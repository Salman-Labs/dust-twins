"""Dust Twins pipeline: fingerprints -> twins -> method checks -> static files for the web app.

Inputs : data/raw/mars/dustscenario_MY*.nc  (Montabone et al. Mars dust climatology, CC BY-SA 3.0)
         data/raw/earth/YYYYMM.nc4          (NASA MERRA-2 M2TMNXAER DUEXTTAU, monthly, 1999-2022)
Outputs: web/public/data/*.json, *.png      (derived data, CC BY-SA 3.0)

Run: .venv/bin/python pipeline/build.py
Written with SI assistance (Claude). Method and parameters are described in README.md.
"""
import glob
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import xarray as xr
from PIL import Image

ROOT = Path(__file__).parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "web" / "public" / "data"

N = 12                      # bins per year: Earth calendar months, Mars 30-degree Ls bins
STORM_X = 1.5               # a bin is "stormy" when it exceeds this multiple of its own climatology
MIN_DUST = 0.01             # Earth cells with median dust AOD below this get "no dust signal"
WEIGHTS = np.array([0.4, 0.2, 0.2, 0.2])   # season, storminess, haze rank, variability
COMPONENTS = ["season", "storminess", "haze", "variability"]
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# Landing sites, planetocentric lat / east lon. Source: NASA mission pages (verify before submission).
SITES = [
    dict(id="insight", name="InSight", place="Elysium Planitia", lat=4.50, lon=135.62,
         years="2018-2022", cleaning="calm", note="No cleaning events recorded; dust built up until the lander lost power."),
    dict(id="opportunity", name="Opportunity", place="Meridiani Planum", lat=-1.95, lon=354.47,
         years="2004-2018", cleaning="gusty", note="Repeated wind cleaning; ended by the 2018 global dust storm."),
    dict(id="spirit", name="Spirit", place="Gusev Crater", lat=-14.57, lon=175.47,
         years="2004-2010", cleaning="gusty", note="Steady build-up broken by a few large wind-cleaning events."),
    dict(id="perseverance", name="Perseverance", place="Jezero Crater", lat=18.44, lon=77.45,
         years="2021-", cleaning="n/a", note="Nuclear powered; included for comparison."),
    dict(id="curiosity", name="Curiosity", place="Gale Crater", lat=-4.59, lon=137.44,
         years="2012-", cleaning="n/a", note="Nuclear powered; included for comparison."),
]
# The four analog sites the challenge statement asks teams to look beyond: (lat0, lat1, lon0, lon1)
FAMOUS = {"Atacama": (-28, -17, -72, -66), "Iceland": (62, 67, -25, -13),
          "Hawaii": (18, 23, -161, -154), "Antarctica": (-90, -60, -180, 180)}


# ---------- loading ----------

