#!/usr/bin/env python3
"""Превращает Excel-расписание в data.js для мини-приложения.

Запуск:  python3 build_data.py расписание.xlsx
Результат: data.js (рядом со скриптом).

Необязательные файлы рядом со скриптом (их даёт режим администратора index.html?edit=1):
  stops_coords.json     — координаты остановок
  routes_geometry.json  — линии рейсов по дорогам
"""
import sys, re, json, os, datetime
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
ENTERPRISE = "МПЗ Богородский"

# Цвет заливки ячейки со временем -> тип времени (по легенде в самой таблице)
KIND_BY_FILL = {"FFFFC000": "exact",   # точное время отправления
                "FF92D050": "rc",      # рейс для сотрудников РЦ
                "FFFFFF00": "demand"}  # рейс по требованию (при наличии пассажиров)

# Тройки колонок: (время, остановка)
COLUMN_PAIRS = [(2, 3), (5, 6), (8, 9)]

# Пояснения в скобках, которые описывают рейс, а не саму остановку
NOTE_PATTERNS = [(r"\s*\(по объездной дороге\)", "по объездной дороге"),
                 (r"\s*\(через пос\.\s*Монино\)", "через пос. Монино")]


# Разные названия одной и той же остановки в таблице -> одно имя
ALIASES = {
    "Ногинск - (ост. Магазин №50)": "Ногинск - Пятачок",
    'Ногинск - пос. Октября (остановка "ДК")': 'Ногинск - пос. Октября (остановка "дк" в сторону "Пушки")',
    "Кудиново (новые дома)": "Кудиново",
}


def norm_name(raw):
    s = re.sub(r"\s+", " ", str(raw)).strip()
    note = None
    for pat, text in NOTE_PATTERNS:
        if re.search(pat, s):
            s = re.sub(pat, "", s).strip()
            note = text
    s = re.sub(r"^г\.\s*", "", s)
    s = re.sub(r"\s+-\s*|\s*-\s+", " - ", s)         # «Электросталь -Поворот» -> «Электросталь - Поворот»; «Лосино-Петровский» не трогаем
    s = re.sub(r"^Ногинск - \(Автовокзал\)", "Ногинск (Автовокзал)", s)
    s = re.sub(r"\)\s*В СТОРОНУ ФРЯЗЕВО$", ") (в сторону Фрязево)", s)
    s = re.sub(r"\s*В СТОРОНУ ФРЯЗЕВО$", " (в сторону Фрязево)", s)
    s = s.replace("Электросталь - Машиностроитель (Эльград)", "Электросталь - Машиностроитель (Эльград)")
    s = s.replace("(Эльград) (в сторону", "(Эльград) (в сторону")
    s = re.sub(r"\s*\(остановка из Ногинска\)", "", s)    # дубли одной и той же остановки
    s = re.sub(r"\s+", " ", s).replace(" )", ")").strip()
    s = ALIASES.get(s, s)
    return s, note


def fill_kind(cell):
    fl = cell.fill
    if fl is None or fl.fill_type is None:
        return "approx"
    fg = fl.fgColor
    if fg.type == "rgb":
        return KIND_BY_FILL.get(fg.rgb, "approx")
    return "approx"


def parse_title(text):
    m = re.match(r"Маршрут\s+(\d+)\s+(Утро|Вечер)\s*\((.*?)\)", text.strip(), re.I)
    if not m:
        return None
    route, part, d = m.group(1), m.group(2).lower(), m.group(3).upper()
    days = "sat" if "СУББОТА" in d and "КРОМЕ" not in d else ("exceptSat" if "КРОМЕ" in d else "daily")
    return route, ("morning" if part == "утро" else "evening"), days


def parse_blocks(ws):
    blocks = []
    for tc, nc in COLUMN_PAIRS:
        cur, gap = None, 0
        for r in range(1, ws.max_row + 1):
            tv, nv = ws.cell(r, tc).value, ws.cell(r, nc).value
            if isinstance(tv, str) and tv.strip().startswith("Маршрут"):
                info = parse_title(tv)
                cur = {"info": info, "entries": []} if info else None
                if cur: blocks.append(cur)
                gap = 0
                continue
            if cur is None:
                continue
            if nv is None or not str(nv).strip():
                gap += 1
                if gap >= 2 and cur["entries"]:
                    cur = None
                continue
            gap = 0
            t = tv if isinstance(tv, datetime.time) else None
            name, note = norm_name(nv)
            kind = fill_kind(ws.cell(r, tc)) if t else "demand"
            cur["entries"].append({"name": name, "time": t.strftime("%H:%M") if t else None,
                                   "kind": kind if t else "demand", "note": note})
    return blocks


