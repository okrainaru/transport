#!/usr/bin/env python3
"""Одна команда для обновления приложения после правки Excel или остановок:
    python3 build_all.py [raspisanie.xlsx]
1) собирает рейсы и остановки в data.js, 2) достраивает недостающие линии по дорогам
(нужен интернет), 3) собирает data.js ещё раз уже с линиями. Ключ --rebuild перестраивает все линии."""
import subprocess, sys, os
here = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
xlsx = args[0] if args else "raspisanie.xlsx"
flags = [a for a in sys.argv[1:] if a.startswith("--")]
run = lambda *c: subprocess.run([sys.executable, *c], cwd=here, check=True)
run("build_data.py", xlsx)
run("build_geometry.py", *flags)
run("build_data.py", xlsx)
print("\nГотово: загрузите index.html, app.css, app.js, config.js, data.js и папку vendor.")
