# Merkaba LED sculpture: progress log

## Where things stand

### Versions (git tags; run `git checkout <tag>` to go back to any of them)
| Tag | What it is |
|---|---|
| v1.2 | Globe heads in the real design: DMX map (universes start at tie points), nodes and supplies per tie point, power, BOM |
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
- Turn on GitHub Pages (steps above).
- Confirm with the supplier: pixels per tube, watts per metre, XLR pinout, how the DMX address is set.
- Choose the tube size (0.5 / 1 / 1.5 m), and measure the real ceiling height.
- Choose the globe head: real channel layout, wattage, mass and DMX connectors. Then update `globeHead` in `merkaba.json` (placeholders now: 8 ch, 15 W, 0.5 kg).
- If the 1.5 m tubes are chosen: 8 universes need more than 3 × 2 node outputs. Use 4-output nodes.
- Start the stand-alone `controller/controller.py` (DMX output, including the heads' channels).

---

## VERSION 1.2 (2026-11-08): globe heads in the real design

**What's in it**
- `merkaba.json`:
  - New `globeHead` section: 14 RGBWUV heads, channel list (8 ch: dimmer, R, G, B, W, UV, strobe, macro), 15 W, 0.5 kg each, globe 160 mm on tips and 200 mm on middle hubs, 32 holes of 12 mm. Channels, watts and mass are marked as assumptions.
  - `dmx.headPlacement`: `"inChain"` (default) or `"ownUniverse"`.
  - `dmx.nodes`: one Art-Net/sACN node per tie point, 2 outputs.
  - `power`: one 24 V supply per tie point, plus the 12 AWG feed down each winch line (6 m).
  - Removed the old tip `virtualPairs`.
- New DMX planner (`docs/js/model.js`):
  - Every universe starts at a tie-point (middle) hub and runs outward to a tip.
  - Each head is patched in where the chain passes its hub. A tip's head is last in its run, before a jumper or the terminator.
  - A tube or head is never split across universes.
  - It tries 4000 seeded layouts, so the result is the same every time. It keeps the one with the fewest node outputs over capacity, then supplies over 80%, then universes, jumpers, busiest supply and jumper length.
- **Wiring & DMX page:**
  - Address map with heads, the start hub and node output for each universe, and jumpers with lengths to buy.
  - Nodes and supplies per tie point: load, amps, % of rating and the 12 AWG feed's voltage drop.
  - Head channel layout.
  - The diagram marks universe starts and head dots.
  - Warnings when node outputs run short or a supply is above 80%.
- **Specs page:** heads in the power budget (tubes + heads, 3 supplies, busiest supply), a Globe heads section, node outputs and jumpers per size, and weight including heads.
- **Visualizer:**
  - Separate globe sizes for tips and middle hubs.
  - Heads run on a DMX frame in the channel layout from `merkaba.json`: the panel writes it and the globes are drawn from it.
  - The Address test now steps through the heads as well as the tubes.
  - The power card includes the heads and shows the busiest supply.
- **BOM:** 14 heads, 8 + 6 globes, head patch leads, 3 nodes (instead of 1 interface), Ethernet and a switch, 3 supplies, 12 AWG feed cable, more fuses and terminators, and longer jumpers (unpriced).
- Fix: heavy fog no longer turns the whole visualizer white. Beam haze now scales with the total number of beams.
- `controller.py` summary uses the new head channels.

**Key numbers (heads in the chain)**
| Tubes | Universes | Node outputs (of 6) | Jumpers | Full white | Busiest supply |
|---|---:|---:|---:|---:|---:|
| 0.5 m | 3 | 3 | 5 | 480 W | 6.9 A (34%) |
| 1 m | 5 | 5 | 3 | 750 W | 11.9 A (59%) |
| 1.5 m | 8 | **8: 2 short** | 4 | 1020 W | 15.3 A (77%) |

With `ownUniverse` there is one more universe in each case (4 / 6 / 9). Feed drop on 6 m of 12 AWG stays under 1 V (about 4%) for every size.

**Tested**
- Node: the planner places all 36 tubes and 14 heads once each for every size and both head options. Every universe starts at a middle hub, ends at a tip, and stays at or under 512 channels.
- Local preview, all six pages, both head options: no console errors.
- Visualizer: globes on all 14 hubs; holes show as hot spots; Fog 0 to 100% brightens the beams without washing out; White and UV work; tip and middle globe sizes rebuild; changing tube size rebuilds; the Address test lights each head in turn (for example `U1 @461–468 · head TA2`).
- Wiring: 50 address rows (36 tubes + 14 heads) and the short-output warning for 1.5 m.

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
