// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_adce (ROM 0xadce-0xade9). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the
// integration check. Run: node --test games/tempest/translated/test/equivalence-adce.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_adce } from "../loc_adce.js";

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

test("loc_adce: positive $50 -> $51 += $50*8, A += carry(0), $50 cleared, 47 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2fff); // RTS -> 0x3000
  m.regs.a = 0x10;
  m.ram[0x0050] = 0x02; // positive -> bmi not taken
  m.ram[0x0051] = 0x03;

  loc_adce(m);

  assert.equal(m.ram[0x0051], 0x13, "$51 = 0x02*8 + 0x03 = 0x13");
  assert.equal(m.regs.a, 0x10, "A = 0x10 (pla) + adc #0x00 with C=0");
  assert.equal(m.ram[0x0050], 0x00, "$50 cleared");
  assert.equal(m.regs.y, 0x00, "Y = 0 (ldy #0)");
  assert.equal(m.pc, 0x3000, "RTS -> pushed + 1");
  assert.deepEqual(m.calls, [], "leaf routine");
  assert.equal(m.cycles, 47, "positive-branch cycle total");
});

test("loc_adce: negative $50 (0x82) -> asl carry into $51, A += 0xff sign-extend, 43 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2fff);
  m.regs.a = 0x20;
  m.ram[0x0050] = 0x82; // negative -> bmi taken -> adc #0xff
  m.ram[0x0051] = 0x01;

  loc_adce(m);

  // 0x82<<1=0x04 (C=1), <<1=0x08, <<1=0x10 -> +0x01 = 0x11
  assert.equal(m.ram[0x0051], 0x11, "$51 = (0x82*8 & 0xff) + 0x01 = 0x11");
  assert.equal(m.regs.a, 0x1f, "A = 0x20 + 0xff + C(0) = 0x1f (i.e. 0x20 - 1)");
  assert.equal(m.ram[0x0050], 0x00, "$50 cleared");
  assert.equal(m.regs.y, 0x00, "Y = 0");
  assert.equal(m.pc, 0x3000, "RTS -> pushed + 1");
  assert.deepEqual(m.calls, [], "leaf routine");
  assert.equal(m.cycles, 43, "negative-branch cycle total");
});

test("loc_adce MUTATION: pla mischarged (4->3) blows the golden T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2fff);
  m.regs.a = 0x10;
  m.ram[0x0050] = 0x02;
  m.ram[0x0051] = 0x03;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0xadda ? 3 : c); // pla steps to 0xadda
  loc_adce(m);
  assert.notEqual(m.cycles, 47, "a mischarged cycle blows the golden total");
});
