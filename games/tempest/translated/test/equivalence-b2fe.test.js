// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b2fe (ROM 0xb2fe). Preserves A across jsr 0xdf09, sets ptr $3b/$3c from
// $ce8c[2A], toggles bit0 of $0415,x, then writes a word from $ceb0[2A] (new bit set) or $ce9e[2A]
// (clear) via ($3b). Minimal 6502 harness. Run: node --test games/tempest/translated/test/equivalence-b2fe.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b2fe } from "../loc_b2fe.js";

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

test("loc_b2fe: bit0 of $0415,x toggles 1->0 -> uses $ce9e table; 83 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // rts -> 0x2001
  m.regs.a = 0x01; // index 1 -> x=1, y=2
  m.ram[0xce8e] = 0x00; m.ram[0xce8f] = 0x05; // $ce8c,2 word -> ptr $0500 into $3b/$3c
  m.ram[0x0416] = 0x01; // $0415,1 = 1; eor #1 -> 0 -> bne fall (uses $ce9e)
  m.ram[0xcea0] = 0x77; // $ce9e,2 -> A -> first store
  m.ram[0xcea1] = 0x88; // $ce9f,2 -> X -> second store
  loc_b2fe(m);
  assert.equal(m.ram[0x3b], 0x00, "$3b low of ptr");
  assert.equal(m.ram[0x3c], 0x05, "$3c high of ptr");
  assert.equal(m.ram[0x0416], 0x00, "$0415,x toggled to 0");
  assert.equal(m.ram[0x0500], 0x77, "($3b),0 := A from $ce9e,y");
  assert.equal(m.ram[0x0501], 0x88, "($3b),1 := X from $ce9f,y");
  assert.equal(m.pc, 0x2001, "rts to pushed+1");
  assert.deepEqual(m.calls, [0xdf09], "jsr 0xdf09 recorded");
  assert.equal(m.cycles, 3 + 6 + 4 + 2 + 2 + 2 + 4 + 3 + 4 + 3 + 4 + 2 + 5 + 2 + 4 + 4 + 2 + 3 + 2 + 6 + 2 + 2 + 6 + 6, "83 T");
});

test("loc_b2fe: bit0 of $0415,x toggles 0->1 -> uses $ceb0 table; 79 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.a = 0x01;
  m.ram[0xce8e] = 0x10; m.ram[0xce8f] = 0x06; // ptr $0610
  m.ram[0x0416] = 0x00; // eor #1 -> 1 -> bne taken (uses $ceb0)
  m.ram[0xceb2] = 0x99; // $ceb0,2 -> A
  m.ram[0xceb3] = 0xaa; // $ceb1,2 -> X
  loc_b2fe(m);
  assert.equal(m.ram[0x0416], 0x01, "$0415,x toggled to 1");
  assert.equal(m.ram[0x0610], 0x99, "($3b),0 := A from $ceb0,y");
  assert.equal(m.ram[0x0611], 0xaa, "($3b),1 := X from $ceb1,y");
  assert.equal(m.cycles, 3 + 6 + 4 + 2 + 2 + 2 + 4 + 3 + 4 + 3 + 4 + 2 + 5 + 3 + 4 + 4 + 2 + 6 + 2 + 2 + 6 + 6, "79 T");
});
