// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a352 (ROM 0xa352-0xa36e) -- alternate entry into loc_a34b's tail. Run:
// node --test games/tempest/translated/test/equivalence-a352.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a352 } from "../loc_a34b.js";

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

test("loc_a352: stores caller A into $2c, copies $0202->$29 and $0200->$2d, calls ccb0 then a3d6, 47 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1500);
  m.regs.a = 0x07;         // caller-supplied $2c value
  m.ram[0x0202] = 0x33;
  m.ram[0x0200] = 0x44;
  loc_a352(m);
  assert.equal(m.ram[0x2c], 0x07, "$2c = caller A");
  assert.equal(m.ram[0x29], 0x33, "$0202 -> $29");
  assert.equal(m.ram[0x2d], 0x44, "$0200 -> $2d");
  assert.equal(m.ram[0x0201], 0x81, "$0201 = 0x81");
  assert.equal(m.ram[0x013c], 0x01, "$013c = 1");
  assert.deepEqual(m.calls, [0xccb0, 0xa3d6], "jsr ccb0 then a3d6");
  assert.equal(m.pc, 0x1501, "rts -> pushed + 1");
  assert.equal(m.cycles, 47, "linear T-state total");
});

test("loc_a352: final lda #1 -> A=1 and Z clear (setNZ on the $013c write value)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x2000);
  m.regs.a = 0x00;         // A=0 in: $2c must still take 0 (sta sets no flags), then A rebuilt downstream
  m.ram[0x0202] = 0x00;    // edge: $0202=0 -> lda sets Z; overwritten before rts by lda #0x81 / lda #0x01
  m.ram[0x0200] = 0xaa;
  loc_a352(m);
  assert.equal(m.ram[0x2c], 0x00, "$2c = 0 (sta ignores flags)");
  assert.equal(m.ram[0x29], 0x00, "$0202(=0) -> $29");
  assert.equal(m.ram[0x2d], 0xaa, "$0200 -> $2d");
  assert.equal(m.regs.a, 0x01, "A = last loaded immediate (#0x01)");
  assert.equal(m.regs.fZ, false, "#0x01 clears Z");
  assert.equal(m.regs.fN, false, "#0x01 clears N");
  assert.equal(m.pc, 0x2001, "rts");
  assert.equal(m.cycles, 47, "cycle total is input-independent");
});
