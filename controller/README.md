# Merkaba controller (placeholder)

This folder will hold the stand-alone **Merkaba-only** `controller.py`, a cut-down version of the
existing WLED/house-lights controller with the window features removed and DMX output added.

## Plan

- Read the geometry and DMX settings from `../docs/data/merkaba.json`, the same file the website uses,
  so pixel order and addresses always match the website's Wiring & DMX page.
- Output DMX (Art-Net or sACN to a multi-universe node, or a USB DMX interface).
- Effects to port from the website demo: rainbow chase, pulse, shape colours, strobe (capped at 10 Hz),
  audio reactive (system audio or mic), and an address test for the bench.
- Master brightness cap, set from the power budget (see the Specs page).
- Later: winch control (raise, lower, tilt) with soft limits.

`controller.py` here is only a stub. It loads the data file and prints a summary.

```bash
python controller/controller.py
```