def load_mars(var="cdodtot"):
    """-> X (years, N, 60, 120), reliability (60, 120), lat, lon, year labels."""
    files = sorted(glob.glob(str(RAW / "mars" / "dustscenario_MY*.nc")))
    assert len(files) == 13, f"expected 13 Mars years, found {len(files)}"
    X, rel, labels = [], [], []
    for f in files:
        d = xr.open_dataset(f, decode_times=False)
        b = np.clip((d.Ls.values // (360 / N)).astype(int), 0, N - 1)
        v, r = d[var].values, d.cdodrel.values
        X.append(np.stack([v[b == i].mean(0) for i in range(N)]))
        rel.append(r.mean(0))
        labels.append(int(Path(f).name.split("MY")[1][:2]))
        lat, lon = d.latitude.values, d.longitude.values
    return np.stack(X), np.mean(rel, 0), lat, lon, labels


def load_earth():
    """-> X (24, 12, 91, 144), lat (south first), lon."""
    files = sorted(glob.glob(str(RAW / "earth" / "[12]*.nc4")))
    assert len(files) == 288, f"expected 288 Earth months, found {len(files)}"
    arr = []
    for f in files:
        d = xr.open_dataset(f)
        arr.append(d.DUEXTTAU.values[0])
        lat, lon = d.lat.values, d.lon.values
    X = np.stack(arr).reshape(24, 12, len(lat), len(lon))
    return X, lat, lon


def load_land():
    """Land fraction on the Earth grid (MERRA-2 constants M2C0NXASM); fetched once."""
    f = RAW / "earth" / "land.nc4"
    if not f.exists():
        import earthaccess
        earthaccess.login(strategy="netrc")
        g = earthaccess.search_data(short_name="M2C0NXASM")[0]
        url = next(u["URL"] for u in g["umm"]["RelatedUrls"] if "opendap" in u["URL"].lower())
        ce = ".dap.nc4?dap4.ce=/FRLAND[0:1:0][0:4:360][0:4:575];/FRLANDICE[0:1:0][0:4:360][0:4:575]"
        r = earthaccess.get_requests_https_session().get(url + ce, timeout=180)
        r.raise_for_status()
        f.write_bytes(r.content)
    d = xr.open_dataset(f)
    return d.FRLAND.values[0], d.FRLANDICE.values[0]


def load_wind():
    """Mean monthly surface wind speed 2010-2019 (MERRA-2 M2TMNXFLX SPEED) on the Earth grid."""
    files = sorted(glob.glob(str(RAW / "wind" / "*.nc4")))
    assert len(files) == 120, f"expected 120 wind months, found {len(files)}"
    return np.mean([xr.open_dataset(f).SPEED.values[0] for f in files], 0)


ROVERS = {  # site id -> (file, first Mars year in the record)
    "opportunity": ("1tau880_5106_20181207a.tab", 26),
    "spirit": ("2tau880_2209_20110214a.tab", 26),
    "insight": ("insight_tau.csv", 34),
}


def load_rover(site_id):
    """Rover sky opacity (tau) -> {(mars_year, bin): mean tau}. Mars year advances when Ls wraps."""
    name, my = ROVERS[site_id]
    rows = []
    for line in open(RAW / "rover" / name):
        parts = [x.strip() for x in line.split(",")]
        try:
            ls, tau = (float(parts[3]), float(parts[4])) if name.endswith(".csv") else (float(parts[1]), float(parts[6]))
        except (ValueError, IndexError):
            continue   # header lines
        rows.append((ls, tau))
    # MER tables write the tail of the landing year as negative Ls; normalise, then count wraps.
    out, prev = {}, None
    for ls, tau in rows:
        ls %= 360
        if prev is not None and ls - prev < -180:
            my += 1
        prev = ls
        out.setdefault((my, min(int(ls // (360 / N)), N - 1)), []).append(tau)
    return {k: float(np.mean(v)) for k, v in out.items() if len(v) >= 3}


# ---------- fingerprint ----------

def pct_rank(v, valid):
    """Percentile rank (0..1) of each valid cell's value among valid cells; NaN elsewhere."""
    out = np.full(v.shape, np.nan)
    vals = v[valid]
    out[valid] = vals.argsort().argsort() / max(len(vals) - 1, 1)
    return out


def fingerprint(X, valid):
    """X (years, N, cells...) -> dict of per-cell arrays. All four numbers are ratios or ranks,
    so any constant factor on X (such as the IR-to-visible conversion) cancels out."""
    clim = X.mean(0)
    mean = clim.mean(0)
    shape = clim / mean
    return dict(
        clim=clim, shape=shape,
        storm=(X > STORM_X * clim).mean((0, 1)),
        haze=pct_rank(np.median(X.reshape(-1, *X.shape[2:]), 0), valid),
        var=(X / clim - 1).std((0, 1)),
    )


def at(fp, idx):
    """Pull one cell's fingerprint out of a gridded fingerprint."""
    i, j = idx
    return dict(shape=fp["shape"][:, i, j], storm=fp["storm"][i, j], haze=fp["haze"][i, j],
                var=fp["var"][i, j], clim=fp["clim"][:, i, j])


# ---------- matching ----------

def closeness(a, b, eps=0.01):
    a, b = a + eps, b + eps
    return np.minimum(a, b) / np.maximum(a, b)


def score(site, fp, shape=None):
    """Score every cell of `fp` against one site fingerprint.
    -> components (4, cells...), shift (cells...). np.roll(e, k)[i] == e[i-k], so with shift k
    Mars bin i lines up with Earth month (i-k) % N."""
    e = fp["shape"] if shape is None else shape
    m = site["shape"]
    mz = (m - m.mean()) / m.std()
    ez = (e - e.mean(0)) / np.where(e.std(0) > 0, e.std(0), 1)
    r = np.stack([(mz.reshape(N, *[1] * (e.ndim - 1)) * np.roll(ez, k, 0)).mean(0) for k in range(N)])
    shift = r.argmax(0)
    season = np.clip(r.max(0), 0, 1) * closeness(e.std(0), m.std(), 1e-6)
    comps = np.stack([season, closeness(fp["storm"], site["storm"]),
                      1 - np.abs(fp["haze"] - site["haze"]), closeness(fp["var"], site["var"])])
    return comps, shift


def total(comps, w=WEIGHTS):
    return np.tensordot(w / w.sum(), comps, 1)


def regions(s, lat, lon, n=10, dlat=8, dlon=10):
    """Greedy pick of the n best cells that are not neighbours of an earlier pick."""
    order = np.argsort(np.where(np.isnan(s), -1, s), axis=None)[::-1]
    picks = []
    for flat in order:
        i, j = np.unravel_index(flat, s.shape)
        if np.isnan(s[i, j]):
            break
        if all(abs(lat[i] - lat[a]) > dlat or min(abs(lon[j] - lon[b]), 360 - abs(lon[j] - lon[b])) > dlon
               for a, b in picks):
            picks.append((i, j))
            if len(picks) == n:
                break
    return picks


def spearman(a, b):
    ok = ~np.isnan(a) & ~np.isnan(b)
    ra, rb = a[ok].argsort().argsort(), b[ok].argsort().argsort()
    return float(np.corrcoef(ra, rb)[0, 1])


def top_overlap(a, b, k=50):
    fa = set(np.argsort(np.where(np.isnan(a), -1, a), axis=None)[-k:])
    fb = set(np.argsort(np.where(np.isnan(b), -1, b), axis=None)[-k:])
    return len(fa & fb) / k


# ---------- output helpers ----------

def r3(x):
    return [round(float(v), 3) for v in np.atleast_1d(x)] if np.ndim(x) else round(float(x), 3)


def heat_png(v, path, north_first, lo, hi, rgb=(255, 176, 64)):
    """Equirectangular RGBA overlay: colour fixed, alpha carries the value. NaN -> transparent."""
    t = np.clip((np.nan_to_num(v, nan=lo) - lo) / (hi - lo), 0, 1) ** 0.8
    if not north_first:
        t = t[::-1]
    img = np.zeros((*t.shape, 4), np.uint8)
    img[..., :3] = rgb
    img[..., 3] = (t * 235).astype(np.uint8)
    Image.fromarray(img, "RGBA").save(path)


def atlas_png(clim, path, north_first, rgb):
    """12 monthly haze frames side by side (N columns), alpha = haze relative to the 99th percentile."""
    hi = np.nanpercentile(clim, 99)
    t = np.clip(clim / hi, 0, 1) ** 0.7
    if not north_first:
        t = t[:, ::-1]
    t = np.concatenate(list(t), axis=1)
    img = np.zeros((*t.shape, 4), np.uint8)
    img[..., :3] = rgb
    img[..., 3] = (t * 220).astype(np.uint8)
    Image.fromarray(img, "RGBA").save(path)


def place_names(coords):
    """Nearest town, region and country for each (lat, lon), from an offline gazetteer."""
    import pycountry
    import reverse_geocoder as rg
    out = []
    for r in rg.search(coords, mode=1):
        c = pycountry.countries.get(alpha_2=r["cc"])
        country = getattr(c, "common_name", None) or (c.name if c else r["cc"])
        parts = [r["name"]] + ([r["admin1"]] if r["admin1"] and r["admin1"] != r["name"] else []) + [country]
        out.append(dict(place=", ".join(parts), near=r["name"], region=r["admin1"], country=country))
    return out


def famous(lat, lon):
    for name, (a, b, c, d) in FAMOUS.items():
        if a <= lat <= b and c <= lon <= d:
            return name
    return None


# ---------- main ----------

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(42)

    MX, mrel, mlat, mlon, myears = load_mars("cdodtot")
    MX610 = load_mars("cdod610")[0]
    EX, elat, elon = load_earth()
    frland, frice = load_land()
    wind = load_wind()

    m_all = np.ones(MX.shape[2:], bool)
    mfp, mfp610 = fingerprint(MX, m_all), fingerprint(MX610, m_all)
    land = (frland + frice > 0.5) & (frice < 0.5)
    dusty = np.median(EX.reshape(-1, *EX.shape[2:]), 0) >= MIN_DUST
    e_valid = land & dusty
    efp = fingerprint(EX, e_valid)

    def mask(s):
        return np.where(e_valid, s, np.nan)

    wind_pct = pct_rank(wind, e_valid)   # how windy a cell is among scored land cells

    # self-checks: fingerprints are normalised, and a site scored against itself is a perfect match
    assert np.allclose(mfp["shape"].mean(0), 1) and np.allclose(efp["shape"].mean(0), 1)

    sites_out, evidence = [], dict(sites={})
    for S in SITES:
        lon180 = S["lon"] - 360 if S["lon"] > 180 else S["lon"]
        idx = (int(np.abs(mlat - S["lat"]).argmin()), int(np.abs(mlon - lon180).argmin()))
        site = at(mfp, idx)
        assert abs(total(score(site, mfp)[0])[idx] - 1) < 1e-6, "self-match must score 1"

        comps, shift = score(site, efp)
        s = mask(total(comps))

        # robustness: how often is a cell in the top 50 under random weightings?
        hits = np.zeros(s.shape)
        for w in rng.dirichlet(np.ones(4), 200):
            sw = mask(total(comps, w))
            hits.flat[np.argsort(np.where(np.isnan(sw), -1, sw), axis=None)[-50:]] += 1
        robust = hits / 200

        # check 1: shuffle baseline (scramble each Earth cell's months, keep everything else)
        null_top, null_p99 = [], []
        for _ in range(30):
            sn = mask(total(score(site, efp, rng.permuted(efp["shape"], axis=0))[0]))
            null_top.append(np.nanmax(sn))
            null_p99.append(np.nanpercentile(sn, 99))
        null99 = float(np.mean(null_p99))

        # check 2: split years (odd vs even years on both planets)
        sp = []
        for a in (0, 1):
            mh, eh = fingerprint(MX[a::2], m_all), fingerprint(EX[a::2], e_valid)
            sp.append(mask(total(score(at(mh, idx), eh)[0])))

        # check 3: Mars-to-Mars self test (do the site's own neighbours rank top?)
        sm = total(score(site, mfp)[0])
        nb = [sm[(idx[0] + di) % 60, (idx[1] + dj) % 120] for di in (-1, 0, 1) for dj in (-1, 0, 1) if di or dj]
        nb_pct = float(np.mean([(sm < v).mean() for v in nb]))

        # sensitivity: 610 Pa-normalised dust instead of dust above the real surface
        s610 = mask(total(score(at(mfp610, idx), efp)[0]))

        picks = regions(s, elat, elon)
        names = place_names([(float(elat[i]), float(elon[j])) for i, j in picks])
        dusty_bins = set(np.argsort(site["clim"])[-4:].tolist())   # the site's four dustiest Ls bins
        twins = []
        for (i, j), name in zip(picks, names):
            k = int(shift[i, j])
            e_shape = efp["shape"][:, i, j]
            mars_bin = [(mth + k) % N for mth in range(N)]          # Earth month -> Mars bin it rehearses
            aligned = site["shape"][mars_bin]
            twins.append(dict(
                lat=float(elat[i]), lon=float(elon[j]), **name, famous=famous(elat[i], elon[j]),
                score=r3(s[i, j]), components=dict(zip(COMPONENTS, r3(comps[:, i, j]))),
                shift=k, mars_bin=mars_bin,
                month_match=r3(closeness(e_shape, aligned)),
                test_months=[MONTHS[mth] for mth in range(N) if mars_bin[mth] in dusty_bins],
                clim=r3(efp["clim"][:, i, j]), shape=r3(e_shape),
                storm=r3(efp["storm"][i, j]), haze=r3(efp["haze"][i, j]), var=r3(efp["var"][i, j]),
                robust=r3(robust[i, j]), beats_null=bool(s[i, j] > null99),
                wind=r3(wind[i, j]), wind_pct=r3(wind_pct[i, j]),
                wind_tag="calm" if wind_pct[i, j] < 1 / 3 else "gusty" if wind_pct[i, j] > 2 / 3 else "moderate",
            ))

        # check 4: rover ground truth (the rover's own sky opacity vs the orbital record at its cell)
        ground = None
        if S["id"] in ROVERS:
            rv = load_rover(S["id"])
            pairs = [(my, b, tau, float(MX[myears.index(my), b, idx[0], idx[1]])) for (my, b), tau in sorted(rv.items()) if my in myears]
            ground = dict(n=len(pairs), r=r3(np.corrcoef([p[2] for p in pairs], [p[3] for p in pairs])[0, 1]),
                          pairs=[dict(my=p[0], bin=p[1], rover=round(p[2], 3), orbit=round(p[3], 3)) for p in pairs])

        hi = float(np.nanmax(s))
        heat_png(s, OUT / f"score_{S['id']}.png", north_first=False, lo=null99, hi=hi)
        json.dump(dict(site=S["id"], twins=twins, scale=dict(lo=r3(null99), hi=r3(hi))),
                  open(OUT / f"twins_{S['id']}.json", "w"))

        sites_out.append(dict(
            **S, cell=dict(lat=float(mlat[idx[0]]), lon=float(mlon[idx[1]])),
            clim=r3(site["clim"]), shape=r3(site["shape"]), storm=r3(site["storm"]),
            haze=r3(site["haze"]), var=r3(site["var"]), reliability=r3(mrel[idx]),
            mars_years=myears, series=[r3(y) for y in MX[:, :, idx[0], idx[1]]],
        ))
        evidence["sites"][S["id"]] = dict(
            top_score=r3(hi), top10_mean=r3(np.mean([t["score"] for t in twins])),
            shuffle=dict(null_p99=r3(null99), null_best=r3(np.mean(null_top)),
                         cells_above_null=int((s > null99).sum()), cells_scored=int(e_valid.sum()),
                         top10_above_null=int(sum(t["beats_null"] for t in twins))),
            split_years=dict(spearman=r3(spearman(sp[0], sp[1])), top50_overlap=r3(top_overlap(sp[0], sp[1]))),
            mars_self_test=dict(neighbour_percentile=r3(nb_pct)),
            pressure_sensitivity=dict(spearman=r3(spearman(s, s610)), top50_overlap=r3(top_overlap(s, s610))),
            famous_in_top10=int(sum(t["famous"] is not None for t in twins)),
            rover=ground,
        )
        print(f"\n{S['name']:13s} top={hi:.3f} null99={null99:.3f} split_rho={evidence['sites'][S['id']]['split_years']['spearman']}"
              f" self={nb_pct:.3f} rover_r={ground and ground['r']} p610_rho={evidence['sites'][S['id']]['pressure_sensitivity']['spearman']}")
        for t in twins[:5]:
            print(f"   {t['score']:.3f}  shift={t['shift']:2d}  robust={t['robust']:.2f}  {t['place']}  wind={t['wind_tag']}  test: {','.join(t['test_months'])}")

    evidence["meta"] = dict(
        generated=datetime.now(timezone.utc).isoformat(timespec="seconds"), bins=N, storm_multiple=STORM_X,
        weights=dict(zip(COMPONENTS, WEIGHTS.tolist())), earth_years="1999-2022", mars_years=f"MY{myears[0]}-MY{myears[-1]}",
        earth_cells_scored=int(e_valid.sum()), earth_grid="2.5 x 2 deg (subsampled)", mars_grid="3 x 3 deg",
        mars_variable="cdodtot (column dust optical depth above the local surface)",
    )
    json.dump(evidence, open(OUT / "evidence.json", "w"), indent=1)
    json.dump(dict(sites=sites_out, months=MONTHS), open(OUT / "mars_sites.json", "w"))
    atlas_png(mfp["clim"], OUT / "haze_mars.png", north_first=True, rgb=(255, 214, 170))
    atlas_png(np.where(land, efp["clim"], efp["clim"] * 0.6), OUT / "haze_earth.png", north_first=False, rgb=(240, 200, 140))
    print(f"\nwrote {len(list(OUT.iterdir()))} files to {OUT}")


if __name__ == "__main__":
    sys.exit(main())
