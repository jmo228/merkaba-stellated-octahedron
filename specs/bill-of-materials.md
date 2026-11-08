# Bill of materials

The live parts list is [`docs/data/bom.json`](../docs/data/bom.json), shown on the website's **Bill of Materials** page.
Edit the JSON (quantity, cost, status) and open a pull request. The page updates itself.

## Summary

| Area | Main parts |
|---|---|
| Light | 40 × DMX pixel tubes (36 + 4 spares), 14 × RGBWUV globe heads, 8 × 160 mm and 6 × 200 mm perforated globes, head patch leads, 120 Ω DMX terminators, 5-pin XLR jumpers (1–3 m) |
| Control | PC running the Merkaba controller, 3 × Art-Net/sACN nodes with 2 outputs (one per tie point), network switch and Ethernet, one XLR feed per universe |
| Power | 3 × 24 V 20 A supplies (one per tie point), 12 AWG feed down each winch line, power injection cable, inline fuses |
| Structure | 8 × tip hubs (3-way), 6 × middle hubs (8-way, with a rated bridle eye) |
| Rigging | 3 × motorised winches, wire rope, 3 bridle rings, rated shackles, independent safety cables |

## Status values

`needed` → `quoted` → `ordered` → `received`

## Open questions

- Hub design (3D printed or machined), and how the tubes clamp in.
- Winch model: load rating with a safety factor, limit switches, brake, and how the PC controls it.
- Globe head model: real channel layout, wattage and mass (placeholders: 8 ch, 15 W, 0.5 kg).
- Nodes: 2 outputs per tie point covers the 0.5 m and 1 m tubes. The 1.5 m tubes need 8 universes, so they need 4-output nodes.
- Supplies: with one per tie point, the busiest is at 77% at full white with 1.5 m tubes. See the **Wiring & DMX** page.
