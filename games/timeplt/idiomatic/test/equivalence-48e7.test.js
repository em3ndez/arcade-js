// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardOneCreditOnDebouncedInputEdge vs the frozen oracle at ROM 0x48E7. The shared tape reaches this address every frame but
 * only ever in the quiet branch — the port mirror reads zero, so the leading edge never fires — so
 * the firing branch (sound + credit) is exercised from CRAFTED entries. The dissolved tail pushes a
 * return address and pops the caller's, so [floor, sp) is masked and a,f,h,l,sp are a ceiling.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-48e7.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { awardOneCreditOnDebouncedInputEdge } from "../awardOneCreditOnDebouncedInputEdge.js";
import { loc_48e7 as oracle } from "../../translated/loc_48e7.js";
import { requestCoinSound } from "../requestCoinSound.js";
import { awardCoinCreditThenPulseCoinCounter } from "../awardCoinCreditThenPulseCoinCounter.js";
import { IN0_MIRROR, FREE_PLAY } from "../names.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x48e7;
const HISTORY = 0xa983;
const INPUT_BIT = 2;

/** Scratch the dissolved tail leaves and the routine never really owns; a ceiling, not a prediction. */
const EXCLUDED = ["a", "f", "h", "l", "sp"];
/** Every real write lands at or below here; the stack seats far above it, so the mask is safe. */
const DATA_TOP = 0xadff;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${d.addr == null ? "reg " + d.k : hex4(d.addr)}: oracle=${d.a} rewrite=${d.b}` : "identical");

let baseEntry = null;
/** The pristine machine at this address's FIRST dispatch under the shared tape (the quiet branch). */
function base() {
  if (baseEntry) return baseEntry;
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (baseEntry === null) baseEntry = mm.clone();
    return oracle(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  assert.notEqual(baseEntry, null, "vacuous: the tape never reached this address");
  return baseEntry;
}

/** A crafted entry: force the input bit, the history byte and (optionally) the free-play flag. */
function craft(bit, history, freePlay) {
  const e = base().clone();
  e.mem8[IN0_MIRROR] = (e.mem8[IN0_MIRROR] & ~(1 << INPUT_BIT)) | ((bit & 1) << INPUT_BIT);
  e.mem8[HISTORY] = history & 0xff;
  if (freePlay !== undefined) e.mem8[FREE_PLAY] = freePlay;
  return e;
}
const fires = (bit, history) => ((((history & 0xff) << 1) | (bit & 1)) & 0x07) === 0x01;

/** Oracle vs candidate on independent clones: RAM outside the watched stack window, then the
 * registers outside the ceiling, then the return value. The floor is watched off the oracle's
 * own pushes so the mask can never widen past what the frozen side actually wrote. */
function unitDiff(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let floor = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < floor) floor = a.regs.sp; };
  const ra = oracle(a);
  const rb = cand(b);
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr !== null && addr >= floor && addr < seat) continue;
    return { addr, a: da[i], b: db[i] };
  }
  for (const k of REG_FIELDS) {
    if (EXCLUDED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) return { addr: null, k, a: a.regs[k], b: b.regs[k] };
  }
  if (ra !== rb) return { addr: null, k: "return", a: ra, b: rb };
  return null;
}

/** Bytes the oracle moves OUTSIDE its stack window AND outside the history cell, plus the floor.
 * The history byte is rewritten on EVERY call, firing or not, so excluding it makes `real` count
 * only the credit-and-sound work the edge is supposed to gate. */
function footprint(machine) {
  const a = machine.clone();
  const before = a.dumpState().slice();
  const seat = a.regs.sp;
  let floor = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < floor) floor = a.regs.sp; };
  oracle(a);
  const now = a.dumpState();
  let real = 0;
  for (let i = 0; i < now.length; i++) {
    if (now[i] === before[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr === HISTORY) continue;
    if (addr !== null && addr >= floor && addr < seat) continue;
    real++;
  }
  return { real, floor, seat };
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("REAL DISPATCH: the tape entry (quiet branch) is identical", { skip }, () => {
  const e = base();
  assert.ok(!fires(e.mem8[IN0_MIRROR] >> INPUT_BIT, e.mem8[HISTORY]),
    "the tape entry unexpectedly fires; the quiet-branch account above is stale");
  assert.equal(unitDiff(awardOneCreditOnDebouncedInputEdge, e), null, "the tape dispatch diverged");
  console.log(`  REAL DISPATCH: entry sp=${hex4(e.regs.sp)} input=${e.mem8[IN0_MIRROR]} identical`);
});

test("CRAFTED EDGE: firing branch identical, and it actually moves memory", { skip }, () => {
  for (const [label, fp] of [["paid", 0x00], ["free-play", 0x01]]) {
    const e = craft(1, 0x00, fp); // bit set, history clear -> low three bits become 001
    assert.ok(fires(1, 0x00), "the crafted edge does not fire; the craft is wrong");
    assert.equal(unitDiff(awardOneCreditOnDebouncedInputEdge, e), null, `${label}: firing branch diverged`);
    const fp2 = footprint(e);
    assert.ok(fp2.real > 0, `${label}: the oracle moved nothing outside the stack — vacuous`);
    assert.ok(fp2.floor > DATA_TOP, `${label}: the stack window ${hex4(fp2.floor)} reached into data`);
    console.log(`  CRAFTED EDGE/${label}: ${fp2.real} real bytes moved, floor ${hex4(fp2.floor)}`);
  }
});

test("EXHAUSTIVE: every history byte, both bit states, both free-play states", { skip }, () => {
  let fired = 0, quiet = 0;
  for (let h = 0; h < 256; h++) {
    for (const bit of [0, 1]) {
      for (const fp of [0x00, 0x01]) {
        const d = unitDiff(awardOneCreditOnDebouncedInputEdge, craft(bit, h, fp));
        assert.equal(d, null, `bit=${bit} history=${hex4(h)} free-play=${fp}: ${show(d)}`);
      }
      (fires(bit, h) ? fired++ : quiet++);
    }
  }
  assert.ok(fired > 0 && quiet > 0, "the sweep did not exercise both the firing and quiet branches");
  console.log(`  EXHAUSTIVE: 1024 crafted states identical; ${fired} fire, ${quiet} do not`);
});

test("SP AND SCRATCH: the drift is two bytes and the floor sits above the data", { skip }, () => {
  const a = craft(1, 0x00, 0x00).clone();
  const b = a.clone();
  oracle(a);
  awardOneCreditOnDebouncedInputEdge(b);
  assert.equal((a.regs.sp - b.regs.sp) & 0xffff, 2, "the oracle no longer re-seats two bytes higher");
  console.log(`  SP AND SCRATCH: spDiff 2, oracle sp=${hex4(a.regs.sp)} rewrite sp=${hex4(b.regs.sp)}`);
});

test("THE EDGE, off the frozen side: the oracle credits exactly when low three bits read 001", { skip }, () => {
  for (let h = 0; h < 256; h++) {
    for (const bit of [0, 1]) {
      const e = craft(bit, h, 0x00);
      assert.equal(footprint(e).real > 0, fires(bit, h),
        `bit=${bit} history=${hex4(h)}: the oracle's credit and the edge predicate disagree`);
    }
  }
  console.log("  THE EDGE: the oracle's firing tracks the 001 predicate across all 512 states");
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

