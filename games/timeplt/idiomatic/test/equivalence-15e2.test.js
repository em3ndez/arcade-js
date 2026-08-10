// SPDX-License-Identifier: GPL-3.0-only
/**
 * startTheWholePlaneWipeAndFoldAnImageBlockIntoThePhase — memory-equivalent to the frozen oracle at ROM 0x15E2.
 *
 * GATE: the real dispatch of both sessions replayed whole; an exhaustive crafted sweep of the outer
 *   phase and inner index; a measured stack window with a boundary control; a register ceiling and teeth.
 *
 * ★ THE ADDRESS IS DISPATCHED ONCE PER SESSION, and the arm that says so measures it rather than
 *   assuming it. It is arm 0 of the inline word table loc_15c2 dispatches through, reached during
 *   the boot self-test at frame 236 of both the coin-then-start tape and the undriven attract loop.
 *   One entry per session is thin evidence on its own, which is why the crafted sweeps below carry
 *   most of the weight — and why the CRAFTED-MATTERS arm exists at all.
 *
 * ★ THE ONE CAPTURED ENTRY HOLDS PHASE ZERO, AND ZERO IS THE FOLD'S FIXED POINT. Measured: on this
 *   image the 256-byte block totals 0xB2 and the key is 0x4E, so the fold leaves 16 of the 256
 *   phase values exactly where it found them and phase 0 is one of them. A twin that ASSIGNS the
 *   block total instead of subtracting it from the standing phase is therefore invisible at the
 *   real dispatch and caught on every other phase in the crafted sweep. CRAFTED-MATTERS pins that,
 *   so the crafted arms cannot be dismissed as decoration of an already-green corpus.
 *
 * ★ THE PRELUDE IS SOMEBODY ELSE'S ROUTINE. The oracle reaches it through the registry; the rewrite
 *   calls the idiomatic sibling directly, so what this gate compares includes that sibling's own
 *   fidelity — if it drifts, the arms here go red rather than staying quietly green. What the gate
 *   does NOT do is judge the sibling on its own terms; that belongs to the sibling's own gate.
 *
 * ★ THE MASKED WINDOW IS MEASURED, NOT DECLARED. The oracle's own push16 is watched over every arm
 *   and pinned at 2 bytes; the BOUNDARY arm then shows a scribble one byte below the window IS
 *   caught, so the mask cannot be quietly hiding a real divergence.
 *
 * HOLE: one dispatch per session is all the corpus there is, and both sessions present the same
 * phase. Everything about a non-zero phase rests on crafted state.
 * HOLE: the prelude is judged only through this entry. Anything it does that this entry's own
 * comparison cannot see is outside every arm below.
 * HOLE: the folded block ends in zero bytes, so a rewrite that folded one byte too few or too many
 * off the END of it would be invisible to every arm here. TRAILING ZEROS measures that rather than
 * leaving it unsaid, and pairs the zero with a fencepost the same sweep does catch.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-15e2.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { startTheWholePlaneWipeAndFoldAnImageBlockIntoThePhase } from "../startTheWholePlaneWipeAndFoldAnImageBlockIntoThePhase.js";
import { loc_15e2 as oracle } from "../../translated/loc_15e2.js";
import { armWholePlaneWipeThenDerailOnATamperedImage as prelude } from "../armWholePlaneWipeThenDerailOnATamperedImage.js";
import { SEQUENCE_PHASE, SEQUENCE_SUBSTEP } from "../names.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x15e2;
const FRAMES = 600;
const DISPATCHES = 1;

/** Derived here independently of the module, so an edit to its constants cannot pass unnoticed. */
const SUBSTEP_SOURCE = 0x1749;
const FOLD_BLOCK = 0x5648;
const FOLD_BYTES = 256;
const FOLD_KEY = 0x4e;

/** Measured by the WINDOW arm: the oracle parks one return address below its seat and nothing else. */
const SCRATCH_BYTES = 2;

