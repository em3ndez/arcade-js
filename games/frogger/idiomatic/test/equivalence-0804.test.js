// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0804 — memory-equivalent to the frozen oracle at ROM 0x0804.
 * GATE: crafted-entry. Attract never dispatches this frog-object init, so coherent post-boot states
 * are captured at the per-frame score redraw (0x0b1f) and replayed through both sides; the routine
 * reads all its inputs from memory (no register live-in), so any such state is a valid entry. Real
 * states hold the play flag at 0 (the timer arm is skipped), so a seeded twin sets it to 2 to
 * exercise the two 16-bit timer writes. Live-out is memory-only, so RAM is compared and registers/SP
 * are not. Teeth: three broken twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_0804 } from "../loc_0804.js";
import { loc_0804 as oracle } from "../../translated/loc_0804.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const NEIGHBOUR = 0x0b1f; // per-frame score redraw; a source of coherent post-boot states
const CAP = 200;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let captured = null;
function captureNeighbours() {
  if (captured) return captured;
  const entries = [];
  const real = TRANSLATED.get(NEIGHBOUR);
  const m = makeMachine(new Map([[NEIGHBOUR, (mm) => {
    if (entries.length < CAP) entries.push(mm.clone());
    return real(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  assert.ok(entries.length > 0, "vacuous: the neighbour was never dispatched, no state to replay");
  captured = entries;
  return captured;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// two-player entry: forces the timer arm; markers on the touched cells so the writes are observable.
function craft2p(machine) {
  const c = machine.clone();
  c.mem8[0x83fe] = 2;
  c.mem8[0x8044] = 0x77; c.mem8[0x8045] = 0x77; c.mem8[0x8047] = 0x77;
  c.mem16[0x83d2] = 0x1234; c.mem16[0x83da] = 0x5678;
  return c;
}
function oracled(machine) { const a = machine.clone(); oracle(a); return a.dumpState(); }

function brokenNoOp() {}
function brokenWrongActive(m) {
  const { mem8, mem16 } = m;
  mem8[0x8044] = 2; mem8[0x8045] = 0; mem8[0x8047] = 0;   // BUG: active = 2 not 1
  if (mem8[0x83fe] !== 2) return;
  mem16[0x83d2] = 64; mem16[0x83da] = 64;
}
function brokenSkipTimers(m) {
  const { mem8 } = m;
  mem8[0x8044] = 1; mem8[0x8045] = 0; mem8[0x8047] = 0;
  // BUG: omit the two timers even in a two-player game
}

test("REAL: oracle == rewrite on every captured neighbour state", { skip }, () => {
  const entries = captureNeighbours();
  for (const e of entries) assert.equal(ramDiff(loc_0804, e), null, "a captured machine diverged");
  console.log(`  REAL: ${entries.length} neighbour states (1-player arm), oracle == rewrite`);
});

test("CRAFTED: oracle == rewrite on the two-player timer arm", { skip }, () => {
  const two = craft2p(captureNeighbours()[0]);
  assert.equal(ramDiff(loc_0804, two), null, "diverged on the two-player timer arm");
  assert.notDeepEqual(oracled(two), two.dumpState(), "two-player entry vacuous: oracle changed nothing");
  console.log("  CRAFTED: two-player timer arm, oracle == rewrite");
});

test("TEETH: broken twins are caught on the two-player entry", { skip }, () => {
  const two = craft2p(captureNeighbours()[0]);
  assert.ok(ramDiff(brokenNoOp, two), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongActive, two), "the wrong-active twin escaped");
  assert.ok(ramDiff(brokenSkipTimers, two), "the skip-timers twin escaped");
  console.log("  TEETH: no-op, wrong-active, skip-timers all caught");
});
