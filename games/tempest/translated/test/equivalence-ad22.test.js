// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ad22 (ROM 0xad22-0xad6d). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam with a call recorder), author-derived; the whole-machine boot-first state diff vs
// MAME is the integration check. Run: node --test games/tempest/translated/test/equivalence-ad22.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ad22 } from "../loc_ad22.js";

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

test("loc_ad22: $0603==0 -> early exit, Y(0x14)->$00, 18 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2fff); // RTS -> 0x3000
  m.ram[0x0603] = 0x00;

  loc_ad22(m);

  assert.equal(m.ram[0x0000], 0x14, "$00 = Y = 0x14 (early sty)");
  assert.equal(m.pc, 0x3000, "RTS -> pushed + 1");
  assert.equal(m.cycles, 18, "2+4 (ldy,lda) + 3 (beq taken) + 3 (sty) + 6 (rts)");
  assert.deepEqual(m.calls, [], "no jsr on the early-exit path");
});

test("loc_ad22: valid slot builds $0602 = -(3*n)-0xe5, arms $0604/$0605/$4e/$50, jsr x2, 104 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2fff);
  m.ram[0x0603] = 0x05;   // and #3 -> 1; dec -> 0; lsr,lsr -> $0603 = 0x01
  m.ram[0x0600] = 0x03;   // slot[0]=3 (1..8 in range)

  loc_ad22(m);

  assert.equal(m.ram[0x003d], 0x00, "$3d = (5&3)-1 = 0");
  assert.equal(m.ram[0x0603], 0x01, "$0603 shifted right twice: 5 -> 1");
  assert.equal(m.ram[0x0602], 0x11, "3*2+3=9, eor ff = 0xf6, sec sbc 0xe5 = 0x11");
  assert.equal(m.ram[0x0605], 0x60, "$0605 = 0x60");
  assert.equal(m.ram[0x004e], 0x00, "$4e = 0");
  assert.equal(m.ram[0x0050], 0x00, "$50 = 0");
  assert.equal(m.ram[0x0604], 0x02, "$0604 = 2");
  assert.equal(m.ram[0x0000], 0x24, "$00 = Y = 0x24 (final sty)");
  assert.equal(m.regs.a, 0x02, "A last set by lda #0x02 at ad5d; ldy at ad63 sets Y not A");
  assert.equal(m.regs.y, 0x24, "Y = 0x24");
  assert.equal(m.regs.x, 0x00, "X = slot index 0");
  assert.deepEqual(m.calls, [0xca48, 0xa789], "jsr $ca48 then jsr $a789");
  assert.equal(m.pc, 0x3000, "RTS -> pushed + 1");
  assert.equal(m.cycles, 104, "full valid-slot path cycle total");
});

test("loc_ad22: zero slot loops back (jmp $ad22), next pass exits, 61 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2fff);
  m.ram[0x0603] = 0x01;   // iter1: and#3=1 -> $3d=0; lsr,lsr -> $0603=0; slot[0]=0 -> beq $ad68 -> jmp $ad22
  // ram[0x0600] stays 0 -> slot is zero
  loc_ad22(m);

  assert.equal(m.ram[0x0000], 0x14, "iter2 $0603==0 -> early exit Y=0x14");
  assert.equal(m.pc, 0x3000, "RTS -> pushed + 1");
  assert.deepEqual(m.calls, [], "loop-then-exit never reaches a jsr");
  assert.equal(m.cycles, 61, "iter1 loop-back 43 T + iter2 early exit 18 T");
});

test("loc_ad22 MUTATION: dec $3d mischarged (5->3) blows the golden T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2fff);
  m.ram[0x0603] = 0x05;
  m.ram[0x0600] = 0x03;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0xad2f ? 3 : c); // dec $3d steps to 0xad2f
  loc_ad22(m);
  assert.notEqual(m.cycles, 104, "a mischarged cycle blows the golden total");
});
