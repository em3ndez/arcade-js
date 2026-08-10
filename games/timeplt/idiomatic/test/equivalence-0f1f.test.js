// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchSequenceSubStepArm — memory-equivalent to the frozen oracle at ROM 0x0F1F.
 *
 * GATE: unit-capture with a MASKED diff, plus a sweep of every arm the table names.
 *
 * WHY MASKED. Two dead effects, both stack bytes below the exit pointer, both established by
 * experiment not assumed: (1) the frozen twin reaches its arm through the restart-vector dispatch
 * three calls deep, each pushing a return address under the arm's return slot and popping it, left as
 * scratch the arithmetic rewrite never writes -- reproducing those pushes in a probe removed the
 * divergence on every arm but one, which identifies the cause; (2) on that one arm the dispatch also
 * leaves different flag bits and a routine pushes the flag byte, popped before any read -- one more
 * scratch byte. Cycle count was ruled out: advancing one side by the uncharged cycles changes nothing.
 * WINDOW is the deepest such byte the sweep finds and the SCRATCH arm pins the measured depth, so it
 * cannot silently grow; a mask can blind a gate, so every twin is required to be caught OUTSIDE it.
 *
 * Arms: DISPATCHED (tape reaches it, repeatedly); EQUAL (masked RAM identical at the real dispatch);
 * SCRATCH (the whole raw difference lies inside the dead window, depth asserted not assumed); ARMS
 * (every table entry identical, or faulting the same way on both sides); SELECTOR (the selector swept
 * over its whole range, so the high-nibble mask is itself tested); IDLE ARM (the block past the table
 * writes only with play inactive -- the state that makes it observable); STACK (the rewrite drops the
 * dissolved continuation's tail return, so the oracle's exit pointer sits exactly two bytes higher);
 * TEETH (broken twins, each caught outside the window, over the live and the idle state).
 *
 * HOLE: one captured machine. The sweeps force the selector, so an arm the tape never selects runs
 * against a state it would not really see; where that faults it is asserted only to fault IDENTICALLY.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0f1f.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { dispatchSequenceSubStepArm } from "../dispatchSequenceSubStepArm.js";
import { PLAY_ACTIVE, SEQUENCE_SUBSTEP } from "../names.js";
import { loc_0f1f as oracle } from "../../translated/loc_0f1f.js";

const TARGET = 0x0f1f;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const ARM_TABLE = 0x0f29;
const ARM_MASK = 0x0f;
const ARM_COUNT = ARM_MASK + 1;
const AFTER_ARM = 0x0f54;
/** Bytes below the exit stack pointer the dispatch's dead scratch reaches; measured. */
const WINDOW = 10;
/**
 * The second cell the block past the table tests, after the play flag. With play active
 * that block returns at once and writes nothing, so nothing can tell whether it ran; the
 * IDLE arm clears the play flag and sets this one, which is the state in which it writes.
 */
const SECOND_TEST_CELL = 0xa986;

let entry = null;
let dispatches = 0;

function entryState() {
  if (entry === null) {
    const ov = new Map([
      [TARGET, (mm) => {
        dispatches++;
        if (entry === null) entry = mm.clone();
        return oracle(mm);
      }],
    ]);
    makeMachine(ov).runFrames(ENTRY_FRAMES);
    assert.notEqual(entry, null, `0x0f1f never entered within ${ENTRY_FRAMES} frames`);
  }
  return entry;
}

