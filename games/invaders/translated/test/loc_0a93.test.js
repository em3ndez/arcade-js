// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0a93 (ROM 0x0a93-0x0aaa): for C bytes from DE, fetch [DE], call 0x08ff,
// then busy-wait (loc_0a9e) on the VBLANK-decremented timer 0x20c0 before advancing DE. The `call`
// override records AND balances the stack (so `pop d` restores DE and the tail `ret` lands on the
// caller). A read hook decrements 0x20c0 on each read -- the ISR the single-threaded mock lacks --
// so the wait terminates. Pins the per-byte calls, DE/C, T-states, and the pushes.
//
// Run: node --test games/invaders/translated/test/loc_0a93.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0a93 } from "../loc_0a93.js";

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
function installBal(m) { m.call = (a) => { m.calls.push(a); m.regs.sp = (m.regs.sp + 2) & 0xffff; return undefined; }; }
// The VBLANK ISR decrements timer 0x20c0 between CPU reads: read returns v, store v-1.
function installTimerTick(m) {
  const rd = m.mem.read8;
  m.mem.read8 = (a) => { if (a === 0x20c0) { const v = m.ram[a]; m.ram[a] = (v - 1) & 0xff; return v; } return rd(a); };
}

// Per outer iteration: prologue 65T + inner-wait (7 reads x 28T = 196) + epilogue 20T = 281T.
const OUTER = 65 + 7 * 28 + 20;

test("loc_0a93: 2 bytes from DE, call 0x08ff each, timer-wait between; DE+2, C=0", () => {
  const m = makeMachine();
  seat(m);
  installBal(m);
  installTimerTick(m);
  m.regs.de = 0x3000;
  m.regs.c = 0x02;
  m.ram[0x3000] = 0xaa;
  m.ram[0x3001] = 0xbb;

  loc_0a93(m);

  assert.deepEqual(m.calls, [0x08ff, 0x08ff], "one 0x08ff per byte");
  assert.deepEqual(m.pushed, [0x3000, 0x0a98, 0x3001, 0x0a98], "push d (DE) + call ret, per outer iter");
  assert.equal(m.regs.de, 0x3002, "DE advanced by 2");
  assert.equal(m.regs.c, 0x00, "C counted down to 0");
  assert.equal(m.tstates, 2 * OUTER + 10, "two outer iters + tail ret");
  assert.equal(m.pc, CALLER_RET, "rets to the seated caller");
});

test("loc_0a93 MUTATION: `call 0x08ff` mis-charged 11T (not 17T) is caught", () => {
  const m = makeMachine();
  seat(m);
  installBal(m);
  installTimerTick(m);
  m.regs.de = 0x3000;
  m.regs.c = 0x02;
  const rs = m.step.bind(m);
  m.step = (n, c) => rs(n, n === 0x08ff ? 11 : c);
  loc_0a93(m);
  assert.equal(m.tstates, 2 * OUTER + 10 - 12, "mutation loses 6 T per call, 2 calls");
  assert.notEqual(m.tstates, 2 * OUTER + 10, "golden T-state total catches the mutant");
});
