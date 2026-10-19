#!/usr/bin/env python3
"""Find, create, boot, or reset the JANUS iPhone Simulator.

Avoids `simctl list -j` and `bootstatus -b` — both stall for minutes on a
first iOS 26 boot while LaunchServices migrates (and can exit failed even
when the device is already Booted).
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import time

DEVICE_TYPES = {
    "iPhone 17": "com.apple.CoreSimulator.SimDeviceType.iPhone-17",
    "iPhone 17 Pro": "com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro",
    "iPhone 17 Pro Max": "com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max",
    "iPhone 17e": "com.apple.CoreSimulator.SimDeviceType.iPhone-17e",
    "iPhone 16 Pro": "com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro",
    "iPhone 16": "com.apple.CoreSimulator.SimDeviceType.iPhone-16",
}

DEVICE_LINE = re.compile(
    r"^\s+(.+?) \(([0-9A-F-]{36})\) \((Booted|Shutdown|Creating|Booting)\)",
    re.I,
)
RUNTIME_LINE = re.compile(
    r"^(iOS \S+) \([^)]+\) - (com\.apple\.CoreSimulator\.SimRuntime\.\S+)"
)


def log(msg: str) -> None:
    print(f"[janus] {msg}", file=sys.stderr)


def simctl(*args: str, timeout: int = 25, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["xcrun", "simctl", *args],
        text=True,
        capture_output=True,
        timeout=timeout,
        check=check,
    )


def iter_devices() -> list[tuple[str, str, str]]:
    """Return (name, udid, state) for available simulators."""
    try:
        raw = simctl("list", "devices", timeout=25).stdout
    except subprocess.TimeoutExpired:
        raise SystemExit("simctl list devices timed out")
    out: list[tuple[str, str, str]] = []
    for line in raw.splitlines():
        if "unavailable" in line.lower():
            continue
        m = DEVICE_LINE.match(line)
        if not m:
            continue
        out.append((m.group(1), m.group(2), m.group(3)))
    return out


def names_equal(name: str, want: str) -> bool:
    n, w = name.lower(), want.lower()
    return n == w or n == f"janus {w}"


def find_udid(want: str) -> str | None:
    janus = exact = None
    for name, udid, _state in iter_devices():
        if name.lower() == f"janus {want.lower()}":
            janus = udid
            break
        if name.lower() == want.lower():
            exact = udid
    return janus or exact


def latest_ios_runtime() -> str:
    try:
        raw = simctl("list", "runtimes", timeout=20).stdout
    except subprocess.TimeoutExpired:
        raise SystemExit("simctl list runtimes timed out")
    found: list[tuple[str, str]] = []
    for line in raw.splitlines():
        if "unavailable" in line.lower():
            continue
        m = RUNTIME_LINE.match(line.strip())
        if m:
            found.append((m.group(1), m.group(2)))
    if not found:
        raise SystemExit("No iOS Simulator runtime. Xcode → Settings → Platforms → iOS")
    found.sort(key=lambda r: r[0], reverse=True)
    return found[0][1]


def create(want: str) -> str:
    dtype = DEVICE_TYPES.get(want)
    if not dtype:
        raise SystemExit(f"Unknown device '{want}'. Use one of: {', '.join(DEVICE_TYPES)}")
    existing = find_udid(want)
    if existing:
        return existing
    runtime = latest_ios_runtime()
    name = f"JANUS {want}"
    log(f"Creating simulator {name}")
    try:
        udid = simctl("create", name, dtype, runtime, timeout=60).stdout.strip()
    except subprocess.CalledProcessError as exc:
        raise SystemExit(exc.stderr.strip() or f"simctl create failed for {name}") from exc
    if not udid:
        raise SystemExit("simctl create returned an empty UDID")
    return udid


def is_booted(udid: str) -> bool:
    try:
        r = simctl("getenv", udid, "SIMULATOR_UDID", timeout=8, check=False)
    except subprocess.TimeoutExpired:
        return False
    return r.returncode == 0 and udid.lower() in (r.stdout or "").lower()


def device_state(udid: str) -> str:
    for _name, du, state in iter_devices():
        if du.lower() == udid.lower():
            return state
    return "Missing"


def springboard_ready(udid: str) -> bool:
    try:
        r = subprocess.run(
            ["xcrun", "simctl", "launch", udid, "com.apple.springboard"],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return False
    if r.returncode == 0:
        return True
    err = (r.stderr or "") + (r.stdout or "")
    return "already running" in err.lower() or "is running" in err.lower()


def wait_boot(udid: str, timeout: int) -> None:
    subprocess.run(["xcrun", "simctl", "boot", udid], capture_output=True, timeout=30, check=False)
    subprocess.run(
        ["open", "-a", "Simulator", "--args", "-CurrentDeviceUDID", udid],
        capture_output=True,
        timeout=20,
        check=False,
    )
    deadline = time.time() + timeout
    booted_at: float | None = None
    while time.time() < deadline:
        if is_booted(udid):
            if booted_at is None:
                booted_at = time.time()
                log(f"Simulator booted {udid} — waiting for SpringBoard")
            if springboard_ready(udid):
                log("SpringBoard ready")
                time.sleep(1)
                return
        time.sleep(2)
    state = device_state(udid)
    if is_booted(udid) or state == "Booted":
        log(f"Simulator booted {udid} (SpringBoard still settling)")
        return
    raise SystemExit(
        f"Simulator {udid} did not boot within {timeout}s (state={state}). "
        "Try: make reset-ios && make ios"
    )


def reset_device(want: str) -> str:
    udid = find_udid(want) or create(want)
    log(f"Erasing {want} {udid}")
    simctl("shutdown", udid, timeout=40, check=False)
    try:
        simctl("erase", udid, timeout=60)
    except subprocess.CalledProcessError as exc:
        raise SystemExit(exc.stderr.strip() or "simctl erase failed") from exc
    return udid


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "cmd",
        nargs="?",
        default="find",
        choices=["find", "wait", "state", "reset"],
    )
    parser.add_argument("target", nargs="*", default=[])
    parser.add_argument(
        "--timeout",
        type=int,
        default=int(os.environ.get("BOOT_TIMEOUT", "120")),
    )
    args = parser.parse_args()
    want = " ".join(args.target).strip()

    if args.cmd == "find":
        want = want or "iPhone 17"
        print(find_udid(want) or create(want))
        return
    if args.cmd == "wait":
        if not want:
            raise SystemExit("wait requires a UDID")
        wait_boot(want, args.timeout)
        return
    if args.cmd == "state":
        if not want:
            raise SystemExit("state requires a UDID")
        print("Booted" if is_booted(want) else device_state(want))
        return
    if args.cmd == "reset":
        want = want or "iPhone 17"
        print(reset_device(want))


if __name__ == "__main__":
    main()
