// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2b91 (ROM 0x2b91-0x2ba8). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2b91.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2b91 } from "../loc_2b91.js";

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

// alpha: $ef nonzero, ($32 & $1f) < $14 -> BCC taken -> immediate RTS, no DEC.
test("loc_2b91: $ef!=0 and A<$14 -> BCC to RTS, no DEC; 21 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  m.ram[0x0032] = 0x05; // & 0x1f = 0x05
  m.ram[0x00ef] = 0x03; // nonzero -> BEQ not taken
  m.ram[0x00da] = 0x55; // DEC region must stay untouched

  loc_2b91(m);

  assert.equal(m.regs.x, 0x03, "X = $ef (never reloaded from $88)");
  assert.equal(m.regs.fC, false, "C clear: 0x05 < 0x14");
  assert.equal(m.ram[0x00da], 0x55, "no DEC on the BCC-to-RTS path");
  assert.equal(m.cycles, 3 + 2 + 3 + 2 + 2 + 3 + 6, "21 T");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

// beta: $ef nonzero, A>=$14 -> BCC not taken, BCS to 2ba3 -> reload X=$88, DEC $d7,X.
test("loc_2b91: $ef!=0 and A>=$14 -> BCS to 2ba3, DEC $d7,X; 32 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x0032] = 0x34; // & 0x1f = 0x14
  m.ram[0x00ef] = 0x02; // nonzero -> BEQ not taken
  m.ram[0x0088] = 0x02; // X reloaded from $88
  m.ram[0x00d9] = 0x40; // DEC target: $d7 + 0x02 = 0xd9

  loc_2b91(m);

  assert.equal(m.regs.x, 0x02, "X reloaded from $88");
  assert.equal(m.ram[0x00d9], 0x3f, "DEC $d7,X: ram[0xd9] 0x40 -> 0x3f");
  assert.equal(m.cycles, 3 + 2 + 3 + 2 + 2 + 2 + 3 + 3 + 6 + 6, "32 T");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

// gamma: $ef==0 -> BEQ to 2b9f, A<$0c -> BCS not taken -> reload X=$88, DEC $d7,X.
test("loc_2b91: $ef==0 and A<$0c -> BEQ to 2b9f, BCS falls to DEC; 30 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x0032] = 0x05; // & 0x1f = 0x05 (< 0x0c)
  m.ram[0x00ef] = 0x00; // zero -> BEQ taken
  m.ram[0x0088] = 0x01; // X reloaded from $88
  m.ram[0x00d8] = 0x10; // DEC target: $d7 + 0x01 = 0xd8

  loc_2b91(m);

  assert.equal(m.regs.x, 0x01, "X reloaded from $88");
  assert.equal(m.ram[0x00d8], 0x0f, "DEC $d7,X: ram[0xd8] 0x10 -> 0x0f");
  assert.equal(m.regs.fC, false, "C clear: 0x05 < 0x0c");
  assert.equal(m.cycles, 3 + 2 + 3 + 3 + 2 + 2 + 3 + 6 + 6, "30 T");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
});

test("loc_2b91 MUTATION: LDA $32 mischarged 2 T not 3 T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x0032] = 0x34;
  m.ram[0x00ef] = 0x02;
  m.ram[0x0088] = 0x02;
  m.ram[0x00d9] = 0x40;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2b93 ? 2 : c); // LDA $32 step lands at 0x2b93
  loc_2b91(m);
  assert.notEqual(m.cycles, 32, "a mischarged cycle blows the golden T-state total");
});
