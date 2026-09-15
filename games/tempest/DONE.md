# tempest — §5 adversarial done-audit (DONE)

**Verdict: DONE — zero open criteria.**

- **Audited commit:** `04fc8d621869adece07fb2fac3d4d82b08f5f0e9`
  (`tempest: ground OBJECT_AXIS0_FRAC/OBJECT_AXIS1_POS [guess]->[seen]`), `== origin/main`.
  This done-marker commit adds this `DONE.md`; the audited substantive game state is `04fc8d62` (HEAD, the
  clock-free idiomatic IRQ port with `idiomaticComplete: true`, born-live on `runIdiomaticIrqGame`).
  Tempest is the SECOND 6502 port and the FIRST vector (QuadraScan) game in arcade-js.
- **Auditor (proposer):** fresh, independent adversarial §5 done-auditor, Claude Opus 4.8 (Claude Code
  agent), dispatched by Jimmy-arcade2, NOT involved in building the port. Proposer≠confirmer: this DONE.md's
  commit is reviewed by a SECOND independent agent that re-runs the FULL §5 audit against the tree at this
  commit (`review_gate`, reviewer-rule R40) — **not** a read of this file. Every criterion below was
  re-derived by running the command and reading the source, never trusting "the gates are green."
- **ROM sha256 (all four manifest parts, `games/tempest/manifest.js` images):**
  - **maincpu** (parts `136002-133.d1 136002-134.f1 136002-235.j1 136002-136.lm1 136002-237.p1`, five
    program ROMs concatenated to 0x5000; machine.js maps them at 0x9000 and reloads the last 4K at 0xF000
    per MAME's `ROM_RELOAD`):
    `3697ff0d18a8d3114e4cc023b2af76a7054712b1cb7536628c56838a2a0d3399`
  - **vectorrom** (part `136002-138.np3`, 0x1000, the vector display-list ROM at 0x3000):
    `c9d7fc0469085d04682dfba3f6f3730bfd818d613207fbf211b3232eb23fb321`
  - **avgprom** (part `136002-125.d7`, 0x100, the AVG state PROM):
    `45fdce76e631695940da6a1d94517177403591046e83bbabdbb72c674906d361`
  - **mathbox_user2** (part `136002.126`, 0x20):
    `14efb14ac87a8db219fb998e4ce14fa62488f1c9cfd882b41b9eb09efffee373`

  All four verified against the on-disk `games/tempest/rom/*.bin` (`shasum -a 256`) AND `manifest.js` — each
  on-disk digest is byte-identical to its manifest `sha256`. Tempest's audio is **two POKEYs driven straight
  off the 6502** (no sound CPU, no sample ROM), so there is no external sound disassembly; the mathbox
  `user3` nibble-interleaved ROM is not assembled (the mathbox is unimplemented — the guest math runs in the
  6502 code paths that are lifted, and it is not on any reachable live path).

## Per-§5-criterion verdict table

| Criterion | Verdict | Concrete evidence |
|---|---|---|
| **§3 completeness** (the biggest trap) | PASS | **Re-derived statically AND by execution, with a source-verified positive control.** (a) `python3 tools/idiomatic_gate.py worklist tempest` → `total 0  [registers=0 calls=0 pushes=0 addrs=0 mem=0 masks=0 stack=0 unlifted=0]` — **no reachable routine is served by the translated oracle**. (b) Because the layer is `idiomaticComplete` with **call=0 / addr=0 / push=0** (confirmed: a grep for `m.call`/`m.push`/raw `0xHHHH` in `games/tempest/idiomatic/*.js` bodies is empty), every routine-to-routine call is a **statically-resolved JS import**, and the computed-jump dispatchers index **static tables of imported functions** (e.g. `dispatchDrawSetup.js:24` `TABLE = [seedTripleArrays, rotateTripleArray, resetVectorTailCursor, emitVectorTailRecord]`). A missing routine is therefore a **module-load failure**, not a deep-state runtime surprise — and the module loads (browser-boot + all suites pass). This is a *stronger* completeness guarantee than a legacy `m.call(0xADDR)` game, whose gaps surface only at runtime. (c) By execution: the pixel `--done` crawl runs the live idiomatic layer clean over the attract golden (**400 content frames**) and the coin/start/fire gameplay golden (**356 content frames**) with **no boot-gap stop**; `transition.test.js` drives attract→play→**game-over** (a deep state) clean; `tape.test.js` drives coin/start/play clean. **Positive control (verified at source):** `games/tempest/machine.js:126` throws `NotImplemented("m.call: no routine registered at 0x…")` for any unregistered target the RESET/IRQ-vector dispatch reaches, an out-of-range dispatcher index throws a `TypeError`, and `games/tempest/tools/pixel_suite.mjs:112-114` `process.exit(1)`s on **any non-`PIN_DRAINED` stop** (a real boot gap) — while `tools/convergence.mjs:163/206` RED on a truncated run (`run.frames < GC` or `run.stopError`). A gap in a deep state would bite; none exists. The 14s crawl window is an **entropy-pin convergence bound** (see residue 1), not a completeness bound — completeness here is static + execution-confirmed. |
| **done_gate** | PASS | `python3 tools/done_gate.py check --game tempest` → all **9 subsystems `[OK]`** (idiomatic, wiring, grounding, naming, comments, audio, pixel, whole-game, browser). It prints `NOT DONE` **only** because no committed `DONE.md` exists yet — "A green pre-filter is necessary, never sufficient" — which is exactly the file this audit lands. |
| **idiomatic** | PASS | `idiomatic_gate.py check` → `tempest: 0 cruft (budget 25)  [regi=0 call=0 push=0 addr=0 mem=0 mask=0 stack=0 unlifted=0]  <- IDIOMATIC  [idiomaticComplete]`. Zero 6502 primitives, zero `m.call`, zero `m.push*`, zero raw addresses, zero register refs, zero unlifted routines — the idiomatic layer fully REPLACES the frozen oracle. (The 25-cruft budget is the ratchet ceiling; the actual count is 0.) |
| **wiring** | PASS | `node --test tools/test/{registry-coverage,no-stale-mcall,no-frozen-twin-call}.test.js` → **38 tests, 38 pass, 0 fail**. Tempest has **NO entry in `tools/registry-coverage.config.mjs`** (neither `UNWIRED` nor `DEBT`) — the strongest form: *every* idiomatic module is DISPATCHED with no exemption at all. No `m.call` into a still-translated layer; no import+call of a frozen twin. |
| **grounding** | PASS | `done_gate` grounding line → **"fully grounded (17 accounted-for via grounding-debt.txt)"**; `grounding-debt.txt` holds exactly 17 `0x…` entries. **Three spot-checked genuinely irreducible-on-a-good-ROM at source:** **0xd8ca** (`playPowerOnTone`) — its only callers are `foldToneTableByte` (0xd92f) and `seedToneBurstCount` (0xd931), themselves the RAM-march self-test fault-tone arms, so the whole power-on-tone family is reachable **only from a RAM readback mismatch** — a dead error arm on a good image. **0x051e** (`SORT_PAYLOAD_LO`) — written at `buildSortedSoundRequest.js:89`, gated by `if (!ordered)` (line 84) **and** `if (y >= 0xe8)` (line 87): a ≥2-row high-region bubble-swap that a multi-simultaneous-sound-draw state never triggered in capture (only boot-clear observed). **0xb955** (`returnConstantTwo`) — called at `drawMovingObjectSlots.js:84` **inside `if (active !== 0)`** (line 73), the active-object-slot draw arm never taken in deep-play/self-test/full-cycle capture (`b955=0`). The remaining debt (RAM-fault tones d8cd/d92f/d931, EAROM region-erase dde9/dded, the `loc_ccc7` code-fetch bytes cccb–ccce that are misclassified data, and the SORT sibling cells) are the same caller-reached-but-branch-never-taken / dead-error-arm class. Cells `0x223`/`0x263` (this commit) are NOT debt — they are grounded `[seen]`. |
| **naming** | PASS | `naming_gate.py check --game tempest` → "OK (no grounded routine left as loc_)". No `names-debt.txt` needed (absent). |
| **comments** | PASS | `comment_gate.py floor --game tempest` → "OK (every idiomatic file carries >= code // 2 + 3 comments)". `mechanisms.md` present (627 lines), narrated subsystem-by-subsystem against the final idiomatic code. |
| **audio** | PASS | `audio_gate.py check --game tempest` → OK (`model=synth`; map + map/wiring tests + per-voice null-mutant + no self-documented simplification). Model is honestly a **SYNTH** (two POKEYs off the 6502 — no sound CPU, no sample ROM), served by `audio/synth.js`, a cycle-stepped port of MAME's POKEY DSP. The oracle is the **per-voice NULL-MUTANT** the runbook requires for a synth: `node --test games/tempest/test/synth-voices.test.js` → **14 pass, 0 fail**, driving each of the **8 voices** (4 channels × 2 chips) alone and asserting the mix is non-silent, plus idle-silent and volume-0-silent controls. Silence any one voice → that voice's test goes RED. No aggregate-correlation blindness. |
| **pixel** | PASS | `python3 games/tempest/tools/pixel_suite.py --done --rompath ~/Downloads` → **`pixel_suite: PASS`**, re-run independently. **PART A (attract)**: content=400, byte-exact 239 (**59.8%**), within-1%-band 397 (**99.3%**), longest-above-band-run 2; **R/B-swap NULL-MUTANT → byte-exact=0, within-band=0 → FAIL (teeth bite)**. **PART B (gameplay tape coin/start/fire)**: content=356, byte-exact 70 (**19.7%**, loose by design — clock-free play reconverges with small residuals), within-1%-band 351 (**98.6%**), run 2; **null-mutant → 0 → FAIL (teeth bite)**. **PART C** state-validated (see residue 1). The AVG→raster pipeline is independently **byte-exact** vs MAME: `games/tempest/tools/vector_gate.py` → `vector_gate: PASS` (content frames 439, byte-exact 285 = **64.9%** ≥ the 60% floor; the non-exact frames are vector RAM sampled mid-AVG-walk — a harness async-sampling limit, not a pipeline defect — and complete display lists render byte-for-byte; teeth: a color/math regression collapses the fraction toward 0). |
| **whole-game (input-tape replay + forced transitions)** | PASS | `node --test games/tempest/test/*.test.js` → **37 tests, 37 pass, 0 fail**: the coin/start/play tape drives **real gameplay** (into-play + spinner + fire all respond) with input null-mutants (drop coin/start/spinner/fire → the game does NOT progress/rotate/fire), the forced attract→play→game-over arc, the settled game-over screen content (display list rebuilt distinct from play + score triplet intact), and the audio suite. Not attract-only. |
| **idiomatic equivalence** | PASS | `node --test games/tempest/idiomatic/test/*.test.js` → **1296 tests, 1296 pass, 0 fail**. Every idiomatic routine equals the frozen oracle in RAM on real dispatches, with CRAFTED cases and mutation TEETH (twin-off-by-one / carry-chain twins diverge). |
| **browser** | PASS | `node --test web/test/games-boot.test.js` → **9 pass, 0 skipped**; `tempest: boots the way the web worker constructs it`. Registered in `games/registry.js:4` (`GAMES` array). `games/tempest/screenshot.png` present (selector card, 34 KB). ROT: the manifest is `rot: 0` because **ROT270 is baked into the vector transform** (`vector-raster.js`), confirmed display-oriented by `vector_gate` matching MAME's 480×640 ROT270 AVI byte-exact. The worker reads `convergence.idiomatic.irq` (`bootAddr:0xd93f`, nine IRQ slots), an IRQ game with no vblank NMI. Live spinner FEEL + canvas are human-confirm-only per runbook §5 (node cannot drive pointer/canvas) — expected, not a gap. |
| **external disasm** | N/A | Tempest's sound is two POKEYs driven straight off the 6502 — no sound CPU, no sample ROM — so there is no external sound disassembly to do. No `games/tempest/contrib/` exists; a Computer-Archaeology disassembly for Tempest is a SEPARATE deliverable (the CA pipeline, per the runbook's screenshot/CA note) and is **not in scope for this port DONE**. |

