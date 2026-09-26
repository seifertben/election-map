#!/usr/bin/env python3
"""Regenerate scripts/party/ces2024_party.json from the CES 2024 common content.

The 184 MB CSV is not committed. Download it once from Harvard Dataverse:

    curl -L -o /tmp/ces2024.csv \
      https://dataverse.harvard.edu/api/access/datafile/12050325
    python3 scripts/party/aggregate-ces.py /tmp/ces2024.csv

Source: Cooperative Election Study Common Content, 2024,
doi:10.7910/DVN/X11EP6 (Schaffner, Ansolabehere, et al.).

Party ID uses pid7 with leaners counted as partisans (1-3 Democratic, 5-7
Republican, 4 Independent); pid3 is the fallback. Shares are weighted by
commonpostweight and keyed by inputstate FIPS and cdid119 (119th-Congress
lines).
"""

import collections
import csv
import json
import os
import sys

ROWS = ("d", "r", "i", "o")


def classify(row, ip7, ip3):
    try:
        p7 = int(row[ip7])
    except (ValueError, TypeError):
        p7 = None
    if p7 in (1, 2, 3):
        return "d"
    if p7 in (5, 6, 7):
        return "r"
    if p7 == 4:
        return "i"
    try:
        p3 = int(row[ip3])
    except (ValueError, TypeError):
        p3 = None
    return {1: "d", 2: "r", 3: "i"}.get(p3, "o")


def normalize(counts):
    total = sum(counts.values())
    if total <= 0:
        return None
    out = {k: round(counts.get(k, 0) / total, 4) for k in ROWS}
    drift = 1 - sum(out.values())
    big = max(out, key=out.get)
    out[big] = round(out[big] + drift, 4)
    return out


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/ces2024.csv"
    if not os.path.exists(path):
        sys.exit(f"CES CSV not found at {path}; see the docstring")

    with open(path, newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        header = next(reader)
        col = {name: i for i, name in enumerate(header)}
        ip7, ip3 = col["pid7"], col["pid3"]
        iw, iw2 = col["commonpostweight"], col["commonweight"]
        state_col, cd_col = col["inputstate"], col["cdid119"]

        states = collections.defaultdict(lambda: collections.defaultdict(float))
        dists = collections.defaultdict(lambda: collections.defaultdict(float))
        state_n = collections.Counter()
        dist_n = collections.Counter()
        for row in reader:
            try:
                st = "%02d" % int(row[state_col])
                cd = "%02d" % int(row[cd_col])
                weight = float(row[iw])
            except (ValueError, TypeError):
                continue
            if not weight > 0:
                try:
                    weight = float(row[iw2])
                except (ValueError, TypeError):
                    weight = 0.0
            if not weight > 0:
                continue
            party = classify(row, ip7, ip3)
            states[st][party] += weight
            dists[(st, cd)][party] += weight
            state_n[st] += 1
            dist_n[(st, cd)] += 1

    output = {
        "source": "Cooperative Election Study (CES) Common Content 2024, "
        "doi:10.7910/DVN/X11EP6",
        "note": "Weighted party ID (pid7, leaners as partisans; pid3 fallback). "
        "District keys use cdid119 lines.",
        "weight": "commonpostweight",
        "states": {},
        "districts": {},
    }
    for st, counts in states.items():
        norm = normalize(counts)
        if norm:
            output["states"][st] = {**norm, "n": state_n[st]}
    for (st, cd), counts in dists.items():
        norm = normalize(counts)
        if norm:
            output["districts"][f"{st}-{int(cd):02d}"] = {**norm, "n": dist_n[(st, cd)]}

    out_path = os.path.join(os.path.dirname(__file__), "ces2024_party.json")
    with open(out_path, "w") as f:
        json.dump(output, f, indent=0)
    print(
        f"wrote {len(output['states'])} states and "
        f"{len(output['districts'])} districts to {out_path}"
    )


if __name__ == "__main__":
    main()
