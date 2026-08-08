// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateSelectedShapeCycle — memory-equivalent to the frozen oracle at ROM 0x2B38.
 *
 * ★ REACHED BY A POKE, AND THE CONTROL SAYS SO. Nothing in an undriven run dispatches this: the
 *   handler that calls it is the last arm of a table indexed by the era cell, and no run this
 *   harness can drive gets there. The gate pokes that ONE cell and lets the game dispatch the
 *   routine itself, with the rest of the machine coherent; an arm asserts the unpoked run reaches
 *   it zero times, so the poke is doing the work it claims to.
 *
 * GATE: poked-natural dispatch, every captured dispatch replayed, an exhaustive cross of the frame
 *   counter against the record byte that picks the shape block, a whole-machine replay, and teeth.
 *   1. EQUAL at the real dispatch — the whole dump identical, stack scratch included.
 *   2. VACUITY, MEASURED — a no-op is invisible at MOST real dispatches, because the two bytes
 *      usually already hold what this writes. The exact fraction is asserted rather than described.
 *   3. EXCLUDED, deliberately — the declared set BOUNDS the divergence rather than measuring it:
 *      nothing outside it may move, and a rewrite that moves fewer of them still passes.
 *   4. CORPUS — every dispatch the poked run produces.
 *   5. EXHAUSTIVE — 256 frame-counter values against a spread of record bytes, which is the whole
 *      of what this routine reads.
 *   6. THE PHASE IS FOUR FRAMES LONG — the shape is asserted to change at every fourth counter
 *      value and only there, which is what the two bits taken out of the middle of it mean.
 *   7. WHOLE-MACHINE — the poked session replayed with the rewrite wired through a measured shim.
 *   8. TEETH — seven twins, each caught on an exact declared count. Two are INVISIBLE at the
 *      real dispatch, because its counter and record byte happen to make them agree.
 *
 * HOLE: the corpus holds two record-byte values, so the shape-block arithmetic is exercised almost
 *   entirely by the crafted cross rather than by real data.
 * HOLE: poking the era cell changes what the game does from that frame on. This is a real dispatch
 *   of the routine in a coherent machine, but it is NOT evidence about which era really runs it.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-2b38.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { animateSelectedShapeCycle } from "../animateSelectedShapeCycle.js";
import { loc_2b38 as oracle } from "../../translated/loc_2b38.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { ERA_INDEX, FRAME_TICK } from "../names.js";

const TARGET = 0x2b38;

const SHAPE_BLOCK = 4;
const SHAPE_CODE = 1;
const ATTRIBUTE = 0x30;
const FIRST_SHAPE = 0xd8;
const ATTRIBUTE_VALUE = 0x61;

/** The one cell the poke forces, and the era value that makes the caller reach this arm. */
const POKED_ERA = 4;
const POKE_FROM_FRAME = 1200;

const MOVED = ["a", "f", "b", "sp"];
const FRAMES = 1800;
const RET_TSTATES = 10;

/** Measured over the corpus below; a move is a finding. */
const DISPATCHES = 2717;
const NO_OP_SEEN = 694;

const COUNTERS = Array.from({ length: 256 }, (_unused, c) => c);
const BLOCKS = [0, 1, 2, 3, 0x3f, 0x40, 0x80, 0xff];
const SWEEP_SIZE = COUNTERS.length * BLOCKS.length;

const skip = romsPresent() ? false : "ROM images are not assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

function factory(overrides, poked = true) {
  const m = makeMachine(overrides, { tape: [] });
  if (poked) m.pokes = [{ addr: ERA_INDEX, val: POKED_ERA, frame: POKE_FROM_FRAME, dur: null }];
  return m;
}

// ── the entry ───────────────────────────────────────────────────────────────────────────

let entry = null;

function gate(candidate) {
  return unitEquivalence(factory, TARGET, oracle, (m) => {
    if (entry === null) entry = m.clone();
    return candidate(m);
  }, { maxFrames: FRAMES });
}

function entryState() {
  if (entry === null) gate(animateSelectedShapeCycle);
  return entry;
}

function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

const caught = (candidate, machine) => unitDiff(candidate, machine) !== null;

const shapeOf = (m) => `${(m.mem8[FRAME_TICK] >> 2) & 3}/${m.mem8[m.regs.ix + SHAPE_BLOCK]}`;

// ── the corpus ──────────────────────────────────────────────────────────────────────────

