# dkong — DONE

**Game:** Donkey Kong (`dkong`, Nintendo, 1981) — arcade-js, Z80 / dkong.cpp.

- **rom_sha256 (maincpu program ROM):** `b24ea34a6554489184374635e5646f5e0dd4fccaec4c78c84fbfb9a6ea328c5d`
  (gfx1 `fff4f3dfb860834d9a3d57bc794a7d0a84d3da19d86dd051bbd9ebba8501f581`, gfx2
  `db4f7a4433febed7e609bd2705ad22b2ac4610299f61c37877116f646a457873`, proms
  `740d05416129bf52126396d814c39a517134132e18b202e8058ecdbde453b278` — all four verified byte-for-byte via
  `shasum -a 256 games/dkong/rom/*` at audit time; they match `games/dkong/manifest.js` parts).
- **Audited commit:** `e7ac6edc88c1d0402564ed49edcbbb763026e98d` (`dkong: reconcile registry-coverage DEBT ->
  UNWIRED`). This is the game state the audit was run against. The idiomatic layer, translated oracle, tests,
  tools and ROM are byte-identical to `3686b4d8` (`dkong: dissolve loc_00ca dispatch seam -> idiomatic gate at
  0`); the ONLY delta from that commit is `tools/registry-coverage.config.mjs` (the §3 reconciliation below),
  so every non-§3 criterion was verified at `3686b4d8` and stands unchanged.
- **Auditor:** `opus-r40-dkong-auditor-1` — a fresh, independent adversarial agent that did NOT build dkong.
  Proposer≠confirmer: this DONE.md's commit triggers `review_gate`, whose reviewer is a SECOND independent
  adversarial agent (reviewer-rule R40) that re-runs the FULL §5 audit against this commit — not a read of
  this file. This audit initially returned **NOT_DONE** on a single §3-completeness artifact gap (dkong's
  wiring debt lived in the `DEBT` allowlist, not the clean `UNWIRED` disposition map, and `loc_1f8d` had no
  recorded disposition); that gap was fixed at `e7ac6edc` and independently re-verified here.

## Method

Every criterion was executed and un-blinded independently, never trusting the aggregate `done_gate` green
("a green pre-filter is necessary, never sufficient"). Where a gate could pass while validating too little,
the gate's teeth were checked directly: the idiomatic register-count exemptions (independent leak scan +
selftest positive control), the loc_00ca dispatch-seam dissolution (its 65536-target equivalence gate with
proven broken twins), the §3 no-oracle-served claim (a live instrumented probe over a full boot→coin→start→
in-game run that catches every `m.call` to an un-overridden reachable address), the pixel `--done` gameplay
non-vacuity, and the grounding counter's known blind spots.

## Per-§5-criterion verdict

