// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b0d1 (ROM 0xb0d1). Minimal 6502 harness; JMP $df4c is opaque (recorded).
// Run: node --test games/tempest/translated/test/equivalence-b0d1.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b0d1 } from "../loc_b0d1.js";

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

test("loc_b0d1: Y == $9e -> beq -> rts, no write; 12 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // rts -> 0x1234
  m.regs.y = 0x05;
  m.ram[0x9e] = 0x05;
  loc_b0d1(m);
  assert.equal(m.ram[0x9e], 0x05, "$9e unchanged when equal");
  assert.equal(m.pc, 0x1234, "rts returns to pushed+1");
  assert.deepEqual(m.calls, [], "no tail-call");
  assert.equal(m.cycles, 3 + 3 + 6, "12 T (cpy + beq-taken + rts)");
});

test("loc_b0d1: Y != $9e -> store Y, lda #$08, tail-jmp 0xdf4c; 13 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.y = 0x11;
  m.ram[0x9e] = 0x22;
  loc_b0d1(m);
  assert.equal(m.ram[0x9e], 0x11, "$9e := Y");
  assert.equal(m.regs.a, 0x08, "A = #$08");
  assert.equal(m.pc, 0xdf4c, "tail-jmp to 0xdf4c");
  assert.deepEqual(m.calls, [0xdf4c], "tail-call 0xdf4c");
  assert.equal(m.cycles, 3 + 2 + 3 + 2 + 3, "13 T");
});