/**
 * The ceiling on register divergence, measured over the corpus AND the 256-value phase sweep — a
 * ceiling, not a demand. a: folded phase in A vs a local; f: the fold's arithmetic sets flags none
 * reads; b: the prelude counts its run down in B, the rewrite's not; h,l: oracle walks HL, rewrite
 * from a base; sp: oracle brackets the prelude with a push and takes its return, the rewrite's not.
 */
const MOVED = ["a", "f", "b", "h", "l", "sp"];

const VALUES = 256;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

const inScratch = (addr, sp) => addr !== null && addr >= sp - SCRATCH_BYTES && addr < sp;

/** Oracle vs candidate on independent clones, everything outside the measured window compared. */
function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    // A JavaScript fault is a bug in THIS file, not a divergence — swallowing one reports a
    // broken twin as a caught twin. Only a machine-level raise counts as an outcome here.
    if (e instanceof ReferenceError || e instanceof TypeError) throw e;
    return { addr: null, a: "returned", b: String(e).slice(0, 60) };
  }
  return allDiffs(a, b).find((d) => !inScratch(d.addr, sp)) ?? null;
}

/** How far below its seat the oracle's own pushes reach, on one entry state. */
function oracleDepth(machine) {
  const c = machine.clone();
  const seat = c.regs.sp;
  let deepest = seat;
  const push = c.push16.bind(c);
  c.push16 = (v) => {
    const r = push(v);
    if (c.regs.sp < deepest) deepest = c.regs.sp;
    return r;
  };
  oracle(c);
  return (seat - deepest) & 0xffff;
}

// ── the captured entries ────────────────────────────────────────────────────────────────

let captured = null;

/** One entry per session, from the driven tape and from the undriven attract loop alike. */
function capture() {
  if (captured) return captured;
  const out = [];
  for (const opts of [{}, { tape: [] }]) {
    const seen = [];
    const m = makeMachine(new Map([[TARGET, (mm) => {
      seen.push(mm.clone());
      return oracle(mm);
    }]]), opts);
    const frames = m.runFrames(FRAMES);
    assert.equal(m.stoppedBy, null, `capture run stopped early: ${m.stoppedBy}`);
    assert.equal(frames.length, FRAMES, "capture run ran short");
    assert.equal(seen.length, DISPATCHES, "the dispatch count moved");
    out.push(...seen);
  }
  captured = out;
  return captured;
}

function entryState() {
  const e = capture()[0] ?? null;
  assert.notEqual(e, null, "vacuous: the tape never reached the routine");
  return e;
}

/** The real entry with the outer phase and the inner index forced. */
function craft(phase, index = 0) {
  const m = entryState().clone();
  m.mem8[SEQUENCE_PHASE] = phase;
  m.mem8[SEQUENCE_SUBSTEP] = index;
  return m;
}

function sweepPhases(candidate) {
  let caught = 0;
  for (let phase = 0; phase < VALUES; phase++) if (unitDiff(candidate, craft(phase))) caught++;
  return caught;
}

function sweepIndexes(candidate) {
  let caught = 0;
  for (let index = 0; index < VALUES; index++) if (unitDiff(candidate, craft(0, index))) caught++;
  return caught;
}

// ── broken twins ────────────────────────────────────────────────────────────────────────

/** The fold the rewrite is supposed to perform, written out here a second time. */
function fold(m, base = FOLD_BLOCK, bytes = FOLD_BYTES, key = FOLD_KEY, sign = -1) {
  let total = m.mem8[SEQUENCE_PHASE];
  for (let i = 0; i < bytes; i++) total = (total + sign * m.mem8[(base + i) & 0xffff]) & 0xff;
  return total ^ key;
}

/** BUG: does nothing — the tell that a gate is measuring an idle entry. */
function brokenNoOp() {}

/** BUG: skips the entry that runs ahead of both stores. */
function brokenNoPrelude(m) {
  m.mem8[SEQUENCE_SUBSTEP] = m.mem8[SUBSTEP_SOURCE];
  m.mem8[SEQUENCE_PHASE] = fold(m);
}

