# Bill of materials

The live parts list is [`docs/data/bom.json`](../docs/data/bom.json), shown on the website's **Bill of Materials** page.
Edit the JSON (quantity, cost, status) and open a pull request. The page updates itself.

## Summary

| Area | Main parts |
|---|---|
| Light | 40 × DMX pixel tubes (36 + 4 spares), 120 Ω DMX terminators, short 5-pin XLR jumpers |
| Control | PC running the Merkaba controller, multi-universe DMX interface (Art-Net/sACN node or USB), one XLR feed per universe |
| Power | 24 V 20 A supply (maybe two, see power budget), power injection cable, inline fuses |
| Structure | 8 × tip hubs (3-way), 6 × middle hubs (8-way, with a rated bridle eye) |
| Rigging | 3 × motorised winches, wire rope, 3 bridle rings, rated shackles, independent safety cables |

## Status values

`needed` → `quoted` → `ordered` → `received`

## Open questions

- Hub design (3D printed or machined), and how the tubes clamp in.
- Winch model: load rating with a safety factor, limit switches, brake, and how the PC controls it.
- Is one 24 V 20 A supply enough? Only for the 0.5 m tubes at full white. See the **Specs** page.
