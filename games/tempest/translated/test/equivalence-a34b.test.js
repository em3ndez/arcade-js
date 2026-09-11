// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a34b (ROM 0xa34b-0xa36e). Minimal 6502 harness. Run:
// node --test games/tempest/translated/test/equivalence-a34b.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a34b, loc_a34d } from "../loc_a34b.js";

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

test("loc_a34b: init sequence, copies $0202->$29 and $0200->$2d, calls ccb0 then a3d6, 55 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1500);
  m.ram[0x0202] = 0x33;
  m.ram[0x0200] = 0x44;
  loc_a34b(m);
  assert.equal(m.ram[0x013b], 0xff, "$013b = 0xff");
  assert.equal(m.ram[0x2c], 0x01, "$2c = 1");
  assert.equal(m.ram[0x29], 0x33, "$0202 -> $29");
  assert.equal(m.ram[0x2d], 0x44, "$0200 -> $2d");
  assert.equal(m.ram[0x0201], 0x81, "$0201 = 0x81");
  assert.equal(m.ram[0x013c], 0x01, "$013c = 1");
  assert.deepEqual(m.calls, [0xccb0, 0xa3d6], "jsr ccb0 then a3d6");
  assert.equal(m.pc, 0x1501, "rts -> pushed + 1");
  assert.equal(m.cycles, 55, "linear T-state total");
});

test("loc_a34d mid-entry: seeds $013b from the caller's A (skips the a34b lda #ff head), 53 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1500);
  m.regs.a = 0x09;               // entered from loc_a343/loc_a347 with the tag already in A
  m.ram[0x0202] = 0x33;
  m.ram[0x0200] = 0x44;
  loc_a34d(m);
  assert.equal(m.ram[0x013b], 0x09, "$013b <- caller's A");
  assert.equal(m.ram[0x2c], 0x01, "$2c = 1");
  assert.equal(m.ram[0x29], 0x33, "$0202 -> $29");
  assert.equal(m.ram[0x2d], 0x44, "$0200 -> $2d");
  assert.equal(m.ram[0x0201], 0x81, "$0201 = 0x81");
  assert.equal(m.ram[0x013c], 0x01, "$013c = 1");
  assert.deepEqual(m.calls, [0xccb0, 0xa3d6]);
  assert.equal(m.pc, 0x1501, "rts -> pushed + 1");
  assert.equal(m.cycles, 53, "loc_a34b total (55) minus the lda #ff head (2)");
});