/** BUG: leaves the inner index where it found it. */
function brokenNoIndex(m) {
  prelude(m);
  m.mem8[SEQUENCE_PHASE] = fold(m);
}

/** BUG: reads the inner index from the byte after the right one. */
function brokenIndexOffByOne(m) {
  prelude(m);
  m.mem8[SEQUENCE_SUBSTEP] = m.mem8[SUBSTEP_SOURCE + 1];
  m.mem8[SEQUENCE_PHASE] = fold(m);
}

/** BUG: adds the block into the phase instead of subtracting it. */
function brokenAdds(m) {
  prelude(m);
  m.mem8[SEQUENCE_SUBSTEP] = m.mem8[SUBSTEP_SOURCE];
  m.mem8[SEQUENCE_PHASE] = fold(m, FOLD_BLOCK, FOLD_BYTES, FOLD_KEY, +1);
}

/** BUG: starts one byte in and folds one byte fewer — a fencepost at the head of the block. */
function brokenDropsFirstByte(m) {
  prelude(m);
  m.mem8[SEQUENCE_SUBSTEP] = m.mem8[SUBSTEP_SOURCE];
  m.mem8[SEQUENCE_PHASE] = fold(m, FOLD_BLOCK + 1, FOLD_BYTES - 1);
}

/** BUG: folds nothing at all, so the phase meets only the key. */
function brokenNoFold(m) {
  prelude(m);
  m.mem8[SEQUENCE_SUBSTEP] = m.mem8[SUBSTEP_SOURCE];
  m.mem8[SEQUENCE_PHASE] = fold(m, FOLD_BLOCK, 0);
}

/** BUG: folds the right length from one byte along. */
function brokenShiftedBlock(m) {
  prelude(m);
  m.mem8[SEQUENCE_SUBSTEP] = m.mem8[SUBSTEP_SOURCE];
  m.mem8[SEQUENCE_PHASE] = fold(m, FOLD_BLOCK + 1);
}

/** BUG: drops the key, so an untampered image no longer leaves the phase standing. */
function brokenNoKey(m) {
  prelude(m);
  m.mem8[SEQUENCE_SUBSTEP] = m.mem8[SUBSTEP_SOURCE];
  m.mem8[SEQUENCE_PHASE] = fold(m, FOLD_BLOCK, FOLD_BYTES, 0);
}

/** BUG: lands the fold on the inner index instead of the outer phase. */
function brokenCrossWired(m) {
  prelude(m);
  const folded = fold(m);
  m.mem8[SEQUENCE_SUBSTEP] = folded;
}

/**
 * BUG: ASSIGNS the block's total rather than subtracting it from the standing phase.
 * Invisible at the real dispatch, which presents the fold's fixed point. See CRAFTED-MATTERS.
 */
function brokenIgnoresStandingPhase(m) {
  prelude(m);
  m.mem8[SEQUENCE_SUBSTEP] = m.mem8[SUBSTEP_SOURCE];
  let total = 0;
  for (let i = 0; i < FOLD_BYTES; i++) total = (total - m.mem8[FOLD_BLOCK + i]) & 0xff;
  m.mem8[SEQUENCE_PHASE] = total ^ FOLD_KEY;
}

/** BUG: scribbles on an index register — the in-arm control for the register ceiling. */
function brokenMovesIndex(m) {
  startTheWholePlaneWipeAndFoldAnImageBlockIntoThePhase(m);
  m.regs.ix = (m.regs.ix + 1) & 0xffff;
}

