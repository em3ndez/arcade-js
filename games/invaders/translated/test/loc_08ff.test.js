// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_08ff (ROM 0x08ff-0x0912): DE := 0x1e00 + 8*A (HL preserved via push/pop),
// B := 8, latch A to shift-count port 6, then tail-jump to blitter loc_1439.
//
// Run: node --test games/invaders/translated/test/loc_08ff.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_08ff } from "../loc_08ff.js";

const CALLER_RET = 0xabcd;

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x08ff, pcSeq: [],
    io: { ins: {}, outs: [], portIn(p) { return this.ins[p] ?? 0; }, portOut(p, v) { this.outs.push([p, v]); } },
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

test("loc_08ff: DE := 0x1e00 + 8*A, HL preserved, port6 latch, tail loc_1439", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.a = 0x03;
  m.regs.hl = 0xdead; // must survive the push/pop frame

  loc_08ff(m);

  assert.equal(m.regs.de, 0x1e18, "DE := 0x1e00 + 8*3");
  assert.equal(m.regs.hl, 0xdead, "HL restored by pop h");
  assert.equal(m.regs.b, 0x08, "B := 8");
  assert.deepEqual(m.io.outs, [[0x06, 0x03]], "A latched to shift-count port 6");
  assert.equal(m.tstates, 114, "T total");
  assert.equal(m.pc, 0x1439, "tail jmp lands on loc_1439");
  assert.deepEqual(m.calls, [0x1439], "delegates to loc_1439");
  assert.deepEqual(m.pcSeq, [
    0x0902, 0x0903, 0x0905, 0x0906, 0x0907, 0x0908, 0x0909, 0x090a, 0x090b, 0x090c, 0x090e, 0x0910, 0x1439,
  ], "step boundaries");
  assert.equal(m.regs.sp, 0x2400, "push h/pop h balanced; loc_1439 rets to caller");
});

test("loc_08ff: A=0 -> DE := 0x1e00 exactly", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.a = 0x00;
  m.regs.hl = 0xbeef;

  loc_08ff(m);

  assert.equal(m.regs.de, 0x1e00, "DE := base with zero index");
  assert.equal(m.regs.hl, 0xbeef, "HL preserved");
  assert.deepEqual(m.io.outs, [[0x06, 0x00]], "port6 latched 0");
});

test("loc_08ff MUTATION: `dad d` mis-charged 4T (not 10T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.a = 0x03;
  m.regs.hl = 0xdead;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x090a ? 4 : c); // dad d -> step 0x090a, real 10T
  loc_08ff(m);
  assert.equal(m.tstates, 108, "mutation loses 6 T");
  assert.notEqual(m.tstates, 114, "golden T-state total catches the mutant");
});
