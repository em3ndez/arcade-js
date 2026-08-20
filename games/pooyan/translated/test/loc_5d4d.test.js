// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5d4d (ROM 0x5d4d, Pooyan) -- runs the proximity test loc_5d68 for 3
 * target objects against the fixed source IX=0x889c. IY walks the targets at 0x887c (stride 4), HL walks
 * the records at 0x8be8 (stride 0x18); each pass ld de=4 (for IY) then ld e=0x18 (for HL).
 *
 * The mock's `call` POPS the return the call site pushed (modelling loc_5d68's `ret` on the no-hit path),
 * so a call site missing its push16 desyncs SP and fails the final ret. loc_5d68's no-hit paths leave
 * IY/HL/B/IX intact and DE is reloaded each pass. (On a HIT loc_5d68 skip-returns two frames up, aborting
 * this loop -- untestable here in isolation and modelled the same as loc_5334's loc_5374 caller.)
 *
 * SWEEP is the only path (B hardwired to 3): 2 taken djnz + 1 not-taken, then ret. Full pcSeq + T=269.
 * TEETH: mis-charge `add iy,de` (15 T FD-form) as 11 T -> the 269-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_5d4d.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5d4d } from "../loc_5d4d.js";

const CALLER_RET = 0xabcd;
const PRE_SEAT = 0x8780;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5d4d, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // loc_5d68's no-hit `ret` pops the return this call site pushed -- model that pop so the stack
    // balances (a missing push16 then desyncs SP and fails the final ret). It leaves IY/HL/B/IX intact.
    call(addr) { this.calls.push(addr); this.pc = this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = PRE_SEAT;
  m.push16(CALLER_RET);
}

function sweepSeq(n) {
  const out = [0x5d51, 0x5d55, 0x5d58, 0x5d5a];
  for (let i = 0; i < n; i++) {
    out.push(0x5d68, 0x5d60, 0x5d62, 0x5d64, 0x5d65);
    out.push(i === n - 1 ? 0x5d67 : 0x5d5a);
  }
  out.push(CALLER_RET);
  return out;
}

test("loc_5d4d SWEEP: 3 targets, call loc_5d68 each, IY/HL advance", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_5d4d(m);

  const setupT = 14 + 14 + 10 + 7;
  const loopT = 2 * (17 + 10 + 15 + 7 + 11 + 13) + (17 + 10 + 15 + 7 + 11 + 8);
  assert.equal(m.tstates, setupT + loopT + 10, "SWEEP golden");
  assert.equal(m.tstates, 269, "SWEEP golden literal");
  assert.deepEqual(m.pcSeq, sweepSeq(3), "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller");
  assert.deepEqual(m.calls, Array(3).fill(0x5d68), "3 loc_5d68 calls");
  assert.equal(m.regs.ix, 0x889c, "IX fixed (source object, never advanced)");
  assert.equal(m.regs.iy, 0x8888, "IY = 0x887c + 3*4");
  assert.equal(m.regs.hl, 0x8c30, "HL = 0x8be8 + 3*0x18");
  assert.equal(m.regs.de, 0x0018, "DE = 0x0004 with E reloaded to 0x18");
  assert.equal(m.regs.b, 0x00, "loop counter exhausted");
  // Every push16 matched a callee ret pop, and the final ret popped CALLER_RET.
  assert.equal(m.regs.sp, PRE_SEAT, "stack fully unwound to the pre-seat baseline");
});

test("loc_5d4d MUTATION: `add iy,de` mis-charged 11T (not 15T FD-form) is caught by the golden", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5d62 ? 11 : cycles);
  seatCaller(m);

  loc_5d4d(m);

  assert.equal(m.tstates, 269 - 3 * 4, "mutation loses 4 T per pass (15 -> 11), 3 passes");
  assert.throws(
    () => assert.equal(m.tstates, 269, "SWEEP golden"),
    /269/,
    "the 269-T golden must fail on the mutant",
  );
});
