// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a18f (ROM 0xa18f-0xa1e3). Minimal 6502 harness; JSR $a1fa/$a1e4 opaque
// (recorded). The routine loops [0x37]=0x0b..0 over $02d3,x. Run: node --test games/tempest/translated/test/equivalence-a18f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a18f } from "../loc_a18f.js";

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

test("loc_a18f: all slots inactive -> 12 iterations of BEQ-skip; $37 ends 0xff, no jsr; 226 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1000);
  // all $02d3..$02de already 0 -> every iteration takes BEQ a1df
  loc_a18f(m);
  assert.equal(m.ram[0x37], 0xff, "$37 decremented past 0 to 0xff");
  assert.deepEqual(m.calls, [], "inactive slots never call a1fa/a1e4");
  assert.equal(m.pc, 0x1001, "rts -> pushed+1");
  assert.equal(m.cycles, 226, "5 prologue + 11*18 + 17 + 6 rts");
});

test("loc_a18f: active slot at X=5 (X<8 branch A) advances $02d3,x, jsr a1fa; 263 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x2000);
  m.ram[0x02d3 + 0x05] = 0x10; // active slot; $02d8
  m.ram[0x02f2 + 0x05] = 0x00; // ldy 0x02f2,x -> 0 -> BEQ a1a8 (skip the sbc #4)
  loc_a18f(m);
  // carry clear from cpx (5<8), so adc #9: 0x10+9 = 0x19; no sbc (Y==0); <0xf0 so not cleared
  assert.equal(m.ram[0x02d8], 0x19, "$02d3,x advanced by +9");
  assert.deepEqual(m.calls, [0xa1fa], "branch A calls a1fa exactly once");
  assert.equal(m.ram[0x37], 0xff, "loop ran to completion");
  assert.equal(m.pc, 0x2001, "rts -> pushed+1");
  assert.equal(m.cycles, 263, "5 + 10*18 + 55(branchA) + 17(last) + 6");
});

test("loc_a18f: active slot at X=0x0b (X>=8 branch B) adds velocity, in-bounds -> dec $a6 + jsr a1e4; 277 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x3000);
  m.ram[0x02d3 + 0x0b] = 0x10; // $02de active
  m.ram[0x02e6 + 0x0b] = 0x00; // $02f1
  m.ram[0x0120] = 0x05;        // velocity low
  m.ram[0x0118] = 0x00;        // velocity high
  m.ram[0x0202] = 0xff;        // boundary; sum 0x10 < 0xff -> bcs a1dc NOT taken
  m.ram[0xa6] = 0x03;
  loc_a18f(m);
  assert.equal(m.ram[0x02f1], 0x05, "$02e6,x += $0120");
  assert.equal(m.ram[0x02de], 0x00, "$02d3,x cleared (lda #0 after jsr a1e4)");
  assert.equal(m.ram[0xa6], 0x02, "$a6 decremented");
  assert.deepEqual(m.calls, [0xa1e4], "branch B calls a1e4 exactly once");
  assert.equal(m.pc, 0x3001, "rts -> pushed+1");
  assert.equal(m.cycles, 277, "5 + 69(branchB) + 10*18 + 17(last) + 6");
});
