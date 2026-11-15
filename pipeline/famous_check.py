"""Where do the famous analog sites land under our method? Adds `famous_sites` to evidence.json.

Reads only files build.py already publishes, so it runs without the raw NASA downloads:
  regimes_earth.png  is drawn on exactly the scored Earth cells (dusty, ice-free land), so alpha > 0 means "scored".
  score_<site>.png   has alpha = 0 at or below the scrambled-seasons line (null_p99), and alpha > 0 above it.
Alpha is stored as an integer, so a cell within about 0.1% of the plotted range above the line also reads as 0.
The counts are checked against evidence.json before anything is written.
Written with SI assistance (Claude).
"""
import ast
import json
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).parent
DATA = HERE.parent / "web" / "public" / "data"
# FAMOUS is read from build.py as a literal, so the boxes have one source and xarray is not needed here
FAMOUS = next(ast.literal_eval(n.value) for n in ast.parse((HERE / "build.py").read_text()).body
              if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", None) == "FAMOUS")
LAT = 90 - 2.0 * np.arange(91)          # Earth grid, north first, as the PNGs are saved
LON = -180 + 2.5 * np.arange(144)


def alpha(name):
    return np.asarray(Image.open(DATA / name).convert("RGBA"))[..., 3]


def main():
    ev = json.load(open(DATA / "evidence.json"))
    scored = alpha("regimes_earth.png") > 0
    sites = [s["id"] for s in json.load(open(DATA / "mars_sites.json"))["sites"]]
    above = {sid: alpha(f"score_{sid}.png") > 0 for sid in sites}

    # the maps must agree with the numbers build.py wrote
    for sid, a in above.items():
        sh = ev["sites"][sid]["shuffle"]
        assert scored.sum() == sh["cells_scored"], sid
        assert abs(int(a.sum()) - sh["cells_above_null"]) <= 3, sid

    out = []
    for name, (la0, la1, lo0, lo1) in FAMOUS.items():
        box = (LAT[:, None] >= la0) & (LAT[:, None] <= la1) & (LON[None, :] >= lo0) & (LON[None, :] <= lo1)
        out.append(dict(name=name, cells=int(box.sum()), scored=int((box & scored).sum()),
                        above_baseline={sid: int((box & a).sum()) for sid, a in above.items()}))
    ev["famous_sites"] = out
    json.dump(ev, open(DATA / "evidence.json", "w"), indent=1)
    for f in out:
        print(f"{f['name']:11s} cells={f['cells']:5d} scored={f['scored']:3d} above_baseline={f['above_baseline']}")


if __name__ == "__main__":
    main()