/** Each twin's exact catch count over the 256 crafted phases. Measured; a move is a finding. */
const TWINS = [
  ["no-op", brokenNoOp, 256],
  ["no-prelude", brokenNoPrelude, 256],
  ["no-index", brokenNoIndex, 256],
  ["index-off-by-one", brokenIndexOffByOne, 256],
  ["adds", brokenAdds, 256],
  ["drops-first-byte", brokenDropsFirstByte, 256],
  ["no-fold", brokenNoFold, 256],
  ["shifted-block", brokenShiftedBlock, 256],
  ["no-key", brokenNoKey, 256],
  ["cross-wired", brokenCrossWired, 256],
  ["ignores-standing-phase", brokenIgnoresStandingPhase, 255],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("WINDOW: the oracle's stack footprint, measured over corpus and sweep", { skip }, () => {
  let deepest = 0;
  for (const e of capture()) deepest = Math.max(deepest, oracleDepth(e));
  for (let phase = 0; phase < VALUES; phase += 17) {
    deepest = Math.max(deepest, oracleDepth(craft(phase)));
  }
  console.log(`  WINDOW (measured): the oracle reaches ${deepest} bytes below its seat`);
  assert.equal(deepest, SCRATCH_BYTES, "the oracle's stack footprint moved, so the masked window " +
    "is the wrong width and every arm here is comparing the wrong bytes");
});

test("BOUNDARY: the mask hides the window and nothing else", { skip }, () => {
  const e = entryState();
  const sp = e.regs.sp;
  const scribble = (offset) => (m) => {
    startTheWholePlaneWipeAndFoldAnImageBlockIntoThePhase(m);
    m.mem8[(sp + offset) & 0xffff] = (m.mem8[(sp + offset) & 0xffff] ^ 0xff) & 0xff;
  };
  assert.equal(unitDiff(scribble(-1), e), null, "a byte inside the window is not masked");
  assert.notEqual(unitDiff(scribble(-SCRATCH_BYTES - 1), e), null,
    "a byte one below the window is masked too, so the window is wider than it claims");
  assert.notEqual(unitDiff(scribble(0), e), null, "the seat itself is masked");
  console.log(`  BOUNDARY: ${hex4(sp - 1)} masked, ${hex4(sp - SCRATCH_BYTES - 1)} caught, ` +
    `${hex4(sp)} caught`);
});

test("CORPUS: the dispatch of both sessions replays identically", { skip }, () => {
  const entries = capture();
  for (const e of entries) {
    const d = unitDiff(startTheWholePlaneWipeAndFoldAnImageBlockIntoThePhase, e);
    assert.equal(d, null, show(d));
  }
  const phases = [...new Set(entries.map((e) => e.mem8[SEQUENCE_PHASE]))];
  console.log(`  CORPUS: ${entries.length} dispatches identical; phases present ${phases.join(", ")}`);
});

test("NOT VACUOUS: a no-op candidate FAILS the same comparison", { skip }, () => {
  const d = unitDiff(brokenNoOp, entryState());
  assert.notEqual(d, null, "the masked comparison passed a candidate that does nothing");
  assert.notEqual(d.addr, null, "the no-op must be caught on a real cell, not on an exception");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

/** Which registers a candidate parts company with the oracle on, over corpus and phase sweep. */
function movedOver(candidate) {
  const moved = new Set();
  const machines = [...capture(), ...Array.from({ length: 16 }, (_u, i) => craft(i * 16 + 1))];
  for (const machine of machines) {
    const a = machine.clone();
    const b = machine.clone();
    oracle(a);
    try {
      candidate(b);
    } catch {
      continue;
    }
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

test("EXCLUDED, deliberately: no register outside the ceiling moves", { skip }, () => {
  const moved = movedOver(startTheWholePlaneWipeAndFoldAnImageBlockIntoThePhase);
  const control = movedOver(brokenMovesIndex);
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !MOVED.includes(k)),
    "the measurement reports nothing outside the ceiling even for a twin that scribbles on an " +
      "index register, so a clean reading below proves nothing");
  console.log(`  EXCLUDED (measured): ${REG_FIELDS.filter((k) => moved.has(k)).join(", ")} — ` +
    `ceiling ${MOVED.join(", ")}; the control twin also moves ` +
    `${REG_FIELDS.filter((k) => control.has(k) && !MOVED.includes(k)).join(", ")}`);
  // A CEILING, not a demand: deepEqual against MOVED would go RED on a rewrite that became
  // register-exact, which is a gate refusing the fix.
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k) && !MOVED.includes(k)), [],
    "a register diverged outside the excluded set");
});

