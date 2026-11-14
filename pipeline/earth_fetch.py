"""Pull monthly MERRA-2 dust AOD (DUEXTTAU), 1999-2022, subsampled to 2.5 x 2 degrees.

Source: NASA GES DISC, collection M2TMNXAER v5.12.4, via OPeNDAP. Needs an Earthdata login in ~/.netrc.
Written with SI assistance (Claude).
"""
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import earthaccess

OUT = Path(__file__).parent.parent / "data" / "raw" / "earth"
# ponytail: stride 4 subsamples the 0.625 x 0.5 grid rather than area-averaging it.
# Fine for monthly means of a smooth field; switch to block averaging if cells look noisy.
CE = ".dap.nc4?dap4.ce=/DUEXTTAU[0:1:0][0:4:360][0:4:575];/lat[0:4:360];/lon[0:4:575]"


WIND_CE = ".dap.nc4?dap4.ce=/SPEED[0:1:0][0:4:360][0:4:575];/SPEEDMAX[0:1:0][0:4:360][0:4:575]"


def main(short="M2TMNXAER", CE=CE, OUT=OUT, span=("1999-01-01", "2022-12-31"), expected=288):
    OUT.mkdir(parents=True, exist_ok=True)
    earthaccess.login(strategy="netrc")
    granules = earthaccess.search_data(short_name=short, temporal=span)
    session = earthaccess.get_requests_https_session()

    def fetch(g):
        url = next(u["URL"] for u in g["umm"]["RelatedUrls"] if "opendap" in u["URL"].lower())
        yyyymm = url.rsplit(".", 2)[-2]  # ...tavgM_2d_aer_Nx.201806.nc4
        dest = OUT / f"{yyyymm}.nc4"
        if dest.exists() and dest.stat().st_size > 10_000:
            return yyyymm, "skip"
        for _ in range(3):
            r = session.get(url + CE, timeout=180)
            if r.status_code == 200 and len(r.content) > 10_000:
                dest.write_bytes(r.content)
                return yyyymm, "ok"
        return yyyymm, f"FAILED {r.status_code}"

    with ThreadPoolExecutor(6) as pool:
        results = list(pool.map(fetch, granules))
    failed = [r for r in results if r[1].startswith("FAILED")]
    print(f"{len(results)} granules, {len(failed)} failed", failed)
    assert len(results) == expected, f"expected {expected} months, got {len(results)}"
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    if sys.argv[1:] == ["wind"]:   # monthly surface wind speed, 2010-2019, for the cleaning-wind tag
        main("M2TMNXFLX", WIND_CE, OUT.parent / "wind", ("2010-01-01", "2019-12-31"), 120)
    else:
        main()
