# Rail to Revenue v2.0: One Quarter at GhIPSS

Team simulation for the GhIPSS Commercial Enablement for Support Functions track, 21 and 22 October 2026. Built from the Rail to Revenue build pack v2.0. Every rule runs through the pack's `engine.js`, embedded byte for byte.

| File | Who opens it | What it is |
|---|---|---|
| `index.html` | Each team device | The team app. Holds the stripped scenario: no grades, debrief points, coach cues, CCP prompts, flags register or achievement rules. |
| `console.html` | Game operator, coaches | Facilitator console. Grades and coach cues are encrypted and open only with the facilitator PIN. |
| `console.html#screen` | Projector | Opened from the console with "Open projector". |
| `sw.js` | Browser | Keeps both pages working through a reload with no signal. |

Addresses once deployed: teams `https://tpssimulation.intreensic.com/rail-to-revenue-v2/`, console `https://tpssimulation.intreensic.com/rail-to-revenue-v2/console.html`. The v1.0 app stays at `/rail-to-revenue/`.

The PIN is in the operator run sheet, not in this folder, because this folder is public once deployed.

No backend: team devices save everything locally and never need the network after the first load. Rounds open with four-digit release codes, curveballs arrive by code, and the console collects each table's position by scanning the QR code on its screen.
