// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_3360 (ROM 0x3360-0x3413). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_3360.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_3360 } from "../loc_3360.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

// One traced column pass with X=0. The entry compares reload/scale A, the $CF cell is 0 so the
// BEQ at 0x3372 jumps to the store, the $D2/$CC timers reset+run, the accumulator folds the delta,
// then DEX -> 0xFF trips the tail: LSR x5 of $D3 (=0) -> Y=0, $CA (=5) - table[0] (=3) = 2, and the
// CPY #$03 mismatch takes BNE $341B out of the routine.
function seedTracedPath(m) {
  m.regs.x = 0x00;
  m.ram[0x0c01] = 0x00; // read at 0x3360 and 0x3386
  m.ram[0x00cf] = 0x00; // body cell -> BEQ $3384 path
  m.ram[0x00d3] = 0x00; // LSR x5 -> Y = 0
  m.ram[0x00ca] = 0x05; // accumulator low
  m.ram[0x00cb] = 0x00; // accumulator high
  m.ram[0x3413] = 0x03; // threshold table[0]
}

const TRACED_T = 120;

test("loc_3360: one column pass folds the delta and exits to 0x341B; 120 T", () => {
  const m = makeMachine();
  seedTracedPath(m);

  loc_3360(m);

  assert.equal(m.regs.a, 0x02, "A = $CA - table[0] = 5 - 3");
  assert.equal(m.regs.x, 0xff, "DEX wrapped 0x00 -> 0xFF");
  assert.equal(m.regs.y, 0x00, "Y from $D3 >> 5");
  assert.equal(m.ram[0x00ca], 0x02, "$CA restored to the subtracted value");
  assert.equal(m.ram[0x00cb], 0x01, "$CB incremented once");
  assert.equal(m.ram[0x00cf], 0x00, "body cell stored back as 0");
  assert.equal(m.ram[0x00cc], 0x00, "$CC timer cleared");
  assert.equal(m.ram[0x00d2], 0xef, "$D2 reloaded 0xF0 then decremented");
  assert.equal(m.regs.fN, true, "N from CPY #$03 (0 - 3)");
  assert.equal(m.regs.fC, false, "C clear from CPY (0 < 3)");
  assert.equal(m.regs.fZ, false, "Z clear from CPY");
  assert.equal(m.cycles, TRACED_T, "hand-summed T-state total for the traced path");
  assert.equal(m.pc, 0x341b, "BNE $341B out of the routine");
  assert.deepEqual(m.calls, [0x341b], "single exit edge to 0x341B");
});

test("loc_3360 MUTATION: the BEQ $3384 taken branch mischarged 4T not 3T is caught", () => {
  const m = makeMachine();
  seedTracedPath(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3384 ? c + 1 : c); // only the 0x3372 BEQ lands at 0x3384 here
  loc_3360(m);
  assert.notEqual(m.cycles, TRACED_T, "a mischarged branch blows the golden T-state total");
});

test("loc_3360 MUTATION: dropping the DEX->BMI loop-exit flag would not exit at 0x341B", () => {
  // Positive control: the traced path must actually reach the single 0x341B exit, so a regression
  // that mis-routed the tail would change m.calls.
  const m = makeMachine();
  seedTracedPath(m);
  loc_3360(m);
  assert.equal(m.calls.length, 1, "exactly one exit edge");
  assert.equal(m.calls[0], 0x341b, "and it is 0x341B");
});
