// SPDX-License-Identifier: GPL-3.0-only
/**
 * flyEnemyFreeLeadInThenStepSequence vs the frozen oracle at ROM 0x5694 — a phase-3 sequence arm: fold, services, delay, fold, step.
 * GATE: capture-clone-replay. Both tapes dispatch it through the sub-step table; every capture is
 * replayed on independent clones and compared on RAM (outside the stack scratch both sides push
 * into), pc and SP. The rewrite runs through the game's withOmittedRet seam, which completes the
 * ROM ret it omits, so pc and SP are compared exactly. Live-out is memory: the oracle leaves A/F/C/HL
 * behind, but its only continuation (the dispatcher's fixed tail) rewrites A/F on every early exit
 * and reads no register, so no register arm is asserted. Crafted entries force each delay arm and a
 * non-genuine phase byte so the folds are exercised off their cancelling point.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-5694.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { flyEnemyFreeLeadInThenStepSequence as candidate } from "../flyEnemyFreeLeadInThenStepSequence.js";
import { loc_5694 as oracle } from "../../translated/loc_5694.js";
import { multiplexSpriteSlotsSkipping } from "../multiplexSpriteSlotsSkipping.js";
import { dispatchPlayerFrameByState } from "../dispatchPlayerFrameByState.js";
import { runSceneryForEra } from "../runSceneryForEra.js";
import { fireAndSweepPlayerShots } from "../fireAndSweepPlayerShots.js";
import { multiplexSpriteSlots } from "../multiplexSpriteSlots.js";
import { advanceSequenceSubStep } from "../advanceSequenceSubStep.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { SEQUENCE_DELAY, SEQUENCE_PHASE, SEQUENCE_SUBSTEP } from "../names.js";

const TARGET = 0x5694;
const DATA_TOP = 0xadff;
const CAP = 12;
const ROUND_ENGINE_PHASE = 3;
// Derived here, independently of the module, from the frozen body.
const FIRST_BLOCK = 0x0831;
const SECOND_BLOCK = 0x12a7;
const FIRST_KEY = 0xc2;
const SECOND_KEY = 0x59;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${d.addr == null ? d.what : hex4(d.addr)}: frozen=${d.a} rewrite=${d.b}` : "identical");

/** Drop decoded graphics from a captured machine: nothing here renders, and cloning one is slow. */
function lean(mm) {
  mm.assets = {};
  mm.video = null;
  return mm;
}

function captureEntries(tapeOpts) {
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (entries.length < CAP) entries.push(lean(mm.clone()));
    return oracle(mm);
  }]]), tapeOpts);
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the capture run ran short");
  return entries;
}

let driven = null;
let undriven = null;
const drivenEntries = () => (driven ??= captureEntries({}));
const undrivenEntries = () => (undriven ??= captureEntries({ tape: [] }));
const realEntries = () => [...drivenEntries(), ...undrivenEntries()];

/** A real capture with one cell poked identically before either side runs. */
function craft(cell, value, from = realEntries()[0]) {
  const e = from.clone();
  e.mem8[cell] = value;
  return e;
}
const expiring = () => craft(SEQUENCE_DELAY, 0x01);
const running = () => craft(SEQUENCE_DELAY, 0x10);
const wrapping = () => craft(SEQUENCE_DELAY, 0x00);
const offPhaseExpiring = () => craft(SEQUENCE_PHASE, 0x00, expiring());
const offPhaseRunning = () => craft(SEQUENCE_PHASE, 0x01, running());
const craftedEntries = () => [expiring(), running(), wrapping(), offPhaseExpiring(), offPhaseRunning()];
const allEntries = () => [...realEntries(), ...craftedEntries()];

/** Track the lowest SP a side reaches, so its own pushes can be masked as stack scratch. */
function trackLow(mm) {
  const box = { low: mm.regs.sp };
  const push = mm.push16.bind(mm);
  mm.push16 = (v) => { push(v); if (mm.regs.sp < box.low) box.low = mm.regs.sp; };
  return box;
}

