# QuoteIt — v1 prototype spec

Field-rep quoting app for Trust Electric Heating. Replaces the paper "Heating Report".
This prototype = the four designed screens as a working clickable flow with the REAL
pricing engine. **Scope guard: NO CRM writes, NO BigQuery, NO email, NO deploy —
local prototype only.** Design was mocked on Paper.design 13 Aug 2026 (screenshots
archived); this codebase is now the design medium.

## Stack (ruled in DESIGN.md, trustwarehouse/quote_app/)
- Flask (serve static + `/api/catalogue` JSON), debug mode for auto-reload.
- Preact + htm via ESM — **no build step** (reps' Chromebooks; also our loop = save file → browser refresh). Vendor preact/htm locally via npm into `static/vendor/` (standalone ESM files), no bundler.
- State: in-memory app state + localStorage draft autosave. Mobile-first 390px layout, works desktop too.

## Design system (owner-approved "industrial")
- Ground `#FFFFFF` · ink `#1A1A1A` · panel `#F5F5F5` · borders `#E5E5E5` 1.5px, radius 12px · secondary text `#555555` · accent **Trust brand red `#FF0403`** (owner CORRECTION 18 Aug — the real site/print red; the earlier `#C0392B` was wrong and read as amber/brick. Primary buttons r14, selected states: 2px red border + `#FFECEB` tint; replaced the original safety orange) · green `#166534` ONLY for coverage-met/discount · validation `#7F1D1D` (darker so it stays distinct from the brand red).
- Type: **Archivo** (Google Fonts link is fine for the prototype): 900 for hero numbers (~64px kW, ~40px £ total), 700 titles 20px / card numbers 22px, 600 section labels 13px uppercase +0.04em `#555`, 500/400 body 15/13px. Buttons 700 17px white on orange, 16px vertical padding.
- Big tap targets; screens read at arm's length in a customer's living room.

## Domain laws (owner rulings — encode exactly)
- Dimensions in **metres**. `kW_needed = m³ × factor / 100`, factor ∈ {5 Standard · normal well-insulated, 6 Draughty · older/poor insulation, 7 Exposed · conservatory/very leaky}. Round display to 1dp.
- **kW is ADVISORY**: show needed-vs-quoted coverage; NEVER block or nag an under-covered quote.
- Max unit 2.5 kW → multi-radiator rooms are normal.
- Workflow: measure the WHOLE HOUSE first, then pick radiators (Rooms screen is the hub).
- Every quote is SIGNED and given to the customer; most take no payment on site (office follows up).

## Rate card (ex-VAT "Trust install" prices — the v1 catalogue, serve from /api/catalogue)
| Family (height) | Model | kW | Width | £ |
|---|---|---|---|---|
| Neos Standard (65cm) | N800 | 0.8 | 44cm | 1082 |
| | N1000 | 1.0 | 71cm | 1142 |
| | N1600 | 1.6 | 71cm | 1172 |
| | N2000 | 2.0 | 101cm | 1226 |
| | N2500 | 2.5 | 136cm | 1322 |
| Vertical (124cm) | NV1600 | 1.6 | 44cm | 1226 |
| | NV2000 | 2.0 | 71cm | 1322 |
| | NV2500 | 2.5 | 71cm | 1442 |
| Junior (40cm) | NJ1600 | 1.6 | 136cm | 1226 |
| | NJ2000 | 2.0 | 136cm | 1322 |
| | NJ2500 | 2.5 | 165cm | 1442 |

Accessories/extras: Protostat £0 (included, 1/radiator, show as "Included") · RF Relay £50/radiator (optional) · Wireless thermostat £100/room (optional) · App Hub £150/house (optional) · Timer £100 · Fuse spur £30 · Towel rail large 600W £350 / small 400W £250.
Work items: **Installation £250 for 1–2 radiators + £100 per extra radiator** · Removal & collection £75/old heater (removal-only, electric: £50).

## Pricing engine (order matters — owner rulings)
1. Per radiator: base price; if RAL colour/smooth finish → **+20% on that radiator FIRST**.
2. **NHS discount = 10% off the RADIATORS subtotal (after colour uplift), radiators only** — not accessories/install.
3. Trust install: prices are final, **no VAT added** (energy-saving relief) — microcopy: "No VAT to add — Trust installation (energy-saving relief)".
4. Supply-only (v1 includes it): per radiator **price × 1.2 + £50 delivery**; VAT-inclusive by construction.
5. Payment today: **50% deposit (default) / 25% / No payment today — office follows up** (the most common; must not look like a failure state). Balance on completion line updates with choice.

## Screens (match the Paper mocks)
- **00 Shell**: iPhone-style status bar optional; app frame max-width 390 centred on desktop with subtle page bg.
- **01 Add Room**: header (back chip, "Add room", customer sub "Mrs Kelly · 14 Oakwood Drive" hardcoded for now, room-counter chip). Room name input. Three dimension cards (Length/Width/Height, m) — numeric. Live "Room volume  N.N m³". Insulation factor: three full-width cards (badge 5/6/7 orange when selected + tint). kW hero: giant orange "6.4" + "kW", "heating needed for this room", advisory line "Guide figure — quote what suits the customer". CTAs: primary "Save & add another room", secondary text "Done measuring — view rooms".
- **02 Rooms** (hub): header + "N rooms" chip. Room cards: name bold, sub "L × W × H m · NN.N m³", gray factor badge, right-aligned Bold kW. Dashed "+ Add another room" card. Panel strip "HOUSE TOTAL" + orange Black total kW. CTA "Choose radiators".
- **03 Pick radiators** (per room, entered from a room card or after hub CTA): header sub "«Room» · needs N.N kW". Coverage strip hero: "X.X of N.N kW" — green when covered, ink otherwise, NEVER red — with selection summary sub-line. Family tabs (Standard 65cm / Vertical 124cm / Junior 40cm; selected = orange pill). Model rows: code Bold, sub "kW · width", price right Bold, qty stepper (orange when >0) or "+" add. CTA "Done — back to rooms".
- **04 Estimate**: header + "N radiators" chip. Sections: RADIATORS grouped by room ("2 × N2500 … £2,644"); ACCESSORIES (Protostat row shows "Included"); INSTALLATION & EXTRAS (auto install price from radiator count, removal count editable); optional colour uplift lines; green NHS discount row (toggle for NHS customer); divider; TOTAL hero + no-VAT microcopy; PAYMENT TODAY: 50%/25% cards + full-width "No payment today · Customer deciding — office will follow up"; balance line. CTAs: primary "Take signature", secondary "Share estimate" (both can stub → toast "v2").
- **05 Signature**: stub screen — "Signature capture coming in build phase" + the disclaimer text placeholder.

Persist app state (rooms, selections, options) in localStorage; "reset quote" link in a corner.

## Run
`pip install flask` (or uv) · `python app.py` → http://localhost:5001 · Flask debug=True so template/static edits hot-apply on refresh. README documents this.
