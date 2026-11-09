#!/usr/bin/env python3
"""Build the checked-in 2026 results snapshot from Polling Desk CSV exports.

Usage: python3 scripts/build-results.py results.csv house-districts.csv ISO_UTC
Download from https://polling-desk.com/results.csv and
https://polling-desk.com/house-districts.csv. Use the response Last-Modified
timestamp for ISO_UTC. Only called races are colored; counting races stay gray.
"""

import csv
import json
import sys
from collections import defaultdict
from pathlib import Path


def rows(path):
    with open(path, newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def party(value):
    return {"DEM": "D", "REP": "R"}.get(value)


def make_result(candidates, called):
    winner = next((row for row in candidates if row["winner"] == "yes"), None)
    if called and winner is None:
        raise ValueError("Called race has no winner in results.csv")
    selected = winner if called else max(candidates, key=lambda row: int(row["votes"] or 0))
    ordered = sorted(candidates, key=lambda row: int(row["votes"] or 0), reverse=True)
    if ordered[0] is not selected:
        ordered.remove(selected)
        ordered.insert(0, selected)
    shown = ordered[:3]
    return {
        "status": "called" if called else "counting",
        "party": party(selected["party"]) if called else None,
        "candidate": selected["candidate"],
        "votes": int(selected["votes"] or 0),
        "reporting": int(selected["percent_reporting"] or 0),
        "candidates": [
            {"candidate": row["candidate"], "party": party(row["party"]),
             "percent": float(row["percent"])}
            for row in shown
        ],
        "otherPercent": round(sum(float(row["percent"]) for row in ordered[3:]), 2),
        "url": selected["url"],
    }


def main(results_path, house_path, as_of):
    state_fips = {
        feature["properties"]["abbr"]: feature["properties"]["fips"]
        for feature in json.loads(Path("public/data/states.json").read_text())["features"]
    }
    races = {"senate": {}, "governor": {}, "house": {}}
    grouped = defaultdict(list)
    for row in rows(results_path):
        if row["office"] in races:
            grouped[(row["office"], row["state"], row["district"])].append(row)
    for (office, abbr, district), candidates in grouped.items():
        if office == "house":
            continue
        races[office][state_fips[abbr]] = make_result(
            candidates, any(row["winner"] == "yes" for row in candidates)
        )
    for row in rows(house_path):
        abbr, district = row["district"].split("-")
        geoid = state_fips[abbr] + ("00" if district == "AL" else district)
        called = row["status"] == "called"
        candidates = grouped[("house", abbr, row["district_number"])]
        if not candidates:
            raise ValueError(f"Missing candidate rows for {row['district']}")
        races["house"][geoid] = make_result(candidates, called)
    expected = {"senate": 35, "governor": 36, "house": 435}
    for office, count in expected.items():
        if len(races[office]) != count:
            raise ValueError(f"{office}: expected {count} races, got {len(races[office])}")
    output = {"asOf": as_of, "source": "Polling Desk / civicAPI", "races": races}
    Path("src/data/results2026.json").write_text(json.dumps(output, indent=2) + "\n")
    print("Called:", {office: sum(r["status"] == "called" for r in data.values()) for office, data in races.items()})


if __name__ == "__main__":
    main(*sys.argv[1:])
