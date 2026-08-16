// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceScrollLaneObjects — memory-equivalent to the frozen oracle at ROM 0x2005.
 * GATE: crafted-entry. Attract never dispatches this NMI scroll driver (probe: 0 dispatches over
 * ENTRY_FRAMES — its caller guards are dead in attract), so a post-boot attract machine is cloned and
 * its scroll counters (0x8110/0x8111), phase counter (0x826E) and two object descriptors
 * (0x8273.., 0x827C..) are poked to drive each path: the two conditional wrap handlers, the three
 * phase-lane blocks, and the counter 8-bit wraps. The routine runs its callees on a fresh clone per
 * side, so the real callees execute identically on both sides and their writes are part of the compared
 * live-out. Live-out is memory-only (both callers reload registers after the call); the rewrite
 * dissolves all four idiomatized callees (stamp/band/grid + the alt-base grid copy) into direct JS
 * calls, so their push16 return-continuations no longer land on the stack — the dead
 * [SP-8, SP) scratch is masked and the rest of RAM is compared. Teeth: three broken RAM twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { advanceScrollLaneObjects } from "../advanceScrollLaneObjects.js";
import { loc_2005 as oracle } from "../../translated/loc_2005.js";

const COUNTER_A = 0x8110, COUNTER_B = 0x8111, PHASE = 0x826e;
const OBJ_A = 0x8273, OBJ_B = 0x827c;
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

// A post-boot machine with coherent (small) scroll descriptors so the copy engine is bounded, and the
// counters/phase poked to the requested arm. A valid entry: advanceScrollLaneObjects reads all its inputs from RAM.
function entry(opts = {}) {
  const { a = 0, b = 158, phase = 0 } = opts;
  const e = seedMachine().clone();
  e.mem8[COUNTER_A] = a;
  e.mem8[COUNTER_B] = b;
  e.mem8[PHASE] = phase;
  e.mem8[OBJ_A] = 0; e.mem8[OBJ_A + 1] = 2; e.mem8[OBJ_A + 2] = 2;
  e.mem8[OBJ_B] = 0; e.mem8[OBJ_B + 1] = 2; e.mem8[OBJ_B + 2] = 2;
  return e;
}

// null == RAM-equivalent, masking the dead [SP-8, SP) stack scratch the dissolved callees'
// return-continuations no longer write. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const lo = (machine.regs.sp - 8) & 0xffff;
  const hi = machine.regs.sp;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const A = a.dumpState(), B = b.dumpState();
  const n = Math.min(A.length, B.length);
  for (let i = 0; i < n; i++) {
    if (A[i] === B[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= lo && addr < hi) continue; // dead stack scratch
    return `0x${(addr ?? 0).toString(16)}: ${A[i]} vs ${B[i]}`;
  }
  return null;
}

// each key an arm: no calls; wrap A; wrap B; both wraps; lane 16/32/48; lane+wraps; both 8-bit wraps.
const ARMS = [
  { a: 0, b: 158, phase: 0 },
  { a: 79, b: 158, phase: 0 },
  { a: 0, b: 0, phase: 0 },
  { a: 79, b: 0, phase: 0 },
  { a: 0, b: 158, phase: 15 },
  { a: 0, b: 158, phase: 31 },
  { a: 0, b: 158, phase: 47 },
  { a: 79, b: 0, phase: 15 },
  { a: 255, b: 158, phase: 0 },
  { a: 0, b: 255, phase: 0 },
];

// broken twins, each leaving wrong RAM the diff must catch (exercised on the lane+wraps arm).
function brokenNoOp() {}
function brokenWrongCounter(m) {
  const { mem8 } = m;
  mem8[0x811a] = mem8[OBJ_A + 2];
  mem8[COUNTER_A] = (mem8[COUNTER_A] + 2) & 0xff; // BUG: steps object A by 2, not 1
}
function brokenSkipCalls(m) {
  const { mem8 } = m;
  mem8[0x811a] = mem8[OBJ_A + 2]; mem8[COUNTER_A] = (mem8[COUNTER_A] + 1) & 0xff;
  mem8[0x8119] = mem8[OBJ_B + 2]; mem8[COUNTER_B] = (mem8[COUNTER_B] + 2) & 0xff;
  mem8[PHASE] = (mem8[PHASE] + 1) & 0xff; // BUG: never runs the wrap handlers or lane blocks
}

test("EQUAL (crafted): advanceScrollLaneObjects == oracle on every arm", { skip }, () => {
  const entries = ARMS.map(entry);
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (const e of entries) assert.equal(ramDiff(advanceScrollLaneObjects, e), null, "a crafted arm diverged");
  console.log(`  EQUAL: ${entries.length} crafted arms, advanceScrollLaneObjects == oracle`);
});

test("TEETH: broken twins are caught on the lane+wraps arm", { skip }, () => {
  const e = entry({ a: 79, b: 0, phase: 15 });
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongCounter, e), "the wrong-counter twin escaped");
  assert.ok(ramDiff(brokenSkipCalls, e), "the skip-calls twin escaped");
  console.log("  TEETH: no-op, wrong-counter, skip-calls all caught");
});
