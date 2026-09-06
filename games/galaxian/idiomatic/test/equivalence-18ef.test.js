// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_18ef — memory-equivalent to the frozen oracle at ROM 0x18ef. Per-frame coin/input service. Every
 * effect is RAM (in the state dump), and the caller reloads its own pointer immediately after, so there is
 * no register live-out: EQUAL is ramDiff==null on all arms.
 *   - MODE 3:  preset the credit count (delegate presetCreditCount).
 *   - COIN:    the folded/masked inputs have bit 7 set -> add a credit (delegate addCreditForCoin).
 *   - COUNTER: else the low two bits each tick the debounce counter once (0/1/2 bumps).
 * The fold is combined = ~(INA | INB) & GUARD1 & GUARD2, so setting INA=INB=0 and both guards to V makes
 * combined == V. Teeth: a no-op, a once-instead-of-twice twin, and a preset-skipping twin.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { serviceCoinInputs as cand } from "../serviceCoinInputs.js";
import { loc_18ef as oracle } from "../../translated/loc_18ef.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const MODE = 0x4000, INA = 0x4010, INB = 0x4013, GUARD1 = 0x4015, GUARD2 = 0x4016;
const PHASE = 0x4001, CREDIT = 0x4002, COUNTER = 0x4004, EVENT = 0x41c9;
const QHEAD = 0x40a0, Q = 0x40c0;

// Non-mode-3 entry with combined == V (INA=INB=0 -> complement is 0xff; both guards = V).
const fold = (V, extra) => craft((mem, mm) => {
  mem[MODE] = 0;
  mem[INA] = 0; mem[INB] = 0;
  mem[GUARD1] = V; mem[GUARD2] = V;
  mem[COUNTER] = 0;
  if (extra) extra(mem, mm);
  mm.push16(0x9999);
});
// Mode 3 -> the preset branch.
const preset = () => craft((mem, mm) => {
  mem[MODE] = 3;
  mem[PHASE] = 0x55; mem[CREDIT] = 0x33;
  mm.push16(0x9999);
});
// Coin accepted (bit 7 set): credit below the cap, a free queue slot for the event word.
const coin = () => fold(0x80, (mem) => {
  mem[CREDIT] = 5; mem[EVENT] = 0;
  mem[QHEAD] = 0xc0;
  for (let i = 0xc0; i <= 0xff; i++) mem[0x4000 + i] = 0xff;
});

test("EQUAL (crafted): loc_18ef == oracle on every arm", { skip }, () => {
  for (const [name, e] of [
    ["preset", preset],
    ["coin", coin],
    ["low=1", () => fold(0x01)],
    ["low=2", () => fold(0x02)],
    ["low=3", () => fold(0x03)],
    ["low=0", () => fold(0x04)],
  ]) {
    assert.equal(ramDiff(oracle, cand, e()), null, `${name} path diverged on RAM`);
  }
  // Non-vacuous positive controls.
  const p = preset(); p.routines = STUBS; oracle(p);
  assert.equal(p.mem8[PHASE], 0, "positive control: preset did not clear the phase flag");
  assert.equal(p.mem8[CREDIT], 9, "positive control: preset did not set the credit count to 9");
  const c = coin(); c.routines = STUBS; oracle(c);
  assert.equal(c.mem8[CREDIT], 6, "positive control: coin did not bump the credit count");
  assert.equal(c.mem8[EVENT], 1, "positive control: coin did not raise the event flag");
  assert.equal(c.mem8[Q + 0], 7, "positive control: coin did not queue the event word");
  const t = fold(0x03); t.routines = STUBS; oracle(t);
  assert.equal(t.mem8[COUNTER], 2, "positive control: both low bits did not bump the counter twice");
  const s = fold(0x02); s.routines = STUBS; oracle(s);
  assert.equal(s.mem8[COUNTER], 1, "positive control: a single low bit did not bump the counter once");
  const z = fold(0x04); z.routines = STUBS; oracle(z);
  assert.equal(z.mem8[COUNTER], 0, "positive control: no low bit still bumped the counter");
  console.log("  EQUAL: loc_18ef == oracle — preset, coin credit, and 0/1/2 debounce bumps");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const onceOnly = (m) => { m.mem8[COUNTER]++; };                 // one bump where low=3 wants two
  const skipPreset = (m) => { m.mem8[CREDIT] = 9; };             // preset sets credit but forgets the phase clear
  assert.ok(ramDiff(oracle, noOp, fold(0x03)), "the no-op twin escaped (RAM)");
  assert.ok(ramDiff(oracle, onceOnly, fold(0x03)), "the once-only twin escaped (RAM)");
  assert.ok(ramDiff(oracle, skipPreset, preset()), "the preset-skipping twin escaped (RAM)");
  console.log("  TEETH: no-op, once-only, preset-skipping all caught");
});
