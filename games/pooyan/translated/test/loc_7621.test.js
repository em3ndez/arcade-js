// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_7621 (ROM 0x7621-0x7625): seed B=0x0e, jr into the shared walk at
// 0x7627 (skipping loc_7625's `ld b,0x08`). It is a pure tail delegation, so the test asserts the
// register seed, the T-state total, the step boundaries, and that the 0x7627 delegation's return
// propagates. Run: node --test games/pooyan/translated/test/loc_7621.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7621 } from "../loc_7621.js";

const CALLER_RET = 0xabcd;
const DELEGATE_MARK = 0x7e57; // sentinel the mocked 0x7627 returns, to prove propagation

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
    call(addr) { this.calls.push(addr); return DELEGATE_MARK; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_7621: seeds B=0x0e, delegates to 0x7627; 19 T", () => {
  const m = makeMachine();
  seatCaller(m);

  const r = loc_7621(m);

  assert.equal(m.regs.b, 0x0e, "B seeded 0x0e");
  assert.equal(m.tstates, 19, "7 (ld b) + 12 (jr)");
  assert.deepEqual(m.calls, [0x7627], "tail-delegates to the shared body at 0x7627");
  assert.equal(r, DELEGATE_MARK, "propagates 0x7627's return (caller-skip boolean chain)");
  assert.deepEqual(m.pcSeq, [0x7623, 0x7627], "step boundaries: ld b -> jr target");
});

test("loc_7621 MUTATION: `jr 0x7627` mis-charged 7T (not 12T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x7627 ? 7 : c);
  loc_7621(m);
  assert.equal(m.tstates, 14, "mutation loses 5 T (12 -> 7)");
  assert.notEqual(m.tstates, 19, "golden T-state total catches the mutant");
});
