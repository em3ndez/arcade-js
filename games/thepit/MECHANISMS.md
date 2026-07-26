# The Pit — mechanism map (code-grounded understanding)

A working model of how the game actually plays, built **from the translated Z80 routines +
observed MAME attract mode**, not from external descriptions (this game has no public
reverse-engineering — that's the point). Every claim is tagged:

- **[seen]** — observed directly in a captured MAME frame.
- **[code]** — derived from a translated routine's behaviour (exact) — role is inference, mechanics are faithful.
- **[guess]** — plausible but unverified; do not rely on it.

This is the precursor to the naming + idiomatic passes: as roles get confirmed, they become
`ram.js` names and English routine names.

## What the game is  [seen]

A **dig-into-the-pit / collect-the-loot** game. The playfield is a vertical cross-section:

- **Top band** — sky, with a **UFO / mothership** patrolling left↔right.  [seen]
- **Top-left** — a green **surface shaft/building** holding the small **player figure**.  [seen]
- **Middle & bottom** — a large **dirt cavern/maze** of brown blocks studded with **red diamonds** (the loot).  [seen]
- **Bottom** — a pink band with a **row of white creatures** (enemies; the demo flashes a "ZUN…" label).  [seen]

The player tunnels down through the dirt, collects diamonds, and contends with the sky UFO and
the bottom creatures.

## Attract cycle  [seen]

Loops **title/high-score screen ↔ gameplay demo**. The title carries "SCORE1 CENTURI SCORE2",
"GAME OVER", the 1P/2P credit menu, "© 1982 CENTURI INC", and a **"BEST SCORES TODAY"** table
(high-score display is folded into the title). The title has a **deterministic blink** (frames
alternate on a fixed period — no RNG), which matters for pixel-matching by frame phase.

## Mechanisms → routines

| Mechanism | Routine(s) | Evidence |
|---|---|---|
| **Cold boot / init** | `loc_01a4` (di/im1, stack, RAM seed, busy-delay → 0x03ac) | [code] |
| **Per-frame service (vblank NMI)** | `loc_0066` (the NMI handler; input sample, coin, re-arm) | [code] |
| **Player dig / wall collision** | `loc_03e8` → 4-way blocked-direction bitmask at **0x801b** | [code] the tunnel-movement core |
| **Tile-under-object classify** (dirt / diamond / empty) | `loc_1568` / `loc_1515` / `loc_14cd` (shared body) | [code] drives collect vs dig |
| **Object/enemy movement** | `0x3490` velocity-preset family (`loc_3476/347d/3484/348b`), `loc_3748`, `loc_384a`, `loc_3968` | [code] |
| **Player walk-frame animation** | `loc_184a`, `loc_186a`→`loc_186f` | [code] |
| **Actor spawn + draw** (tile+colour stamp into VRAM/CRAM) | `loc_37cf`, `loc_38c8` | [code] |
| **Object action dispatch** (per-state) | `loc_13de`, `loc_1434`, `loc_144c`, `loc_4eea` | [code] state machines keyed on a mode byte |
| **Sound request** | `loc_4c1f..4ca3` stubs → shared enqueue `loc_4ca5` → ring at 0x8020 | [code] |
| **High-score table + score display** | `loc_4d3a` (top-3 insert), `loc_4d0c` (BCD digit unpack) | [code] backs "BEST SCORES TODAY" |
| **DSW → gameplay params** | `loc_4b55` decodes dip bits into 0x804c–0x8053 | [code] |

## RAM roles (inferred from code — unverified)  [code]/[guess]

| Addr | Role |
|---|---|
| 0x801b | player 4-way blocked-direction bitmask (dig/move) |
| 0x8068 / 0x806b | tracked-object X / Y probe coords (collision) |
| 0x8075 | object flags / mode byte (dispatcher key) |
| 0x8069 | current frame / sprite id |
| 0x8018 | object-action selector |
| 0x807b | phase flag (spawn/init gate) |
| 0x808b | tick / velocity counter (movers) |
| 0x8112 | period-8 down-counter (enemy cadence) |
| 0x810a / 0x811b | actor X coords (primary / twin) |
| 0x801e / 0x8020 | sound ring head / ring buffer |
| 0x804c–0x8053 | DSW-decoded gameplay parameters |
| 0x8031/0x8034, 0x803c/41/46, 0x8037/38 | score lo/hi candidate, top-3 slots, BCD-staged value |
| 0x80c3 | 24-entry object table (scanned by `loc_2bf2`) |
| 0x80e7 | tile-under-object record |
| 0x8080 | object-overlap flag |

## Open questions (to resolve as translation completes)

- Exact win/lose conditions and the timer (a tick counter gates flags — `loc_3458`/`loc_34da`).
- What the **UFO** does — patrol only, or does it fire/bomb? (a sky-object dispatcher, not yet pinned).
- The bottom **creatures'** behaviour and the "ZUN…" label (full enemy name unread).
- How a collected diamond scores + removes its tile (the classifier writes 0x80e7; the scoring link is unconfirmed).
- The elevator/shaft the player starts in (top-left green structure) — is it a lift, or just the entry?

## Pixel-testing target order (once `machine.js` exists)

1. **Title screen** — deterministic; diff by frame phase (account for the blink). First gate.
2. **Attract demo** — needs the **entropy pin** (enemy motion uses the RNG); diff pinned runs.
3. **Live gameplay** — later; needs input and the full loop.

Golden reference frames staged (gitignored, ROM-derived): `out/golden/attract/{title_ref,demo_ref}.png` (224×256, ROT90).
