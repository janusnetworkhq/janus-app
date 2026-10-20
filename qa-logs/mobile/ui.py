#!/usr/bin/env python3
"""Tiny idb driver: ui.py labels | tap <substr> [nth] | tapxy x y | type <text> | shot <name> | swipe x1 y1 x2 y2 | wait <substr> [sec]"""
import json, os, subprocess, sys, time
SIM = os.environ.get("SIM", "84E914D8-8D64-4A2D-9B0B-73749EDEAA56")
IDB = os.path.expanduser("~/.idb-venv/bin/idb")
OUT = "/Users/gokul/Documents/personal/InnovaX/qa-screenshots/mobile-e2e"
def els():
    raw = subprocess.run([IDB, "ui", "describe-all", "--udid", SIM], capture_output=True, text=True).stdout
    try: d = json.loads(raw)
    except Exception: return []
    res = []
    for e in d:
        l = e.get("AXLabel") or e.get("AXValue") or ""
        f = e["frame"]
        res.append((l, round(f["x"] + f["width"] / 2), round(f["y"] + f["height"] / 2), e.get("type")))
    return res
def find(sub, nth=0):
    m = [e for e in els() if sub.lower() in (e[0] or "").lower()]
    return m[nth] if len(m) > nth else None
cmd, args = sys.argv[1], sys.argv[2:]
if cmd == "labels":
    for e in els():
        if e[0]: print(repr(e[0])[:70], e[1], e[2], e[3])
elif cmd == "tap":
    e = find(args[0], int(args[1]) if len(args) > 1 else 0)
    if not e: print("NOTFOUND", args[0]); sys.exit(3)
    subprocess.run([IDB, "ui", "tap", "--udid", SIM, str(e[1]), str(e[2])]); print("tapped", repr(e[0])[:50], e[1], e[2])
elif cmd == "tapxy":
    subprocess.run([IDB, "ui", "tap", "--udid", SIM, args[0], args[1]])
elif cmd == "type":
    t = args[0]
    for i in range(0, len(t), 2):
        subprocess.run([IDB, "ui", "text", "--udid", SIM, t[i:i+2]]); time.sleep(0.6)
elif cmd == "clear":
    n = int(args[0]) if args else 40
    subprocess.run([IDB, "ui", "key-sequence", "--udid", SIM, *(["42"] * n)])
elif cmd == "swipe":
    subprocess.run([IDB, "ui", "swipe", "--udid", SIM, *args[:4], "--duration", args[4] if len(args) > 4 else "0.4"])
elif cmd == "shot":
    subprocess.run(["xcrun", "simctl", "io", SIM, "screenshot", f"{OUT}/{args[0]}.png"], capture_output=True); print("shot", args[0])
elif cmd == "wait":
    end = time.time() + float(args[1] if len(args) > 1 else 30)
    while time.time() < end:
        if find(args[0]): print("found", args[0]); sys.exit(0)
        time.sleep(1.5)
    print("TIMEOUT", args[0]); sys.exit(4)
