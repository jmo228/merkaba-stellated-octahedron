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
    head = data["globeHead"]
    head_ch = len(head["channels"])
    print(f"{data['project']['name']} v{data['project']['version']}")
    print(f"{len(tubes)} tubes, {len(hubs)} hubs, {head['count']} globe heads "
          f"({head_ch} ch each: {', '.join(head['channels'])})")
    print(f"Heads placed: {dmx['headPlacement']}")
    for v in data["variants"]:
        ch = v["pixelsPerTube"] * dmx["channelsPerPixel"]
        total = len(tubes) * ch + head["count"] * head_ch
        least = math.ceil(total / dmx["channelsPerUniverse"])
        print(f"  {v['label']:>12}: {v['pixelsPerTube']} px/tube, {ch} ch/tube, "
              f"{total} channels with heads (at least {least} universes)")
    print("The full address map (universes start at tie points) is on the website's Wiring & DMX page.")
    print("\nTODO: DMX output (tubes and heads), effects, audio input, brightness cap, winch control.")


if __name__ == "__main__":
    main()
