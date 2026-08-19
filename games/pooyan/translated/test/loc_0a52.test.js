// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_0a52 (ROM 0x0a52-0x0a64): paint two 2x2 blocks via the plain-ret copier
// at 0x0a40. Flat-RAM mock (real Regs). 0x0a40 is a plain-ret routine, so both call sites are
// pattern-A (push return, then call) and the stub MUST run m.ret() to pop that pushed return -- a
// record-only stub would hide a stack bug.
//
// Run: node --test games/pooyan/translated/test/loc_0a52.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0a52 } from "../loc_0a52.js";

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
    // pattern-A stub: pop the pushed return so the two-blit stack sequence is exercised for real.
    call(addr) { this.calls.push(addr); this.ret(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_0a52: two 0x0a40 blits, second anchored at 0x826a; 104 T", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_0a52(m);

  assert.equal(m.tstates, 104, "T-state total (7 ops + 2 stub rets)");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [0x0a40, 0x0a40], "copier invoked twice");
  assert.equal(m.regs.hl, 0x826a, "HL left at the second anchor");
  assert.equal(m.regs.de, 0x0a72, "DE left at the source table");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq,
    [0x0a55, 0x0a58, 0x0a40, 0x0a5b, 0x0a5e, 0x0a61, 0x0a40, 0x0a64, CALLER_RET],
    "op boundaries (each call steps into 0x0a40 then the stub rets to the next op)");
});

test("loc_0a52 MUTATION: call at 0x0a58 mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const realStep = m.step.bind(m);
  let first = true;
  m.step = (n, c) => { if (n === 0x0a40 && first) { first = false; return realStep(n, 10); } return realStep(n, c); };

  loc_0a52(m);

  assert.equal(m.tstates, 97, "mutation loses 7 T (17 -> 10)");
  assert.notEqual(m.tstates, 104, "golden T-state total catches the mutant");
});
