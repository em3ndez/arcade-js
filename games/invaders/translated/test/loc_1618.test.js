// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_1618 (ROM 0x1618-0x166a). Seats the gate inputs so the header checks all
// pass (0x2015==0xff, 0x2010/0x2011 clear, 0x2025 clear) and 0x20ef==0 -> the `jz 0x1652` arm, then
// 0x20ed low byte < 0x7e -> the `jc 0x1663` (taken) tail: writes 0x2025=1, steps 0x20ed, stores 0x201d.
//
// Run: node --test games/invaders/translated/test/loc_1618.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1618 } from "../loc_1618.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], pushes: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { this.pushes.push(v & 0xffff); regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatArm(m) {
  m.mem.write8(0x2015, 0xff); // cpi 0xff -> Z (rnz not taken)
  // 0x2010/0x2011/0x2025/0x20ef default 0 -> all the header checks fall through
  m.mem.write8(0x20ed, 0x50); m.mem.write8(0x20ee, 0x00); // lhld -> 0x0050, inx -> 0x0051
  m.mem.write8(0x0051, 0x99); // mov a,m after shld reads here
  m.push16(0xbeef); // return address for the final ret
  m.pushes.length = 0; // ignore the harness's own setup push
}

test("loc_1618: jz-1652 / jc-1663 arm sets 0x2025, steps 0x20ed, stores 0x201d; 221 T", () => {
  const m = makeMachine();
  seatArm(m);

  loc_1618(m);

  assert.equal(m.mem.read8(0x2025), 0x01, "mvi m,0x01 at loc_1652");
  assert.equal(m.mem.read16(0x20ed), 0x0051, "shld 0x20ed <- HL stepped to 0x0051");
  assert.equal(m.mem.read8(0x201d), 0x99, "sta 0x201d <- mem[0x0051]");
  assert.equal(m.regs.a, 0x99, "A := mem[0x0051]");
  assert.equal(m.regs.b, 0x00, "B := mem[0x2011] (0)");
  assert.equal(m.regs.hl, 0x0051, "HL stepped 0x0050 -> 0x0051, kept by jc-taken");
  assert.deepEqual(m.calls, [], "no 0x17c0 call on this arm");
  assert.deepEqual(m.pushes, [], "no CALL pushes on this arm");
  assert.equal(m.pc, 0xbeef, "final ret pops the seeded return address");
  assert.equal(m.tstates, 221, "T total for the jz-1652/jc-1663 arm");
});

test("loc_1618 MUTATION: `lhld 0x20ed` mis-charged 10T (not 16T) is caught", () => {
  const m = makeMachine();
  seatArm(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x165a ? 10 : c); // lhld's step target
  loc_1618(m);
  assert.equal(m.tstates, 215, "mutation loses 6 T (16 -> 10)");
  assert.notEqual(m.tstates, 221, "golden T-state total catches the mutant");
});
