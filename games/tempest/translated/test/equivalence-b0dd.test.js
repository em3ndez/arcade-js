// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b0dd (ROM 0xb0dd). Minimal 6502 harness; JMP $df6a is opaque (recorded).
// Run: node --test games/tempest/translated/test/equivalence-b0dd.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b0dd } from "../loc_b0dd.js";

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

test("loc_b0dd: A == $72 -> beq -> rts, no write; 12 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x0fff); // rts -> 0x1000
  m.regs.a = 0x40;
  m.ram[0x72] = 0x40;
  loc_b0dd(m);
  assert.equal(m.ram[0x72], 0x40, "$72 unchanged when equal");
  assert.equal(m.pc, 0x1000, "rts returns to pushed+1");
  assert.deepEqual(m.calls, [], "no tail-call");
  assert.equal(m.cycles, 3 + 3 + 6, "12 T");
});

test("loc_b0dd: A != $72 -> store A, tail-jmp 0xdf6a; 11 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.a = 0x7f;
  m.ram[0x72] = 0x10;
  loc_b0dd(m);
  assert.equal(m.ram[0x72], 0x7f, "$72 := A");
  assert.equal(m.pc, 0xdf6a, "tail-jmp to 0xdf6a");
  assert.deepEqual(m.calls, [0xdf6a], "tail-call 0xdf6a");
  assert.equal(m.cycles, 3 + 2 + 3 + 3, "11 T");
});
