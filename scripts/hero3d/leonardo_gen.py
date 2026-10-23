"""Leonardo helper (from the leonardo-visuals skill). The key comes ONLY from the LEONARDO_API_KEY
environment variable: it is never written to a file or printed.

  python leonardo_gen.py me
  python leonardo_gen.py gen "prompt" -o out.png [--size 1024x1024] [--quality LOW|MEDIUM|HIGH]
"""
import argparse
import json
import os
import pathlib
import sys
import time

import requests

BASE = "https://cloud.leonardo.ai/api/rest"
MODEL = "openai/gpt-image-2.5-sunburst"
COST = 0.045  # USD per Medium image (estimate)
KEY = os.environ.get("LEONARDO_API_KEY", "").strip() or sys.exit("Set LEONARDO_API_KEY first.")
H = {"authorization": f"Bearer {KEY}", "accept": "application/json", "content-type": "application/json"}


def call(method, path, **kw):
    r = requests.request(method, BASE + path, headers=H, timeout=120, **kw)
    if not r.ok:
        sys.exit(f"HTTP {r.status_code} on {path}: {r.text[:500]}")
    return r.json()


def generate(prompt, size, quality):
    w, h = (int(x) for x in size.lower().split("x"))
    params = {"prompt": prompt, "width": w, "height": h, "quantity": 1, "quality": quality}
    gid = call("POST", "/v2/generations", json={"model": MODEL, "public": False, "parameters": params})["generate"]["generationId"]
    for _ in range(90):
        time.sleep(4)
        g = call("GET", f"/v1/generations/{gid}")["generations_by_pk"]
        if g["status"] == "COMPLETE":
            return [i["url"] for i in g["generated_images"]]
        if g["status"] == "FAILED":
            sys.exit("Generation failed.")
    sys.exit("Timed out.")


ap = argparse.ArgumentParser()
sub = ap.add_subparsers(dest="cmd", required=True)
sub.add_parser("me")
p = sub.add_parser("gen")
p.add_argument("prompt")
p.add_argument("-o", "--out", required=True)
p.add_argument("--size", default="1024x1024")
p.add_argument("--quality", default="MEDIUM")
a = ap.parse_args()
if a.cmd == "me":
    d = call("GET", "/v1/me")["user_details"][0]
    print("username:", d["user"]["username"], "| API credits:", d.get("apiPaidTokens"))
else:
    for i, u in enumerate(generate(a.prompt, a.size, a.quality)):
        out = pathlib.Path(a.out)
        out = out if i == 0 else out.with_name(f"{out.stem}_{i + 1}{out.suffix}")
        out.write_bytes(requests.get(u, timeout=300).content)
        print("saved", out, "| est. cost ~$%.3f" % COST)
