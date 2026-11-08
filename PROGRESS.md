# Merkaba LED sculpture: progress log

## Where things stand

### Versions (git tags; run `git checkout <tag>` to go back to any of them)
| Tag | What it is |
|---|---|
| v1.0 | First prototype: static website (6 pages, 3D visualizer), shared geometry/spec data, spec sheets, controller placeholder |

### Live pieces
- **Repo:** https://github.com/jmo228/merkaba-stellated-octahedron (public)
- **Website:** https://jmo228.github.io/merkaba-stellated-octahedron/ (live once GitHub Pages is on: Settings → Pages → branch `main`, folder `/docs`)
- **Local copy:** `Desktop\merkaba-stellated-octahedron`

### How to make a new version
1. Make and test the change. To preview locally, run `python -m http.server 8000` inside `docs`.
2. Add a `VERSION x.y` section at the top of the log below: what changed, how to use it, what was tested.
3. Update the versions table above and `project.version` in `docs/data/merkaba.json`. The site footer shows it.
4. Commit, then tag and push:
   ```bash
   git tag -a vX.Y -m "vX.Y: short summary"
   git push origin main --tags
   ```

### To do next
- Turn on GitHub Pages (steps above).
- Confirm with the supplier: pixels per tube, watts per metre, XLR pinout, how the DMX address is set.
- Choose the tube size (0.5 / 1 / 1.5 m), and measure the real ceiling height.
- Start the stand-alone `controller/controller.py` (DMX output).

---

## VERSION 1.0 (2026-11-08): first prototype

**What's in it**
- `docs/`: static site for GitHub Pages. Plain HTML/CSS/JS, no build step, Three.js 0.160.0 from jsDelivr.
  - **Home:** overview with a live, spinning 3D render.
  - **Visualizer:**
    - Every tube is drawn as its LED pixels, in DMX address order, and you can orbit the view.
    - Effects: rainbow chase, pulse, shape colours (A / B / octahedron), strobe (capped at 10 Hz, with a warning), audio reactive, and an address test.
    - Audio reactive uses the mic via Web Audio, or a simulated 120 BPM beat when the mic isn't available.
    - Speed and brightness sliders, plus a live power estimate.
    - Tube size switch (0.5 / 1 / 1.5 m) showing overall dimensions.
    - Winch sliders for height, tilt and tilt direction, showing each winch line's length and the ceiling and floor clearance.
  - **Specs:** size variants, power budget, tube, connectors, hubs and tubes, and the assumptions still to confirm.
  - **Bill of Materials:** loaded from `docs/data/bom.json`, with category filter and cost total.
  - **Wiring & DMX:** diagram of the daisy-chain runs coloured by universe, plus universe table, address map and hub table.
  - **Collaborate:** issue and PR links, branch naming, roadmap (`roadmap.json`) and notes (`notes.json`).
- `docs/data/merkaba.json` is the single source of truth: 14 hubs, 36 tubes, size variants, tube spec, power, DMX settings and rig/winch pairs.
- `specs/`: tube spec, bill of materials and wiring/DMX notes, in markdown.
- `controller/`: placeholder `controller.py` that reads the shared data file and prints a summary.
- README (project, viewing, contributing, branch names), MIT license, Python `.gitignore`, issue templates.

**Key numbers (based on estimates)**
- Universes: 3 / 5 / 8 for the 0.5 / 1 / 1.5 m tubes. The 1 m and 1.5 m layouts need 3 XLR jumpers each.
- Full white: 270 / 540 / 810 W, against 384 W continuous from one 24 V 20 A supply. The larger tubes need a brightness cap (71% / 47%) or a second supply.
- 1.5 m version is about 4 m tip to tip, so it barely fits under the assumed 4.5 m ceiling.

**Tested**
- All six pages on a local server: no console errors, data loads, tables fill in.
- Visualizer: effects, size switch, tilt and winch readouts, audio mode on the simulated beat.
- Phone width (375 px): no sideways scrolling on any page.
- `python controller/controller.py` runs.
- Not checked by eye: the strobe, and live mic input (the mic needs https or localhost and a permission prompt).
