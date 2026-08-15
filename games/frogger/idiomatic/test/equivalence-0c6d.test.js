// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0c6d — memory-equivalent to the frozen oracle at ROM 0x0C6D.
 * Crafted-entry: attract never dispatches the mode-4 marquee within ENTRY_FRAMES (probe: 0), so a
 * post-boot clone is poked at the phase counter (0x83D7) across 0..5 to drive every arm (idle park,
 * three strip phases, sprite-seeding phase) and both counter branches. Live-out is memory-only; the
 * rewrite's dissolved calls omit the oracle's push16 return residue in [SP-8,SP), masked before the
 * RAM compare. Teeth: no-op, wrong-marker, frozen-counter.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_0c6d } from "../loc_0c6d.js";
import { loc_0c6d as oracle } from "../../translated/loc_0c6d.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const PHASE_COUNTER = 0x83d7;
const STATE_CELL = 0x83d8;
const SPRITE_CELL = 0x801b; // one of the sprite band cells the phase-4 arm seeds
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let seed = null;
function seedMachine() {
  if (seed) return seed;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the seed run stopped early: ${m.stoppedBy}`);
  seed = m.clone();
  return seed;
}

function entryWithCounter(v) {
  const e = seedMachine().clone();
  e.mem8[PHASE_COUNTER] = v;
  return e;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
const WORK_RAM_BASE = 0x8000;
const WORK_RAM_END = 0x8800;
// Zero the dead stack scratch [SP-8, SP) (clamped to work RAM): the oracle's dissolved return-brackets
// leave push16 residue there that the rewrite never writes, and it is not live-out.
function maskStack(dump, sp) {
  const lo = Math.max(WORK_RAM_BASE, sp - 8);
  const hi = Math.min(WORK_RAM_END, sp);
  for (let a = lo; a < hi; a++) dump[a - WORK_RAM_BASE] = 0;
  return dump;
}
function ramDiff(cand, machine) {
  const sp = machine.regs.sp; // entry SP; both sides' stack activity sits just below it
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(
    maskStack(a.dumpState(), sp),
    maskStack(b.dumpState(), sp),
    (o) => a.stateOffsetToAddr(o),
  );
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

function brokenNoOp() {}
function brokenWrongMarker(m) { oracle(m); m.mem8[STATE_CELL] = 0; } // BUG: parks the wrong state marker
function brokenFrozenCounter(m) {
  const before = m.mem8[PHASE_COUNTER];
  oracle(m);
  m.mem8[PHASE_COUNTER] = before; // BUG: the phase never advances to the next call
}

test("EQUAL (crafted): loc_0c6d == oracle across every phase and both counter branches", { skip }, () => {
  for (const v of [0, 1, 2, 3, 4, 5]) {
    assert.equal(ramDiff(loc_0c6d, entryWithCounter(v)), null, `counter=${v} diverged`);
  }
  // non-vacuous: the idle park and the sprite-seeding phase both write RAM.
  assert.ok(ramDiff(brokenNoOp, entryWithCounter(1)), "vacuous: the idle phase wrote nothing");
  assert.ok(ramDiff(brokenNoOp, entryWithCounter(5)), "vacuous: the sprite phase wrote nothing");
  console.log("  EQUAL: phases 0-4 + reload branch, loc_0c6d == oracle");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = entryWithCounter(5); // the sprite-seeding phase, the richest write-set
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongMarker, e), "the wrong-marker twin escaped");
  assert.ok(ramDiff(brokenFrozenCounter, e), "the frozen-counter twin escaped");
  // and a strip-drawing phase catches wrong-marker too, not just the sprite phase.
  assert.ok(ramDiff(brokenWrongMarker, entryWithCounter(3)), "the wrong-marker twin escaped on a draw phase");
  console.log("  TEETH: no-op, wrong-marker, frozen-counter all caught");
});