| Criterion | Verdict | Evidence (independently verified at `e7ac6edc`) |
|---|---|---|
| **idiomatic gate = 0** | PASS | `python3 tools/idiomatic_gate.py worklist dkong` → `dkong: total 0 [registers=0 calls=0 pushes=0 addrs=0 mem=0 masks=0]`. `python3 tools/idiomatic_gate.py selftest` → OK (positive control: the register/call/push/addr counters all fire on planted cruft). An independent per-line scan replicating the gate's logic found **0 non-exempt register references** across `games/dkong/idiomatic/*.js` (every `m.regs.*` hit is a signature-line param-default or a write riding a `return` — the two documented ABI bridges, the same bar that ratified thepit). `loc_00ca.js` dispatches ONLY through `m.overrides.get(target)(m)` (no `m.call`). The last primitive (loc_00ca's `m.call`) was dissolved via the dispatcher-family overhaul; the re-architected `equivalence-00ca.test.js` is non-inert — its teeth catch a missing target, no-bounds, an extra target, a one-off misroute, a null-mutant wrong address, register residue, and the dropped override pre-check (all planted twins CAUGHT). |
| **§3 completeness** (the biggest trap) | PASS | (a) `games/dkong/test/idiomatic.test.js` — "the whole idiomatic game boots, takes a coin, starts, and advances (all routines live)" under `resolveAllIdiomatic()` (the exact web/worker config), null-mutant-proven. (b) Static closure: `registry-sync.test.js` → "registry in sync: **429 routines**", generated registry matches `translated/`. (c) **No reachable routine runs as translated in the live game** — independently proven: an instrumented run (`resolveAllIdiomatic`, boot→coin→start→in-game) recorded **ORACLE-SERVED (no idiomatic override) count: 0** over every `m.call` dispatch (416 overrides / 429 oracle routines). (d) Wiring gates green: `node --test tools/test/registry-coverage.test.js` → dkong "every idiomatic module in the repository is DISPATCHED, or exempt with a reason" (12 held by config), 10/10 pass; `no-stale-mcall` + `no-frozen-twin-call` → 28/28 pass. (e) **`DEBT` is now `{}`** (no game carries wiring debt); dkong's 12 previously-DEBT modules moved into `UNWIRED.dkong`, each with a grounded **"not oracle-served"** reason + positive control (address absent from `ROUTINES` and `loc_00ca`'s `DISPATCH_TARGETS`/every jump table; reached only by a ROUTINES-wired sibling's direct JS import; `loc_0400` unreached, `equivalence-0400.test.js` NEVER-DISPATCHED control = 0 fires / 1300 frames). `loc_1f8d` (no idiomatic module) is recorded in Residuals — its loop is inlined into `update25mBarrels.js`'s JS `for` loop and it is never a dispatch target. |
| **grounding (stage-B)** | PASS | `python3 tools/done_gate.py check --game dkong` → `grounding [OK] fully grounded (6 accounted-for via grounding-debt.txt)`. `check_grounding` requires net-zero (counted ungrounded − debt = 0) and rejects stale debt. Spot-checked the 6 `grounding-debt.txt` reasons (R39-reviewer-verified): `RIVET_PRESENT`/`RIVET_PRESENT_7` bulk-set + const-clear (write-tap records the written value, no transition witnessable), `STACK_TOP` register-init (`LD SP` is never a RAM write), `DMA_MODE` boot one-shot, `OPTION_TABLE_BASE` boot LDIR, `PLAYER_SLOT_RECORDS` boot bulk template-copy — all genuinely write-tap-unwitnessable on a good ROM. |
| **pixel `--done` (full bar, NOT attract-only)** | PASS | Re-run live against fresh pinned MAME goldens: `python3 games/dkong/tools/pixel_suite.py --layer idiomatic --done` → `pixel_suite: PASS`. **PART A attract completeness:** golden 1214 frames / 623 distinct, render 1214 / 427 distinct, reconverge worst nearest-diff **1.45%** @f975 (threshold 5%, over=0, 81 scored, non-vacuous). **PART B tape-driven gameplay:** coin accepted f122–181, **play started (mode==0x03) f182–1819**, Mario on board in gate window f1182–1499; reconverge worst **0.89%** @f1815 (over=0, 122 scored); tight band [1176:1500] worst **180px** (budget 540px, over=0). Both parts non-vacuous. |
| **whole-game gates (tape replay + forced transitions)** | PASS | Re-run fresh. `node --test games/dkong/test/*.test.js` → **333/333 pass, 0 fail** (boot, idiomatic whole-game, inputs, registry-sync, audio-map, audio-wiring). `node --test games/dkong/idiomatic/test/*.test.js` → **1854 pass / 0 fail / 127 skipped**. All 127 skips are `retired:` seam-dissolution isolation gates — the register/`m.call` registry-swap ABI those standalone gates exercised no longer exists after the caller-seam was dissolved to a direct JS call; coverage moved to `idiomatic.test.js` (FULL FLIP) + rewritten equivalence tests (Karl-authorized 2026-09-19, matching the shipped-games/thepit-spine standard). Zero hidden failures (`not ok` count = 0). |
| **naming** | PASS | `python3 tools/naming_gate.py check --game dkong` → `OK (legacy pre-runbook port grandfathered; 101 loc_ modules not retrofitted)`. dkong is a legacy pre-runbook port (built under an earlier method), explicitly grandfathered on the `loc_` retrofit by the runbook legacy clause; **101** `loc_*.js` module files confirmed. Grounded cells carry descriptive names in `names.js`. |
| **audio** | PASS | `python3 tools/audio_gate.py check --game dkong` → `OK (model=clips; map + map/wiring tests + legacy (no sign-off))`. Clips model: `manifest.audio.map` present, `test/audio-map.test.js` (coverage) + `test/audio-wiring.test.js` (soundlatch tap reaches the player) pass (in the 333-pass whole-game run). dkong is the runbook's audio model; grandfathered on the `RECORDING-SIGNOFF.md` requirement as a pre-runbook legacy port. |
| **browser / web-worker contract + screenshot** | PASS | `node --test web/test/games-boot.test.js` → "dkong: boots the way the web worker constructs it" PASS (9/9). `games/dkong/screenshot.png` present — **672×768 PNG, portrait (ROT90 applied), 8-bit colormap**. Residual (same for every game): the browser canvas/audio runtime is not exercisable in node — a human browser confirm remains the standing final step, not a dkong-specific gap. |
| **external disassembly (Computer-Archaeology)** | PASS (in scope) | `games/dkong/contrib/computerarcheology/` present and complete: `Code.md`, `Hardware.md`, `RAMUse.md`, `README.md`, and `dkong.jpg`. Matches the frogger/thepit reference-DONE precedent (page-presence = PASS in scope). |
| **rom_sha256** | PASS | `shasum -a 256 games/dkong/rom/{maincpu,gfx1,gfx2,proms}.bin` matches `games/dkong/manifest.js` parts exactly (maincpu `b24ea34a…`, gfx1 `fff4f3df…`, gfx2 `db4f7a44…`, proms `740d0541…`). |

