# Runbook — porting an arcade game, start to finish

**This is the authoritative, self-contained procedure.** Execute it top to bottom. It absorbs the
load-bearing steps and decisions rather than pointing elsewhere; where it conflicts with any other
`docs/` file, **this runbook wins**, and it is where the process is tweaked going forward. The goal:
turn a ROM into validated, *understood* JavaScript that renders pixel-exact against MAME — with no
decision kicked to a human.

## The two governing rules

- **Novel decision (no rule below covers it):** ground it in **MAME** (never the JS engine), pick the
  **truthful/conservative** reading, **act** — do not park it (a parked decision is a dropped
  decision) — and **write the new rule into this runbook** so it sticks.
- **Feedback loop:** every process miss found on a port becomes a baked-in step here *before* the next
  port. This document is the living method; it gets sharper each game, never stale.

## Standing discipline (applies to every step)

Set the idle-timer first. Commit **locally**; a human gates the push. ROM is **never** committed
(bring-your-own, sha256-verified). Stage **explicit paths** (never `git add -A`); python not sed for
identifier renames; never `--no-verify` without per-commit approval. Work **in batches — ~15 agents ×
3–4 routines each** (≈50/batch; fan AGGRESSIVELY, per-agent spin-up is too high for one, so 20×1 is retired),
**one commit per batch, single-threaded** (don't author the next batch while one is under review), and
**fan the review at the same scale** (≈1 agent per 8 routines — one reviewer can't full-decode 50). **Parallelise as
much as possible — never retreat to one-routine-at-a-time when a batchable pool exists.** Every
commit gets an **independent reviewer** — a gate is not a review; run the repo's gates *before* the
reviewer, and verify a reviewer's *reasons*, not just its ruling. **Grounding always uses MAME, never
the JS engine** (self-grounding is circular). **Author ≠ checker** — mutation-test every routine.
**Quote from a command you just ran, never recollection; no derived counts in commits/docs/prose.**

---

## 0 — Set up and know the game

- Build a properly-named, `-verifyroms`-verified romset first (a loose chip dump lacks the `.icNN`
  names verify needs). Symlink/read the MAME driver locally
  (`mame-src/src/mame/<manufacturer>/<driver>.cpp`) — never a web summary.
- Stand up the MAME observation rig (per-frame RAM dump + poke/input harness) on day zero.
- Write `games/<game>/gameplay.md` — outside-in, from **public sources only, blind to the ROM**
  (objective, cast, controls, win/lose, boards). Flag single-source/contradictory items and expect
  play to overturn some of them. This adjudicates mechanics the code can't settle later; skipping it
  costs many wrong names downstream.
- Do the behavioural grounding **day-zero, before any naming** — running it late forces a heavy
  re-derivation of every name chosen at partial understanding.

## 1 — Identify the machine

Three layers: **CPU** (`core/cpu/<chip>.js` — reuse or new), **board** (`boards/<driver>/`, named
after the **MAME driver**, shared by games on that PCB), **game** (`games/<id>/` = manifest + lift).

- Read the driver `.cpp` for the memory map, I/O ports (active-low vs -high), interrupts/watchdog,
  palette/PROM decode, DMA. Get **every address and offset** from the driver's memory-map *and* its
  video/draw code — never by inference (a guessed sprite base / scroll base / plane order / mirror
  mask is where subtle bugs hide). Verify every hardware fact against MAME source, not a listing.
- **★ Copy the exact MAME `ROT` into the manifest — never a `"vertical"`/`"horizontal"` boolean.**
  `ROT90` = 90° CW, `ROT270` = 90° CCW; a boolean keeps "portrait" but throws away *which way* and
  renders the display 180° wrong.
- A **read and a write at one address are different devices**; a read may have a side effect
  (watchdog kick, coin-counter clock); an LS259 control latch is **one address per bit**. State these
  invariants in the board source up front.
- Model the board from the ROM's own accesses; pin video addressing against the driver's draw routine
  and **cite it in the board source** — a render-addressing offset is invisible to the state diff and
  only the pixel gate catches it. Pin reset facts (CPU reset registers, IX/IY) and `cyclesPerFrame`
  from the pixel clock. The frame origin is the **vblank point** (the interrupt lands at frame
  N.000x); don't confuse the first visible raster line with the vblank offset.
- Model the **WHEN**, not just the WHAT: a DMA sprite transfer **costs the CPU time** (bus stolen —
  derive the per-byte cost), or the CPU reaches later routines early. Derive device
  direction/behaviour from the ROM (which region it writes heavily vs once), not the datasheet.
- `boards/<driver>/hardware.json` declares state-dump regions, MMIO, screen size, driver name, frame
  timing; a drift test asserts it matches `memory.js`/`io.js`.

## 2 — Skeleton first

Stand up a bootable machine and its gates *before* any routine work, so every later gate measures the
real running game, not attract mode.

- Manifest: cpu, board, ROM images + sha256, `inputs` (ports/actions/keys — **coin/start are not
  always the same port**), `entropyPin`, exact ROT. Register the id in `games/registry.js`. Makefile
  `rom` target.
- Board layer (`memory.js`/`io.js`/`video.js`/`hardware.json`): **every unimplemented I/O stub
  THROWS, never returns 0** — a silent 0 is indistinguishable from correct until a pixel diff fails
  hundreds of frames later; throwing turns "not implemented" into a self-naming coverage signal. State
  lives at its real address (the RAM arrays are what gets diffed vs MAME).
- **The game runs on the born-live engine `runIdiomaticGame` from the start** — a clock-free engine
  whose frame boundary is the ROM's own vblank-wait yield. Until routines are rewritten it runs
  **entirely on the translated fallback** (`resolveAllIdiomatic` supplies the translated routine for
  anything not yet done), so it is always a complete runnable game. There is no separate "make it
  live" milestone later. Declare `manifest.convergence.idiomatic.nmiReturnPC` (the ROM PC the vblank
  NMI returns to — the main-loop top): the engine sets it before firing each NMI, and the browser
  worker refuses `runtime: "idiomatic"` without it.
- **Plumb `--input`, `--poke`, and `--pin` into `render.js` in this first pass**, not once the layer
  "looks done." `io.inputAssert` = `{portAddr: pressedBits}`; apply inputs/pokes at the frame boundary
  before the state dump; `emit.js` forwards tape/pokes. Tapes in **pressed-bit** form even on
  active-low hardware; rebuild the assert map each frame; apply inputs for frame 0 too. The
  MAME-vs-JS frame origin differs, so the same tape lands at a different emulated frame per side — the
  offset is a per-game **constant you MEASURE** and write beside the tape. Find input bits empirically
  (press each bit, diff the whole run vs a no-input baseline of identical call structure).
- `mame_golden.py` captures the reference (video/sound off, no throttle/frameskip, fresh nvram+cfg,
  no autosave; self-checked, fails closed); `emit.js` emits the same three formats from the JS machine
  and exits non-zero on a partial run. **Diff order = state → writes → pixels** (state differs ⇒
  CPU/logic; state matches but pixels differ ⇒ video model; writes catch timing the snapshots miss).
- **Build the whole-machine equivalence gate in the FIRST unit** (while there's one routine to
  bisect) and **commission it to FAIL** — break it deliberately (a plausible wrong twin, one wrong
  byte, a leak under a loose window, the seam adapter removed) and keep the teeth running. A gate
  scoped to one routine cannot observe an assembled-system property — a leak in a shared helper or a
  dropped return at the dispatch seam is invisible to it; build it whole-machine, and a gate built to
  pass is decoration.
- **Run the whole-machine state diff continuously — it is the worklist**: boot, see where it diverges,
  fix that routine, boot again (`emit.js` names the next boot gap). There is no standalone CPU
  interpreter, so the only way to execute is the running layer → the gate is forced boot-first.
- **Turn the pixel gate on now and keep it green for the layer's life** (a precondition, not a
  capstone). Declare the game's suite in `tools/pixel_gate_required.py` (an undeclared game's commit
  is refused). The interlock requires the literal `PASS` line; SKIP/INCOMPLETE/FAIL/crash/timeout all
  count as refusal — **never trust the suite's exit code** (it exits 0 when it can't run). Which layer
  the gate renders vs MAME is a **CLI switch** (`render.js --idiomatic` vs the translated path), never
  `manifest.runtime` — "which layer the player runs" is not "which layer I'm validating vs MAME right
  now." Confirm the render path paints **sprites**, not just the tilemap. **Bootstrapping a NEW
  game:** it cannot render a frame matching MAME until translation reaches a rendering state (the
  boot must clear its computed-jump dispatchers), so committing the early translation batches would
  otherwise be refused. Add a TEMPORARY, checkable `EXEMPT` entry for the game in
  `pixel_gate_required.py` (reason: mid-translation, no rendered frame yet — a reviewer verifies by
  booting it to an unregistered-routine gap) and **REMOVE it, declaring the real suite, at the first
  rendered frame.** That removal trigger is a **live checklist item, not a code comment** — re-test the
  render precondition every batch (does the boot reach a drawn frame yet?); a temporary waiver turns
  permanent the moment its exit condition stops being watched. Track it by *does it render vs MAME yet*,
  **never by routines translated** — the primary-goal gate outranks lift throughput, and stacking batches
  on an unvalidated renderer defers the first MAME diff to when the most code rides on the error.
