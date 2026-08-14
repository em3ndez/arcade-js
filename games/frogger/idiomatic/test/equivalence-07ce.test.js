// SPDX-License-Identifier: GPL-3.0-only
/**
 * raiseTwoPlayerStartFlag — memory-equivalent to the frozen oracle at ROM 0x07CE.
 * GATE: real-state capture. Plain attract NEVER dispatches this routine (the 2-player start-flag
 * helper, tail-called from loc_07c1 only when (0x83fd)==1), so we harvest real attract STATES via a
 * high-frequency neighbour (0x0028) and drive raiseTwoPlayerStartFlag directly. Valid because it takes NO register
 * live-in (it reads only work-RAM cell 0x826d).
 * raiseTwoPlayerStartFlag is GUARDED: writes (0x825b)=1 only when (0x826d)!=0; the BRANCH test seeds 0x826d to 0 and 1.
 * LIVE-OUT: memory-only; A/flags are clobbered but not live-out. RAM is compared; three twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { raiseTwoPlayerStartFlag } from "../raiseTwoPlayerStartFlag.js";
import { loc_07ce as oracle } from "../../translated/loc_07ce.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const HARVEST = 0x0028;
const GUARD = 0x826d;
const CAP = 150;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let captured = null;
function capture() {
  if (captured) return captured;
  const entries = [];
  const real = TRANSLATED.get(HARVEST);
  const m = makeMachine(new Map([[HARVEST, (mm) => {
    if (entries.length < CAP) entries.push(mm.clone());
    return real(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  captured = entries;
  return captured;
}

function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

const OUT = 0x825b; // the start flag raiseTwoPlayerStartFlag conditionally sets

// Clone `machine` with the guard cell forced to `v` before comparing.
function ramDiffSeeded(cand, machine, v) {
  const seeded = machine.clone();
  seeded.mem.write8(GUARD, v);
  return ramDiff(cand, seeded);
}

// Clone with guard forced to `g` AND the output cell forced to a sentinel, so a twin that writes the
// wrong thing (or nothing) is always detectable regardless of the captured state's prior 0x825b.
function ramDiffTeeth(cand, machine, g) {
  const seeded = machine.clone();
  seeded.mem.write8(GUARD, g);
  seeded.mem.write8(OUT, 0xaa); // sentinel: neither oracle path nor a correct rewrite yields 0xAA here
  return ramDiff(cand, seeded);
}

// broken twins.
function brokenNoOp() {}
function brokenAlwaysSet(m) { m.mem.write8(OUT, 0x01); } // ignores the (0x826d)==0 guard
function brokenWrongVal(m) { if (m.mem.read8(GUARD) !== 0) m.mem.write8(OUT, 0x02); } // 1 -> 2

test("CAPTURE: oracle == rewrite on every real attract state", { skip }, () => {
  const entries = capture();
  assert.ok(entries.length > 0, "vacuous: no attract states were harvested");
  for (const e of entries) assert.equal(ramDiff(raiseTwoPlayerStartFlag, e), null, "a captured machine diverged");
  console.log(`  CAPTURE: ${entries.length} states, oracle == rewrite`);
});

test("BRANCH: both guard paths equal (0x826d = 0 and = 1)", { skip }, () => {
  const e = capture()[0];
  assert.ok(e, "no capture to seed");
  assert.equal(ramDiffSeeded(raiseTwoPlayerStartFlag, e, 0x00), null, "guard==0 (no-write path) diverged");
  assert.equal(ramDiffSeeded(raiseTwoPlayerStartFlag, e, 0x01), null, "guard!=0 (write path) diverged");
  console.log("  BRANCH: both (0x826d)==0 and !=0 paths equal");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = capture()[0];
  assert.ok(e, "no capture to test teeth against");
  // no-op / wrong-value caught on the write path (guard != 0)
  assert.ok(ramDiffTeeth(brokenNoOp, e, 0x01), "the no-op twin escaped on the write path");
  assert.ok(ramDiffTeeth(brokenWrongVal, e, 0x01), "the wrong-value twin escaped");
  // always-set caught on the no-write path (guard == 0)
  assert.ok(ramDiffTeeth(brokenAlwaysSet, e, 0x00), "the always-set twin escaped on the guarded path");
  console.log("  TEETH: no-op, wrong-value, ignored-guard all caught");
});
