# thepit — DONE

**Game:** The Pit (`thepitu1`, Zilec Electronics / Centuri / Taito, 1982) — arcade-js game #2, Z80 / roundup.cpp.

- **rom_sha256 (maincpu program ROM):** `3bf98d469cd542f32cf3f3ef8f594defc9d8dc45cef844854016e3c18ae826f1`
  (gfx `e5fc56777dcb74efe2bbe9baff38db560ce322adc0ad78645006dbae747bacf1`, proms
  `8ca28db76430409265eaedcbaaf48353a5d049bf316eed7d16078e20a6413c14` — all three verified byte-for-byte
  against `games/thepit/rom/` on disk at audit time; they match `games/thepit/manifest.js` parts).
- **Audited commit:** `7150e624b4e7f1ec4f5f2166d3c0a05428c01c42` (`thepit: grounding stage-B COMPLETE — final 7
  cells + 1 routine [->seen], grounding=0`). This is the game state the audit was run against.
- **Auditor:** `opus-r40-thepit-auditor-1` — a fresh, independent adversarial agent that did NOT build thepit.
  Proposer≠confirmer: this DONE.md's commit triggers `review_gate`, whose reviewer is a SECOND independent
  adversarial agent (reviewer-rule R40) that re-runs the FULL §5 audit against this commit — not a read of
  this file.

## Method

Every criterion was executed and un-blinded independently, never trusting the aggregate `done_gate` green
("a green pre-filter is necessary, never sufficient"). Where a gate could pass while validating too little,
the gate's teeth were checked directly (the pixel grandfather path, the grounding counter's known blind spot,
oracle-served vs dissolved wiring, the deep-state transition coverage).

## Per-§5-criterion verdict

