// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_755d (ROM 0x755d-0x756c): dispatch state 2, the per-frame gameplay
// driver. Five pattern-A calls then ret. Each callee is a plain-ret routine, so the stub runs
// m.ret() to pop the pushed return -- a record-only stub would hide a mistranslated call site.
//
// Run: node --test games/pooyan/translated/test/loc_755d.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_755d } from "../loc_755d.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// Each plain-ret callee pops the pattern-A pushed return via m.ret() (charging its 10 T).
function installBalancingCalls(m) {
  m.call = (addr) => { m.calls.push(addr); m.ret(); return undefined; };
}

test("loc_755d: five pattern-A calls in order, then ret; 145 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);

  loc_755d(m);

  assert.equal(m.tstates, 145, "5*(17 call + 10 stub-ret) + 10 final ret");
  assert.equal(m.pc, CALLER_RET, "returns to caller after all five");
  assert.deepEqual(m.calls, [0x756d, 0x7621, 0x6b13, 0x76af, 0x02ef], "gameplay driver order");
  assert.equal(m.regs.sp, 0x8780, "stack balanced across five pattern-A calls + ret");
  assert.deepEqual(m.pcSeq,
    [0x756d, 0x7560, 0x7621, 0x7563, 0x6b13, 0x7566, 0x76af, 0x7569, 0x02ef, 0x756c, CALLER_RET],
    "each call steps into the target then the stub-ret lands on the next call site");
});

test("loc_755d MUTATION: 0x6b13 call site mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x6b13 ? 10 : c);
  loc_755d(m);
  assert.equal(m.tstates, 138, "mutation loses 7 T (17 -> 10)");
  assert.notEqual(m.tstates, 145, "golden T-state total catches the mutant");
});
