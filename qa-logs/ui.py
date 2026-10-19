import json,subprocess,sys,re,time
IDB="/Users/gokul/.idb-venv/bin/idb"
def els():
    out=subprocess.run([IDB,"ui","describe-all","--json"],capture_output=True,text=True).stdout
    try: return json.loads(out)
    except: return [json.loads(l) for l in out.splitlines() if l.strip()]
def show():
    for e in els():
        f=e.get("frame",{}); l=e.get("AXLabel") or ""; v=e.get("AXValue") or ""
        if l or v: print(f'{e.get("type","")[:10]:10} {int(f.get("x",0)):4},{int(f.get("y",0)):4} {int(f.get("width",0)):3}x{int(f.get("height",0)):3} | {l[:70]} | {str(v)[:30]}')
def tap(label,idx=0):
    m=[e for e in els() if label.lower() in (e.get("AXLabel") or "").lower() and 0<=e["frame"]["y"]+e["frame"]["height"]/2<=874]
    if not m: print("NOTFOUND",label); return False
    f=m[min(idx,len(m)-1)]["frame"]; x=f["x"]+f["width"]/2; y=f["y"]+f["height"]/2
    subprocess.run([IDB,"ui","tap",str(int(x)),str(int(y))]); print("tapped",label,int(x),int(y)); return True
cmd=sys.argv[1]
if cmd=="show": show()
elif cmd=="tap": tap(sys.argv[2], int(sys.argv[3]) if len(sys.argv)>3 else 0)
if cmd=="field":
    m=[e for e in els() if e.get("type")=="TextField" or e.get("role")=="AXTextField"]
    f=m[int(sys.argv[2])]["frame"]; subprocess.run([IDB,"ui","tap",str(int(f["x"]+f["width"]-20)),str(int(f["y"]+f["height"]/2))]); print("field",sys.argv[2])
