"""Merkaba controller — placeholder.

Will become the stand-alone, Merkaba-only version of the existing controller.py
(DMX output, effects, audio reactive; no window features). For now it only loads the
shared data file and prints a summary, to show where the numbers come from.
"""
import json
import math
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "docs" / "data" / "merkaba.json"


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    tubes = data["geometry"]["tubes"]
    hubs = data["geometry"]["hubs"]
    dmx = data["dmx"]
    print(f"{data['project']['name']}")
    print(f"{len(tubes)} tubes, {len(hubs)} hubs")
    for v in data["variants"]:
        ch = v["pixelsPerTube"] * dmx["channelsPerPixel"]
        per_u = dmx["channelsPerUniverse"] // ch
        universes = math.ceil(len(tubes) / per_u)
        print(f"  {v['label']:>12}: {v['pixelsPerTube']} px/tube, {ch} ch/tube, {universes} universes")
    print("\nTODO: DMX output, effects, audio input, brightness cap, winch control.")


if __name__ == "__main__":
    main()
