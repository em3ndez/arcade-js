// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0292 — memory-equivalent to the frozen oracle at ROM 0x0292.
 * GATE: real-state capture. Plain attract NEVER dispatches this routine in 15000 frames (it is the
 * NMI in-play tail, called from the 0x0066 in-game branch at 0x023e, which the attract demo does not
 * enter), so — unlike the reference 0x0766 gate — there is no self-dispatch to hook. We harvest real
 * attract STATES via a high-frequency neighbour (0x0028) and drive loc_0292 directly. Valid because
 * loc_0292 takes NO register live-in (it reads only the work-RAM word 0x829d).
 * loc_0292 is BRANCHY on (0x829d): ==0 returns untouched; !=0 decrements; and when the decrement
 * reaches 0 it also clears (0x83ae). Attract states leave 0x829d arbitrary, so the BRANCH test seeds
 * it to 0, 1 (the reach-zero path) and 2 (decrement-only) to exercise all three paths.
 * LIVE-OUT: memory-only; A/HL/flags are clobbered but not live-out. RAM is compared; three broken twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_0292 } from "../loc_0292.js";
import { loc_0292 as oracle } from "../../translated/loc_0292.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const HARVEST = 0x0028;
const COUNT = 0x829d; // the 16-bit countdown word
const FLAG = 0x83ae; // cleared when the countdown reaches zero
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

// Clone with the countdown word forced to `n` (for branch coverage).
function ramDiffSeeded(cand, machine, n) {
  const seeded = machine.clone();
  seeded.mem.write16(COUNT, n);
  return ramDiff(cand, seeded);
}

// Clone with the countdown word AND the flag forced to a sentinel, so a twin mishandling either cell
// is always detectable regardless of the captured state's prior values.
function ramDiffTeeth(cand, machine, n) {
  const seeded = machine.clone();
  seeded.mem.write16(COUNT, n);
  seeded.mem.write8(FLAG, 0xaa); // sentinel: oracle writes 0 only on the reach-zero path
  return ramDiff(cand, seeded);
}

// broken twins.
function brokenNoOp() {}
function brokenSkipFlag(m) { // decrements but never clears (0x83ae)
  const c = m.mem.read16(COUNT);
  if (c !== 0) m.mem.write16(COUNT, (c - 1) & 0xffff);
}
function brokenWrongDec(m) { // decrements by 2 instead of 1
  const c = m.mem.read16(COUNT);
  if (c !== 0) { const n = (c - 2) & 0xffff; m.mem.write16(COUNT, n); if (n === 0) m.mem.write8(FLAG, 0); }
}

test("CAPTURE: oracle == rewrite on every real attract state", { skip }, () => {
  const entries = capture();
  assert.ok(entries.length > 0, "vacuous: no attract states were harvested");
  for (const e of entries) assert.equal(ramDiff(loc_0292, e), null, "a captured machine diverged");
  console.log(`  CAPTURE: ${entries.length} states, oracle == rewrite`);
});

test("BRANCH: all three count paths equal (0x829d = 0, 1, 2)", { skip }, () => {
  const e = capture()[0];
  assert.ok(e, "no capture to seed");
  assert.equal(ramDiffSeeded(loc_0292, e, 0), null, "count==0 (no-write path) diverged");
  assert.equal(ramDiffSeeded(loc_0292, e, 1), null, "count==1 (reach-zero + clear-flag path) diverged");
  assert.equal(ramDiffSeeded(loc_0292, e, 2), null, "count==2 (decrement-only path) diverged");
  console.log("  BRANCH: 0x829d = 0 / 1 / 2 all equal");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = capture()[0];
  assert.ok(e, "no capture to test teeth against");
  assert.ok(ramDiffTeeth(brokenNoOp, e, 2), "the no-op twin escaped");
  assert.ok(ramDiffTeeth(brokenSkipFlag, e, 1), "the skip-flag twin escaped on the reach-zero path");
  assert.ok(ramDiffTeeth(brokenWrongDec, e, 2), "the wrong-decrement twin escaped");
  console.log("  TEETH: no-op, skip-flag, wrong-decrement all caught");
});
