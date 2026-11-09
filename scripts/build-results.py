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


def main(results_path, house_path, as_of):
    state_fips = {
        feature["properties"]["abbr"]: feature["properties"]["fips"]
        for feature in json.loads(Path("public/data/states.json").read_text())["features"]
    }
    races = {"senate": {}, "governor": {}, "house": {}}
    grouped = defaultdict(list)
    for row in rows(results_path):
        if row["office"] in ("senate", "governor"):
            grouped[(row["office"], row["state"])].append(row)
    for (office, abbr), candidates in grouped.items():
        winner = next((row for row in candidates if row["winner"] == "yes"), None)
        leader = max(candidates, key=lambda row: int(row["votes"] or 0))
        selected = winner or leader
        races[office][state_fips[abbr]] = {
            "status": "called" if winner else "counting",
            "party": party(winner["party"]) if winner else None,
            "candidate": selected["candidate"],
            "votes": int(selected["votes"] or 0),
            "reporting": int(selected["percent_reporting"] or 0),
            "url": selected["url"],
        }
    for row in rows(house_path):
        abbr, district = row["district"].split("-")
        geoid = state_fips[abbr] + ("00" if district == "AL" else district)
        called = row["status"] == "called"
        races["house"][geoid] = {
            "status": "called" if called else "counting",
            "party": party(row["party"]) if called else None,
            "candidate": row["winner_or_leader"],
            "votes": int(row["total_votes"] or 0),
            "reporting": int(row["percent_reporting"] or 0),
            "url": row["url"],
        }
    expected = {"senate": 35, "governor": 36, "house": 435}
    for office, count in expected.items():
        if len(races[office]) != count:
            raise ValueError(f"{office}: expected {count} races, got {len(races[office])}")
    output = {"asOf": as_of, "source": "Polling Desk / civicAPI", "races": races}
    Path("src/data/results2026.json").write_text(json.dumps(output, indent=2) + "\n")
    print("Called:", {office: sum(r["status"] == "called" for r in data.values()) for office, data in races.items()})


if __name__ == "__main__":
    main(*sys.argv[1:])
