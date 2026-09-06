// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1964 — memory-equivalent to the frozen oracle at ROM 0x1964. Two-phase coin toggle; every effect is
 * RAM (in the state dump) and the caller reloads its own pointer, so there is no register live-out: EQUAL is
 * ramDiff==null on both arms.
 *   - FIRST COIN:  phase flag's low bit clear -> raise the flag (delegate setCoinPhaseFlag).
 *   - PAIR DONE:   low bit set -> clear the flag and advance the credit counter (delegate incrementCreditCount).
 * Teeth: a no-op, a wrong-flag-value twin (first coin), and a twin that clears the flag but skips the credit.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_1964 as cand } from "../loc_1964.js";
import { loc_1964 as oracle } from "../../translated/loc_1964.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const PHASE = 0x4001, CREDIT = 0x4002, EVENT = 0x41c9, QHEAD = 0x40a0, Q = 0x40c0;

// Phase flag's low bit clear (first coin of a pair).
const first = (flag) => craft((mem, mm) => {
  mem[PHASE] = flag;
  mm.push16(0x9999);
});
// Phase flag's low bit set (completing coin): clear flag, advance the credit counter.
const pair = (flag, credit) => craft((mem, mm) => {
  mem[PHASE] = flag;
  mem[CREDIT] = credit; mem[EVENT] = 0;
  mem[QHEAD] = 0xc0;
  for (let i = 0xc0; i <= 0xff; i++) mem[0x4000 + i] = 0xff;
  mm.push16(0x9999);
});

test("EQUAL (crafted): loc_1964 == oracle on both arms", { skip }, () => {
  for (const [name, e] of [
    ["first/0", () => first(0)],
    ["first/2", () => first(2)],   // low bit clear, other bits set
    ["pair/1", () => pair(1, 5)],
    ["pair/3", () => pair(3, 5)],  // low bit set, other bits set
    ["pair/cap", () => pair(1, 99)],
  ]) {
    assert.equal(ramDiff(oracle, cand, e()), null, `${name} path diverged on RAM`);
  }
  // Non-vacuous positive controls.
  const f = first(0); f.routines = STUBS; oracle(f);
  assert.equal(f.mem8[PHASE], 1, "positive control: first coin did not raise the phase flag");
  const p = pair(1, 5); p.routines = STUBS; oracle(p);
  assert.equal(p.mem8[PHASE], 0, "positive control: completing coin did not clear the phase flag");
  assert.equal(p.mem8[CREDIT], 6, "positive control: completing coin did not advance the credit count");
  assert.equal(p.mem8[EVENT], 1, "positive control: completing coin did not raise the event flag");
  assert.equal(p.mem8[Q + 0], 7, "positive control: completing coin did not queue the event word");
  const cap = pair(1, 99); cap.routines = STUBS; oracle(cap);
  assert.equal(cap.mem8[CREDIT], 99, "positive control: credit count bumped past its cap");
  console.log("  EQUAL: loc_1964 == oracle — raise flag, or clear flag + advance credit");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongFlag = (m) => { m.mem8[PHASE] = 2; };                // first coin, wrong raised value
  const skipCredit = (m) => { m.mem8[PHASE] = 0; };              // clears flag but forgets the credit advance
  assert.ok(ramDiff(oracle, noOp, first(0)), "the no-op twin escaped (RAM)");
  assert.ok(ramDiff(oracle, wrongFlag, first(0)), "the wrong-flag twin escaped (RAM)");
  assert.ok(ramDiff(oracle, skipCredit, pair(1, 5)), "the skip-credit twin escaped (RAM)");
  console.log("  TEETH: no-op, wrong-flag, skip-credit all caught");
});
