// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0a3c (ROM 0x0a3c-0x0a58): poll loc_0a59, then spin at loc_0a52 while it
// returns NZ, or (entry Z) seed timer 0x20c0=0x30 and wait at loc_0a47 for it to reach 0. The `call`
// override records, balances the stack, and scripts the Z the polled 0x0a59 leaves (the mock does not
// run it). A read hook decrements 0x20c0 (the ISR the single-threaded mock lacks). Pins both arms.
//
// Run: node --test games/invaders/translated/test/loc_0a3c.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0a3c } from "../loc_0a3c.js";

const CALLER_RET = 0xbe2f;

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
    regs, mem, ram, calls: [], pushed: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { this.pushed.push(v & 0xffff); regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seat(m) { m.regs.sp = 0x2400; m.push16(CALLER_RET); m.pushed = []; m.calls = []; m.tstates = 0; m.pcSeq = []; m.pc = 0; }
// call override: record + balance the stack + script the Z flag loc_0a59 leaves.
function installPoll(m, zseq) { let i = 0; m.call = (a) => { m.calls.push(a); m.regs.sp = (m.regs.sp + 2) & 0xffff; if (a === 0x0a59) m.regs.fZ = zseq[i++]; return undefined; }; }

test("loc_0a3c: entry NZ -> loc_0a52 spins until 0x0a59 returns Z; 91 T", () => {
  const m = makeMachine();
  seat(m);
  installPoll(m, [false, false, true]); // entry NZ; loc_0a52 poll #1 NZ (loop), #2 Z (exit)

  loc_0a3c(m);

  assert.deepEqual(m.calls, [0x0a59, 0x0a59, 0x0a59], "entry poll + two loc_0a52 polls");
  assert.deepEqual(m.pushed, [0x0a3f, 0x0a55, 0x0a55], "call return addresses");
  assert.equal(m.tstates, 17 + 10 + 17 + 10 + 17 + 10 + 10, "entry + 2 spin passes + ret");
  assert.equal(m.pc, CALLER_RET, "rets to the seated caller");
});

test("loc_0a3c: entry Z -> seeds 0x20c0=0x30, waits at loc_0a47 until it reaches 0", () => {
  const m = makeMachine();
  seat(m);
  installPoll(m, new Array(49).fill(true)); // entry Z (skip loc_0a52), each loop poll Z (keep looping)
  const rd = m.mem.read8;
  m.mem.read8 = (a) => { if (a === 0x20c0) { const v = m.ram[a]; m.ram[a] = (v - 1) & 0xff; return v; } return rd(a); };

  loc_0a3c(m);

  // 0x30 (=48) reads before it decrements past 0; the 49th read is 0 and `rz` fires (no poll that pass).
  assert.equal(m.calls.length, 49, "entry poll + 48 in-loop polls");
  assert.equal(m.tstates, 47 + 48 * 49 + 28, "entry(47) + 48 full passes(49) + rz pass(28)");
  assert.equal(m.pc, CALLER_RET, "rz returns to the seated caller");
});

test("loc_0a3c MUTATION: final `jnz 0x0a52` (not taken) mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  seat(m);
  installPoll(m, [false, false, true]);
  const rs = m.step.bind(m);
  m.step = (n, c) => rs(n, n === 0x0a58 ? 7 : c);
  loc_0a3c(m);
  assert.equal(m.tstates, 91 - 3, "mutation loses 3 T (10 -> 7)");
  assert.notEqual(m.tstates, 91, "golden T-state total catches the mutant");
});