## Named residues — each honest, bounded, and not a blocker

1. **Clock-free forced-transition PIXEL residue (PART C).** The idiomatic layer is CLOCK-FREE and reads the
   POKEY `RANDOM` register (a hardware LFSR, no seed to freeze) at a slightly higher **per-frame rate** than
   MAME, so the record/replay entropy pin (golden `RANDOM` values fed into `pokeyRead`) **drains before the
   ~16–30s game-over**; past the pin the RNG-driven STATE (enemy positions, score) forks, so the
   forced-transition PIXELS differ by STATE, not by rendering. This is the runbook's explicitly-permitted
   clock-free hazard (# interrupts during a computation depends on how long it takes), not a rendering defect.
   It is therefore **STATE-validated** instead of pixel-compared: `games/tempest/test/transition.test.js`
   asserts BOTH the attract→play→game-over arc AND the settled game-over screen content (the display list is
   rebuilt distinct-from-play and the score triplet is intact), with a coin-drop null-mutant tooth. Crucially,
   **every rendering PRIMITIVE a forced transition uses is already pixel-validated**: the game-over/score
   glyphs by PART A (attract, byte-exact within a tight band), the level tubes + object vectors by PART B
   (gameplay). So no rendering path is unmeasured — only the RNG-forked pixel *composition* of the tail is not
   byte-compared, which the clock-free design makes infeasible (matching MAME's read-rate would contradict the
   clock-free model). Bounded, player-invisible, teethed at the state level. **The auditor makes this call
   directly** (full autonomy): PART C is an honest bounded residue, not a hole.
2. **Grounding-debt irreducibles (17, all accounted).** Each is a cell whose named role-write is gated behind
   a branch never reached on a good ROM in any reproducible capture: the **RAM-march self-test fault tones**
   (0xd8ca/0xd8cd/0xd92f/0xd931 — reached only on a RAM readback mismatch); the **EAROM region-erase /
   clear-scores** path (0xdde9/0xdded — d804 ran 3628× across all held-input combos with no region-mask
   match); the **`loc_ccc7 registerSound` code-fetch bytes** (0xcccb–0xccce — misclassified as `VOICE_ENV_*`
   data cells but only ever fetched as code/operand at those PCs, code-grounded via `loc_ccc7[seen]`); the
   **≥2-row sound-request SORT branch** payload/key scratch (0x051e/0x051f/0x0520/0x061e/0x061f/0x0620 — the
   `>= 0xe8` high-region bubble-swap in `buildSortedSoundRequest[seen]`, only boot-clear observed); and
   **0xb955 `returnConstantTwo`** (the active-object-slot draw arm of `drawMovingObjectSlots[seen]`, never
   taken in deep-play/self-test/full-cycle capture). Three verified at source above; all are the accepted
   caller-reached-but-branch-never-taken / dead-error-arm class.
3. **`vector_gate` byte-exact fraction (64.9%).** The stable/complete display-list frames render byte-for-byte
   identical to MAME; the ~35% non-exact frames are vector RAM sampled mid-AVG-walk by the offline dump (the
   dump samples asynchronously to the AVG's list walk), a harness limitation, not a pipeline divergence. The
   fraction floor (60%) has teeth — the historical red-channel color bug made *every* attract frame differ
   (fraction → ~0). Bounded and honest.
4. **Pixel gameplay byte-exact is intentionally loose (19.7%).** A clock-free coin/start/fire replay
   reconverges with small per-frame residuals rather than landing byte-identical, so the gameplay floor is the
   within-1%-band (98.6%) + the R/B null-mutant tooth (→ 0), with the tight byte-exact anchor kept on the
   deterministic attract screens (PART A). A real gameplay/rendering regression blows past the band or
   collapses the null-mutant. Named, bounded, teethed.

**Also (expected per runbook §5):** the browser LIVE runtime — spinner feel and on-canvas render — is
human-confirm-only because node cannot drive pointer/canvas; the browser gate confirms the worker-form
construct/render/input/sound seam and a clean boot, and leaves live feel to a human, as the runbook prescribes
for a new render/input path (Tempest is arcade-js's first vector game).

## Conclusion

**Zero open criteria.** §3-completeness is established statically (idiomatic worklist total 0 / unlifted 0,
call=0 / addr=0 → every call a resolved JS import, a missing routine is a load-time failure) AND by clean
execution over attract + gameplay + the game-over transition, with a source-verified positive control that
bites on any unregistered routine or truncated run; the idiomatic gate is at 0 with nothing exempted; wiring,
naming, comments, grounding (17 accounted, three spot-checked irreducible at source), audio (per-voice
null-mutant over all 8 voices), whole-game input-tape replay + forced transitions, idiomatic equivalence
(1296 tests with teeth), the byte-exact AVG→raster pipeline, and browser worker-boot are all green under their
own gates and independently re-verified; the pixel `--done` gate PASSes PART A + PART B with R/B null-mutant
teeth and PART C state-validated; and the four named residues (clock-free forced-transition pixel, the 17
grounding-debt irreducibles, the vector-gate mid-walk sampling fraction, the loose-but-teethed gameplay pixel
floor) are each honest, bounded, and player-invisible with the correct gating. tempest is DONE at commit
`04fc8d62`.