let corpus = null;
function captureCorpus() {
  if (corpus) return corpus;
  const entries = [];
  const shapes = new Set();
  let noOpSeen = 0;
  const m = factory(new Map([[TARGET, (mm) => {
    entries.push(mm.clone());
    shapes.add(shapeOf(mm));
    if (caught(() => {}, mm)) noOpSeen++;
    return oracle(mm);
  }]]));
  const frames = m.runFrames(FRAMES);
  assert.equal(m.stoppedBy, null, `corpus run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, FRAMES, "corpus run ran short");
  corpus = { entries, shapes, noOpSeen };
  return corpus;
}

/** A real captured machine forced onto one (counter, record byte) — the crafted-entry idiom. */
function craft(counter, block) {
  const m = entryState().clone();
  m.mem8[FRAME_TICK] = counter;
  m.mem8[m.regs.ix + SHAPE_BLOCK] = block;
  return m;
}

function sweepCaught(candidate) {
  let n = 0;
  for (const c of COUNTERS) for (const b of BLOCKS) if (caught(candidate, craft(c, b))) n++;
  return n;
}

// ── the shim, measured rather than asserted ─────────────────────────────────────────────

function hosted(candidate) {
  return (mm) => {
    const probe = mm.clone();
    const before = probe.cycles;
    oracle(probe);
    const total = probe.cycles - before;
    candidate(mm);
    mm.tick(total - RET_TSTATES);
    mm.ret(RET_TSTATES);
  };
}

const replay = (candidate) =>
  wholeMachineEquivalence(factory, FRAMES, new Map([[TARGET, hosted(candidate)]]));

// ── the twins ───────────────────────────────────────────────────────────────────────────

const write = (m, shape, attribute) => {
  m.mem8[m.regs.iy + SHAPE_CODE] = shape;
  m.mem8[m.regs.iy + ATTRIBUTE] = attribute;
};
const blockOf = (m) => (m.mem8[m.regs.ix + SHAPE_BLOCK] - 1) & 0xff;
const phaseOf = (m) => (m.mem8[FRAME_TICK] >> 2) & 3;

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: the shape never animates, so the object is frozen on the first frame of its cycle. */
function brokenNoPhase(m) {
  write(m, FIRST_SHAPE + 4 * blockOf(m), ATTRIBUTE_VALUE);
}

/** BUG: the phase is taken from the bottom of the counter, so it turns over every frame. */
function brokenPhaseFromLowBits(m) {
  write(m, FIRST_SHAPE + (m.mem8[FRAME_TICK] & 3) + 4 * blockOf(m), ATTRIBUTE_VALUE);
}

/** BUG: the record byte is used as it stands, so every block is one too far along. */
function brokenBlockNotDecremented(m) {
  write(m, FIRST_SHAPE + phaseOf(m) + 4 * m.mem8[m.regs.ix + SHAPE_BLOCK], ATTRIBUTE_VALUE);
}

/** BUG: the block step is two shapes rather than four, so blocks overlap. */
function brokenBlockStepTooSmall(m) {
  write(m, FIRST_SHAPE + phaseOf(m) + 2 * blockOf(m), ATTRIBUTE_VALUE);
}

/** BUG: the attribute is left standing, so the object keeps whatever it had. */
function brokenNoAttribute(m) {
  m.mem8[m.regs.iy + SHAPE_CODE] = FIRST_SHAPE + phaseOf(m) + 4 * blockOf(m);
}

/** BUG: the two bytes go into each other's places. */
function brokenBytesSwapped(m) {
  m.mem8[m.regs.iy + SHAPE_CODE] = ATTRIBUTE_VALUE;
  m.mem8[m.regs.iy + ATTRIBUTE] = FIRST_SHAPE + phaseOf(m) + 4 * blockOf(m);
}

/** Per twin: exact catch count over the crafted cross, and its verdict at the real dispatch. */
const TWINS = [
  ["no-op", brokenNoOp, 2048, true],
  ["no-phase", brokenNoPhase, 1536, true],
  ["phase-from-low-bits", brokenPhaseFromLowBits, 1536, false],
  ["block-not-decremented", brokenBlockNotDecremented, 2048, true],
  ["block-step-too-small", brokenBlockStepTooSmall, 1792, false],
  ["no-attribute", brokenNoAttribute, 2048, true],
  ["bytes-swapped", brokenBytesSwapped, 2048, true],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("NEGATIVE CONTROL: without the poke the game never dispatches it", { skip }, () => {
  assert.throws(
    () => unitEquivalence((o) => factory(o, false), TARGET, oracle, animateSelectedShapeCycle, { maxFrames: FRAMES }),
    /never entered/,
    "an unpoked run reached this arm — if it does, the poke below is not what makes it reachable",
  );
  console.log("  CONTROL: zero dispatches in an unpoked run of the same length");
});

test("EQUAL at the real dispatch: animateSelectedShapeCycle == oracle on the whole dump", { skip }, () => {
  const r = gate(animateSelectedShapeCycle);
  assert.notEqual(entry, null, "vacuous: the poked run never reached the routine");
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  console.log(`  EQUAL: entry phase/block ${shapeOf(entryState())}; identical`);
});

test("VACUITY, MEASURED: a no-op is invisible at most real dispatches", { skip }, () => {
  const { entries, noOpSeen } = captureCorpus();
  assert.equal(noOpSeen, NO_OP_SEEN, "the fraction of dispatches a no-op is visible at moved");
  assert.ok(noOpSeen > 0, "a no-op is invisible at EVERY real dispatch, so RAM gates nothing here");
  assert.ok(
    noOpSeen < entries.length,
    "a no-op is now visible everywhere, so the two bytes no longer usually hold what this writes " +
      "and the hole this arm records has closed",
  );
  console.log(`  VACUITY: a no-op shows at ${noOpSeen} of ${entries.length} real dispatches`);
});

test("EXCLUDED, deliberately: scratch registers, the stack pointer and pc", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  animateSelectedShapeCycle(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  const unexpected = moved.filter((k) => !MOVED.includes(k));
  assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${MOVED.join(", ")} and pc`);
});

