# pooyan — §5 adversarial done-audit (DONE)

**Verdict: DONE — zero open criteria.**

- **Audited commit:** `83dc4b4d7aa303a1ead6f84b26a83670000f6b87`
  (`pooyan: pixel PART C -- full-attract-loop correctness (§5 pixel criterion)`)
- **Auditor (proposer):** adversarial §5 done-auditor, Claude Opus 4.8 (Claude Code agent), dispatched
  by Jimmy-arcade2. Proposer≠confirmer: this DONE.md's commit is reviewed by a SECOND independent agent
  that re-runs the full §5 audit against the tree at this commit (review_gate, reviewer-rule R40).
- **ROM sha256 (primary game ROM — maincpu, manifest `images.rom`, parts `1.4a 2.5a 3.6a 4.7a`,
  4×8KB contiguous 0x0000-0x7fff):**
  `dff1bf18c7b98800bd6460247cef96103e8e56dba6e611419a01f3eba60cea56`
  — verified against `games/pooyan/rom/maincpu.bin` on disk and against `manifest.js images.rom.sha256`.
- **Audio ROM sha256 (2nd Z80 — tpsound, manifest `images.tpsound`, parts `xx.7a xx.8a`):**
  `8e2b8ac79af7ed62fedd258bdf43b6baadff5e8946d97d308824bd90cc7c6e3e`
  — verified against `games/pooyan/rom/tpsound.bin` on disk, `manifest.js images.tpsound.sha256`, AND the
  `audio/RECORDING-SIGNOFF.md rom_sha256` (all three agree).

The audit ran each gate independently (never trusting "the gates are green") and, for each criterion,
verified it validates ENOUGH. It re-derived the heavy checks the committed gates only attest to (the §3
10-minute boot-gap crawl; the pixel `--done` clean run AND its positive control). This commit `83dc4b4d`
changed ONLY `tools/pixel_suite.py` (+PART C) versus the fully-audited `cc686afd`; the other eight criteria
were verified PASS at `cc686afd` and re-confirmed unchanged here (no tracked change to their artifacts).

## Per-§5-criterion verdict table

