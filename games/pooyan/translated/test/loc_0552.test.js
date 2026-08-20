// SPDX-License-Identifier: GPL-3.0-only
/**
 * Test for loc_0552 (ROM 0x0552-0x059c, Pooyan) -- idx4: reset a 3-byte counter triple then
 * render it via the digit emitter 0x059d. Self-contained mock machine (real Regs for exact flags,
 * flat 64K RAM, step/call/ret/push16/pop16). A `call` is modeled as the callee running to its own
 * ret (SP rebalanced, +2), so the two 0x059d calls per byte stay stack-balanced. The mock seats a
 * caller return so the terminal `ret` proves the exit. Path A: A==0 -> base 0x88a2, IX 0x8781.
 * Path B: A==2 -> base 0x88a8, IX 0x8641 (both jr-z fall through twice). The B=3 djnz loop and the
 * two calls per byte are fixed regardless of source bytes, so the pcSeq is deterministic.
 * TEETH: mis-charge `add hl` -- actually `ld ix,0x8781` (14 T) as 10 T; the 407-T golden catches it.
 * Run: node --test games/pooyan/translated/test/loc_0552.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0552 } from "../loc_0552.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0552, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); regs.sp = (regs.sp + 2) & 0xffff; return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// One loop body: read/high-nibble/rrca x4/call, reload/low-nibble/call, dec hl, then djnz target.
function loopIter(djnzTarget) {
  return [0x058e, 0x058f, 0x0590, 0x0591, 0x0592, 0x059d, 0x0596, 0x059d, 0x059a, djnzTarget];
}

const PROLOGUE_A = [
  0x0553, 0x0556, 0x0557, 0x0562, 0x0564, 0x0565, 0x0567, 0x0568, 0x056a,
  0x056b, 0x056e, 0x0572, 0x0573, 0x0586, 0x0589, 0x058b, 0x058d,
];
const PC_A = [
  ...PROLOGUE_A,
  ...loopIter(0x058d), ...loopIter(0x058d), ...loopIter(0x059c),
  CALLER_RET,
];

test("loc_0552 Path A: A==0 -> base 0x88a2 cleared, IX 0x8781, render loop", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x00;

  loc_0552(m);

  assert.equal(m.pc, CALLER_RET, "ends via 0x059c ret");
  assert.equal(m.tstates, 407, "Path A T-state total");
  assert.deepEqual(m.calls, [0x059d, 0x059d, 0x059d, 0x059d, 0x059d, 0x059d], "two 0x059d calls x3 bytes");
  assert.equal(m.mem.read8(0x88a2), 0x00, "counter triple base cleared");
  assert.equal(m.mem.read8(0x88a3), 0x00, "counter triple +1 cleared");
  assert.equal(m.mem.read8(0x88a4), 0x00, "counter triple +2 cleared");
  assert.equal(m.regs.ix, 0x8781, "IX = dest column for A==0");
  assert.equal(m.regs.hl, 0x88a1, "HL walked down 3 from 0x88a4");
  assert.equal(m.regs.b, 0x00, "B exhausted by djnz");
  assert.equal(m.regs.de, 0xffe0, "DE = row stride");
  assert.deepEqual(m.pcSeq, PC_A, "Path A step boundaries match the ROM bytes");
});

const PROLOGUE_B = [
  0x0553, 0x0556, 0x0557, 0x0559, 0x055c, 0x055d, 0x055f, 0x0562, 0x0564, 0x0565, 0x0567, 0x0568, 0x056a,
  0x056b, 0x056e, 0x0572, 0x0573, 0x0575, 0x0578, 0x057c, 0x057d, 0x057f, 0x0582, 0x0586, 0x0589, 0x058b, 0x058d,
];
const PC_B = [
  ...PROLOGUE_B,
  ...loopIter(0x058d), ...loopIter(0x058d), ...loopIter(0x059c),
  CALLER_RET,
];

test("loc_0552 Path B: A==2 -> both jr-z fall through, base 0x88a8, IX 0x8641", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x02;

  loc_0552(m);

  assert.equal(m.pc, CALLER_RET, "ends via 0x059c ret");
  assert.equal(m.tstates, 487, "Path B T-state total");
  assert.deepEqual(m.calls, [0x059d, 0x059d, 0x059d, 0x059d, 0x059d, 0x059d]);
  assert.equal(m.mem.read8(0x88a8), 0x00, "base cleared");
  assert.equal(m.mem.read8(0x88a9), 0x00);
  assert.equal(m.mem.read8(0x88aa), 0x00);
  assert.equal(m.regs.ix, 0x8641, "IX = dest column for A>=2");
  assert.equal(m.regs.hl, 0x88a7, "HL walked down 3 from 0x88aa");
  assert.deepEqual(m.pcSeq, PC_B, "Path B step boundaries match the ROM bytes");
});

test("loc_0552 MUTATION: `ld ix,0x8781` mis-charged 10 T (not 14) is caught", () => {
  const m = makeMachine();
  const real = m.step.bind(m);
  let first = true;
  m.step = (n, c) => { if (first && n === 0x0572) { first = false; return real(n, 10); } return real(n, c); };
  seatCaller(m);
  m.regs.a = 0x00;

  loc_0552(m);

  assert.equal(m.tstates, 403, "mutant loses exactly 4 T (14 -> 10)");
  assert.throws(() => assert.equal(m.tstates, 407, "Path A T-state total"), /Path A T-state total/,
    "the 407-T golden must fail on the mutant");
});