- `make verify` is **not** the pixel gate (it is a disassembly decoder check for another game's ROM).

### ★ Building the pixel gate (the mechanics behind "turn it on now")

The gate is a JS render diffed byte-for-byte against a freshly captured, self-certified MAME golden.
Stand up these pieces in the skeleton; none of them needs a finished layer.

- **The JS render emitter (`games/<id>/tools/render.js`).** Instantiate the machine, run the frames,
  and write a raw frame dump `frames.rgb` (screen_w × screen_h × 3 bytes per frame, RGB888, no header)
  plus a `frames.json` manifest carrying a per-frame sha256. **Paint at the point the player sees** —
  the vblank yield for the idiomatic layer, the plain frame loop for the translated oracle — and exit
  **non-zero** on any boot gap, dropped frame, or short run, so a truncated artifact is never diffed.
- **The certified golden (`tools/mame_golden.py`, shared).** It drives MAME headless with a pinned,
  determinism-controlled command line (video/sound off, no throttle, `-frameskip 0`, fresh empty
  nvram+cfg per run, no autosave — two runs must be byte-identical) and converts the AVI to the same
  raw `frames.rgb`. Two ffmpeg conversions are mandatory: MAME's AVI is **bgr24**, so `-pix_fmt rgb24`
  is required or every frame differs by a swapped R/B that looks like a palette bug; and `-map 0:v:0`
  is required because MAME writes an audio stream even under `-sound none`. The tool **self-certifies
  and fails closed** — a frame-count mismatch or a mid-capture watchdog reset (the boot image
  recurring *after* content first appears) exits non-zero rather than hand back quietly-wrong data.
  The golden is ROM-derived; **never commit it.**
- **Per-game capture inputs.** `mame_golden.py` is game-agnostic: it takes the board from
  `--hardware boards/<board>/hardware.json` and the RAM dumpers from `--lua-dir games/<id>/tools/lua/`.
  Write a `dump_state.lua` that dumps the state that gets diffed (work RAM + VRAM + sprite/object RAM at
  their real addresses). **Ground the board's I/O in `hardware.json`** — the control-latch byte and DSW
  expected values read off MAME, input idle values from the dip-switch defaults — and enforce each where
  it is checked: the board unit tests assert the input/DSW values, and `mame_golden.py`'s config probe
  rejects any capture whose control byte disagrees (a wrong control byte silently poisons every golden).
- **Measure the frame offset; never hardcode it.** MAME's AVI lags the JS render by a per-game
  constant (one frame is typical: `render[N] == golden[N+1]`). Sweep a small window of offsets and pick
  the one that minimises total differing pixels, so a drift either way shows up instead of being
  assumed.
- **One tight band, fail-closed.** After aligning, the verdict is a single full-frame pixel budget set
  just above the measured **correct-layer floor** (a few pixels of mid-frame beam residual) and far
  below one 8×8 tile — loose enough for the known residual, tight enough that a wrong sprite blows past
  it. Guard it with a positive control: require a minimum count of **distinct** frames on both sides so
  a frozen or black screen cannot pass by matching nothing. Print the literal `pixel_suite: PASS` only
  on a clean comparison; every cannot-compare path exits non-zero.
- **★ Expand the frame count — the fast gate is a tripwire, not coverage.** The default `SECONDS` window
  (`pixel_suite.py --seconds`, ~10 s) is a per-commit REGRESSION check, NOT a done-proof: a defect can hide
  just past it. Before a game is DONE, pixel-validate the **full attract cycle AND gameplay** — expand
  `--seconds` to cover ≥1 complete attract loop, and drive an input tape from `games/<game>/tapes/`
  (`mame_golden.py --tape`, `render.js --inputs`) to cover play. Frogger was byte-exact for 49 s, then a
  divergence surfaced only at the attract-LOOP WRAP the 10 s gate never reached — "we should have been
  testing [the long window] all along" (Karl 2026-08-17).
  ⚠⚠ **Run the pixel gate against MAME for a FULL ~10-MINUTE golden — and treat that long run as a
  DUAL check, completeness AND correctness (Karl 2026-08-20).** Capture ONCE
  (`mame_golden.py --seconds 600`, ~36k frames) and reuse it as the boot deepens batch by batch;
  ROM-derived, gitignored (never commit).
  - **(1) COMPLETENESS — the biggest trap.** Run the oracle/boot the FULL golden length; a translation
    gap anywhere in it means a routine reached only in a **deep gameplay state** is still untranslated,
    and **neither a static call-graph closure NOR a short boot will find it.** Pooyan declared §3 "done"
    off a static m.call-closure + a 4000-frame boot — but `loc_1a64` (a 0x15a8 state-table handler whose
    `DISPATCH_TABLE_` constant listed no entries, so the closure was blind to it) sat unreached until
    **frame 4613** of the full golden. A short check will let you SHIP a gap. The long boot-gap crawl is
    the only trustworthy §3-completeness signal.
  - **(2) CORRECTNESS** — the pixel/state diff over the whole run.
  Storage was the old excuse for a short golden and it is GONE: state is cheap (~48 MB at 180 s) and
  `tools/golden_mp4.py compress <dir> --drop-rgb` shrinks frames.rgb ~300× to a byte-exact lossless
  `frames.mp4` (~6 MB at 180 s, ~20 MB at 600 s; verified against the frames.json sha256, fails closed);
  `golden_mp4.py decode <dir>` regenerates frames.rgb before a diff, so every reader is unchanged. Keep
  the full 10-minute frames golden; `--no-frames` (state-only) is a quick spot-check, NEVER the done-proof.
  10 minutes is a **FLOOR, not a ceiling** — extend it for a game with states reachable only much later
  (a late level, the attract-loop wrap); pick the length from where the deepest state the game can enter
  actually occurs, never a fixed count.
  ⚠ **The fixed-offset compare aligns only within ONE landmark segment.** The "collapse pure delay, align on
  a landmark" model runs the attract cycle faster than MAME, so the offset SHIFTS at the loop wrap; a single
  swept offset breaks there even when the layer is correct. An extended / cross-loop / gameplay run must use
  the **drift-tolerant reconverge rule** (`tools/convergence.mjs`, nearest-golden-frame over the whole
  golden), never the fixed `pixel_suite` offset. Settle any cross-loop divergence with reconverge (or a
  longer golden that contains it) before ruling it a bug.
- **Wire it in and drop the waiver.** Declare the suite in `SUITES` in `pixel_gate_required.py` and
  remove the game's `EXEMPT` entry. The gate invokes each suite with `--layer {oracle,idiomatic}`; a
  translated-only game accepts the flag and renders the oracle for both until an idiomatic render
  exists.
- **Gotcha — the comment cap can block the golden edit.** `mame_golden.py` is a shared tool that
  documents external-system quirks, so it can sit over the comment-density cap; editing an over-cap
  file trips the whole-file freeze by design. Bring it under the cap first (relocate the long rationale
  to a doc, preserving every load-bearing note) as its own prerequisite unit, then make the change.

## 3 — Translation pass (disassemble + faithful lift → the frozen oracle)

- Disassemble with **reachability-driven recursive descent** from the real entries (reset and NMI
  vectors) — a linear sweep decodes data as garbage. Cross-check the tracer against **what MAME proves
  is code** (a coin+play executed-instruction trace); the tracer alone can miss executed addresses.
- **★ Build the WHOLE call graph UP FRONT with `tools/callgraph.py` — do NOT discover routines
  one-at-a-time off the boot gap.** The boot-gap crawl (translate until `m.call` throws, translate the
  gap, repeat) is a reachability *oracle* — reliable but strictly sequential; it is what made Pooyan take
  forever. A one-pass static extractor recovers ~all of the routine set before any lift. It must do four
  things plain recursive descent does not:
  1. **Recover the ONE computed-jump that is a code table: `rst 0x28`.** Its handler (0x0028) does
     `pop hl`, so the word table is **inline** — the base is the bytes RIGHT AFTER the rst (the address the
     rst pushed), NOT a preceding `ld hl,nn`. Index by A; bound the length by the `and mask` / `cp N` guard
     just before the dispatch (or where the words leave the code range); read every word and add each to the
     entry set. This is the single biggest miss — it hid the whole object-state handler set behind `loc_40d0`
     twice. ⚠ `rst 0x20` and `rst 0x10` are NOT code-table dispatches: `rst 0x20` is a **byte-table LOOKUP
     returning A** (its table is DATA) and `rst 0x10` is a block-fill helper — treat both as ordinary
     page-zero calls (flow continues) and decode their tables as data, or you inject the data-as-code
     cascade item 4 warns about.
  2. **Flag mid-routine entries.** A `call`/`jp` target that lands *inside* an already-decoded routine's
     `[start,end)` is a **second entry point** → its own `loc_<addr>` (re-emitting the shared tail, like
     `loc_5733` mirrors `loc_572b`), never folded into the parent.
  3. **Derive data-vs-code from REACHABILITY — never a hand-maintained exclusion list.** A stale "this is
     a latch/data" guess is precisely what hid a real routine (`0x60bc`, wrongly hand-listed as a
     non-routine, has a literal `m.call(0x60bc)`). Unreached bytes are data; reached bytes are code. Full
     stop.
  4. **Report the irreducible residue explicitly** — arithmetically-computed `jp (hl)` with no static
     table, self-modifying code. It is small (Pooyan: ~none); resolve those few by MAME executed-trace,
     not by crawling.
  ⚠ **NO static count is a completeness proof — the FULL-LENGTH boot-gap crawl (§2, the ~10-minute
  golden) is the only one.** The raw `--frontier` OVER-COUNTS (Pooyan: ~1693 heads / ~1269 "uncovered"
  vs a true ~459, data decoded as code). The m.call closure (distinct `m.call` targets + recovered
  rst-28 table entries minus the registry) is a useful WORKLIST but it UNDER-counts: it is blind to any
  dispatch-table handler whose `DISPATCH_TABLE_` constant lists no entries (Pooyan's 0x15a8 table hid
  seven state handlers — `loc_1a64` et al. — this way, and both the closure and a 4000-frame boot passed
  clean). Use the closure to SCOPE the next batch, but **prove §3 done only by running the oracle the FULL
  10-minute golden with zero translation gaps** — the deep gameplay states a short boot never enters are
  exactly where the last routines hide.
