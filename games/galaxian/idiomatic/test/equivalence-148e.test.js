// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_148e — memory-equivalent to the frozen oracle at ROM 0x148e. One step of the secondary-object spawn
 * walk: spawn into the current slot (all RAM: the activation + a queued command word, in the state dump),
 * advance the slot pointer by one record, and count the budget down. Live-outs beyond RAM are the three
 * registers the caller's loop reads back — the advanced slot pointer IY, the decremented budget C, and (only
 * when the budget hits zero) the loop counter B forced to 1 to end the caller's djnz. So EQUAL asserts
 * ramDiff==null AND {IY,C,B} on both paths:
 *   - BUDGET REMAINS: budget > 1 -> IY += 0x20, C -= 1, B untouched.
 *   - BUDGET SPENT:   budget == 1 -> IY += 0x20, C = 0, B = 1.
 * Teeth: a no-op twin, a scribble twin (RAM), a stalled-pointer twin, and a wrong-B twin (registers).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_148e as cand } from "../loc_148e.js";
import { loc_148e as oracle } from "../../translated/loc_148e.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const SLOT = 0x42f0;   // IY: current secondary slot
const SRC = 0x42d0;    // IX: source record (field 6 inherited)
const TRIG = 0x4176;   // HL: trigger flag cell (low byte is the index)
const INDEX = 0x76;
const INHERIT_VAL = 0x2a;
const QHEAD = 0x40a0;
const Q = 0x40c0;
const ENTRY_B = 3;

// Idle slot (both live flags clear), trigger set, source armed, queue free; C=budget, B distinctive.
const activate = (budget) => craft((mem, mm) => {
  mm.regs.iy = SLOT; mm.regs.ix = SRC; mm.regs.hl = TRIG;
  mm.regs.c = budget; mm.regs.b = ENTRY_B;
  mem[SLOT + 0] = 0; mem[SLOT + 1] = 0;
  mem[TRIG] = 1;
  mem[SRC + 6] = INHERIT_VAL;
  mem[QHEAD] = 0xc0;
  for (let i = 0xc0; i <= 0xff; i++) mem[0x4000 + i] = 0xff;
  mm.push16(0x9999);
});
// Slot already live: spawn bails (no RAM), but the pointer/budget still advance.
const bail = (budget) => craft((mem, mm) => {
  mm.regs.iy = SLOT; mm.regs.ix = SRC; mm.regs.hl = TRIG;
  mm.regs.c = budget; mm.regs.b = ENTRY_B;
  mem[SLOT + 0] = 1; mem[SLOT + 1] = 0;
  mem[TRIG] = 1;
  mm.push16(0x9999);
});

// The caller-read live-out registers (ramDiff is blind to registers): the advanced slot pointer IY, the
// decremented budget C, the loop counter B, and the trigger pointer HL the caller steps with `dec l`.
function regDiff(twin, e) {
  const a = e.clone(); a.routines = STUBS; oracle(a);
  const b = e.clone(); b.routines = STUBS; twin(b);
  for (const r of ["iy", "c", "b", "hl"]) {
    if (a.regs[r] !== b.regs[r]) {
      return `${r}: 0x${a.regs[r].toString(16)} vs 0x${b.regs[r].toString(16)}`;
    }
  }
  return null;
}

test("EQUAL (crafted): loc_148e == oracle on RAM and {IY,C,B}", { skip }, () => {
  for (const [name, e] of [
    ["remains/activate", () => activate(2)],
    ["spent/activate", () => activate(1)],
    ["remains/bail", () => bail(2)],
    ["spent/bail", () => bail(1)],
  ]) {
    assert.equal(ramDiff(oracle, cand, e()), null, `${name} diverged on RAM`);
    assert.equal(regDiff(cand, e()), null, `${name} diverged on a live-out register`);
  }
  // Non-vacuous: budget-remains advances the pointer and budget, leaves B, and activates the slot + queue.
  const a = activate(2); a.routines = STUBS; oracle(a);
  assert.equal(a.regs.iy, SLOT + 0x20, "positive control: slot pointer not advanced");
  assert.equal(a.regs.c, 1, "positive control: budget not decremented");
  assert.equal(a.regs.b, ENTRY_B, "positive control: loop counter clobbered while budget remained");
  assert.equal(a.mem8[SLOT + 0], 1, "positive control: slot not marked alive");
  assert.equal(a.mem8[SLOT + 7], INDEX, "positive control: trigger index not stashed");
  assert.equal(a.mem8[Q + 0], 0x01, "positive control: command word hi not queued");
  // Non-vacuous: budget-spent zeroes C and forces B=1 to end the caller's walk.
  const b = activate(1); b.routines = STUBS; oracle(b);
  assert.equal(b.regs.c, 0, "positive control: budget not spent to zero");
  assert.equal(b.regs.b, 1, "positive control: loop counter not forced to 1 on the last slot");
  console.log("  EQUAL: loc_148e == oracle — slot spawned, pointer/budget stepped, B ends the walk");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const scribble = (m) => { cand(m); m.mem8[SLOT + 3] = m.mem8[SLOT + 3] ^ 0xff; };
  const stalled = (m, slot = m.regs.iy) => { m.regs.c = (m.regs.c - 1) & 0xff; }; // budget dec, pointer stuck
  const wrongB = (m) => { cand(m); m.regs.b = 1; };                                // forces B even when budget remains
  assert.ok(ramDiff(oracle, noOp, activate(2)), "the no-op twin escaped (RAM)");
  assert.ok(ramDiff(oracle, scribble, activate(2)), "the scribble twin escaped (RAM)");
  assert.ok(regDiff(stalled, activate(2)), "the stalled-pointer twin escaped (register)");
  assert.ok(regDiff(wrongB, activate(2)), "the wrong-B twin escaped (register)");
  console.log("  TEETH: no-op, scribble (RAM), stalled-pointer, wrong-B (register) all caught");
});
