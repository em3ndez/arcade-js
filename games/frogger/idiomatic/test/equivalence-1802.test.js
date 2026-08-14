// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1802 — memory-equivalent to the frozen oracle at ROM 0x1802.
 * GATE: crafted-entry. Attract never dispatches this in-play animation stepper (probe: 0 dispatches
 * over ENTRY_FRAMES), so a post-boot attract machine is cloned and its gate cells poked to drive each
 * path — either busy latch set (early return), the timer-tick branch, the frame-copy branch at
 * several indices, and the index-wrap edge. Live-out is memory-only, so registers/SP are not
 * compared. Teeth: three broken RAM twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_1802 } from "../loc_1802.js";
import { loc_1802 as oracle } from "../../translated/loc_1802.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const BUSY_1 = 0x814f;
const BUSY_2 = 0x815b;
const TIMER = 0x81b4;
const INDEX = 0x81b3;
const PTR_TABLE = 0x1841;
const FRAME_DST = 0x819b;
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

// A post-boot machine with the gate cells poked to force a chosen path (a valid entry: this leaf
// reads its own gate state from these cells).
function entry({ busy1 = 0, busy2 = 0, timer = 0, index = 0 } = {}) {
  const e = seedMachine().clone();
  e.mem8[BUSY_1] = busy1;
  e.mem8[BUSY_2] = busy2;
  e.mem8[TIMER] = timer;
  e.mem8[INDEX] = index;
  return e;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

const PATHS = [
  { busy1: 5 }, // busy latch 1 -> early return
  { busy2: 7 }, // busy latch 2 -> early return
  { timer: 9 }, // timer running -> tick down
  { index: 0 }, // frame copy, first index
  { index: 1 },
  { index: 8 }, // frame copy, last non-wrapping index
  { index: 9 }, // index-wrap edge -> reset, no copy
];

function brokenNoOp() {}
function brokenWrongTimer(m) {
  const { mem8, mem16 } = m;
  if (mem8[BUSY_1] !== 0 || mem8[BUSY_2] !== 0) return;
  if (mem8[TIMER] !== 0) { mem8[TIMER] = mem8[TIMER] - 1; return; }
  const i = mem8[INDEX];
  const src = mem16[(PTR_TABLE + 2 * i) & 0xffff];
  const n = (i + 1) & 0xff;
  mem8[TIMER] = 22; // BUG: wrong reload value
  if (n === 10) { mem8[INDEX] = 0; return; }
  mem8[INDEX] = n;
  for (let k = 0; k < 11; k++) mem8[(FRAME_DST + k) & 0xffff] = mem8[(src + k) & 0xffff];
}
function brokenNoWrap(m) {
  const { mem8, mem16 } = m;
  if (mem8[BUSY_1] !== 0 || mem8[BUSY_2] !== 0) return;
  if (mem8[TIMER] !== 0) { mem8[TIMER] = mem8[TIMER] - 1; return; }
  const i = mem8[INDEX];
  const src = mem16[(PTR_TABLE + 2 * i) & 0xffff];
  mem8[TIMER] = 21;
  mem8[INDEX] = (i + 1) & 0xff; // BUG: never resets at the table end, and always copies
  for (let k = 0; k < 11; k++) mem8[(FRAME_DST + k) & 0xffff] = mem8[(src + k) & 0xffff];
}

test("EQUAL (crafted): loc_1802 == oracle on every gate path", { skip }, () => {
  const entries = PATHS.map(entry);
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (const e of entries) assert.equal(ramDiff(loc_1802, e), null, "a crafted entry diverged");
  assert.ok(ramDiff(brokenNoOp, entry({ index: 1 })), "vacuous: oracle wrote nothing on the copy path");
  console.log(`  EQUAL: ${entries.length} crafted gate paths, loc_1802 == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  assert.ok(ramDiff(brokenNoOp, entry({ index: 1 })), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongTimer, entry({ index: 1 })), "the wrong-timer twin escaped");
  assert.ok(ramDiff(brokenNoWrap, entry({ index: 9 })), "the no-wrap twin escaped");
  console.log("  TEETH: no-op, wrong-timer, no-wrap all caught");
});
