// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2a92 (ROM 0x2a92-0x2aa5). Minimal 6502 harness (Regs + flat RAM + the page-1
// stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration check.
// JSR $2c96 is opaque here (harness records the call, does not run it), so the BCC at 0x2a9c is exercised
// against the carry the routine's own ADC leaves. Run: node --test games/centiped/translated/test/loc_2a92.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2a92 } from "../loc_2a92.js";

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
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); return undefined; },
  };
}

test("loc_2a92: carry-clear after the add tail-jumps to loc_2acd; 23 T", () => {
  const m = makeMachine();
  m.regs.x = 0x00;
  m.ram[0x0044] = 0x01; // $44,0
  m.ram[0x0054] = 0x02; // $54,0 -> 0x01+0x02 = 0x03, no carry
  loc_2a92(m);
  assert.equal(m.regs.a, 0x03, "A = $44,x + $54,x = 0x03");
  assert.equal(m.ram[0x0054], 0x03, "$54,x written with the sum");
  assert.equal(m.regs.fC, false, "carry clear (no BCD/binary overflow)");
  assert.equal(m.pc, 0x2acd, "BCC (carry clear) -> loc_2acd");
  assert.deepEqual(m.calls, [0x2c96, 0x2acd], "JSR $2c96 then tail-call loc_2acd");
  assert.equal(m.cycles, 4 + 2 + 4 + 4 + 6 + 3, "23 T");
});

test("loc_2a92: carry set, ($64,x & 7)==4 falls through to loc_2aa6; 32 T", () => {
  const m = makeMachine();
  m.regs.x = 0x00;
  m.ram[0x0044] = 0x80;
  m.ram[0x0054] = 0x90; // 0x80+0x90 = 0x110 -> carry set, A = 0x10
  m.ram[0x0064] = 0x0c; // 0x0c & 7 = 0x04 -> CMP #$04 equal -> BNE not taken
  loc_2a92(m);
  assert.equal(m.ram[0x0054], 0x10, "$54,x = low byte of the sum");
  assert.equal(m.regs.a, 0x04, "A = $64,x & 7 = 0x04");
  assert.equal(m.regs.fZ, true, "Z set: 0x04 == 0x04");
  assert.equal(m.pc, 0x2aa6, "BNE not taken -> fall into loc_2aa6");
  assert.deepEqual(m.calls, [0x2c96, 0x2aa6], "JSR $2c96 then fall into loc_2aa6");
  assert.equal(m.cycles, 4 + 2 + 4 + 4 + 6 + 2 + 4 + 2 + 2 + 2, "32 T");
});

test("loc_2a92: carry set, ($64,x & 7)!=4 branches to loc_2ac7; 33 T", () => {
  const m = makeMachine();
  m.regs.x = 0x00;
  m.ram[0x0044] = 0x80;
  m.ram[0x0054] = 0x90; // carry set
  m.ram[0x0064] = 0x03; // 0x03 & 7 = 0x03 -> CMP #$04 not equal -> BNE taken
  loc_2a92(m);
  assert.equal(m.regs.a, 0x03, "A = $64,x & 7 = 0x03");
  assert.equal(m.regs.fZ, false, "Z clear: 0x03 != 0x04");
  assert.equal(m.pc, 0x2ac7, "BNE taken -> loc_2ac7");
  assert.deepEqual(m.calls, [0x2c96, 0x2ac7], "JSR $2c96 then branch to loc_2ac7");
  assert.equal(m.cycles, 4 + 2 + 4 + 4 + 6 + 2 + 4 + 2 + 2 + 3, "33 T");
});

test("loc_2a92 MUTATION: JSR $2c96 mischarged 7T not 6T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.x = 0x00;
  m.ram[0x0044] = 0x01;
  m.ram[0x0054] = 0x02;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2a9c && m.pcSeq.length === 4 ? 7 : c); // the JSR step lands at 0x2a9c
  loc_2a92(m);
  assert.notEqual(m.cycles, 23, "a mischarged JSR cycle blows the golden T-state total");
});