test("PHASES: all 256 crafted outer-phase values", { skip }, () => {
  assert.equal(sweepPhases(startTheWholePlaneWipeAndFoldAnImageBlockIntoThePhase), 0, "a phase value diverged");
  console.log(`  PHASES: ${VALUES} values identical`);
});

test("INDEXES: all 256 crafted inner-index values, the store unconditional", { skip }, () => {
  assert.equal(sweepIndexes(startTheWholePlaneWipeAndFoldAnImageBlockIntoThePhase), 0, "an inner-index value diverged");
  const landed = new Set();
  for (let index = 0; index < VALUES; index += 51) {
    const m = craft(0, index);
    startTheWholePlaneWipeAndFoldAnImageBlockIntoThePhase(m);
    landed.add(m.mem8[SEQUENCE_SUBSTEP]);
  }
  assert.equal(landed.size, 1, "the inner index is not overwritten unconditionally");
  console.log(`  INDEXES: ${VALUES} values identical; every one lands on ${[...landed][0]}`);
});

test("CRAFTED-MATTERS: the corpus alone cannot see the standing phase", { skip }, () => {
  let standing = 0;
  for (let phase = 0; phase < VALUES; phase++) {
    const m = craft(phase);
    startTheWholePlaneWipeAndFoldAnImageBlockIntoThePhase(m);
    if (m.mem8[SEQUENCE_PHASE] === phase) standing++;
  }
  const atDispatch = capture().map((e) => e.mem8[SEQUENCE_PHASE]);
  const blind = atDispatch.every((phase) => {
    const m = craft(phase);
    return unitDiff(brokenIgnoresStandingPhase, m) === null;
  });
  console.log(`  CRAFTED-MATTERS: the fold leaves ${standing} of ${VALUES} phases standing; the ` +
    `dispatch presents ${atDispatch.join(", ")}, and the standing-phase twin is invisible there`);
  assert.ok(standing > 0 && standing < VALUES, "the fold is either the identity or never it, and " +
    "either way the twin below is not the discriminating case this arm claims");
  assert.ok(blind, "the standing-phase twin is ALREADY caught at the real dispatch, so this arm " +
    "no longer shows what the crafted sweep buys — say so rather than deleting it");
});

test("TRAILING ZEROS: a fencepost at the END of the block cannot be caught here", { skip }, () => {
  const m = entryState();
  let zeros = 0;
  while (zeros < FOLD_BYTES && m.mem8[FOLD_BLOCK + FOLD_BYTES - 1 - zeros] === 0) zeros++;
  const trailingShort = (mm) => {
    prelude(mm);
    mm.mem8[SEQUENCE_SUBSTEP] = mm.mem8[SUBSTEP_SOURCE];
    mm.mem8[SEQUENCE_PHASE] = fold(mm, FOLD_BLOCK, FOLD_BYTES - 1);
  };
  const missed = sweepPhases(trailingShort);
  const control = sweepPhases(brokenDropsFirstByte);
  console.log(`  TRAILING ZEROS: the block ends in ${zeros} zero bytes, so a twin folding one byte ` +
    `fewer is caught ${missed} times; the head-fencepost control is caught ${control} times`);
  // The zero is a statement about the block, not about the gate: the same sweep catches the same
  // fencepost at the other end 256 times, so the instrument works and the block is the reason.
  assert.ok(control > 0, "the phase sweep catches no fencepost at all, so the zero below says " +
    "nothing about the block and everything about a broken arm");
  assert.ok(zeros > 0, "the block no longer ends in zeros, so a trailing fencepost should now be " +
    "catchable and this recorded hole is stale");
  assert.equal(missed, 0, "a trailing fencepost is now caught, which is better than this arm " +
    "expects — re-measure the hole rather than keeping this assertion");
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count`, { skip }, () => {
    const caught = sweepPhases(twin);
    console.log(`  TEETH/${label}: caught on ${caught} of ${VALUES} crafted phases`);
    assert.equal(caught, expected, `the ${label} twin's catch count moved`);
    assert.ok(expected > 0, `the ${label} twin is caught nowhere at all`);
  });
}
