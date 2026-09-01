// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_09ef (ROM 0x09ef-0x0a3b): player switch/handoff. Path exercised: page
// byte 0x2067=0x20 (bit0=0 -> jc 0x0a33 NOT taken, the 0x0a25 arm), 0x20fe=0x05 (-> delay count
// 0x06, table index 0x1da8=0x2a). The mock's call is record-only + rebalances SP so the interleaved
// push psw/pop psw (across 0x01e4) and push h/pop h restore correctly. Goldens (pcSeq/T=436) come
// from an independent reference sim of the ROM semantics.
//
// Run: node --test games/invaders/translated/test/loc_09ef.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_09ef } from "../loc_09ef.js";

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
    regs, mem, ram, calls: [], pushes: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { this.pushes.push(v & 0xffff); regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); regs.sp = (regs.sp + 2) & 0xffff; return undefined; }, // record + rebalance
  };
}

function seatCaller(m) { m.regs.sp = 0x2380; m.push16(CALLER_RET); m.pushes.length = 0; }

const PCSEQ = [
  0xa3c, 0x9f3, 0x9f6, 0x9d6, 0x9fc, 0x9fd, 0x1e4, 0xa01, 0xa04, 0xa07,
  0xa08, 0xa09, 0xa0b, 0xa0c, 0xa0e, 0xa0f, 0xa10, 0xa13, 0xa14, 0xa15,
  0xa13, 0xa14, 0xa15, 0xa13, 0xa14, 0xa15, 0xa13, 0xa14, 0xa15, 0xa13,
  0xa14, 0xa15, 0xa13, 0xa14, 0xa15, 0xa18, 0xa19, 0xa1a, 0xa1c, 0xa1d,
  0xa1e, 0xa20, 0xa21, 0xa22, 0xa25, 0xa27, 0xa2a, 0x1f5, 0x1904, 0x804,
];

test("loc_09ef: page 0x20 (bit0=0) -> 0x0a25 arm, delegates to 0x0804; 436 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x0000;
  m.mem.write8(0x2067, 0x20);
  m.mem.write8(0x20fe, 0x05);
  m.mem.write8(0x1da8, 0x2a);

  loc_09ef(m);

  assert.deepEqual(m.calls, [0x0a3c, 0x09d6, 0x01e4, 0x01f5, 0x1904, 0x0804], "call/delegate chain");
  assert.deepEqual(m.pcSeq, PCSEQ, "full step trace incl. the 6-pass delay loop");
  assert.equal(m.tstates, 436, "independent reference T-state total");
  assert.equal(m.pc, 0x0804, "tail-jump lands at loc_0804");

  // memory writes along the path
  assert.equal(m.mem.read8(0x20e9), 0x00, "0x20e9 cleared by xra a");
  assert.equal(m.mem.read8(0x2067), 0x20, "0x2067 written back (A saved across 0x01e4)");
  assert.equal(m.mem.read8(0x20fe), 0x06, "(0x20fe & 7) + 1 written back");
  assert.equal(m.mem.read8(0x20fc), 0x2a, "table byte 0x1da8 stored at 0x20fc");
  assert.equal(m.mem.read8(0x20fd), 0x38, "0x38 stored at 0x20fd");
  assert.equal(m.mem.read8(0x2098), 0x21, "even-page arm sets 0x2098 = 0x21");
  assert.equal(m.regs.a, 0x21, "A ends 0x21 from the 0x0a25 arm");

  // push sequence: 3 call returns, PSW save, push h, 2 more call returns
  assert.deepEqual(m.pushes, [0x09f2, 0x09f9, 0x2046, 0x0a00, 0x2000, 0x0a2d, 0x0a30], "push sequence");
});

test("loc_09ef MUTATION: the `jc 0x0a33` not-taken step mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x0000;
  m.mem.write8(0x2067, 0x20);
  m.mem.write8(0x20fe, 0x05);
  m.mem.write8(0x1da8, 0x2a);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0a25 ? 7 : c);
  loc_09ef(m);
  assert.notEqual(m.tstates, 436, "golden T-state total catches the mutant");
});
