// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_20e8 (ROM 0x20e8-0x2119). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. $100a is a hardware counter, so the harness pins it to loop-exit values. Run:
// node --test games/centiped/translated/test/loc_20e8.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_20e8 } from "../loc_20e8.js";

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

test("loc_20e8: $100a=$18 exits the wait on the first pass; $ab,x>=6 keeps Y=3; 66 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x00ef] = 0x00; // $40 = 0x1c ^ 0 = 0x1c
  m.ram[0x00f0] = 0x00; // $70 = 0xf8 ^ 0 = 0xf8
  m.ram[0x100a] = 0x18; // & 0xf8 = 0x18: non-zero and >= 0x10 -> exit
  m.ram[0x0088] = 0x00; // X = 0
  m.ram[0x00ab] = 0x06; // $ab,x = 6 -> BCS taken -> Y stays 3

  loc_20e8(m);

  assert.equal(m.ram[0x0040], 0x1c, "$40 = 0x1c ^ $ef");
  assert.equal(m.ram[0x0070], 0xf8, "$70 = 0xf8 ^ $f0");
  assert.equal(m.ram[0x0060], 0x14, "$60 = ($100a & $f8) - 4 = 0x14");
  assert.equal(m.ram[0x0080], 0x03, "$80 = Y = 3 (BCS taken)");
  assert.equal(m.ram[0x0050], 0x00, "$50 cleared");
  assert.equal(m.ram[0x00b8], 0x00, "$b8 cleared");
  assert.equal(m.regs.a, 0x00, "A = 0 at end");
  assert.equal(m.regs.fZ, true, "Z set (A = 0)");
  assert.equal(m.cycles,
    2 + 3 + 3 + 2 + 3 + 3 +           // 20e8..20f2 prologue
    4 + 2 + 2 + 2 + 2 +               // 20f4 loop, single pass to exit
    2 + 2 + 3 + 2 + 3 + 4 + 2 +       // 20ff..210a
    3 +                              // 210c bcs taken
    3 + 2 + 3 + 3 + 6,               // 2110..2118 rts
    "66 T");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

test("loc_20e8: one spin then exit adds a BEQ-taken iteration (9T); 75 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x00ab] = 0x06;
  const realRead = m.mem.read8;
  let first = true;
  m.mem.read8 = (a) => {
    if ((a & 0xffff) === 0x100a) { if (first) { first = false; return 0x00; } return 0x18; }
    return realRead(a);
  };

  loc_20e8(m);

  assert.equal(m.ram[0x0060], 0x14, "$60 from the second (exit) $100a read");
  assert.equal(m.cycles, 66 + (4 + 2 + 3), "75 T: one extra LDA/AND/BEQ-taken iteration");
  assert.equal(m.pc, 0x1234);
});

test("loc_20e8 MUTATION: LDA $100a mischarged 5T not 4T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x100a] = 0x18;
  m.ram[0x00ab] = 0x06;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x20f7 ? 5 : c); // LDA $100a steps to 0x20f7
  loc_20e8(m);
  assert.notEqual(m.cycles, 66, "a mischarged cycle blows the golden T-state total");
});
