# Merkaba — stellated octahedron LED sculpture

A suspended Merkaba light sculpture: two interlocked tetrahedra plus the inner octahedron that
joins their edge midpoints (a *stella octangula*). It is built from **36 DMX512 pixel tubes** and **14 hubs**,
and hangs from **three motorised winches** so it can rise, fall and tilt.

**Website:** `https://<your-github-username>.github.io/merkaba-stellated-octahedron/` (once GitHub Pages is on)

| | |
|---|---|
| Tubes | 36 in the sculpture, 40 ordered (4 spares). HTD-T40-20IC-5050RGB style, 24 V, 5-pin DMX XLR in/out on 150 mm leads |
| Sizes | 0.5 m, 1 m or 1.5 m tubes (one size for the whole build, not chosen yet) |
| Hubs | 8 tips (3 tubes each) + 6 middle hubs (8 tubes each) |
| Power | 24 V 20 A supply |
| Rigging | 3 winches, each on a two-leg bridle to a pair of middle hubs |
| Control | DMX from a PC app (stand-alone Merkaba version of `controller.py`) |

## Repository layout

```
docs/          the website, served by GitHub Pages
  data/        merkaba.json (geometry + specs: the single source of truth),
               bom.json, roadmap.json, notes.json
  js/          model.js (geometry, DMX planner), viewer.js (Three.js), effects, audio
  css/
controller/    placeholder for the stand-alone Merkaba controller.py
specs/         markdown spec sheets: tube spec, bill of materials, wiring & DMX notes
```

Geometry and spec numbers live in **one file**, [`docs/data/merkaba.json`](docs/data/merkaba.json).
The visualizer, Specs page and Wiring & DMX page all work from it, so they always agree.

## Viewing the site

- **Online:** use the GitHub Pages link above.
- **On your computer:** browsers block the data files when a page is opened straight from disk,
  so run a tiny local server:

  ```bash
  cd docs
  python -m http.server 8000
  ```

  Then open <http://localhost:8000>. No build step is needed. Three.js loads from a CDN.

The microphone (audio-reactive mode) only works on `https://` or `localhost`. Without it the effect runs on a simulated beat.

## Contributing

Friends are welcome to help.

1. **Ideas, questions, wrong numbers:** open an [issue](../../issues). Pick a template or a blank issue.
2. **Changes:** fork the repo (or ask to be added as a collaborator), make a branch, commit, and open a pull request against `main`.
3. **Data-only changes** (BOM, roadmap, notes, specs) are just JSON edits in `docs/data/`. You can do them in the GitHub web editor.

### Branch names

| Prefix | For | Example |
|---|---|---|
| `feature/` | New pages, effects, controller features | `feature/sparkle-effect` |
| `fix/` | Bugs and wrong numbers | `fix/power-budget-typo` |
| `data/` | BOM, specs, roadmap or notes updates | `data/bom-winch-quote` |
| `docs/` | README and spec sheet text | `docs/wiring-notes` |
| `hw/` | Hub, rigging or wiring designs | `hw/middle-hub-v1` |

Keep pull requests small and say what you changed and why. If you change a number in
`merkaba.json`, check the Specs and Wiring pages still look right.

## Estimates still to confirm

Pixels per tube, watts per metre, weights and the ceiling height are estimates. They are listed under
`assumptions` in `merkaba.json` and on the Specs page. At the estimated 15 W/m, the 1 m and 1.5 m
tubes draw more at full white than one 24 V 20 A supply can deliver, so the controller needs a
brightness cap or the build needs a second supply.

## License

[MIT](LICENSE)
