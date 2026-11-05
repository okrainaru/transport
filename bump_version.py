#!/usr/bin/env python3
"""Меняет номер версии ?v=... у файлов в index.html, чтобы телефоны не показывали старый кэш.
Запускать после замены data.js или других файлов:  python3 bump_version.py"""
import os, re, time
p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.html")
v = time.strftime("%Y%m%d%H%M")
s = open(p, encoding="utf-8").read()
s2 = re.sub(r"\?v=[0-9a-z]+", "?v=" + v, s)
open(p, "w", encoding="utf-8").write(s2)
print("версия:", v)
