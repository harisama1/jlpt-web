#!/usr/bin/env python3
"""Run tests/<page>.html in ONE headless Firefox (snap) with a timeout and print the report it POSTs to /__result.
usage: python3 tests/run_browser_test.py quiz|routes [timeout_s]   (serves this repo on :8765; Firefox killed by PID)"""
import sys, os, time, threading, subprocess, http.server, socketserver, signal
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PAGE = sys.argv[1] if len(sys.argv) > 1 else 'quiz'
TMO = int(sys.argv[2]) if len(sys.argv) > 2 else 90; PROF = os.path.expanduser('~/snap/firefox/common/fftest/prof'); result = []
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
    def do_POST(s):
        n = int(s.headers.get('Content-Length', 0)); result.append(s.rfile.read(n).decode('utf-8', 'replace'))
        s.send_response(200); s.end_headers()
    def do_GET(s):
        if s.path.startswith('/__slow'):
            time.sleep(min(30, int(s.path.split('?')[-1] or 5))); s.send_response(404); s.end_headers(); return
        super().do_GET()
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 8765), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
PROF = PROF + '_%d' % int(time.time()); os.makedirs(PROF, exist_ok=True)   # fresh profile: a stuck old one can't lock us out
SHOT = os.path.join(os.path.dirname(PROF), 'last_%s.png' % PAGE)
# --screenshot: Firefox exits by itself once the page has loaded (the test page holds its load with /__slow until done)
ff = subprocess.Popen(['firefox', '--headless', '--no-remote', '--profile', PROF, '--screenshot', SHOT, 'http://127.0.0.1:8765/tests/%s.html' % PAGE],
                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(2)
try: scope = next((l.rsplit('/', 1)[-1].strip() for l in open('/proc/%d/cgroup' % ff.pid) if '.scope' in l), None)
except Exception: scope = None
t0 = time.time()
while not result and time.time() - t0 < TMO and ff.poll() is None: time.sleep(0.5)
time.sleep(1)
if ff.poll() is None and scope:                    # snap Firefox ignores kill (AppArmor): stop its systemd scope instead
    subprocess.run(['systemctl', '--user', 'stop', scope], capture_output=True)
srv.shutdown()
subprocess.run(['rm', '-rf', PROF])
print(result[0] if result else 'NO RESULT within %d s' % TMO)