/** Oracle vs the seam-wrapped candidate on independent clones: RAM outside both push windows, pc, SP. */
function unitDiff(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  const la = trackLow(a);
  const lb = trackLow(b);
  oracle(a);
  try {
    withOmittedRet(cand, TARGET)(b);
  } catch (e) {
    return { addr: null, what: "seam", a: "placed", b: String(e.message).slice(0, 60) };
  }
  const low = Math.min(la.low, lb.low);
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    return { addr, a: da[i], b: db[i] };
  }
  if (a.regs.sp !== b.regs.sp) return { addr: null, what: "sp", a: hex4(a.regs.sp), b: hex4(b.regs.sp) };
  if (a.pc !== b.pc) return { addr: null, what: "pc", a: hex4(a.pc), b: hex4(b.pc) };
  return null;
}

function windowOf(machine) {
  const a = machine.clone();
  const seat = a.regs.sp;
  const la = trackLow(a);
  oracle(a);
  return { low: la.low, seat };
}

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("REAL DISPATCHES: both tapes reach this arm, and every capture is identical", { skip }, () => {
  assert.ok(drivenEntries().length > 0, "vacuous: the coin-start tape never dispatched this address");
  assert.ok(undrivenEntries().length > 0, "vacuous: the undriven tape never dispatched this address");
  for (const e of realEntries()) {
    assert.equal(e.mem8[SEQUENCE_PHASE], ROUND_ENGINE_PHASE, "a capture was not taken in the round engine's phase");
    const d = unitDiff(candidate, e);
    assert.equal(d, null, `a real dispatch diverged: ${show(d)}`);
  }
  console.log(`  REAL DISPATCHES: ${drivenEntries().length} driven + ${undrivenEntries().length} undriven, all identical`);
});

test("DELAY ARMS: running, expiring, wrapping and off-phase crafts are identical", { skip }, () => {
  for (const e of craftedEntries()) {
    const d = unitDiff(candidate, e);
    assert.equal(d, null, `a crafted entry diverged: ${show(d)}`);
  }
  console.log(`  DELAY ARMS: ${craftedEntries().length} crafted entries identical`);
});

test("TAIL: the sub-step steps on only when the delay expires", { skip }, () => {
  for (const [label, e, steps] of [["expiring", expiring(), true], ["running", running(), false], ["wrapping", wrapping(), false]]) {
    const before = e.mem8[SEQUENCE_SUBSTEP];
    const c = e.clone();
    oracle(c);
    const want = steps ? (before + 1) & 0xff : before;
    assert.equal(c.mem8[SEQUENCE_SUBSTEP], want, `the ${label} arm left the sub-step wrong on the frozen side`);
  }
  console.log("  TAIL: sub-step advanced on expiry only");
});

test("FOLDS: on a genuine image each fold hands the round-engine phase back unchanged", { skip }, () => {
  const rom = realEntries()[0];
  for (const [base, key] of [[FIRST_BLOCK, FIRST_KEY], [SECOND_BLOCK, SECOND_KEY]]) {
    let sum = ROUND_ENGINE_PHASE;
    for (let i = 0; i < 256; i++) sum = (sum - rom.mem8[base + i]) & 0xff;
    assert.equal(sum ^ key, ROUND_ENGINE_PHASE, `the fold over ${hex4(base)} does not cancel on this image`);
  }
  console.log("  FOLDS: both cancel at phase 3");
});

test("SCRATCH: the frozen push window sits above the data on every entry", { skip }, () => {
  for (const e of allEntries()) {
    const { low, seat } = windowOf(e);
    assert.ok(low > DATA_TOP, `the push window ${hex4(low)} reached into game data`);
    assert.ok(low < seat, "the frozen side pushed nothing, so the mask hides an untested divergence");
  }
  const r = windowOf(realEntries()[0]);
  console.log(`  SCRATCH: window [${hex4(r.low)}, ${hex4(r.seat)}) clears data top ${hex4(DATA_TOP)}`);
});

// ── SP tooth (R36) ──────────────────────────────────────────────────────────────────────────

/** BUG: the second sprite fixup is called with no stack word, so its ret pops the caller's slot. */
function brokenMissingPush(m) {
  const { mem8 } = m;
  const fold = (base, key) => {
    let sum = mem8[SEQUENCE_PHASE];
    for (let i = 0; i < 256; i++) sum = (sum - mem8[base + i]) & 0xff;
    mem8[SEQUENCE_PHASE] = sum ^ key;
  };
  fold(FIRST_BLOCK, FIRST_KEY);
  m.push16(0); multiplexSpriteSlotsSkipping(m);
  dispatchPlayerFrameByState(m);
  multiplexSpriteSlotsSkipping(m);
  runSceneryForEra(m);
  fireAndSweepPlayerShots(m);
  multiplexSpriteSlots(m);
  mem8[SEQUENCE_DELAY] = (mem8[SEQUENCE_DELAY] - 1) & 0xff;
  if (mem8[SEQUENCE_DELAY] !== 0) return;
  fold(SECOND_BLOCK, SECOND_KEY);
  advanceSequenceSubStep(m);
}