| Criterion | Verdict | Evidence (independently verified at `7150e624`) |
|---|---|---|
| **idiomatic gate = 0** | PASS | `python3 tools/idiomatic_gate.py worklist thepit` → `thepit: total 0 [registers=0 calls=0 pushes=0 addrs=0 mem=0 masks=0]`. No registers/`m.call`/`m.push*`/raw `0xHHHH`. The only `m.call` strings in `games/thepit/idiomatic/*.js` are prose comments explaining `yield*` generator delegation, not primitives. |
| **§3 completeness** (the biggest trap) | PASS | (a) `games/thepit/test/idiomatic.test.js` — "the whole idiomatic game boots, takes a coin, starts, and plays (**no translation gap**)". (b) Static closure complete: `registry-sync.test.js` → "registry in sync: **186 routines**", generated registry matches `translated/`. (c) Dispatch is static (idiomatic_gate calls=0/addrs=0), so a routine reached only deep would be a module-load failure, not a runtime surprise — and the module loads (every suite passes). (d) Deep states reached & byte-exact vs oracle via `transition.test.js`: level-advance, round-boundary, game-over teardown, high-score initials entry, colour-test DIP, credit-corruption cold-reset. (e) `UNWIRED` entries in `tools/registry-coverage.config.mjs` are all DISSOLVED caller-skips / SCC folds, each labelled "**not oracle-served**"; `no-stale-mcall` + `no-frozen-twin-call` gates pass. No reachable routine runs as translated in the live game. |
| **grounding (stage-B)** | PASS | `python3 tools/done_gate.py check --game thepit` → `grounding [OK] fully grounded (20 accounted-for via grounding-debt.txt)`. `check_grounding` requires net-zero (counted ungrounded − debt = 0) AND rejects stale debt. Independently un-blinded: thepit has **0 lowercase `loc_` cell consts**, so the known CELL_CONST under-count bug does not apply; JSDoc blocks are 2–3 lines so the 7-line scan has no far-tag blind spot. Spot-checked the 20 `grounding-debt.txt` reasons — all genuinely structural/irreducible (packed coinage value words, stack-scratch, DMA-only sprite/score staging, locked-mirror twin steps, write-only seeds, structural loop bounds, one vestigial dead cell). No `[code]`/`[guess]` cell left uncounted. |
| **pixel `--done` (full bar, NOT attract-only)** | PASS | Re-run live against a fresh pinned MAME golden: `python3 games/thepit/tools/pixel_suite.py --layer idiomatic --done` → `pixel_suite: PASS`. **PART A attract completeness:** golden 971 frames / 288 distinct, render 950 / 287 distinct, reconverge worst **0.67%** @f870 (0 over 5%). **PART B tape-driven gameplay:** `game_responded` non-vacuous — coin latched f404–411, credit-accepted f412–463, **play-active f464–788**; reconverge worst **0.56%** @f765 (0 over 5%); tight band rows 16.. worst **690px** (budget 2200, 0 over). **Not the grandfathered path:** thepit is in `done_gate.py LEGACY_ATTRACT_ONLY`, but its suite HAS a `--done` mode, so the grandfather is inert and it runs the full gameplay bar; `done_gate` prints `pixel PASS (--done: attract completeness + gameplay vs MAME)`. |
| **whole-game gates (tape replay + forced transitions)** | PASS | Re-run fresh. `games/thepit/test/idiomatic.test.js` + `registry-sync.test.js` → 2/2 pass. `games/thepit/idiomatic/test/{tape,transition}.test.js` → **8/8 pass**: dig tape tunnels (PLAYER_X advances, idiomatic == translated) plus the 6 forced transitions the tapes never reach (level-complete, round-boundary, game-over, high-score entry, colour-test DIP, credit-corruption cold-reset), each idiomatic coroutine == translated oracle byte-for-byte. Not attract-only. |
| **naming** | PASS | `python3 tools/naming_gate.py check --game thepit` → `OK (0 loc_ modules not retrofitted)`. Independently: **0 `loc_*.js` module files** in `games/thepit/idiomatic/`, **0 `loc_` routine names** in `names.js`, **0 lowercase `loc_` cell consts**. Grounded cells carry descriptive effect names. (Legacy pre-runbook port is grandfathered, but the actual count is 0 under the strict bar.) |
| **audio** | PASS | `python3 tools/audio_gate.py check --game thepit` → `OK (model=clips; map + map/wiring tests + legacy (no sign-off))`. Clips model: `manifest.audio.map` present, `test/audio-map.test.js` (coverage) + `test/audio-wiring.test.js` (soundlatch tap reaches player) pass. thepit is a pre-runbook legacy port (game #2), grandfathered on the `RECORDING-SIGNOFF.md` requirement per runbook §5 audio bullet. |
| **browser / web-worker contract + screenshot** | PASS | `web/test/games-boot.test.js` → thepit boots under the worker-form factory (construct + non-uniform render + worker-form input keying + sound seam). `games/thepit/screenshot.png` present — **672×768 PNG, portrait (ROT90 applied), 8-bit RGB**, representative selector card. Residual (same for every game): the browser canvas/audio *runtime* is not exercisable in node — a human browser confirm remains the standing final step, not a thepit-specific gap. |
| **external disassembly (Computer-Archaeology)** | PASS (in scope) | `games/thepit/contrib/computerarcheology/` present and complete: `Code.md` (6761 lines, annotated Z80 disasm from reset `0x0000` + vblank NMI `0x0066`), `Hardware.md`, `RAMUse.md`, `README.md`. AI-produced, ROM- and MAME-verified. Matches the frogger reference-DONE precedent (page-presence = PASS in scope). |

## Residuals (recorded transparently; none done-blocking)

1. **CA-pages `thepit.jpg` absent.** The CA `README.md` references `![The Pit](thepit.jpg)` and lists
   `+thepit.jpg` in its deploy block, but the image is not committed at `games/thepit/thepit.jpg` or
   `games/thepit/contrib/computerarcheology/thepit.jpg`. This is **identical to frogger**, the reference DONE
   game, whose R40-reviewed DONE.md marks CA "PASS (in scope)" on page-presence alone — the CA `.jpg` is a
   CA-website deploy artifact, not a repo done-blocker. Recorded so the confirming reviewer sees it was checked.
2. **Audio has no `RECORDING-SIGNOFF.md`** — legitimate: thepit is a pre-runbook legacy port, explicitly
   grandfathered by the runbook §5 audio-coverage bullet.
3. **Browser runtime (canvas/audio)** needs a human confirm — a standing residual for every game, not thepit-specific.

## Conclusion

**Zero open criteria.** Every §5 completion subsystem is green under its own gate, and each was independently
re-executed and un-blinded at commit `7150e624`: idiomatic gate at 0, §3-completeness established by
no-translation-gap boot + static closure (186 routines) + deep forced-transition equivalence + no oracle-served
wiring, stage-B grounding complete (20 accounted-for, counter verified non-blind), the pixel `--done` bar
passing the FULL attract-completeness + tape-driven-gameplay path (not the grandfathered attract-only path),
the whole-game tape + 6 forced transitions byte-exact vs oracle, naming clean (0 `loc_`), audio (legacy-clips)
wired+tested, browser worker-boot green with a committed portrait `screenshot.png`, and the in-scope CA
disassembly present and complete. **thepit is DONE.**

*Auditor: opus-r40-thepit-auditor-1. Method over recollection; every line above is a command re-run at HEAD,
not a trusted prior claim.*
