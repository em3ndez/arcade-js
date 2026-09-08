// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2db6 (ROM 0x2db6-0x2e0a). Minimal 6502 harness (Regs + flat RAM + the page-1
// stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration check.
// JSR $21b3/$26b8 are opaque (harness records the call, does not run it). The two tested paths avoid the
// 0x2dfd BCS-to-self spin. Run: node --test games/centiped/translated/test/loc_2db6.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2db6 } from "../loc_2db6.js";

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

test("loc_2db6: $86 negative -> BMI early-exit RTS (page cross taken); 13 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> pulled + 1 = 0x1234
  m.regs.y = 0x00;
  m.ram[0x0086] = 0x80; // bit7 set -> N set -> BMI taken
  loc_2db6(m);
  assert.equal(m.regs.y, 0x80, "Y = $86 = 0x80");
  assert.equal(m.regs.fN, true, "N set from LDY $86");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "no callee reached on the early-exit path");
  assert.equal(m.cycles, 3 + 4 + 6, "LDY + BMI(taken,cross) + RTS = 13 T");
});

test("loc_2db6: add path, low carry-clear skips roll, 16-bit compare borrows -> BCC $2e08 exit; 71 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.regs.x = 0x07;   // caller X saved to $8d then restored at the end
  m.ram[0x0086] = 0x00; // BMI not taken
  m.ram[0x0088] = 0x00; // LDX $88 -> X = 0
  m.regs.a = 0x00;   // input accumulator
  m.ram[0x00a7] = 0x00; m.ram[0x00a9] = 0x00; m.ram[0x008b] = 0x00; // 16-bit add stays 0, no carry
  m.ram[0x00ad] = 0x01; m.ram[0x00af] = 0x00; // $a9/$ab (=0) minus $ad/$af (=1) -> borrow -> carry clear
  m.ram[0x00ab] = 0x00;
  loc_2db6(m);
  assert.equal(m.ram[0x008d], 0x07, "STX $8d saved caller X");
  assert.equal(m.ram[0x00a7], 0x00, "$a7,x low byte written");
  assert.equal(m.ram[0x00a9], 0x00, "$a9,x high byte written");
  assert.equal(m.regs.x, 0x07, "X restored from $8d before RTS");
  assert.equal(m.regs.a, 0xff, "SBC borrow -> A = 0x00 - 0x00 - 1 = 0xff");
  assert.equal(m.regs.fC, false, "carry clear from the borrowing SBC");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "BCC $2e08 taken before the JSRs");
  assert.equal(
    m.cycles,
    3 + 2 + 3 + 2 + 3 + 2 + 4 + 4 + 4 + 3 + 4 + 3 + 2 + 3 + 4 + 4 + 4 + 4 + 4 + 3 + 6,
    "71 T",
  );
});

test("loc_2db6 MUTATION: BCC $2e08 mischarged 3T (no page-cross) not 4T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.regs.x = 0x07;
  m.ram[0x0086] = 0x00;
  m.ram[0x0088] = 0x00;
  m.regs.a = 0x00;
  m.ram[0x00ad] = 0x01;
  const realStep = m.step.bind(m);
  // the BCC $2e08 taken step lands at 0x2e08 the first time; mischarge it 3 instead of 4
  let hit = false;
  m.step = (n, c) => realStep(n, (n === 0x2e08 && !hit && (hit = true)) ? 3 : c);
  loc_2db6(m);
  assert.notEqual(m.cycles, 71, "dropping the branch page-cross penalty blows the golden T-state total");
});