/** BUG: does nothing, so the edge never credits. */
function brokenNoOp() {}

/** BUG: never records the shifted history, so a nonzero history is left stale. */
function brokenNoHistoryWrite(m) {
  const bit = (m.mem8[IN0_MIRROR] >> INPUT_BIT) & 1;
  if (((((m.mem8[HISTORY]) << 1) | bit) & 0x07) !== 0x01) return;
  requestCoinSound(m);
  m.regs.c = 0x01;
  return awardCoinCreditThenPulseCoinCounter(m);
}

/** BUG: fires on the complementary pattern (low three bits 000 rather than 001). */
function brokenWrongThreshold(m) {
  const bit = (m.mem8[IN0_MIRROR] >> INPUT_BIT) & 1;
  const h = ((m.mem8[HISTORY] << 1) | bit) & 0xff;
  m.mem8[HISTORY] = h;
  if ((h & 0x07) !== 0x00) return;
  requestCoinSound(m);
  m.regs.c = 0x01;
  return awardCoinCreditThenPulseCoinCounter(m);
}

/** BUG: awards two credits' worth instead of one. */
function brokenWrongCredit(m) {
  const bit = (m.mem8[IN0_MIRROR] >> INPUT_BIT) & 1;
  const h = ((m.mem8[HISTORY] << 1) | bit) & 0xff;
  m.mem8[HISTORY] = h;
  if ((h & 0x07) !== 0x01) return;
  requestCoinSound(m);
  m.regs.c = 0x02;
  return awardCoinCreditThenPulseCoinCounter(m);
}

/** BUG: debounces the wrong input bit (bit 0, coin 1's line). */
function brokenWrongBit(m) {
  const bit = (m.mem8[IN0_MIRROR] >> 0) & 1;
  const h = ((m.mem8[HISTORY] << 1) | bit) & 0xff;
  m.mem8[HISTORY] = h;
  if ((h & 0x07) !== 0x01) return;
  requestCoinSound(m);
  m.regs.c = 0x01;
  return awardCoinCreditThenPulseCoinCounter(m);
}

/** BUG: scribbles a register outside the ceiling; the control that proves the register check bites. */
function brokenMovesSpareRegister(m) {
  const r = awardOneCreditOnDebouncedInputEdge(m);
  m.regs.d = (m.regs.d + 1) & 0xff;
  return r;
}

function sweepCaught(twin) {
  let caught = 0;
  for (let h = 0; h < 256; h++) {
    for (const bit of [0, 1]) {
      for (const fp of [0x00, 0x01]) if (unitDiff(twin, craft(bit, h, fp))) caught++;
    }
  }
  return caught;
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["no-history-write", brokenNoHistoryWrite],
  ["wrong-threshold", brokenWrongThreshold],
  ["wrong-credit", brokenWrongCredit],
  ["wrong-bit", brokenWrongBit],
  ["moves-spare-register", brokenMovesSpareRegister],
];

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const caught = sweepCaught(twin);
    assert.ok(caught > 0, `every crafted state PASSED the ${label} twin — it has no teeth`);
    console.log(`  TEETH/${label}: caught on ${caught}/1024 crafted states`);
  });
}
