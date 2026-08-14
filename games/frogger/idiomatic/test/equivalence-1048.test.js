// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1048 — memory-equivalent to the frozen oracle at ROM 0x1048, and watchdog-count-equivalent.
 * GATE: captured boot entry. The boot chain dispatches this settle delay exactly once (probe: 1
 * dispatch within 64 frames), so the entry is captured by hooking the address and cloning the live
 * state on first arrival. The routine writes no RAM; its only effect is that each pass reads the
 * watchdog port, and that read COUNT is the point of this file. dumpState() holds work/video/sprite
 * RAM but no io, so a RAM comparison passes a rewrite that under-feeds the dog — the read count,
 * tracked on the memory object, is what the twins move. Teeth: three broken read-count twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { loc_1048 } from "../loc_1048.js";
import { loc_1048 as oracle } from "../../translated/loc_1048.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const TARGET = 0x1048;
const WATCHDOG = 0x8800;
const EXPECTED_READS = 61439; // one per settle pass
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let entry = null;
let dispatched = 0;
function entryState() {
  if (entry) return entry;
  class Reached extends Error {}
  const m = makeMachine(new Map([[TARGET, (mm) => { dispatched++; entry = mm.clone(); throw new Reached(); }]]));
  try { m.runFrames(64); } catch (e) { if (!(e instanceof Reached)) throw e; }
  assert.ok(entry, "boot never dispatched the settle delay");
  return entry;
}

// RAM difference outside no exclusion (this routine writes no RAM); null == identical.
function ramDiff(a, b) {
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}
function readsOf(fn) {
  const m = entryState().clone();
  const before = m.mem.watchdogReads;
  fn(m);
  return { reads: m.mem.watchdogReads - before, machine: m };
}

// broken read-count twins.
function brokenNoOp() {}
function brokenFewer(m) { for (let i = 0; i < 100; i++) m.mem.read8(WATCHDOG); }
function brokenOneExtra(m) { for (let i = 0; i < EXPECTED_READS + 1; i++) m.mem.read8(WATCHDOG); }

test("WITNESSED: boot really does reach the settle delay", { skip }, () => {
  entryState();
  assert.equal(dispatched, 1, "expected exactly one boot dispatch");
});

test("EQUAL (captured): loc_1048 == oracle on RAM and the watchdog read count", { skip }, () => {
  const a = entryState().clone(); oracle(a);
  const b = entryState().clone(); loc_1048(b);
  assert.equal(ramDiff(a, b), null, "RAM diverged (neither should write RAM)");
  const base = entryState().mem.watchdogReads;
  assert.equal(a.mem.watchdogReads - base, EXPECTED_READS, "the ORACLE's read count moved");
  assert.equal(b.mem.watchdogReads - base, EXPECTED_READS, "the rewrite's read count moved");
  console.log(`  EQUAL: RAM identical, both fed the watchdog ${EXPECTED_READS} times`);
});

test("THE STATE DUMP IS BLIND: an under-feeding rewrite passes a RAM comparison", { skip }, () => {
  const a = entryState().clone(); oracle(a);
  const b = entryState().clone(); brokenFewer(b);
  assert.equal(ramDiff(a, b), null, "expected the fewer-reads twin to be INVISIBLE to RAM");
  assert.notEqual(a.mem.watchdogReads, b.mem.watchdogReads, "and yet the read counts must differ");
});

test("TEETH: broken read-count twins are caught by the count", { skip }, () => {
  const oracleReads = readsOf(oracle).reads;
  assert.notEqual(readsOf(brokenNoOp).reads, oracleReads, "the no-op twin escaped");
  assert.notEqual(readsOf(brokenFewer).reads, oracleReads, "the fewer-reads twin escaped");
  assert.notEqual(readsOf(brokenOneExtra).reads, oracleReads, "the one-extra-read twin escaped");
  console.log("  TEETH: no-op, fewer-reads, one-extra all caught");
});
