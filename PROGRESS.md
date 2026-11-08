# Merkaba LED sculpture: progress log

## Where things stand

### Versions (git tags; run `git checkout <tag>` to go back to any of them)
| Tag | What it is |
|---|---|
| v1.1-beta | Perforated RGBWUV hub globes on the visualizer (beams in fog); not yet in DMX map or power estimate |
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
- Hub globe heads (14, RGBWUV): add to the DMX address map and power estimate; replan universes to start at the tie-point hubs; one supply and one 2-universe Art-Net/sACN node per tie point; separate globe sizes for tips and middle hubs.
- Turn on GitHub Pages (steps above).
- Confirm with the supplier: pixels per tube, watts per metre, XLR pinout, how the DMX address is set.
- Choose the tube size (0.5 / 1 / 1.5 m), and measure the real ceiling height.
- Start the stand-alone `controller/controller.py` (DMX output).

---

## VERSION 1.1-beta (2026-11-08): perforated hub globes

**What's in it**
- New `docs/js/fixtures.js`: a frosted snap-on globe around each ball joint, lit by an RGBWUV DMX head inside.
  - Holes spread evenly over the shell (tube ports kept clear) throw beams straight out from the centre. Beam spread = 2 × atan(hole radius / globe radius): a 12 mm hole in a 160 mm globe ≈ 8.6°.
  - Colour: follow the LEDs next to the hub, solid, or white; plus White and UV levels (UV shown as violet).
  - Fog/haze control: beams barely show with no fog and glow in thick fog.
- Visualizer page: new **Hub globes** card (8 tips or all 14 hubs, globe size, colour, W, UV, holes per globe, hole size, beam length, fog).
- Home page render shows globes on the 8 tips.

**Not yet**
- Heads are visual only: not in the DMX address map, wiring page, BOM or power estimate.

**Tested**
- Syntax check on all changed scripts; globe/hole/beam logic run against all three tube sizes (8 and 14 globes, 0–96 holes, every colour mode). Rendered preview checked in chat; check the live page after pushing.

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