- Translate each routine one instruction at a time via `m.step(addr, tstates)` — `addr` is the
  **next** instruction (where execution lands). Charge T-states exactly (video depends on *when* each
  write lands; `stepcheck`/`stepaudit` audit it). Keep flags exact (BCD/half-carry/parity/signed);
  pin each flag helper against the reference CPU before use. Model control flow honestly (a tail-jump
  discarding the return → return to the caller's caller; an rst-dispatch → switch on the state byte).
- Name every translated routine **`loc_<addr>`** — no `sub_`/`handler_` prefixes, no English. **One
  file per routine** (`loc_<addr>.js` + `equivalence-<addr>.test.js`). **Export every routine from
  line one** (the idiomatic rewrite reuses the oracle's copy of any un-rewritten callee — exactly one
  copy). Write every call as **`m.call(0xADDR)`** (the registry seam is what makes a routine isolable
  for capture/replay); keep `push16`/`step` at the call site.
- Boundaries: an externally-entered `loc_<addr>` is a routine boundary → one file; the parent stops at
  boundary-1 and **delegates** (`return m.call(0xBOUNDARY)`), never inlines across it. Partition the
  lift by **range, not filename** (walk control flow to a real terminator; subtract vs tracer
  **coverage**, never filenames). An interior branch target is not an entry point.
- **Evaluate a conditional's guard before believing its target** — a self-checksum ROM aims its dead
  failure arm into **data**; model the trap (aimed at data → `throw`; aimed at real re-entered code →
  delegate); what the guard READS decides severity (a ROM-sum guard firing ⇒ the image is wrong; a
  work-RAM guard firing ⇒ the port has a bug).
- Faithful lift = **memory-equivalent + mutation-tested, validated in isolation off the live game**.
  The translated layer carries **no prose** (SPDX, a one-line identity, per-instruction address/
  mnemonic comments; a trailing `--` clause names what bytes *are*, never a mechanism). **Write it
  UNDER the `comment_gate` density cap (comments ≤ code//4 + 4) from the first draft** — keep the
  checkable `--` clauses, drop mnemonic-only restatements (an address/mnemonic line with no `--` clause
  is usually cuttable, and a two-line JSDoc that fits on one should be one). A batch that lands under cap
  needs no pruning pass. This binds **boards, manifests and test files too** — Time Pilot is the quality
  model (its files predate the cap and are grandfathered, so match their KIND, not their higher density).
  **≈50 routines/batch (~15 agents × 3–4) — fan AGGRESSIVELY; shrinking the batch out of caution is the
  failure mode, not the safe default.** Scope the batch from the whole reachable closure, not just the current
  boot frontier — the deferred callees are provably reached (translated code already `m.call`s them), so
  translate them in bulk ahead of the boot; the boot-statediff still runs each merge and live-validates the
  swath as the boot advances into it. Regenerate the registry after batches land (`gen-registry.mjs`), not per batch.
- **Fan out every batch — parallelise as much as possible; do NOT get scared and start one-by-one.**
  Serial pace is the failure mode, not the safe default: when a batchable pool exists, going one-at-a-time
  is the mistake. A batch is a serial→parallel→serial sandwich: ONE setup (fold the entrypoints, re-trace to a single
  stable disassembly, pre-assign each routine's RANGE), **~15 agents × 3–4 routines each (≈50/batch)** (one-per-agent
  wastes spin-up; scale the agent count to the pool — a 13-routine pool is 4–5 agents, not 13), then ONE
  merge (regenerate the registry, run the boot gate + stepcheck on the assembled set). Distinct
  `loc_<addr>.js`/`<addr>.test.js` (and idiomatic module/test) files never merge-conflict; the only
  cross-agent care is those pre-assigned ranges (so two agents don't disagree on a boundary) plus a
  style/ABI check at review.
  ⚠ **Balance the split by estimated CODE VOLUME, not seed-entry count.** A seed entry with a large gap
  to the next known entry expands into however many in-range sub-routines the disassembly holds, so
  "N entries per agent" fans out wildly lopsided — Pooyan batch 3 gave one agent 72 routines (a dense
  4 KB span) and another just 1 (its span was mostly data), and the big one ran ~90 min solo,
  concentrating both the wall-clock and the review risk. In setup, ESTIMATE routines-per-range from
  each span's decoded instruction blocks (NOT the byte gap — most of a large gap is data/unreached) and
  size the groups to the ~3-routine target; a genuinely huge span gets its OWN batch or a sub-split at
  interior routine entries, never buried in a mixed group.
  Shared files (the registry, `names.js`, board files) stay under serial control — agents RETURN their
  `names.js`/registry additions, the coordinator merges them. This parallelism is *within* a batch — the
  across-batch rule still holds (don't open the next batch while this one is under review).
- **Fan the REVIEW too, at the same scale as the translation.** A ~50-routine batch cannot be full-decoded
  by one reviewer — split the independent by-execution review across **~1 agent per ~8 routines** (a workflow
  returning compact per-routine verdicts, not N loose parallel agents), then reconcile the blockers serially.
  The review-fan is what keeps per-routine rigor at batch scale: it has caught real defects (missing-`push16`,
  T-state mischarges in untested paths, mis-scoped loop-latches) that every mechanical gate and the per-routine
  tests passed clean. Each review agent decodes its routines' whole range against the ROM (not just tested
  paths) and runs its own positive control. Routines translated ahead of the boot lean on their equivalence
  tests + this review until the boot reaches them.
- **Even the hard spine parallelises — in clusters, not one-by-one.** "Hard" means each unit needs a
  bespoke fixture (tape/golden, pixel gate) or careful grounding, NOT that authoring conflicts. Group the
  interdependent routines into coherent CLUSTERS (siblings sharing state, a render group sharing the pixel
  gate) and run ~1 agent per cluster in parallel; born-live `m.call` fallback decouples the authoring, and
  equivalence gates correctness regardless of order. Keep the GROUNDING careful (the spine is where
  grounding-overturns hide) and **wire the spine dispatchers LAST, validating them serially** (a bad
  dispatcher wire breaks the whole live game — the pixel/live gate is what catches it).
  **Before opening the next batch, re-check any waived gate's removal trigger** — a pixel-gate waiver comes
  off the instant the game first renders, not once the lift is finished.

## 4 — Idiomatic pass (the spiral)

Rewrite the lift into readable JavaScript **and** recover what it means, spiralling up the call graph.
The spiral has two alternating halves — **decompile** (correctness) and **understand** (meaning) —
run as separate commits (never two decompile commits in a row); understanding compounds batch over
batch and feeds the next batch's targets.

### The decompile half

- **Batches of ≥40 routines, leaves-first** (Karl 2026-08-20: the idiomatic and translation passes are
  the **same size** — floor **40** — so fan AGGRESSIVELY, ~15 agents × 3–4; do NOT retreat to tiny leaf
  batches). A caller decompiled before its callee has to hand-marshal the callee's register ABI, an
  assembly leak the equivalence gate can't see, so still go leaves-first: re-derive the leaf set **each
  batch** by closing the call graph over current `m.call` targets, and pull ≥40 of them per batch.
- **`batch_size_gate` enforces THIS pass too, at the SAME floor (40).** It counts the idiomatic MODULE
  files a commit adds (N) and holds them to the shared floor while routines remain to decompile
  (R = the game's `loc_` routine files minus the idiomatic modules present); a genuinely small final
  cluster clears with the `--reason` waiver. (Karl 2026-08-20 set the two passes to the same size,
  overriding the earlier "idiomatic economics warrant a lower floor" note — the floor is 40 for both.)
- Per routine ship all **four**: module + `equivalence-<addr>.test.js` + `ROUTINES` entry + green
  gate. **Done only when DISPATCHED** — `resolveAllIdiomatic` walks `ROUTINES`, so a module no entry
  names is never overridden. Done requires that **no routine runs as the frozen oracle in the live
  game**: every reachable routine is either wired as a live override (in `ROUTINES`) OR — for a genuine
  caller-skip whose net +4 SP move the withOmittedRet seam cannot seat — DISSOLVED into a direct-called
  boolean and recorded in the config with a `DISSOLVED ... not oracle-served` reason. An `UNWIRED`/`DEBT`
  entry that means "oracle-served, can't-seat, left translated by design" is a **transient debt state,
  never done** — a seam throw is the signal to DISSOLVE, never to leave the routine translated. Silence
  reads as oversight.
- Fidelity = **memory-equivalence**: RAM minus stack scratch + `pc` + `SP` + declared live-out;
  **never the full register file, never cycles**. **Derive live-out from the oracle, never the module
  header** (a gate whose excluded set matches its module asserts the divergence — green on broken,
  red on correct). When a routine's live-out **is** a register, add a **standing register-comparison
  arm** — a memory-only gate passes a register-valued rewrite that is wholly wrong. Every gate carries
  teeth. Test by **capture-clone-replay** (hook the address, `m.clone()` at each real dispatch, replay
  in isolation); for arms the run never reaches, craft an entry — a real captured state with one
  variable poked identically on both sides.
- **Dissolve an `m.call` when you write the CALLER**, not when the callee lands. Before writing
  `m.call(0xADDR)`, check whether the callee is already decompiled (a stale marshalled call is
  memory-equivalent → the gate misses it, it reaches the reviewer). The `no-stale-mcall` lint must
  resolve file-local `const NAME = 0x…` aliases, not just literal hex. A bare-return no-op module
  dissolves to nothing (inline + delete module/entry/test). A strongly-connected cycle lands as one
  unit. Partition caller files across agents; don't run a rename pass while authoring agents are live.
- **Fan agents WRITE + parse-check only; the LEAD runs the equivalence tests.** A decompile fan must
  NOT have each agent run `node --test` — N agents each spawning a Machine-booting test at once starve
  CPU, and an agent that retries a slow/hung test livelocks the whole fan (2026-08-20: a batch-2 fan
  pinned a core ~5h across a compaction). Agents verify only `node --check <module>` (parses) +
  `idiomatic_gate worklist <game>` (cruft-0) then return; the LEAD runs every `equivalence-<addr>.test.js`
  SERIALLY in reconcile, each wrapped in an OS `timeout`. A timeout is a **bug to fix** — a
  non-terminating test is a real defect (e.g. the `ramDiffMinusStack` subarray-offset loop that spun on
  ≥2 dead-stack diffs) — **never a retry**. A background fan is not fire-and-forget: after a compaction
  FIRST check whether one is still live (`ps` for `node --test`; the fan's `agent-*.jsonl` mtimes) and
  kill a stalled run (`TaskStop <task-id>`); a large fan gets a stall watchdog.
- Idiomatic rewrite = routine-**local** rules + routine-**wide** rules (input-register → optional
  param defaulting to the register `fn(m, x = m.regs.a)`; interface-register → explicit value/return;
  phantom no-op → inline+delete). Never weaken an assertion. **Address-retrofit:** no idiomatic routine
  references a data address by raw hex or a routine-local const — import it from `names.js`; use the
  **`_ADDR` convention** when an address is also a routine entry.
- **Registers become params/vars/returns AS YOU AUTHOR each idiomatic module — never as a later
  sweep.** The goal is **all CPU registers gone** from the idiomatic layer: no `regs.*` in a body or an
  idiomatic call site. (The `= m.regs.X` in a param default is the one sanctioned exception — it is the
  load-bearing bridge for register-based `m.call` dispatch from the *frozen* translated layer, which
  cannot pass named args, so it stays; it is exempt from the count.) **Enforced by
  `tools/idiomatic_gate.py` (pre-commit)** — the single gate that counts ALL idiomatic-layer cruft
  (register refs + `m.call` + `m.push*` + raw `0xHHHH`) and holds every `games/*/idiomatic/` to a
  per-game budget (implicit 0), so a NEW game is fail-closed from its first module and an author
  literally cannot commit new cruft. `tools/idiomatic-budget.txt` is a **shrinking allowlist of
  grandfathered exceptions only** (a game mid-burndown; legacy games frozen at their count); a game
  absent from it is held at 0, and a game is IDIOMATIC (a done requirement) only at 0. ⚠ frogger was authored register-full and is being retrofitted down after the fact — the
  debt this rule exists to prevent. Do not repeat it: on the next game, the gate is green only if every
  module was born with its registers already named.
- **★ Closure — a reachable routine still served by the oracle is cruft too.** A born-live layer
  silently falls back to the translated routine for anything unlifted, so it *runs correctly* and the
  behavioural worklist (the state diff, §2) never flags it — a whole reachable sub-tree can stay frozen
  while every gate is green (the frog-anim render cluster hid exactly this way). The cruft *count* alone
  said "some cleanup remains," never *which* routines. So `idiomatic_gate` now also counts, for a
  **closure-enrolled game** (`CLOSURE_GAMES`, frogger only until a legacy game is worked), every
  **reachable-but-unlifted routine** — the translated `_registry.generated.js` set (graph-closed by the
  §3 recursive descent) minus the idiomatic `ROUTINES` overrides minus a reviewed
  `tools/idiomatic-boundaries.txt` allowlist (`dead` = callers dissolved, `boundary` = genuinely left
  ROM) — and **lists them by address** in the worklist. The total cannot reach 0 while any reachable
  routine is oracle-served, so the frozen tail is a **named, finite work-list, not an inferred number**,
  and completeness is STRUCTURAL (the call-graph closure) rather than behavioural (does it play right).
  This is the enforcement the latent rules (§4 "close the call graph over current m.call targets", §5
  "every reachable routine runs as JS") always implied but nothing measured. (Recorded 2026-08-17: a
  frogger frog-anim sub-tree of ~10 routines ran entirely on the translated fallback while
  registry-coverage read 100% and every pixel/whole-game gate was green — the count was nonzero but
  named nothing; Karl: "just add the unlifted routines to the cruft list.")
- **Outgoing registers: `return` by default; a return-assignment for the load-bearing case.** The gate
  cannot infer input-vs-output from a `regs.a = value` write, and it does not try — **the author
  declares intent in the form and the gate enforces the form.** A routine that produces an interface
  register **returns it**; idiomatic callers use the return, no `regs.*` write, gate-clean by
  construction — the default for a born-idiomatic game. Several idiomatic outputs return a tuple
  (`return [a, hl];` → `const [a, hl] = fn(m);`). The one exception is a **load-bearing** register-out:
  the routine is register-dispatched via `m.call` from the *frozen* translated layer, whose caller
  reads the result straight out of the register, so a plain `return` is invisible to it. Write those as
  a **return-assignment** — `return (m.regs.a = value);` — which sets the register (for the translated
  dispatch) *and* returns the value (for idiomatic callers); never a bare `regs.a = value;`. So the
  exempt forms are: a param-default (incoming), a `return`/tuple (idiomatic outgoing), and a `regs.X`
  write that is **part of a `return`** (load-bearing outgoing); the gate flags **every other** body
  register reference as debt, and the **reviewer audits** each return-assignment as a genuine
  dispatch-out under proposer≠confirmer. Multiple load-bearing outputs generalize the same way —
  `return [ m.regs.a = foo, m.regs.hl = bar ];` sets every register (for the dispatch) *and* returns the
  tuple (for idiomatic callers); each write still sits inside the `return`, so the one gate rule covers
  it with no special case. (An assignment evaluates to its RHS *before* the register's width mask, so
  the returned value equals the stored register only for an in-range output — always true for a genuine
  register-out.)

### The understand half

**★ An understanding pass is TWO stages, and the second is MANDATORY. Naming is stage A; GROUNDING is
stage B; a pass that stops after stage A is not finished and MUST NOT be committed as done.** Stage A
(name from body + callers, two blind derivers, promote on convergence) produces `[code]` *proposals* —
a self-consistent reading of the code, nothing more. Stage B plays and pokes each proposal — **both a
routine's role AND a data address's role** (grounding is not routines-only; see *Ground addresses, not
just routines* below) — on the **real ROM under MAME** — never our own engine, which is our own model,
so grounding against it is circular — to lift it `[code]`→`[seen]` or to OVERTURN it. **A batch of fresh `[code]` names plus a
`[code]`/`[guess]` `mechanisms.md` is a grounding WORK-LIST, not a finished map**; the pass completes
only when that list is grounded-or-accounted-for, under **proposer≠confirmer** (whoever grounds a name
is not who proposed it — a prose review is not grounding). Honestly tagging an uncertain item `[guess]`
does **not** discharge stage B: a `[code]` name is a proposal that owes a grounding, not a finished
label. If you did not run MAME this pass, you have not grounded, and the pass is not done. (Full
formula and method in `understanding.md`; it is not optional there and not optional here.)

**Why stage B gets skipped — the failure mode this rule exists to stop.** Grounding leaves almost no
*diff* artifacts: it is `[seen]` tags, notes, and the occasional overturned name — not `git mv`
renames. So reconstructing "how an understanding pass works" from a past commit's diff shows only stage
A (the renames + the map) and silently omits stage B. **Derive the method from this runbook and
`understanding.md`, never from the shape of an old commit.** (Recorded, 2026-08-14: a frogger
understanding pass reconstructed its method from a prior commit's diff, named + mapped everything at
`[code]`, and was one review away from shipping stage-A-only — the map read as finished because every
tag was honest; honest tags are not grounding.)

- **Confidence-tag every claim:** `[seen]` (chain ends in a MAME observation), `[code]` (from a
  translated routine's behaviour — harness replay), `[guess]`. A confidently-wrong role is worse than
  a neutral `loc_`.
- **Front-load RAM/variable naming before routine naming** — named memory is the biggest legibility
  lever, and routine names derive from what a routine does to memory. Variable names = consensus of
  every routine touching an address (never one routine's local view); routine names = mechanism +
  callers.
- **★ A cell earns its DESCRIPTIVE identifier the moment it reaches `[code]` — the `[guess]`→`[code]`
  transition — not at grounding.** As soon as a cell's reading is confident enough to be `[code]`
  (understood from the routines, consistent across the ones that touch it), RENAME its `names.js`
  `export const` from `loc_<addr>` to a DESCRIPTIVE name (the `PLAYER_X`/`CREDIT_BCD` style — see
  `names-registry.md`) and update every importer. This is **value-identical** — the address never
  changes, only the identifier. A `[guess]`/unknown cell takes a **`loc_<addr>`** name, allowlisted in
  `tools/names-debt.txt` — a readable placeholder that clears the raw-hex cruft and marks the role
  pending; promote it to a descriptive name the moment it reaches `[code]` (loc_ is never valid for a
  `[code]`/`[seen]` cell). (Amended 2026-08-17 by Karl: unknown cells take loc_, not keep-hex.)
  Grounding (`[code]`→`[seen]`) then only CONFIRMS the name — or OVERTURNS it, forcing a re-rename — it
  does not *first* bestow it. A confidently-read cell (`[code]` **or** `[seen]`) still named
  `loc_<addr>` is an unfinished job: the tag says we understand the byte, the symbol the code runs on
  says we don't, and every reader pays the `mem16[loc_83ef]`-vs-`mem16[HIGH_SCORE]` legibility tax the
  idiomatic layer exists to remove. (Recorded 2026-08-15: the frogger pipeline left the bulk of its
  confident cells — `[code]` and `[seen]` alike — named `loc_<addr>`; Karl: "when a cell changes
  guess→code, that's when it should be renamed." Grading the role without promoting the name is half the job.)
  **Enforced** at review by `reviewer-rules.md` R31 (a `loc_<addr>` idiomatic cell const FAILs) and
  mechanically now by the `names_consistency` gate rule (B): it FAILs any new `loc_` cell while
  grandfathering the existing debt (`names-debt.txt`); fully debt-free once the backfill clears.
- **★ DECOMPILE the routines FIRST — THE priority; get as many routines done as possible. Cells come
  automatically from routine work (Karl, 2026-08-21).** Maximizing routine throughput — the decompile
  half above, plus grounding routine ROLES here — is THE priority; do NOT divert into a standalone
  cell-grinding campaign. A cell's role IS what the routines do to it, so decompiling and grounding a
  routine — observing it run under MAME and confirming what it reads/writes — grounds the cells it
  touches in the SAME work. Do NOT isolate an ungrounded cell and build a bespoke experiment to force
  its value; that is backwards and slow. Decompile and ground the routines, and the cells fall out as a
  byproduct — the cell-grounding mechanics below describe what that byproduct looks like, NOT a separate
  cell-by-cell campaign. When a cell's routine is understood but the cell only changes on an unreachable
  arm (an anti-tamper error path, a state no valid play reaches), it is ACCOUNTED FOR by the routine's
  grounding + a reasoned note — not chased with a tailored capture. (Recorded 2026-08-21: pooyan work
  was being driven cell-first — isolating individual ungrounded data cells and forcing each with a
  tailored tamper/poke/read-tap capture — instead of decompiling routines; Karl: "decompile the
  routines first. that's the priority. get as many routines done as possible." … "cells come in
  automatically from routine work.")
- **Ground addresses, not just routines — stage B applies to every claim in `names.js`, cells
  included.** A data address carries a confidence tag exactly as a routine does, and a fresh batch's
  data-name cells land at `[code]` (a code-only reading) until grounded. Lift a **RAM cell**
  `[code]`→`[seen]` by watching it under MAME — the value change, poke, or write-tap that confirms its
  role (a countdown draining to zero at frog-spawn; a slot cursor advancing 1..5). A **ROM address** (a
  constant, a table base) is grounded by confirming what the machine *reads* from it and does with it,
  not by watching it change — it never changes; this is the harder, still-open case, so tag it `[code]`
  honestly when the chain cannot yet terminate in a MAME observation. Ground the cells a routine touches
  in the SAME pass as the routine — never lift the routine roles to `[seen]` and leave their cells at
  `[code]`. (Recorded, 2026-08-14: frogger UP-1/UP-2 grounded the routines but left every data-name cell
  at `[code]`, including cells watched directly under MAME — the exact gap this rule closes.)
- Both get **three looks**: two BLIND independent derivations (from body + callers, neither sees the
  other), promote **only on convergence**, then a third **adversarial** re-derivation — two blind
  derivers can converge on the same wrong reading. The lead edits `names.js`, never a proposer. A name
  isn't done until code **uses** it (`names.js` + retrofit in one commit).
- **Promoting an idiomatic name = a rename retrofit in ONE commit — the concrete steps** (they live
  here so no one reverse-engineers them from a past commit's diff): `git mv
  games/<game>/idiomatic/loc_<addr>.js <name>.js`; rename the **exported function** to match the file
  (`resolveAllIdiomatic` imports `mod[name]`, so export name = the ROUTINES `name` = the filename); in
  the equivalence gate, repoint the **idiomatic** import + its usages to `../<name>.js` but **leave the
  frozen oracle import `../../translated/loc_<addr>.js as oracle` untouched** — the translated layer
  keeps `loc_` forever, and the gate file itself keeps its `equivalence-<addr>` address name; update the
  `names.js` ROUTINES `name` field (and prose that cites the routine); rewrite `mechanisms.md` in the
  **same** commit (`understanding_gate` CHECK A binds a names.js change to a staged `mechanisms.md`;
  CHECK B forbids any **retired** `loc_` name from appearing in the map). Do the identifier swap with a
  **word-boundary script**, never a blanket replace — a blanket replace rewrites the frozen oracle
  import and the shared data-name consts. `git mv` stages the OLD blob, so `git add` the edited file and
  `git diff --cached` to confirm the rename **and** the content landed. The commit subject is
  `<game>: understanding pass N — …` (classifies UNDERSTANDING for R1).
- **Name by EFFECT**, not internal mechanism — trace each live-out to its final consumer and name the
  verb it causes (`steer`/`spawn`, not `classify`/`detect`); if the output is read in place of another
  input, the routine *generates* that input. Name a routine whose **mechanism** is confident even if
  its game-purpose is open (purpose as `[guess]`); `loc_` is reserved for an unclear mechanism.
- **A wrong name is worse than none.** When derivers diverge or the reading is underdetermined, stay
  hex and flag. **Recorded keep-hex decisions are binding:** a routine with no absolute entry point
  stays hex (a range fragment isn't its own routine); a refused name is not re-proposed; **read the
  `names.js` `why` and `mechanisms.md` before renaming** — a regex scan of the `why` is a broken
  instrument.
- **Ground a load-bearing, code-undecidable pick IN-LOOP before committing the name** — deferring
  propagates the wrong pick into everything built on it. Take four **theory-free** measurements first:
  does it execute and where; write-set (clone+diff vs the memory map); who calls it and what they do
  with the result; what changes on screen. Experiment: hypothesis → reach the state → watch → A/B with
  a **negative control** (the control is the proof) → prefer a natural run; verify a positive control
  actually moved pixels (a no-op write reads like an invisible one). On a write tap the reported PC is
  the **next** instruction.
- **Sweep reachability before deciding anything is blocked** ("unnamed" ≠ "unreachable"). A hit count
  is not a dispatch count for a routine that WAITS; tap a known-executing address first and confirm
  it's non-zero; without a driver the sweep measures attract only. A search's zero is not absence
  until the instrument is shown working on something known-present.
- **★ `mechanisms.md` is REGENERATED WHOLE every understanding pass — never patched, never an
  incremental edit, even for a one-routine change** (Karl, 2026-08-17). Throw the prior map away and
  re-derive the ENTIRE document from the current code, every time. Method: fan out one code-reading
  subagent per subsystem, each re-deriving mechanism from the ACTUAL routine bodies (idiomatic override
  + frozen oracle) — **blind to the prior map**, forbidden to paraphrase it or the `names.js` role
  strings; the lead stitches the sections, VERIFIES every mechanism claim against the code, and carries
  grounding TAGS from the `names.js` `cert` field (`[seen]` is never re-invented by a code read — the
  TAG, not prose, is how the map records that MAME confirmed a role). **Grounding is conveyed by the
  tag, NEVER by narrative** — no "MAME overturned/confirmed X", no wave dates, no golden names; that is
  development history and gets stripped. A current-state WARNING that a reading is counterintuitive ("X
  is a counter, not a static base") stays, but stated about the code as it IS, with no before/after
  framing. **It is a CURRENT-STATE description, NOT a development history** — no "batch N did X"
  chronicle, no decompile-campaign narrative; describe what the machine IS now. **And it reads as
  NARRATION** (Karl, 2026-08-17) — flowing, human-readable exposition a person follows to understand how
  the machine works, NOT a bare fact-listing (comma-strings of cells/offsets, bulleted catalogues). Every
  fact is present — cells, addresses, control flow, grounding tags — but woven into explanatory prose with
  the connective tissue (why a step matters, how the pieces fit) that makes it readable. A patch that
  touches a line or two is the exact anti-pattern: it lets the map drift and reads as finished while stale.
  `understanding_gate` CHECK A binds the regenerated map to the commit and fires on **additions** too,
  by design; a fresh-vs-patched regeneration is a reviewer call (`reviewer-rules.md`). `names.js` is the
  single source for a cell's name/role/tag; prose cites it, never contradicts it (`names_consistency`).
  Promotion requires a proposer≠confirmer who **independently re-derives** — a prose review is not a
  confirmation.

### ★ The clock-free block — handle these four together

The idiomatic layer charges no cycles, so anything the real hardware ties to time or the beam needs
deliberate handling. These four are one problem and are decided together, once, per game:

- **Vblank / interrupt handling.** Running clock-free means a cycle-driven vblank busy-wait would
  never tick — so the frame boundary *is* the ROM's vblank-wait yield, and the interrupt is fired
  **at that yield** (the real machine only accepts it when the main loop idles). Spine routines that
  can reach a vblank wait become `function*` (callers use `yield*`; the classic bug is a `function*`
  called without `yield*`, which silently skips the wait); the vblank wait becomes `yield`; a warm
  restart is a boundary sentinel, **not** a `yield*`; leave the emulated CPU stack ops alone.
  - **★ No main-loop wait (the NMI is the sole heartbeat) → collapse to one iteration per frame.** Some
    games never busy-wait: the main loop free-runs and the vblank NMI, firing asynchronously, does ALL
    per-frame work (render + input + the game-state dispatch), so the CPU is interrupted at a PC spread
    ∝ execution frequency with NO single-PC spin. MEASURE this before assuming a dkong-style wait — an
    NMI-return-PC histogram off a MAME read-tap on the NMI vector (gate CURPC, read the pushed return
    PC off SP). With no ROM wait to yield at, the born-live yield is SYNTHETIC: make the main loop a
    `function*` that `yield`s once per outer iteration, and set `nmiReturnPC` = `pollPCs` = the main-loop
    TOP. Firing one NMI per iteration keeps game-time 1:1 with MAME (every NMI is one frame) and
    collapses only the ~N redundant intra-frame iterations — VALID only because those are
    memory-idempotent (anti-tamper re-checks, VRAM refreshes that rewrite the same bytes). PROVE the
    idempotence, don't assume it: run the translated layer under `runCycleFree(pollPCs=[top])` and
    reconverge vs a MAME golden (`convergence.mjs --mode state`); a clean reconverge (only the RNG
    residual) confirms the collapse, a large persistent diff means an intra-frame iteration is NOT
    idempotent and the model is wrong. (Pooyan: top 0x020f, worst 8 bytes/frame vs the attract golden;
    dkong by contrast has a real wait at 0x02bd, so its yield is the wait, not the loop top.)
- **Entropy pinning.** Most arcade RNG seeds from a spin counter the main loop increments while
  waiting for vblank — timing-derived, so a clock-free layer forks it within a few frames and every
  RNG-driven sprite drifts. **Pin it for testing only** (it forfeits falsifiability): discover the
  set by attract-diffing the two engines per frame (the spin counter forks first), declare
  `manifest.entropyPin`, express the pin **twice** (a JS seam and a cycle-neutral ROM operand patch)
  so the two check each other, and **never pin the shipped game.**
- **Loose (convergent) pixel gating.** With entropy pinned, RNG- and DMA-driven pixels don't land
  byte-identical — they **converge**. Gate them with an **align-tolerant diff** (each frame vs its
  nearest golden frame): small deviations allowed, but the residual must **reconverge, never
  diverge**. **Never lower the floor to reach green** — the tolerance is a hardware-jitter property,
  calibrated once and committed, not a knob.
- **Scan-line tricks (sprite multiplexing, split-scroll, status/palette splits).** Wherever the game
  mutates video state mid-frame in step with the raster, a single end-of-frame snapshot can't
  reproduce it. Use a **beam-sync band accumulator** (`startBeamFrame` / `paintBeamBand(row)` /
  `finishBeamFrame`) painting each band from current RAM, driven once per frame by a per-game beam
  routine; declare `manifest.convergence.beam`. It is **state-neutral** (final RAM identical);
  non-beam games cost nothing; validate with a positive control forcing the single-snapshot path so
  the residual returns.

### Driving coverage

- **Poke-tapes are required per game** — they pixel-validate the DISTANT routines (later levels, 2P,
  game-over, boss) the base tape never reaches, moving them `[code]`→`[seen]`. Key pokes on the
  **NMI ordinal**, never a raw frame index; use `POKE_OFFSET = 0` (a direct RAM poke has no
  input-debounce pipeline); poke the **trigger** then play in — poking a raw end-state renders
  coherent-looking garbage on both sides, a weak check.
- **Run a long continuous idiomatic run** (many minutes) diffed vs a matching golden, RAM first — the
  base and poke tapes are each too short to catch time-accumulated bugs that surface only deep into a
  session. ⚠ A RAM diff is BLIND to render and audio: the RAM can be byte-correct while the screen or
  the sound is wrong (see the next two bullets), so RAM-clean is necessary, not sufficient.
- **The deepest gameplay test is a real human PLAYTHROUGH — play it / WATCH it, do not just
  replay-diff it.** Record a human playing a long session (`mame -record`, and pass NO
  `-input_directory` or it silently no-ops). It drives the collision / scroll / audio paths the
  attract gates and RAM state-diffs cannot see. In practice these bugs surface by EYE and EAR, never a
  diff: a tilemap scroll drawn with the wrong sign (every lane/vehicle rendered backwards — invisible
  to RAM diffs, and the pixel gate false-passed because a uniform background keeps any frame ~2-4%
  "similar"), and a repeated effect that played only once (each hop re-writes the SAME sound-latch
  byte, and the edge-deduped event stream dropped the repeats). Both were found by playing in the
  browser, not by any automated gate.
- **Do NOT trust a fixed-origin frame-by-frame replay of a recorded tape vs MAME.** The idiomatic
  boot/board collapse warps the timeline NON-UNIFORMLY (a ~44-frame board wipe busy-wait drops to one
  frame), so a tape replayed at one constant frame-offset drifts and manufactures FALSE divergences (a
  "carry bug" that was pure replay desync, not a game bug). To replay-diff a real tape you must re-sync
  on a landmark per life/board — or reproduce the collapsed busy-waits' frame counts so the timeline
  stays aligned. The offset is not a constant across a whole session; it jumps at every collapse.
- **Per-mechanic POKE tests vs MAME are the reliable per-mechanic detector** (`tools/mechanics_gate.py`,
  game-agnostic; a game supplies `games/<g>/tools/mechanics_suite.py` printing `MECHANIC <id> PASS|FAIL`).
  For EACH declared mechanic, poke the exact scenario (frog on a log, mid-hop, at a bay) identically into
  the JS engine AND MAME, drive one input, and compare — MAME is the oracle, so there is no author-guessed
  expected value, and poking the setup sidesteps the tape-alignment problem entirely. This is what catches
  the gameplay holes attract-only gates are blind to; the honest limit is that the mechanic LIST is not
  mechanically enumerable, so its completeness stays the adversarial done-audit's job.
- The dispatch **seam leaks two stack bytes** — MEASURE per dispatch what heals it (SP unmoved ⇒ the
  resolver supplies the `ret`; SP up two with `pc` on the held slot ⇒ the transfer did it; anything
  else ⇒ raise, naming the routine). Bound the stack exclusion by the **measured** stack, not the
  game-state ceiling. Attract-only gates are blind — gates must **replay input tapes and assert the
  game responds** (banks credits, starts at the contract frame, player moves/scores), plus
  idiomatic==translated through the sequence and video RAM byte-identical, including **forced
  transitions the tapes never reach** (poke the ROM's own trigger).

### ★ The cleanup phase — end of the idiomatic pass

Once `idiomatic_gate` reports **0 total cruft** (all six categories + 0 unlifted for a closure game) the
port is COMPLETE but terse. The cleanup phase turns it into a clean, self-documenting artifact. It is a
distinct phase, gated on a flag, and runs in this order.

- **Declare completeness — a GAME-LOCAL flag.** Set `idiomaticComplete: true` in
  `games/<game>/manifest.js` (NOT a repo-wide list; game settings live with the game). `idiomatic_gate`
  **enforces** it — a game that declares it at cruft > 0 is blocked — and `comment_gate` reads it to drop
  **both** its rules (density + reference) for that game's `idiomatic/**`, so cleaned routines may carry
  verbose comments that cite the ROM/hardware. The flag is the phase's precondition. (`docs/comment-gate.md`.)
- **Regenerate `mechanisms.md` whole, from code (blank-slate).** Per-subsystem agents write each section
  FROM THE CODE BODIES (forbidden to read the old map or paraphrase role strings); tags come from
  `names.js` certs. The lead assembles, PRESERVES the grounding provenance (`[seen]` narratives + batch
  history — not code-derivable), writes intro/legend/open, and **verifies every claim against code** — fan
  that out: one adversarial checker per section, flagging wrong/unsupported/imprecise claims, fold the real
  ones. The map carries **NO port plumbing** (`m.call`, the seam, `withOmittedRet`, `push16`,
  "address-dispatched") — that is how the port is wired, not how the machine works.
- **Rewrite `names.js`.** It accretes run-on role strings and port-plumbing prose across the pass. Make
  every role concise, consistent, plumbing-free, correctly tagged. It is ONE file (edit contention):
  agents PROPOSE cleaned entries per disjoint address range; the lead APPLIES them serially as the single
  writer. Do this before the routine sweep, so the sweep references clean names.
- **Clean every routine, LEAVES-FIRST.** Topo-sort the idiomatic call graph (imports = calls) and clean in
  leaf-first waves — a callee cleaned (and any rename settled) before its callers — fanning out each wave
  fully. "Cleaned" = verbose explanatory comments PLUS light code cleanup (fix misnomers, simplify locals),
  never a behaviour change.
  - **Comment standard:** a rich header (what it is, its role in the machine, ROM address, grounding tag,
    live-out) + a block comment before each logical step explaining the mechanism and WHY, citing the
    ROM/hardware — the level where someone who has never seen the game's internals could follow it.
  - **Prove it changed nothing but comments:** for a comment-only unit, strip comments + blank lines and
    assert the code is BYTE-IDENTICAL to pre-clean; run the equivalence subset + pixel as a backstop.
- **Land per the usual cadence.** Each unit: gates first (`comment_gate` now in verbose mode for the game),
  then an independent reviewer, then commit as Jimmy + push, single-threaded. Order across the phase:
  complete-flag + mechanisms regen (one milestone) → `names.js` → the leaf-first sweep.

## 5 — Ship

- **Web-worker contract** (get each right the first time): (1) register the id in `games/registry.js`
  or it never appears in the selector; (2) assemble **every** declared ROM image to `games/<id>/rom/`
  **honoring `offsets`** — a gapped image otherwise assembles to wrong bytes, fails sha256, and the
  others silently never build; (3) build the registry with **static imports** — never `node:fs`/
  `file://` (the browser rejects both); no `node:` builtin anywhere on the browser load path; (4) the
  Machine satisfies the worker contract — synchronous constructor, exported `resolveOverrides()`,
  live-render interface (`captureVideo`/`videoFrames`/`finishRasterFrame()`), exported `Inputs` class
  in the board io; (5) inputs manifest-driven across IN0/IN1/IN2; (6) exact ROT (step 1); (7) unported
  audio → silent, not broken; (8) `runtime: "idiomatic"` reads `manifest.convergence.idiomatic.nmiReturnPC`
  (§2) — the worker throws without it.
- **Audio by record/replay** (don't emulate the second CPU): tap the soundlatch write and play a
  recorded clip per command (the tap is a nullable field, runs after the store, return discarded, must
  not throw). **Record, don't extract** — a game's sound may be discrete-analog or only exist once the
  audio CPU runs; nothing is a "rip samples from ROM" job. A recorder drives real MAME headless,
  injects each command, captures a clip + an `index.json`. Gotchas: **mute the ROM's own soundlatch
  writes while injecting** (prove it with the silent-gap residual); **read the driver for how a
  command triggers** (a latch write may not raise the audio IRQ — the audio CPU can poll it on its
  own VSYNC IRQ, so "trigger" is *hold the byte ≥1 frame*); **★ do NOT loop off the recorder's `loop`
  flag** — it can't tell a looping tune from a sustained one-shot, so model **one voice** (a new
  command stops the previous and plays once) and earn looping only by detecting a real loop point via
  autocorrelation; **median-center** each segment (a PSG idle DC bias steps by thousands of LSB, and
  mean-centering reads silent tails as signal); isolate commands by pulse-vs-sustain stop timing, not
  by reset (a soft reset re-runs the autoboot). Committed = `manifest.audio.map` (data-only,
  evidence-based names, no invented sound names, no file paths); the WAVs + `index.json` are
  **gitignored copyright** (silence in a fresh clone is the point). Web side: dedup by raw write
  **address**, forward only changed edges; guard any polled surface behind a board-capability check.
  **Report evidence disagreements — never silently pick a winner**; when the driver and the measured
  hardware disagree, ship what the hardware does.
- **ROM stays out:** bring-your-own — tests guard on ROM presence and skip when absent; a rom-guard
  clone verifies a no-ROM checkout still passes. The manifest lists part filenames + sha256; `make
  rom` assembles from the user's dump and verifies.
- The standing whole-game gates (`idiomatic.test.js` boot→attract, `tape.test.js` coin/start/play,
  `transition.test.js` level/round/game-over) have run since the skeleton and gate the ship as-is.
- **Definition of done — a named gate, not a claim.** *Done* means a named gate ran and passed
  (`how-the-agents-worked.md`), never "it looks finished." A game is shippable only when **every**
  completion subsystem is green under its own gate — the live pixel gate **run against the FULL
  ~10-minute MAME golden (§2), never a short window** (that long run is also the authoritative
  §3-completeness check — a boot gap in a deep state = a still-missing routine a short gate never
  reaches), stage-B grounding complete (zero ungrounded `[code]`), the idiomatic gate at 0 (no
  registers/m.call/m.push*/raw addresses), the whole-game gates above, the
  external disassembly if in scope, and **audio**. Each is executed, not reasoned about; the ship is
  refused while any is red. This ledger exists because frogger shipped "done" three times over with
  grounding, registers, *and* audio all still open — every one a subsystem with no gate guarding the
  done-claim.
- **A fully idiomatic layer is required — zero translated routines, zero `m.call()`, zero `m.push*()`,
  zero register references.** The idiomatic layer REPLACES the frozen oracle; a game is not done while
  any reachable routine still runs as translated code in the live game, or while the idiomatic layer
  still holds Z80-level primitives. Concretely: **(a)** every reachable routine runs as JS in the live game — wired as a
  live override, or dissolved to a direct-called boolean for a caller-skip that cannot seat; the game's
  `UNWIRED` map in `tools/registry-coverage.config.mjs` holds **only such DISSOLVED entries**, never an
  "oracle-served / can't-seat" one, and there is no `m.call` into the still-translated layer. Dissolve an unbalanced tail-call
  (`return m.call(<translated>)`, whose translated `ret` drifts SP and throws at the override seam) into
  a **direct JS call**, and a caller-skip into a **boolean skip-signal** the caller early-returns on; the
  seam throwing at dispatch is the signal to DISSOLVE, never to leave the routine translated "by design".
  **(b)** zero `m.push16`/`m.push*` — the ROM's stack trampolines become JS control flow; a
  coroutine/main-loop handoff uses the generator engine (`yield*`), not an `m.call`. **(c)** zero register
  references (`m.regs.*`/`regs.*`) in the body, and **(d)** zero raw `0xHHHH` addresses — every cell is
  a named import from names.js. Enforced mechanically and fail-closed by `tools/idiomatic_gate.py`: it
  counts all four (registers + `m.call` + `m.push*` + raw `0xHHHH`) on a per-game ratchet toward 0 and
  is folded into `done_gate` as the **idiomatic** subsystem, so any surviving primitive refuses the
  ship. dkong is the model: no translated routines, no stack ops, no registers, no raw addresses.
  (Balanced legacy trampolines are not an exception — they too must be dissolved before done; the seam
  merely tolerates them meanwhile.)
- **Gameplay must be validated by INPUT-TAPE REPLAY — an attract-only gate does not count as done.** A
  pixel or whole-game gate that runs only boot→attract is BLIND to every in-play routine: the gameplay
  layer renders and runs identically whether it is correct, un-wired, or broken, because gameplay never
  executes. So done REQUIRES the pixel gate and the whole-game gate to **replay a coin/start/play input
  tape** through the *idiomatic* layer and assert it matches the MAME golden AND the oracle in
  GAMEPLAY, plus the **forced transitions the tapes never reach** (life loss, level/round advance,
  game-over). A boot→attract-only gate must NOT be counted green for done. This is the §4 "Driving
  coverage" rule — *"attract-only gates are blind … gates must replay input tapes and assert the game
  responds"* — promoted into the definition of done so it cannot be skipped; frogger's attract-only
  `pixel_suite.py` and lone `idiomatic.test.js` (whose idiomatic-vs-oracle and vs-MAME arms are still
  "TODO") are the exact hole this names.
- **A game is NOT done until an independent adversarial agent agrees it is done.** The gates are
  necessary but not sufficient: a gate can be green while *blind* — measuring too little (an
  attract-only pixel/whole-game gate never exercises gameplay) or not covering a criterion at all
  (lifting/wiring, `m.call` dissolution, `loc_` cell naming). So the FINAL, MANDATORY step of done is a
  fresh **adversarial reviewer agent**, handed this runbook, that audits the game against *every*
  completion criterion and must independently conclude it is done — proposer≠confirmer applied to the
  done-claim itself, never the author's word and never "the gates are green." If it finds any open
  criterion, OR any gate that passes while validating too little, the game is not done. Record its
  verdict; a game with no adversarial done-audit on record is not done. (This step exists because an
  adversarial done-audit of frogger found not only registers and audio open but that the pixel and
  whole-game gates were attract-only — blind to the entire gameplay layer — a hole no green gate would
  ever have surfaced.)
- **Audio-coverage gate — the one that was missing.** Audio was the only ship step with no gate ("by
  ear, no oracle"), so it is the step that silently gets skipped. Fix: `tools/audio_gate.py`, a
  completion gate requiring the committed artifacts a complete audio layer has (the model is dkong):
  `manifest.audio.map` + the map file; for a clips model, a `soundLatch` matching names.js
  `SOUND_CMD_LATCH`; and BOTH `test/audio-map.test.js` (coverage — every emitted command has a mapped
  clip) and `test/audio-wiring.test.js` (the soundlatch tap reaches the player). Those two committed
  tests do the enumeration/verification in the standing suite — the WAVs + index.json are gitignored
  copyright, so the gate cannot parse coverage itself; it guarantees the tests were not skipped.
  Fail-closed when the layer or a test is absent. It **cannot** check correctness — no oracle — so "does
  it sound right" stays a recorded by-ear sign-off, but a *missing or untested* audio layer becomes
  impossible to ship.

---

## Cross-cutting — the "plausible-but-wrong" class

The failure hardest to distrust is a **recognizable-but-wrong** image or a check that **passes for the
wrong reason**. Guard against it everywhere:

- Render **pens before RGB** so a pixel diff attributes to one half; **say which coordinate zero**
  every time (frame-origin vs raster line vs visible row differ by fixed offsets — the ambiguity
  breeds mislabels and cycle bugs). A **wrong constant can produce a perfect match** by hiding the
  pixels that would falsify it — any "is this displayed?" probe must write a value known to differ.
  **Raster-time the renderer** where a mid-frame write splits the frame. Carry MAME's own "this is
  wrong" notes faithfully rather than inventing a fix.
- **A gate arm that cannot fail is decoration; a gate that mandates the defect** (asserting a faithful
  rewrite's divergence) must be changed — measure the exclusion from the oracle. **A property with no
  owner AND no record of being unowned is a trap** (T-states, the full register file, DMA sub-frame
  position are deliberately unowned — write it down). While a review is in flight **nothing stages the
  index** (the review token binds to the exact staged diff).
- **Treat a stall/contradiction as a claim about the instrument first.** An empty capture/comparison
  directory is not a pass (0 comparisons and 0 failures share the success exit code). Retain **every**
  Lua tap token in a global (a GC'd tap flatlines and reads as a stall). A class fix by scripted
  string-replace propagates a per-site fact wrongly — **script the finding, never the fix.** A
  labelled-wrong constant beats a plausible unlabelled one; an UNVERIFIED placeholder says so and
  names where the real value comes from.
- Small language traps that read as data: a default parameter is a landmine for a `.map(fn)` callback
  (arg 2 is the index → a NaN that looks like data); integer division truncates toward zero (use
  `Math.trunc`, not `Math.floor`, on signed values). Numbers base-10 (hex only for irreducible bit
  ops); `u8()`/`u16()` for a load-bearing wrap. `comment_gate`: comments ≤ code//4 + 4, each describes
  *this* file only — when it trips, cut prose (whole-file freeze). `doc_gate` caps markdown at 150
  lines (**this runbook is exempt by name**); commit messages ≤ 10 lines.

---

## Legacy games — do not be surprised they diverge

The ports already in `games/` were built under earlier iterations of this method and **do not yet
follow this runbook**. They work and are pixel-validated against MAME, but their test names, gate
wiring, and configuration predate the process here, so expect inconsistencies. **This is known, not a
defect to chase.** The runbook is the go-forward spec; the existing ports are legacy it supersedes.
**Do not retrofit them** — reconcile them only once this process is proven on a new game.

---

## Autonomous process decisions — review-pending

Process decisions made autonomously while porting a new game under the "entirely without my input"
directive that RESHAPE this process or touch a rigor gate are logged here so the accumulated set is
reviewable in one place — reverse any that would have been called differently.

- **2026-08-13 — New-game pixel-gate bootstrapping** (§2): a temporary, checkable `EXEMPT` entry in
  `pixel_gate_required.py` for a game mid-translation (it cannot render a frame matching MAME until the
  boot clears its computed-jump dispatchers), removed at the first rendered frame. Uses the gate's own
  sanctioned "cannot-run + checkable reason" mechanism — not a gate disable.
- **2026-08-13 — comment_gate on a new-game foundation:** the density cap trips the whole new foundation
  (board JSDoc + per-instruction oracle comments) because the shipped games are grandfathered. Resolved
  by TRIMMING under the cap — drop mnemonic-only + verbose restating, keep the load-bearing rationale,
  checkable clauses, and mutation anchors — NOT by exempting. Consistent with "cut prose, don't raise the
  cap" and this doc's own sanction to drop mnemonic-only oracle comments when a file trips the cap.
  Follow-up (§3): translation/board agents now write UNDER the cap from the first draft, so no pruning pass
  is needed on future ports.