test("CORPUS: every captured dispatch replays identically", { skip }, () => {
  const { entries, shapes } = captureCorpus();
  assert.equal(entries.length, DISPATCHES, "the dispatch count moved");
  for (const captured of entries) {
    assert.equal(unitDiff(animateSelectedShapeCycle, captured), null, "a captured dispatch diverged");
  }
  console.log(`  CORPUS: ${entries.length} dispatches over ${shapes.size} phase/block shapes`);
});

test("EXHAUSTIVE: every counter value against a spread of record bytes", { skip }, () => {
  for (const c of COUNTERS) {
    for (const b of BLOCKS) {
      const d = unitDiff(animateSelectedShapeCycle, craft(c, b));
      assert.equal(d, null, `counter ${c} block ${b}: ${show(d)}`);
    }
  }
  console.log(`  EXHAUSTIVE: ${SWEEP_SIZE} combinations identical`);
});

test("THE PHASE IS FOUR FRAMES LONG, and turns over only on the fourth", { skip }, () => {
  const shapes = COUNTERS.map((c) => {
    const m = craft(c, 1);
    animateSelectedShapeCycle(m);
    return m.mem8[m.regs.iy + SHAPE_CODE];
  });
  const changes = COUNTERS.filter((c) => c > 0 && shapes[c] !== shapes[c - 1]);
  assert.deepEqual(
    changes,
    COUNTERS.filter((c) => c > 0 && c % 4 === 0),
    "the shape changed somewhere other than a four-frame boundary",
  );
  assert.equal(new Set(shapes).size, 4, "and exactly four shapes must appear in one block");
  console.log(`  PHASE: ${changes.length} changes, all on four-frame boundaries, 4 shapes`);
});

test("WHOLE-MACHINE: the poked session is byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(animateSelectedShapeCycle);
  assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the override never dispatched");
  assert.equal(w.framesCompared, FRAMES, "the replay ran short");
  assert.equal(w.equal, true, `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  console.log(`  WHOLE-MACHINE: ${w.framesCompared} frames, ${w.invocations.get(TARGET)} dispatches`);
});

test("TEETH: removing the shim's return kills the run, so the shim is load-bearing", { skip }, () => {
  let died = null;
  try {
    const w = wholeMachineEquivalence(factory, FRAMES, new Map([[TARGET, animateSelectedShapeCycle]]));
    died = w.equal ? null : "forked";
  } catch (e) {
    died = String(e).slice(0, 80);
  }
  assert.notEqual(died, null, "the unshimmed rewrite ran clean, so the shim proves nothing");
  console.log(`  TEETH/shim: the unshimmed rewrite dies — ${died}`);
});

for (const [label, twin, swept, seenAtDispatch] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    assert.equal(sweepCaught(twin), swept, `the ${label} twin's crafted catch count moved`);
    console.log(`  TEETH/${label}: caught on ${swept} of ${SWEEP_SIZE} crafted entries`);
  });

  test(`TEETH: the ${label} twin at the real dispatch, hole pinned`, { skip }, () => {
    const seen = caught(twin, entryState());
    assert.equal(seen, seenAtDispatch, `the real dispatch's view of the ${label} twin moved`);
    console.log(`  TEETH/${label}: real dispatch ${seen ? "catches it" : "is BLIND, as recorded"}`);
  });
}