/** Run both sides on clones of the entry with the selector forced, and report everything. */
function run(candidate, index, idle = false) {
  const a = entryState().clone();
  const b = entryState().clone();
  for (const mm of [a, b]) {
    if (index !== undefined) mm.mem8[SEQUENCE_SUBSTEP] = index;
    if (idle) {
      mm.mem8[PLAY_ACTIVE] = 0;
      mm.mem8[SECOND_TEST_CELL] = 1;
    }
  }
  let fa = null;
  let fb = null;
  try { oracle(a); } catch (e) { fa = e.constructor.name; }
  try { candidate(b); } catch (e) { fb = e.constructor.name; }
  if (fa || fb) return { faultA: fa, faultB: fb };

  const da = a.dumpState();
  const db = b.dumpState();
  const all = [];
  for (let off = 0; off < da.length; off++) {
    if (da[off] !== db[off]) all.push({ addr: a.stateOffsetToAddr(off), a: da[off], b: db[off] });
  }
  const exitSp = a.regs.sp;
  const inWindow = (d) => d.addr >= exitSp - WINDOW && d.addr < exitSp;
  return { all, masked: all.filter((d) => !inWindow(d)), spA: exitSp, spB: b.regs.sp };
}

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (ds) =>
  ds.length === 0 ? "identical" : ds.map((d) => `${hex4(d.addr)}(${d.a}/${d.b})`).join(" ");

// ── broken twins ────────────────────────────────────────────────────────────────────────

/** BUG: does nothing — neither the arm nor the block that follows the table. */
function brokenNoOp() {}

/** BUG: takes the next entry of the table. */
function brokenNextArm(m) {
  const i = (m.mem8[SEQUENCE_SUBSTEP] + 1) & ARM_MASK;
  m.push16(AFTER_ARM);
  m.call(m.mem16[ARM_TABLE + 2 * i]);
  m.call(AFTER_ARM);
}

/** BUG: runs the arm and stops, never reaching the block past the table. */
function brokenSkipsAfter(m) {
  const i = m.mem8[SEQUENCE_SUBSTEP] & ARM_MASK;
  m.push16(AFTER_ARM);
  m.call(m.mem16[ARM_TABLE + 2 * i]);
}

