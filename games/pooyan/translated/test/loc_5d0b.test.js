// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5d0b (ROM 0x5d0b, Pooyan) -- sweeps the 6-entry stride-0x18 object
 * table at 0x8ae0 calling loc_5d1e (animation-hold countdown) per entry. The loop counter B and stride
 * DE are banked across the call by exx; IX (untouched by exx and by loc_5d1e) advances by 0x18 each pass.
 *
 * The mock's `call` POPS the return the call site pushed (modelling loc_5d1e's `ret`), so a call site
 * missing its push16 desyncs SP and fails the final ret. loc_5d1e leaves IX/B/DE (banked by exx) intact.
 *
 * SWEEP is the only path (B hardwired to 6): 5 taken djnz + 1 not-taken, then ret. Full pcSeq + T=354.
 * TEETH: mis-charge `add ix,de` (15 T DD-form) as 11 T -> the 354-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_5d0b.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5d0b } from "../loc_5d0b.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5d0b, pcSeq: [],
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
    // loc_5d1e's `ret` pops the return this call site pushed -- model that pop so the stack balances (a
    // missing push16 then desyncs SP and fails the final ret). loc_5d1e leaves IX/B/DE (banked by exx) intact.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = PRE_SEAT;
  m.push16(CALLER_RET);
}

function sweepSeq(n) {
  const out = [0x5d0f, 0x5d12, 0x5d14];
  for (let i = 0; i < n; i++) {
    out.push(0x5d15, 0x5d1e, 0x5d19, 0x5d1b);
    out.push(i === n - 1 ? 0x5d1d : 0x5d14);
  }
  out.push(CALLER_RET);
  return out;
}

test("loc_5d0b SWEEP: 6 stride-0x18 entries, call loc_5d1e each, IX advances", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_5d0b(m);

  const setupT = 14 + 10 + 7;
  const loopT = 5 * (4 + 17 + 4 + 15 + 13) + (4 + 17 + 4 + 15 + 8);
  assert.equal(m.tstates, setupT + loopT + 10, "SWEEP golden");
  assert.equal(m.tstates, 354, "SWEEP golden literal");
  assert.deepEqual(m.pcSeq, sweepSeq(6), "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller");
  assert.deepEqual(m.calls, Array(6).fill(0x5d1e), "6 loc_5d1e calls");
  assert.equal(m.regs.ix, 0x8b70, "IX = 0x8ae0 + 6*0x18");
  assert.equal(m.regs.de, 0x0018, "stride DE restored by exx each pass");
  assert.equal(m.regs.b, 0x00, "loop counter exhausted");
  // Every push16 matched a callee ret pop, and the final ret popped CALLER_RET.
  assert.equal(m.regs.sp, PRE_SEAT, "stack fully unwound to the pre-seat baseline");
});

test("loc_5d0b MUTATION: `add ix,de` mis-charged 11T (not 15T DD-form) is caught by the golden", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5d1b ? 11 : cycles);
  seatCaller(m);

  loc_5d0b(m);

  assert.equal(m.tstates, 354 - 6 * 4, "mutation loses 4 T per pass (15 -> 11), 6 passes");
  assert.throws(
    () => assert.equal(m.tstates, 354, "SWEEP golden"),
    /354/,
    "the 354-T golden must fail on the mutant",
  );
});
