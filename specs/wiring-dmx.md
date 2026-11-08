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

## Daisy-chain rules

1. Each tube has DMX in and out on 150 mm leads, so the next tube in a chain must start at the **same hub** where the last one ended.
2. A tip has 3 tubes, an odd number, so chains have to start and end at tips. The planner pairs the tips (`dmx.virtualPairs` in the JSON), walks one path through all 36 tubes, then cuts it into universes.
3. A tube is never split across universes. Universes = ceil(36 / floor(512 / channels per tube)), with tubes spread evenly between them.
4. Where the next tube in a universe starts at a different hub, a short **XLR jumper** is needed. The planner lists every one; there are currently 3 for the 1 m and 1.5 m tubes.
5. Each universe starts with a feed cable from its own DMX interface output and ends with a **120 Ω terminator**.

## Addressing

- 3 channels per pixel in R, G, B order.
- Within a universe, tube *n* starts at `1 + (n − 1) × channels per tube`.
- Pixel 1 of each tube is at its **data-in** end. The address map shows the direction as `from → to`.

| Tube size | Channels per tube | Max tubes per universe | Universes |
|---|---:|---:|---:|
| 0.5 m (10 px) | 30 | 17 | 3 |
| 1 m (20 px) | 60 | 8 | 5 |
| 1.5 m (30 px) | 90 | 5 | 8 |

## Power

- 24 V into the tube leads. With long chains, add **power injection** at several hubs so the far tubes don't dim or shift colour.
- Fuse each injection branch.
- Connect the DMX interface ground to the 24 V supply ground once, at one point.

## Before hanging

Run the **Address test** effect in the visualizer (and later in the controller). It lights one tube at a time in address order, so you can check every tube's address and direction on the bench.