| Criterion | Verdict | Concrete evidence |
|---|---|---|
| **done_gate** | PASS | `python3 tools/done_gate.py check --game pooyan` → all 7 subsystems `[OK]` (idiomatic, wiring, grounding, naming, audio, pixel, whole-game). Reports NOT DONE only for the (now-being-landed) committed DONE.md. |
| **idiomatic** | PASS | `idiomatic_gate.py worklist pooyan` → `total 0 [registers=0 calls=0 pushes=0 addrs=0 mem=0 masks=0 stack=0 unlifted=0]`. Zero CPU/memory cruft AND zero reachable routines still oracle-served. 41 boundary dispositions are all reviewed caller-skip dissolutions (not oracle-served), enforced by the wiring gates. |
| **wiring** | PASS | `registry-coverage`, `no-stale-mcall`, `no-frozen-twin-call` node tests all PASS. Every idiomatic module dispatched; no `m.call` into the frozen layer; no frozen-twin call. |
| **grounding** | PASS | `done_gate.check_grounding` → "fully grounded (45 accounted-for via grounding-debt.txt)". Every ungrounded `[code]`/`cert:"code"` item is a reviewed grounding-debt entry; the gate's stale-check enforces each debt address is genuinely ungrounded. Spot-checked 7 entries (tamper counters 0x89e7/0x89e8, dead code 0x0c2a/0x0e46, MMIO 0xa080, tamper-trap 0x0929, ref copy 0x2980) — each structurally irreducible on a good ROM. |
| **naming** | PASS | `naming_gate.py check --game pooyan` → "OK (no grounded routine left as loc_ (3 accounted in names-debt.txt))". The 4 on-disk `loc_*.js` reconcile exactly: loc_0728/loc_60f2/loc_5733 are the 3 grounded names-debt allowlist entries (reviewer-justified); loc_0929 is `cert:"code"` (ungrounded, in grounding-debt), so no rename obligation. |
| **audio** | PASS | `audio_gate.py check --game pooyan` → OK (map present + latch-correct + map/wiring tests committed + recording sign-off). soundLatch 0xA100; RECORDING-SIGNOFF.md valid (rom_sha256 matches tpsound, clips: 20 > 0, date, by_ear covering the multi-context music). Multi-context background music verified coherent: beds map keys are silent-in-isolation music-select codes (0x1c intro / 0x1a board1 / 0x1e-0x21 board2), 0x82 correctly excluded, stop=[0x00]; masterGain 1.79 × bedGain 0.559 = 1.0006 ≈ 1 (faithful balance); `record_samples.py --background` reproduces the 3 beds; audio-map + audio-wiring tests pass (15 pass / 1 skip). The shared `web/player.html` change is guarded (`SOUNDS.masterGain ?? 0.7`, `bgm?.beds ?? {}`, `bgFire` no-op without a beds map); core/audio.js unchanged. Frozen clips games unaffected — timeplt/thepit/frogger/dkong declare no masterGain/backgroundMusic and their full test suites pass (0 fail). |
| **pixel** | PASS | `pixel_suite.py --layer idiomatic --done` → `pixel_suite: PASS`, run independently. **PART A** attract completeness/crash: clean 2400 frames (past the former f1681 crash frames). **PART B** tape-driven gameplay vs MAME: deep-state REACHED round>=1 (board cleared) at golden frame 4955; nearest-golden reconverge worst 5.13%, 1 over 5% band (budget 8), span 5385, distinct 3922. **PART C** (new) full-attract-loop CORRECTNESS: 4900 idiomatic frames vs a fresh 5456-frame input-free golden — byte-exact 3506 (title/story byte-identical to MAME), drift 1394 (demo segment), **worst drift 21px** (band 40 — an 8×8 tile=64px would fail), **matched-golden span 4937 ≥ loop 4515** (validates ≥1 complete attract loop), distinct 4183. `run_done` passes only if A AND B AND C are clean. Satisfies runbook 165-169 (pixel-validate ≥1 complete attract loop, correctness). |
| **pixel teeth (positive controls)** | PASS | Re-run with `--inject-ext-defect`: one flipped pixel on byte-exact frame 300 → drift 1395 > budget 1394 → `pixel_suite: FAIL -- PART C` (0-margin exact drift-count tripwire bites a single-pixel regression). Magnitude band (40px) early-fails any offender > 40px (an 8×8 tile / sprite / persistent region); distinct≥1000 + span≥4000 reject a frozen/short render. The forgiven drift is bounded sub-frame phase-drift (worst 21px, title/story byte-exact), the same class as PART B's already-green gameplay drift — NOT a masked defect. |
| **whole-game** | PASS | `boot.test.js` + `tape.test.js` + `transition.test.js` → 6 tests, 6 pass, 0 fail. Covers boot→attract, coin/start/play tape, and the forced transitions the tapes never reach: round/board advance (ROUND_COUNTER bumps), game-over (GAME_ACTIVE_FLAG clears), life-loss with lives left (PLAYER0_LIVES decrements, respawn). |
| **§3 completeness** | PASS | Re-derived (not just attested): oracle attract boot-gap crawl **36000 frames → CLEAN, 0 gaps, 7366 distinct**; oracle gameplay crawl (coin/start/play tape) **6600 frames → CLEAN, 0 gaps, 4697 distinct** (past the round-advance). No boot gap in a deep state = no still-missing routine. |
| **cleanup** | PASS | `comment_gate.py check` → OK repo-wide (verbose grounded header enforced on every idiomatic module). Sampled ~12 modules across the tree; even the thinnest carries a rich grounded header (WHAT IT IS / THE RECORD / WHAT IT DOES, ROM range, "Grounding tag: [seen]"). Every idiomatic routine carries a descriptive effect name or a reasoned names-debt.txt loc_. |
| **external disasm** | N/A (not in scope) | Pooyan audio is faithful record/replay; the 2nd Z80 (tpsound) is not emulated, so no external disassembly is required for done. |

## Conclusion

**Zero open criteria.** Every §5 completion subsystem is green under its own gate, the pixel gate now
pixel-validates ≥1 complete attract loop for correctness (PART C) with positive controls that bite, the §3
10-minute completeness crawl re-derives clean, audio is recorded + signed off with the multi-context music
verified coherent, and no frozen game regressed. pooyan is DONE at commit `83dc4b4d`.
