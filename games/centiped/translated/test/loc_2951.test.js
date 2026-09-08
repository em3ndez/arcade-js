// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2951 (ROM 0x2951-0x2962). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2951.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2951 } from "../loc_2951.js";

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

test("loc_2951: $87 nonzero -> immediate RTS; 11 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  m.ram[0x0087] = 0x05;

  loc_2951(m);

  assert.equal(m.regs.a, 0x05, "A = $87");
  assert.equal(m.cycles, 3 + 2 + 6, "LDA + BEQ(not taken) + RTS = 11 T");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "early-out: no fall-through call");
  assert.deepEqual(m.pcSeq, [0x2953, 0x2955, 0x1234], "LDA -> BEQ(nt) -> RTS");
});

test("loc_2951: $87==0 and ($00 & $0f)==0 -> $b3=7, fall into loc_2962; 20 T", () => {
  const m = makeMachine();
  m.ram[0x0087] = 0x00;
  m.ram[0x0000] = 0x10; // 0x10 & 0x0f == 0 -> BNE not taken

  loc_2951(m);

  assert.equal(m.regs.x, 0x0b, "X = $0b");
  assert.equal(m.regs.a, 0x07, "A = #$07");
  assert.equal(m.ram[0x00b3], 0x07, "$b3 = 7");
  assert.equal(m.cycles, 3 + 3 + 2 + 3 + 2 + 2 + 2 + 3, "20 T");
  assert.equal(m.pc, 0x2962, "last step lands at loc_2962 before the fall-through call");
  assert.deepEqual(m.calls, [0x2962], "fall through into loc_2962");
});

test("loc_2951: $87==0 and ($00 & $0f)!=0 -> BNE taken, no $b3 write; 16 T", () => {
  const m = makeMachine();
  m.ram[0x0087] = 0x00;
  m.ram[0x0000] = 0x11; // 0x11 & 0x0f == 0x01 -> BNE taken
  m.ram[0x00b3] = 0x99; // must stay untouched

  loc_2951(m);

  assert.equal(m.regs.a, 0x01, "A = ($00 & $0f)");
  assert.equal(m.ram[0x00b3], 0x99, "$b3 not written on the BNE-taken path");
  assert.equal(m.cycles, 3 + 3 + 2 + 3 + 2 + 3, "16 T");
  assert.equal(m.pc, 0x2962, "BNE target");
  assert.deepEqual(m.calls, [0x2962], "branch out into loc_2962");
});

test("loc_2951 MUTATION: BEQ taken mischarged 2 T not 3 T is caught by the T-state total", () => {
  const m = makeMachine();
  m.ram[0x0087] = 0x00;
  m.ram[0x0000] = 0x10;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2956 ? 2 : c); // BEQ-taken step lands at 0x2956
  loc_2951(m);
  assert.notEqual(m.cycles, 20, "a mischarged taken-branch cycle blows the golden T-state total");
});
