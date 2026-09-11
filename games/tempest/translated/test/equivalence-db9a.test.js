// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_db9a (ROM 0xdb9a-0xdbd4). Minimal 6502 harness (Regs + flat RAM + the page-1
// stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration check.
// JSR $df39 / $df6c and the tail JMP $df39 are opaque here (harness records the call, does not run it), so
// each table read comes from RAM cells seeded in place of ROM. Run: node --test games/tempest/translated/test/equivalence-db9a.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_db9a } from "../loc_db9a.js";

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

test("loc_db9a: $03&0x3f!=0 skips inc $39; index x=2 writes slots; tail-jumps loc_df39; 78 T", () => {
  const m = makeMachine();
  m.regs.s = 0xff;
  m.ram[0x03] = 0x41; // 0x41 & 0x3f = 0x01 -> BNE taken, inc skipped
  m.ram[0x39] = 0x02; // 0x02 & 0x07 = 0x02 -> x = 2
  m.ram[0xdbd7] = 0x10; // $dbd5,2 -> y = 0x10
  m.ram[0xdbd8] = 0x20; // $dbd6,2 -> y = 0x20
  m.ram[0xdfde] = 0x55; // $dfdc,2 -> a = 0x55
  m.ram[0x60d1] = 0xff; // pre-set so the 0x00 write is observable

  loc_db9a(m);

  assert.equal(m.ram[0x39], 0x02, "$39 unchanged (inc skipped)");
  assert.equal(m.ram[0x60d1], 0x00, "sta #$00 -> $60c1+0x10");
  assert.equal(m.ram[0x60e0], 0x55, "$dfdc,x -> $60c0+0x20");
  assert.equal(m.ram[0x60e1], 0xa8, "#$a8 -> $60c1+0x20");
  assert.equal(m.regs.a, 0x34, "final lda #$34");
  assert.equal(m.regs.x, 0xaa, "final ldx #$aa");
  assert.equal(m.regs.y, 0x41, "$03 & 0x7f = 0x41 -> tay");
  assert.equal(m.pc, 0xdf39, "tail JMP $df39");
  assert.deepEqual(m.calls, [0xdf39, 0xdf6c, 0xdf39], "JSR $df39, JSR $df6c, then tail JMP $df39");
  assert.equal(m.regs.s, 0xff, "stack balanced after both JSRs");
  assert.equal(m.cycles, 3 + 2 + 3 + 3 + 2 + 2 + 4 + 2 + 5 + 4 + 4 + 5 + 2 + 5 + 2 + 2 + 6 + 3 + 2 + 2 + 2 + 6 + 2 + 2 + 3, "78 T");
});

test("loc_db9a: $03&0x3f==0 increments $39; wrapped index x=0; 82 T", () => {
  const m = makeMachine();
  m.regs.s = 0xff;
  m.ram[0x03] = 0x40; // 0x40 & 0x3f = 0x00 -> BNE not taken -> inc $39
  m.ram[0x39] = 0x07; // inc -> 0x08; 0x08 & 0x07 = 0x00 -> x = 0
  m.ram[0xdbd5] = 0x01; // $dbd5,0 -> y = 0x01
  m.ram[0xdbd6] = 0x03; // $dbd6,0 -> y = 0x03
  m.ram[0xdfdc] = 0x77; // $dfdc,0 -> a = 0x77

  loc_db9a(m);

  assert.equal(m.ram[0x39], 0x08, "$39 incremented");
  assert.equal(m.ram[0x60c2], 0x00, "sta #$00 -> $60c1+0x01");
  assert.equal(m.ram[0x60c3], 0x77, "$dfdc,0 -> $60c0+0x03");
  assert.equal(m.ram[0x60c4], 0xa8, "#$a8 -> $60c1+0x03");
  assert.equal(m.regs.y, 0x40, "$03 & 0x7f = 0x40 -> tay");
  assert.equal(m.pc, 0xdf39, "tail JMP $df39");
  assert.deepEqual(m.calls, [0xdf39, 0xdf6c, 0xdf39], "same call chain");
  assert.equal(m.cycles, 78 + 4, "82 T: not-taken BNE (2) + inc (5) replaces taken BNE (3)");
});

test("loc_db9a MUTATION: JSR $df39 mischarged 7T not 6T blows the golden total", () => {
  const m = makeMachine();
  m.regs.s = 0xff;
  m.ram[0x03] = 0x41;
  m.ram[0x39] = 0x02;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0xdbc4 ? 7 : c); // the first JSR's step lands at 0xdbc4
  loc_db9a(m);
  assert.notEqual(m.cycles, 78, "a mischarged JSR cycle blows the golden T-state total");
});
