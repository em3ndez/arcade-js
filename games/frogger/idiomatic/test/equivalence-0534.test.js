// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearPlayerOneHomeBayGates — memory-equivalent to the frozen oracle at ROM 0x0534.
 * GATE: crafted-entry (probe: 0 dispatches over ENTRY_FRAMES). Its tail transfers to the cold-start
 * entry 0x0567, which never returns in a unit context, so 0x0567 is overridden with a sentinel stub
 * installed identically on both sides; the compared live-out is the routine's own clears (0x825C,
 * 0x825E-0x8262) and the stub's sentinel write makes a skipped tail call observable. Memory-only
 * live-out, no register live-in. Teeth: no-op, wrong-value, skip-call (0x825D stays untouched).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { clearPlayerOneHomeBayGates } from "../clearPlayerOneHomeBayGates.js";
import { loc_0534 as oracle } from "../../translated/loc_0534.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const COLD_START = 0x0567;
const SLOT = 0x825c;
const GAP = 0x825d; // between the slot byte and the gate table; the routine must NOT touch it
const GATES = 0x825e; // 0x825E-0x8262, five occupancy gates
const SENTINEL = 0x8600; // a cell the routine never writes; the stub marks it so the tail is visible
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const stub = (mm) => { mm.mem8[SENTINEL] = 0xab; };

let seed = null;
function seedMachine() {
  if (seed) return seed;
  const m = makeMachine(new Map([[COLD_START, stub]])); // stub is never hit during attract
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the seed run stopped early: ${m.stoppedBy}`);
  seed = m.clone();
  return seed;
}

// A post-boot machine with the slot/gate cells set to a marker so the clears are observable, the gap
// byte set to a witness, and the sentinel pre-cleared.
function entry(v) {
  const e = seedMachine().clone();
  e.mem8[SLOT] = v;
  e.mem8[GAP] = 0x99;
  for (let i = 0; i < 5; i++) e.mem8[GATES + i] = v;
  e.mem8[SENTINEL] = 0;
  return e;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

const VALUES = [0xff, 0x01, 0x7e];

function brokenNoOp() {}
function brokenWrongValue(m) {
  m.mem8[SLOT] = 0; for (let i = 0; i < 5; i++) m.mem8[GATES + i] = 1; return m.call(COLD_START);
}
function brokenSkipCall(m) {
  m.mem8[SLOT] = 0; for (let i = 0; i < 5; i++) m.mem8[GATES + i] = 0; // BUG: never enters cold-start
}

test("EQUAL (crafted): clearPlayerOneHomeBayGates == oracle on every marker value", { skip }, () => {
  const entries = VALUES.map(entry);
  for (const e of entries) assert.equal(ramDiff(clearPlayerOneHomeBayGates, e), null, "a crafted entry diverged");
  assert.ok(ramDiff(brokenNoOp, entry(0xff)), "vacuous: oracle wrote nothing");
  // the routine must leave 0x825D untouched.
  const chk = entry(0xff).clone(); oracle(chk);
  assert.equal(chk.mem8[GAP], 0x99, "oracle unexpectedly wrote 0x825D");
  console.log(`  EQUAL: ${entries.length} marker values, clearPlayerOneHomeBayGates == oracle; 0x825D preserved`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = entry(0xff);
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongValue, e), "the wrong-value twin escaped");
  assert.ok(ramDiff(brokenSkipCall, e), "the skip-call twin escaped");
  console.log("  TEETH: no-op, wrong-value, skip-call all caught");
});