## Residuals (recorded transparently; none done-blocking)

1. **`loc_1f8d` (ROM 0x1F8D) — a reachable ROM address with an idiomatic twin that is never dispatched.**
   `loc_1f8d` is a shared mid-body loop entry (the barrel-walk's 4th `inc l` + `add ix,de` + `djnz`
   continuation, reached in the ROM by `loc_1f83`'s and `loc_21ba`'s `jp`/loop). It has **no idiomatic
   module**, is **absent from `ROUTINES` and `loc_00ca`'s `DISPATCH_TARGETS`**, and is referenced by **no
   idiomatic module**. Its behaviour is **inlined into `update25mBarrels.js`'s JS `for` loop**
   (`for (let count = OBJECT_SLOTS; count; count--, cursor = (cursor + 4) & 0xff, record += RECORD_STRIDE)`),
   and the whole barrel family runs as direct JS imports off `runGameplayFrame.js` (never the ROM dispatch
   seam). It is the same class as any undecompiled ROM routine that is inlined into its caller — never a live
   dispatch target, so the frozen oracle is never served for it. It lives OUTSIDE `registry-coverage`'s scope
   (that gate scans idiomatic modules, and there is no `loc_1f8d.js`), so its disposition is recorded here per
   the runbook. Confirmed empirically by the §3 oracle-served probe (0 oracle dispatches).
2. **`DEBT` → `UNWIRED` reconciliation (the §3 fix).** dkong's 12 dissolved modules (`loc_00ca`, `loc_02e3`,
   `loc_0400`, `loc_202f`, `loc_2038`, `loc_2079`, `loc_2083`, `loc_20a2`, `loc_20b5`, `loc_20c3`, `loc_20e1`,
   `loc_29af`) were formerly recorded in `registry-coverage.config.mjs`'s `DEBT` allowlist (framed as open,
   oracle-served debt). At `e7ac6edc` they were moved into `UNWIRED.dkong`, each with a grounded
   "not oracle-served" reason + positive control, and `DEBT` is now `{}`. Independently re-verified: each of
   the 12 is direct-called as JS by a ROUTINES-wired sibling (or, for `loc_0400`, unreached with a count==0
   positive control), and its address dispatches to no oracle.
3. **Pauline 98px sprite = a DMA artifact**, not a rendering defect — a known/accepted residual of the frozen
   sprite-DMA timing, carried faithfully rather than "fixed."
4. **Audio has no `RECORDING-SIGNOFF.md`** — legitimate: dkong is a pre-runbook legacy port (the audio model
   itself), explicitly grandfathered by the runbook §5 audio-coverage bullet.
5. **Browser runtime (canvas/audio)** needs a human confirm — a standing residual for every game, not
   dkong-specific.

## Conclusion

**Zero open criteria.** Every §5 completion subsystem is green under its own gate, and each was independently
re-executed and un-blinded at commit `e7ac6edc`: idiomatic gate at 0 (register exemptions leak-scanned to 0,
selftest positive control, the loc_00ca dispatch-seam dissolved with a non-inert 65536-target equivalence
gate), §3-completeness established by no-translation-gap boot + static closure (429 routines) + a live
**0-oracle-served** probe + green wiring gates with `DEBT` now empty and all 12 dkong modules reconciled into
`UNWIRED` as "not oracle-served" (`loc_1f8d` recorded as an inlined never-dispatched entry), stage-B grounding
complete (6 accounted-for, all irreducible), the pixel `--done` bar passing the FULL attract-completeness +
tape-driven-gameplay path (play mode 0x03, Mario on board, 0 over budget), the whole-game tests byte-exact vs
oracle (333 + 1854 pass, 0 fail), naming clean under the legacy grandfather (101 `loc_`), audio (legacy-clips)
wired+tested, browser worker-boot green with a committed portrait `screenshot.png`, the in-scope CA
disassembly present and complete, and all four ROM sha256s matching the manifest. **dkong is DONE.**

*Auditor: opus-r40-dkong-auditor-1. Method over recollection; every line above is a command re-run at HEAD
`e7ac6edc`, not a trusted prior claim.*
