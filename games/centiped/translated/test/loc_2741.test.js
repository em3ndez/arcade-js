// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2741 (ROM 0x2741-0x2872). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2741.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2741 } from "../loc_2741.js";

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

// Short path: $c1 & $c2 has bit7 set -> BPL $2748 not taken -> RTS at 0x2747.
test("loc_2741: $c1&$c2 negative -> early RTS at 0x2747; 14 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000); // RTS -> 0x1001
  m.ram[0x00c1] = 0x80;
  m.ram[0x00c2] = 0x80;

  loc_2741(m);

  assert.equal(m.regs.a, 0x80, "A = $c1 & $c2 = 0x80");
  assert.equal(m.regs.fN, true, "N set (bit7)");
  assert.equal(m.regs.fZ, false, "Z clear");
  assert.equal(m.cycles, 3 + 3 + 2 + 6, "14 T");
  assert.equal(m.pc, 0x1001, "early RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "no callees on the gate path");
});

// Long path: 2741 -(BPL)-> 2748 -(BMI)-> 2764 -(BEQ)-> 277d -> 27b7 -(BNE,page-cross)-> 280a
// -(BEQ fall, BNE)-> 283e -(BNE)-> 286f -> RTS at 0x2871.
test("loc_2741: spawn/move spine to the 0x2871 RTS; 161 T; five writer calls", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1234); // RTS -> 0x1235
  m.ram[0x00c1] = 0x01;
  m.ram[0x00c2] = 0x80; // $c1&$c2 = 0x00 (BPL taken); $c2 bit7 set (BMI taken at 274a)
  m.ram[0x0089] = 0x01; // LSR -> 0 -> BEQ $277d taken
  m.ram[0x0088] = 0x00; // X for LDY $c0,X
  m.ram[0x00c0] = 0x05;
  m.ram[0x00f5] = 0x00; // $91 = 0x89 ^ 0x00
  m.ram[0x00f7] = 0x00; // $92 = 0x05 ^ 0x00
  m.ram[0x0c01] = 0x10; // >>3 -> 0x02
  m.ram[0x00ef] = 0x00; // LDX $ef -> 0 -> BEQ $27b7 taken (skip 27b6 LSR)
  m.ram[0x009a] = 0x00; // ROL target
  m.ram[0x0001] = 0x03; // LDA $01 nonzero -> BEQ $27cc not taken, BNE $283e taken
  m.ram[0x0000] = 0x05; // AND #$07 nonzero -> BNE $286f taken

  loc_2741(m);

  assert.equal(m.regs.a, 0x00, "final A = 0x00 (286f LDA #$00)");
  assert.equal(m.regs.fZ, true, "Z set by LDA #$00");
  assert.equal(m.regs.fN, false, "N clear");
  assert.equal(m.ram[0x0091], 0x89, "STA $91 = #$89 ^ $f5");
  assert.equal(m.ram[0x0092], 0x05, "STA $92 = #$05 ^ $f7");
  assert.equal(m.ram[0x008d], 0x05, "STY $8d = $c0,X");
  assert.equal(m.ram[0x008e], 0x0a, "STA $8e = $c0,X + $c0");
  assert.equal(m.ram[0x009a], 0x00, "ROL $9a with carry-in 0");
  assert.equal(m.cycles, 161, "161 T on the traced spine path");
  assert.equal(m.pc, 0x1235, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [0x37d5, 0x37d5, 0x3833, 0x3833, 0x3833], "the five writer JSRs on this path");
});

test("loc_2741 MUTATION: page-cross BNE $280a mischarged 3T not 4T is caught by the T total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1234);
  m.ram[0x00c1] = 0x01;
  m.ram[0x00c2] = 0x80;
  m.ram[0x0089] = 0x01;
  m.ram[0x0088] = 0x00;
  m.ram[0x00c0] = 0x05;
  m.ram[0x0c01] = 0x10;
  m.ram[0x00ef] = 0x00;
  m.ram[0x009a] = 0x00;
  m.ram[0x0001] = 0x03;
  m.ram[0x0000] = 0x05;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x280a ? 3 : c); // drop the +1 page-cross on the taken BNE
  loc_2741(m);
  assert.notEqual(m.cycles, 161, "a mischarged page-cross cycle blows the golden T total");
});