/** BUG: masks one bit too wide, so half the selectors index past the table. */
function brokenWideMask(m) {
  const i = m.mem8[SEQUENCE_SUBSTEP] & 0x1f;
  m.push16(AFTER_ARM);
  m.call(m.mem16[ARM_TABLE + 2 * i]);
  m.call(AFTER_ARM);
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["next-arm", brokenNextArm],
  ["skips-after", brokenSkipsAfter],
  ["wide-mask", brokenWideMask],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("DISPATCHED: the tape reaches the routine, repeatedly", { skip }, () => {
  const e = entryState();
  assert.ok(dispatches > 1, `only ${dispatches} dispatch(es): this is not the live path`);
  console.log(
    `  DISPATCHED: ${dispatches} times in ${ENTRY_FRAMES} frames; captured with selector ` +
      `${e.mem8[SEQUENCE_SUBSTEP] & ARM_MASK}`,
  );
});

test("EQUAL at the real dispatch: masked RAM identical", { skip }, () => {
  const r = run(dispatchSequenceSubStepArm);
  assert.equal(r.faultA ?? r.faultB, undefined, "the real dispatch must not fault");
  assert.deepEqual(r.masked, [], `RAM diverged outside the dead window — ${show(r.masked)}`);
  console.log(`  EQUAL: masked RAM identical; raw difference ${show(r.all)}`);
});

test("SCRATCH: the whole raw difference lies inside the dead window", { skip }, () => {
  let deepest = 0;
  let seen = 0;
  for (let i = 0; i < ARM_COUNT; i++) {
    const r = run(dispatchSequenceSubStepArm, i);
    if (r.faultA || r.faultB) continue;
    for (const d of r.all) {
      assert.ok(d.addr < r.spA, `arm ${i}: ${hex4(d.addr)} is at or above the exit pointer`);
      deepest = Math.max(deepest, r.spA - d.addr);
      seen++;
    }
  }
  assert.ok(seen > 0, "no raw difference at all: the mask is not measuring anything");
  assert.ok(
    deepest <= WINDOW,
    `the deepest difference is ${deepest} bytes below the exit pointer, past the ${WINDOW}-` +
      "byte window this file masks — widen it deliberately, do not let it drift",
  );
  console.log(
    `  SCRATCH: ${seen} differing bytes across the arms, deepest ${deepest} below the exit ` +
      `pointer, window ${WINDOW}`,
  );
});

test("ARMS: every table entry runs identically, or faults identically", { skip }, () => {
  const faulted = [];
  for (let i = 0; i < ARM_COUNT; i++) {
    const r = run(dispatchSequenceSubStepArm, i);
    if (r.faultA || r.faultB) {
      assert.equal(r.faultA, r.faultB, `arm ${i}: ${r.faultA} on one side, ${r.faultB} on the other`);
      faulted.push(i);
      continue;
    }
    assert.deepEqual(r.masked, [], `arm ${i}: ${show(r.masked)}`);
  }
  assert.ok(faulted.length < ARM_COUNT, "every arm faulted: this sweep proves nothing");
  console.log(
    `  ARMS: ${ARM_COUNT} entries swept, ${faulted.length} faulting identically on both ` +
      `sides (${faulted.join(", ") || "none"})`,
  );
});

test("SELECTOR: the high nibble is ignored, over the cell's whole range", { skip }, () => {
  let swept = 0;
  for (let v = 0; v < 256; v++) {
    const r = run(dispatchSequenceSubStepArm, v);
    if (r.faultA || r.faultB) {
      assert.equal(r.faultA, r.faultB, `selector ${v}: ${r.faultA} vs ${r.faultB}`);
    } else {
      assert.deepEqual(r.masked, [], `selector ${v}: ${show(r.masked)}`);
    }
    swept++;
  }
  assert.equal(swept, 256, "must have swept the whole selector cell");
  console.log(`  SELECTOR: ${swept} values identical — only the low nibble can matter`);
});

test("IDLE ARM: with play inactive the block past the table stops doing nothing", { skip }, () => {
  const busy = run(brokenSkipsAfter, 0, false);
  const idle = run(brokenSkipsAfter, 0, true);
  assert.deepEqual(
    busy.masked,
    [],
    "the block past the table now writes while play is active, so this arm's premise is " +
      "gone and the skips-after twin should be gated on the live entry instead",
  );
  assert.ok(
    idle.masked.length > 0,
    "the block past the table writes nothing even with play inactive, so no state reachable " +
      "from this entry can tell whether it ran",
  );
  console.log(`  IDLE ARM: inert while play is active, live with it clear — ${show(idle.masked)}`);
});

test("STACK: the rewrite drops exactly the tail return the oracle pops", { skip }, () => {
  // The dissolved advanceAttractTowardGameStart takes the play-active bail and returns without the tail pop the frozen
  // oracle does there, so the oracle's exit pointer sits two bytes higher on every completing arm.
  for (let i = 0; i < ARM_COUNT; i++) {
    const r = run(dispatchSequenceSubStepArm, i);
    if (r.faultA || r.faultB) continue;
    assert.equal(r.spA - r.spB, 2, `arm ${i}: oracle ${hex4(r.spA)} rewrite ${hex4(r.spB)} — the ` +
      "dropped tail return is not exactly two bytes");
  }
  console.log("  STACK: oracle pops the tail return, the rewrite leaves it — sp+2 on every arm");
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT outside the window`, { skip }, () => {
    const caught = [];
    for (const idle of [false, true]) {
      for (let v = 0; v < 256; v++) {
        const r = run(twin, v, idle);
        if (r.faultA || r.faultB) {
          if (r.faultA !== r.faultB) caught.push(`${idle ? "idle " : ""}${v}`);
          continue;
        }
        if (r.masked.length > 0) caught.push(`${idle ? "idle " : ""}${v}`);
      }
    }
    assert.ok(
      caught.length > 0,
      `the masked comparison PASSED the ${label} twin on every selector — either the twin ` +
        "is not broken or the window has swallowed the evidence",
    );
    console.log(`  TEETH/${label}: caught on ${caught.length} selectors, first ${caught[0]}`);
  });
}
