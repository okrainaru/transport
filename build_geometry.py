#!/usr/bin/env python3
"""Автоматически строит линии рейсов по дорогам и пишет их в routes_geometry.json.

Запуск (нужен интернет):
  python3 build_geometry.py              # достроить только недостающие линии
  python3 build_geometry.py --rebuild    # перестроить все линии
  python3 build_geometry.py --route 478  # только рейсы одного маршрута
Потом:  python3 build_data.py raspisanie.xlsx   (линии попадут в data.js)

Как это работает
  * Каждый рейс строится ОДНИМ запросом ко всем своим остановкам по порядку
    (а не по парам), с запретом разворота на остановке (continue_straight).
    Так линия идёт так, как едет автобус, а не по кратчайшему пути между соседними остановками.
  * route_via.json — ручные промежуточные точки для трудных участков:
      {"ост. Обухово→ст. Электроугли": [[55.80, 38.25], [55.76, 38.22]]}
    (ключ «откуда→куда» как в routes_geometry.json, точки [широта, долгота]).
  * Участки, где линия длиннее прямой более чем в 2,5 раза, помечаются в отчёте:
    для них добавьте точки в route_via.json и запустите с --rebuild.
  * Свой сервер OSRM: переменная OSRM=http://localhost:5000
"""
import sys, os, json, math, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OSRM = os.environ.get("OSRM", "https://router.project-osrm.org").rstrip("/")
RATIO_WARN = 2.5


def load_json(name, default):
    p = os.path.join(HERE, name)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else default


def load_data():
    s = open(os.path.join(HERE, "data.js"), encoding="utf-8").read()
    return json.loads(s[s.index("{"): s.rindex("}") + 1])


def hav(a, b):
    R = 6371000
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    n = math.hypot(dx, dy) or 1e-12
    dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        d = abs(dy * (pts[i][0] - x1) - dx * (pts[i][1] - y1)) / n
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return rdp(pts[: idx + 1], eps)[:-1] + rdp(pts[idx:], eps)
    return [pts[0], pts[-1]]


def osrm_route(wps, kinds=None):
    coords = ";".join(f"{lon},{lat}" for lat, lon in wps)
    url = (f"{OSRM}/route/v1/driving/{coords}?overview=false&steps=true"
           f"&geometries=geojson&continue_straight=true")
    extra = ("&approaches=" + ";".join("curb" if k else "unrestricted" for k in kinds)) if kinds else ""
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url + (extra if attempt < 2 else ""), headers={"User-Agent": "busapp-mini"}), timeout=40) as r:
                j = json.load(r)
            if j.get("code") == "Ok":
                return j["routes"][0]["legs"]
            err = j.get("code")
        except Exception as e:
            err = str(e)
        time.sleep(2 * (attempt + 1))
    print("   ошибка запроса:", err)
    return None


def main():
    rebuild = "--rebuild" in sys.argv
    only = sys.argv[sys.argv.index("--route") + 1] if "--route" in sys.argv else None
    D = load_data()
    xy = {s["name"]: (s["lat"], s["lon"]) for s in D["stops"] if s.get("lat") is not None}
    geom = load_json("routes_geometry.json", {})
    via = load_json("route_via.json", {})
    okl = set(load_json("route_confirmed.json", []))
    built, warn, failed = set(), [], 0
    hubs = {s["name"] for s in D["stops"] if s.get("hub")}

    work = []
    for t in D["trips"]:
        if only and t["route"] != only:
            continue
        seq = []
        for s in t["stops"]:
            if s["stop"] in xy and (not seq or seq[-1] != s["stop"]):
                seq.append(s["stop"])
        cur = seq[:1]
        for i in range(1, len(seq)):
            cur.append(seq[i])
            if seq[i] in hubs and i < len(seq) - 1:   # узловая остановка в середине рейса: строим отдельно, без петли
                work.append(cur); cur = [seq[i]]
        if len(cur) > 1:
            work.append(cur)
    for names in work:
        pairs = list(zip(names, names[1:]))
        need = [p for p in pairs if f"{p[0]}→{p[1]}" not in built and (rebuild or f"{p[0]}→{p[1]}" not in geom)]
        if len(names) < 2 or not need:
            continue
        wps, is_stop = [xy[names[0]]], [names[0]]
        for a, b in pairs:
            for v in via.get(f"{a}→{b}", []):
                wps.append(tuple(v)); is_stop.append(None)
            wps.append(xy[b]); is_stop.append(b)
        print(f"{names[0]} → {names[-1]}: {len(names)} остановок")
        legs = osrm_route(wps, [x is not None and x not in hubs for x in is_stop])
        time.sleep(1.1)
        if not legs or len(legs) != len(wps) - 1:
            failed += 1
            continue
        prev, acc = names[0], []
        for k, leg in enumerate(legs):
            for st in leg["steps"]:
                acc += [(c[1], c[0]) for c in st["geometry"]["coordinates"]]
            nm = is_stop[k + 1]
            if nm is None:
                continue
            key = f"{prev}→{nm}"
            line = rdp(acc, 0.00003)
            if key not in built and (rebuild or key not in geom):
                geom[key] = [[round(a, 5), round(b, 5)] for a, b in line]
                built.add(key)
                length = sum(hav(line[i], line[i + 1]) for i in range(len(line) - 1))
                straight = hav(xy[prev], xy[nm]) or 1
                if length / straight > RATIO_WARN and length > 1500 and key not in okl:
                    warn.append(f"  {key}: {length/1000:.1f} км по дороге при {straight/1000:.1f} км по прямой")
            prev, acc = nm, []

    json.dump(geom, open(os.path.join(HERE, "routes_geometry.json"), "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))
    print(f"\nПостроено линий: {len(built)}, всего в файле: {len(geom)}, неудачных рейсов: {failed}")
    if warn:
        print("Проверьте на карте (возможен крюк), при необходимости добавьте точки в route_via.json:")
        print("\n".join(warn))
    print("Дальше: python3 build_data.py raspisanie.xlsx")


if __name__ == "__main__":
    main()
