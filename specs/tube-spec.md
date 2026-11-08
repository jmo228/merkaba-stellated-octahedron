# Tube spec

> The numbers the website uses live in [`docs/data/merkaba.json`](../docs/data/merkaba.json).
> If you change a number, change it there first, then update this sheet to match.

## Part

| | |
|---|---|
| Model | HTD-T40-20IC-5050RGB (style) |
| Type | DMX512 digital pixel tube |
| Diameter | 40 mm (T40) |
| LEDs | 5050 RGB SMD |
| Supply | 24 V DC |
| Control | DMX512 (RS-485), 3 channels (R, G, B) per pixel |
| Leads | 150 mm, 5-pin DMX XLR in (male) and out (female) on every tube |
| Ingress rating | IP65 *(assumed)* |
| Ordered | 40 (36 in the sculpture + 4 spares) |

## Size variants

All 36 tubes in the sculpture are the same length. Pick one size for the whole build.

| | 0.5 m | 1 m | 1.5 m |
|---|---:|---:|---:|
| Pixels per tube *(assumed 20/m)* | 10 | 20 | 30 |
| DMX channels per tube | 30 | 60 | 90 |
| Hub centre to hub centre | 0.62 m | 1.12 m | 1.62 m |
| Tip-to-tip height (hung) | 1.52 m | 2.74 m | 3.97 m |
| Overall width (hung) | 1.43 m | 2.59 m | 3.74 m |
| Total pixels | 360 | 720 | 1,080 |
| DMX universes | 3 | 5 | 8 |
| Full white power *(assumed 15 W/m)* | 270 W | 540 W | 810 W |
| Est. weight, tubes + hubs | 15.7 kg | 26.5 kg | 37.3 kg |

Dimensions assume 60 mm from each hub centre to the tube end.

## To confirm with the supplier

- [ ] Pixels (ICs) per tube for each length. Does "20IC" mean 20 per metre or 20 per tube?
- [ ] Power per metre at full white.
- [ ] XLR pinout: which pins carry DMX+ / DMX− / GND / +24 V.
- [ ] Is the DMX start address set by DIP switch, by RDM, or written with a programmer?
- [ ] Weight per metre.
- [ ] Minimum bend radius of the leads, and the strain relief at the tube ends.
