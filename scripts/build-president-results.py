#!/usr/bin/env python3
"""Extract state vote percentages from the FEC's official 2024 Excel workbook.

Usage: python3 scripts/build-president-results.py 2024presgeresults.xlsx
Source: https://www.fec.gov/documents/5645/2024presgeresults.xlsx
"""

import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
SOURCE = "https://www.fec.gov/resources/cms-content/documents/2024presgeresults.pdf"


def main(path):
    with ZipFile(path) as workbook:
        strings = ["".join(item.itertext()) for item in ET.fromstring(
            workbook.read("xl/sharedStrings.xml")
        ).findall("x:si", NS)]
        sheet = ET.fromstring(workbook.read("xl/worksheets/sheet1.xml"))
    rows = []
    for row in sheet.findall(".//x:sheetData/x:row", NS):
        cells = {}
        for cell in row.findall("x:c", NS):
            value = cell.find("x:v", NS)
            if value is None:
                continue
            column = "".join(char for char in cell.attrib["r"] if char.isalpha())
            cells[column] = strings[int(value.text)] if cell.get("t") == "s" else value.text
        rows.append(cells)
    fips_by_abbr = {
        feature["properties"]["abbr"]: feature["properties"]["fips"]
        for feature in json.loads(Path("public/data/states.json").read_text())["features"]
    }
    results = {}
    for row in rows[1:]:
        abbr = row.get("A")
        if abbr not in fips_by_abbr:
            continue
        total = int(row["AE"])
        harris = int(row.get("M", 0))
        trump = int(row.get("Y", 0))
        candidates = [
            {"candidate": "Kamala Harris", "party": "D", "percent": round(harris * 100 / total, 2)},
            {"candidate": "Donald Trump", "party": "R", "percent": round(trump * 100 / total, 2)},
        ]
        candidates.sort(key=lambda item: item["percent"], reverse=True)
        results[fips_by_abbr[abbr]] = {
            "status": "called", "party": candidates[0]["party"],
            "candidate": candidates[0]["candidate"], "reporting": 100,
            "candidates": candidates,
            "otherPercent": round((total - harris - trump) * 100 / total, 2),
            "url": SOURCE,
        }
    if len(results) != 51:
        raise ValueError(f"Expected 50 states and DC, got {len(results)}")
    Path("src/data/president2024Votes.json").write_text(json.dumps(results, indent=2) + "\n")
    print("Wrote presidential vote shares for", len(results), "states and DC")


if __name__ == "__main__":
    main(sys.argv[1])
