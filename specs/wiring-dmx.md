# Wiring and DMX addressing notes

The website's **Wiring & DMX** page works out the full run plan and address map from
[`docs/data/merkaba.json`](../docs/data/merkaba.json). Use that page as the reference. This sheet explains the rules behind it.

## Hubs

| Hub | Count | Tubes each | Notes |
|---|---:|---:|---|
| `TA1`–`TA4` | 4 | 3 | Tips of tetrahedron A (TA1 is the top tip) |
| `TB1`–`TB4` | 4 | 3 | Tips of tetrahedron B (TB1 is the bottom tip) |
| `M+X` `M+Y` `M+Z` | 3 | 8 | Middle hubs, upper ring |
| `M-X` `M-Y` `M-Z` | 3 | 8 | Middle hubs, lower ring |

Tube IDs: `A01`–`A12` (tetrahedron A), `B01`–`B12` (tetrahedron B), `O01`–`O12` (octahedron).

Every hub has a **globe head**: an RGBWUV DMX head inside a perforated frosted globe (160 mm on tips, 200 mm on middle hubs).

## Tie points

Each winch is a **tie point**: its bridle holds one upper-ring and one lower-ring middle hub, and it also carries:

| Tie point | Hubs | DMX node | Supply |
|---|---|---|---|
| W1 | `M+X` `M-Y` | N1 (Art-Net/sACN, 2 outputs) | PSU1, 24 V 20 A |
| W2 | `M+Y` `M-Z` | N2 | PSU2 |
| W3 | `M+Z` `M-X` | N3 | PSU3 |

## Daisy-chain rules

1. Each tube has DMX in and out on 150 mm leads, so the next tube in a chain must start at the **same hub** where the last one ended.
2. **Every universe starts at a tie-point (middle) hub and runs outward to a tip.** Its feed comes from the node at that tie point.
3. **Heads in the chain** (`dmx.headPlacement: "inChain"`, the default): each head is patched in where the chain passes its hub, with a short patch lead. A tip's head comes last in its run, just before a jumper or the terminator.
   **Heads on their own universe** (`"ownUniverse"`): all 14 heads share one extra universe, linked hub to hub (middle hubs first, then the tips).
4. A tube or head is never split across universes.
5. When a universe holds more than one run, an **XLR jumper** links the tip where one run ends to the middle hub where the next starts. The Wiring page lists each one with a length to buy.
6. Each universe ends with a **120 Ω terminator**.
7. The planner tries many layouts (seeded, so the result is repeatable). It keeps the one with the fewest node outputs over capacity, then the fewest supplies over 80%, then universes, jumpers, busiest supply and jumper length.

## Addressing

- Tubes: 3 channels per pixel in R, G, B order. Pixel 1 of each tube is at its **data-in** end. The address map shows the direction as `from → to`.
- Heads: 8 channels each (placeholder layout): dimmer, red, green, blue, white, UV, strobe, macro.
- Each item starts at the channel after the previous one in its universe. The Wiring page lists every start address.

With the heads in the chain:

| Tube size | Channels per tube | Universes | Node outputs (6 available) | Jumpers |
|---|---:|---:|---:|---:|
| 0.5 m (10 px) | 30 | 3 | 3 | 5 |
| 1 m (20 px) | 60 | 5 | 5 | 3 |
| 1.5 m (30 px) | 90 | 8 | 8: **2 short**, use 4-output nodes | 4 |

At 1.5 m a universe fits at most 5 tubes (5 × 90 = 450 channels), so 36 tubes need at least 8 universes.

## Power

- One **24 V 20 A supply per tie point**, beside its winch on the ceiling. Its **12 AWG** pair runs about 6 m down the winch line to the tie point's two hubs.
- Each tube and head is assumed to draw from the supply at the tie point that feeds its universe, since power travels with the chain. Keep each supply at or below **80%** (16 A) continuous. The Wiring page shows each supply's full-white load and warns above that.
- Full white, tubes + 14 heads: 480 / 750 / 1020 W for 0.5 / 1 / 1.5 m tubes. The busiest supply is at 6.9 / 11.9 / 15.3 A.
- The 12 AWG feed drops under 1 V (about 4%) at those loads.
- With long chains, add **power injection** at more hubs so the far tubes don't dim or shift colour. Fuse each hub feed.
- Connect each node's DMX ground to its supply's ground once, at one point.

## Before hanging

Run the **Address test** effect in the visualizer (and later in the controller). It lights one tube or head at a time in address order, so you can check every address and tube direction on the bench.