def split_trips(entries):
    is_mpz = lambda e: e["name"] == ENTERPRISE
    trips, cur = [], []
    for i, e in enumerate(entries):
        if is_mpz(e):
            if not cur:
                cur = [e]
            else:
                cur.append(e)
                trips.append(cur)
                nxt = entries[i + 1] if i + 1 < len(entries) else None
                cur = [e] if (nxt and not is_mpz(nxt)) else []
        else:
            cur.append(e)
    if len(cur) > 1:
        trips.append(cur)
    return trips


def main(xlsx):
    ws = openpyxl.load_workbook(xlsx).worksheets[0]
    coords_path = os.path.join(HERE, "stops_coords.json")
    coords = json.load(open(coords_path, encoding="utf-8")) if os.path.exists(coords_path) else {}
    queries = json.load(open(os.path.join(HERE, "stops_queries.json"), encoding="utf-8"))

    nums_path = os.path.join(HERE, "stop_numbers.json")
    nums = json.load(open(nums_path, encoding="utf-8")) if os.path.exists(nums_path) else {}
    hubs_path = os.path.join(HERE, "stop_hubs.json")
    hubs = set(json.load(open(hubs_path, encoding="utf-8"))) if os.path.exists(hubs_path) else set()
    trips_out, stop_names, n = [], [], 0
    order = {}
    for b in parse_blocks(ws):
        route, part, days = b["info"]
        for stops in split_trips(b["entries"]):
            n += 1
            timed = [s["time"] for s in stops if s["time"]]
            kinds = {s["kind"] for s in stops}
            trip_kind = "rc" if "rc" in kinds else ("demand" if "demand" in kinds and not any(s["kind"] == "exact" for s in stops) else None)
            trips_out.append({
                "id": f"t{n}", "route": route, "part": part, "days": days,
                "start": timed[0], "end": timed[-1],
                "rc": "rc" in kinds,
                "stops": [{"stop": s["name"], "time": s["time"], "kind": s["kind"], **({"note": s["note"]} if s["note"] else {})} for s in stops],
            })
            for s in stops:
                if s["name"] not in order:
                    order[s["name"]] = len(order)
    # Ручные поправки к рейсам (trip_overrides.json): заменяют остановки рейса,
    # найденного по маршруту, части дня, дням и времени отправления.
    ov_path = os.path.join(HERE, "trip_overrides.json")
    for o in (json.load(open(ov_path, encoding="utf-8")) if os.path.exists(ov_path) else []):
        for t in trips_out:
            if (t["route"], t["part"], t["days"], t["start"]) == (o["route"], o["part"], o["days"], o["start"]):
                t["stops"] = o["stops"]
                t["start"], t["end"] = o["stops"][0]["time"], o["stops"][-1]["time"]
                for st in o["stops"]:
                    if st["stop"] not in order:
                        order[st["stop"]] = len(order)
                break
        else:
            print("поправка не нашла рейс:", o["route"], o["part"], o["days"], o["start"])
    trips_out.sort(key=lambda t: (t["route"], t["part"] != "morning", t["start"]))

    stops_out = []
    for name in sorted(order, key=lambda x: order[x]):
        c = coords.get(name) or {}
        item = {"name": name, "query": queries.get(name, name),
                "lat": c.get("lat"), "lon": c.get("lon")}
        if name in nums:
            item["num"] = nums[name]
        if name in hubs:
            item["hub"] = True
        stops_out.append(item)
    geom_path = os.path.join(HERE, "routes_geometry.json")
    geom = json.load(open(geom_path, encoding="utf-8")) if os.path.exists(geom_path) else {}
    ok_path = os.path.join(HERE, "route_confirmed.json")
    okl = json.load(open(ok_path, encoding="utf-8")) if os.path.exists(ok_path) else []
    data = {"enterprise": ENTERPRISE, "built": datetime.date.today().isoformat(),
            "stops": stops_out, "trips": trips_out, "geom": geom, "okLegs": okl}
    with open(os.path.join(HERE, "data.js"), "w", encoding="utf-8") as f:
        # индент только для рейсов и остановок; линии по дорогам — компактно
        geom_s = json.dumps(data.pop("geom"), ensure_ascii=False, separators=(",", ":"))
        body = json.dumps(data, ensure_ascii=False, indent=1)
        f.write("window.BUS_DATA = " + body[:-2] + ',\n "geom": ' + geom_s + "\n};\n")
    missing = [s["name"] for s in stops_out if s["name"] not in queries]
    print(f"рейсов: {len(trips_out)}, остановок: {len(stops_out)}")
    if missing:
        print("нет строки поиска для:", *missing, sep="\n  ")


if __name__ == "__main__":
    main(sys.argv[1])