test("SP TOOTH: the seam places the rewrite on every entry, and refuses a dropped push", { skip }, () => {
  for (const e of allEntries()) {
    const r = seamPlaceable(withOmittedRet, candidate, TARGET, e.clone());
    assert.equal(r.placeable, true, `the seam refused the rewrite: ${r.error}`);
  }
  let refused = 0;
  for (const e of allEntries()) if (!seamPlaceable(withOmittedRet, brokenMissingPush, TARGET, e.clone()).placeable) refused++;
  assert.ok(refused > 0, "the missing-push mutant was placed on every entry — the SP tooth has no teeth");
  console.log(`  SP TOOTH: rewrite placed on all; missing-push mutant refused on ${refused}/${allEntries().length}`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────────

const brokenNoOp = () => {};

/** BUG: the first fold uses the second block's key. */
function brokenWrongKey(m) {
  candidate(m);
  m.mem8[SEQUENCE_PHASE] ^= FIRST_KEY ^ SECOND_KEY;
}

/** BUG: the delay is never counted down. */
function brokenNoCountdown(m) {
  const d = m.mem8[SEQUENCE_DELAY];
  candidate(m);
  m.mem8[SEQUENCE_DELAY] = d;
}

/** BUG: steps the sequence on every dispatch, not just on expiry. */
function brokenAlwaysStep(m) {
  const d = m.mem8[SEQUENCE_DELAY];
  candidate(m);
  if (((d - 1) & 0xff) !== 0) advanceSequenceSubStep(m);
}

/** BUG: never steps the sequence. */
function brokenNeverStep(m) {
  const s = m.mem8[SEQUENCE_SUBSTEP];
  candidate(m);
  m.mem8[SEQUENCE_SUBSTEP] = s;
}

/** BUG: the scenery service is dropped. */
function brokenNoScenery(m) {
  const { mem8 } = m;
  const phase = mem8[SEQUENCE_PHASE];
  let sum = phase;
  for (let i = 0; i < 256; i++) sum = (sum - mem8[FIRST_BLOCK + i]) & 0xff;
  mem8[SEQUENCE_PHASE] = sum ^ FIRST_KEY;
  m.push16(0); multiplexSpriteSlotsSkipping(m);
  dispatchPlayerFrameByState(m);
  m.push16(0); multiplexSpriteSlotsSkipping(m);
  fireAndSweepPlayerShots(m);
  multiplexSpriteSlots(m);
  mem8[SEQUENCE_DELAY] = (mem8[SEQUENCE_DELAY] - 1) & 0xff;
  if (mem8[SEQUENCE_DELAY] !== 0) return;
  let s2 = mem8[SEQUENCE_PHASE];
  for (let i = 0; i < 256; i++) s2 = (s2 - mem8[SECOND_BLOCK + i]) & 0xff;
  mem8[SEQUENCE_PHASE] = s2 ^ SECOND_KEY;
  advanceSequenceSubStep(m);
}

const TWINS = [
  ["no-op", brokenNoOp, allEntries],
  ["wrong-key", brokenWrongKey, allEntries],
  ["no-countdown", brokenNoCountdown, allEntries],
  // only visible where the delay is still running
  ["always-step", brokenAlwaysStep, () => [running(), wrapping(), offPhaseRunning()]],
  // only visible where the delay expires
  ["never-step", brokenNeverStep, () => [expiring(), offPhaseExpiring()]],
  ["no-scenery", brokenNoScenery, allEntries],
  ["missing-push", brokenMissingPush, allEntries],
];

for (const [label, twin, pool] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    let caught = 0;
    let first = null;
    const entries = pool();
    for (const e of entries) {
      const d = unitDiff(twin, e);
      if (d) { caught++; first ??= d; }
    }
    assert.ok(caught > 0, `every entry PASSED the ${label} twin — it has no teeth`);
    console.log(`  TEETH/${label}: caught on ${caught}/${entries.length} — first ${show(first)}`);
  });
}
