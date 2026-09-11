// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_aa79 (ROM 0xaa79-0xaa8f) -- jsr $ab17, branch on ($03 & $1f) vs $10,
// optional second jsr $ab17, tail-jmp $a8b4. Run: node --test games/tempest/translated/test/equivalence-aa79.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_aa79 } from "../loc_aa79.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; (this.retAddrs ||= []).push(this.pull16()); } return undefined; },
  };
}

// bcs taken: ($03 & $1f) >= $10 -> single jsr $ab17, straight to tail-jmp $a8b4
test("loc_aa79: ($03 & $1f) >= $10 -> bcs taken, one jsr $ab17", () => {
  const m = makeMachine(); m.regs.s = 0xfd;
  m.ram[0x03] = 0x10;               // & $1f = 0x10 >= 0x10 -> carry set -> bcs taken
  loc_aa79(m);
  assert.deepEqual(m.calls, [0xab17, 0xa8b4], "first jsr then tail-jmp only");
  assert.deepEqual(m.retAddrs, [0xaa7f], "only the first jsr pushed (0xaa7d+2)");
  assert.equal(m.regs.a, 0x10, "A = $03 & $1f");
  assert.equal(m.regs.x, 0x32, "X still $32 (second ldx skipped)");
  assert.equal(m.regs.fC, true, "cmp #$10 set carry (A >= $10)");
  assert.equal(m.pc, 0xa8b4, "tail jmp lands on $a8b4");
  assert.equal(m.cycles, 23, "2+2+6+3+2+2 + bcs 3 + jmp 3");
});

// bcs not taken: ($03 & $1f) < $10 -> second jsr $ab17 with A=$e0/X=$22, then tail-jmp $a8b4
test("loc_aa79: ($03 & $1f) < $10 -> bcs not taken, two jsr $ab17", () => {
  const m = makeMachine(); m.regs.s = 0xfd;
  m.ram[0x03] = 0x00;               // & $1f = 0 < 0x10 -> carry clear -> bcs not taken
  loc_aa79(m);
  assert.deepEqual(m.calls, [0xab17, 0xab17, 0xa8b4], "two jsr then tail-jmp");
  assert.deepEqual(m.retAddrs, [0xaa7f, 0xaa8e], "both jsr push (0xaa7d+2, 0xaa8c+2)");
  assert.equal(m.regs.a, 0xe0, "A = $e0 from second load");
  assert.equal(m.regs.x, 0x22, "X = $22 from second load");
  assert.equal(m.regs.fC, false, "cmp #$10 cleared carry (A < $10)");
  assert.equal(m.pc, 0xa8b4, "tail jmp lands on $a8b4");
  assert.equal(m.cycles, 32, "2+2+6+3+2+2 + bcs 2 + 2+2+6 + jmp 3");
});

// masking teeth: only low 5 bits gate the branch ($03 = $f0 -> & $1f = 0 -> not taken)
test("loc_aa79: high bits of $03 are masked off before the compare", () => {
  const m = makeMachine(); m.regs.s = 0xfd;
  m.ram[0x03] = 0xf0;               // & $1f = 0x10 -> carry set -> bcs taken
  loc_aa79(m);
  assert.deepEqual(m.calls, [0xab17, 0xa8b4]);
  assert.equal(m.regs.a, 0x10, "0xf0 & $1f = 0x10");
  assert.equal(m.cycles, 23);
});
