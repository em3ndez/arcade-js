// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b2de (ROM 0xb2de). Like loc_b2be but into $3b/$3c with the tables swapped:
// $ce68 when $0415,x == 0, $ce7a when != 0. Minimal 6502 harness.
// Run: node --test games/tempest/translated/test/equivalence-b2de.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b2de } from "../loc_b2de.js";

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

test("loc_b2de: $0415,x == 0 -> $ce68 table into $3b/$3c; 42 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // rts -> 0x2001
  m.regs.a = 0x01; // x=1, y=2
  m.ram[0x0416] = 0x00; // == 0 -> bne fall -> $ce68
  m.ram[0xce6a] = 0x11; // $ce68,2 -> X
  m.ram[0xce6b] = 0x22; // $ce69,2 -> A
  loc_b2de(m);
  assert.equal(m.ram[0x3b], 0x11, "$3b := X from $ce68,y");
  assert.equal(m.ram[0x3c], 0x22, "$3c := A from $ce69,y");
  assert.equal(m.ram[0xa9], 0x00, "$a9 cleared");
  assert.equal(m.pc, 0x2001, "rts to pushed+1");
  assert.equal(m.cycles, 2 + 2 + 2 + 4 + 2 + 4 + 4 + 2 + 3 + 3 + 3 + 2 + 3 + 6, "42 T");
});

test("loc_b2de: $0415,x != 0 -> $ce7a table into $3b/$3c; 38 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.a = 0x01;
  m.ram[0x0416] = 0x01; // != 0 -> bne taken -> $ce7a
  m.ram[0xce7c] = 0x33; // $ce7a,2 -> X
  m.ram[0xce7d] = 0x44; // $ce7b,2 -> A
  loc_b2de(m);
  assert.equal(m.ram[0x3b], 0x33, "$3b := X from $ce7a,y");
  assert.equal(m.ram[0x3c], 0x44, "$3c := A from $ce7b,y");
  assert.equal(m.cycles, 2 + 2 + 2 + 4 + 3 + 4 + 4 + 3 + 3 + 2 + 3 + 6, "38 T");
});
