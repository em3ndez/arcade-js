// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_40bd (ROM 0x40bd, Pooyan) -- the 4-record sweep over IX=0x8c30
 * (stride 0x18), parking B/DE in the alt register set (exx) across loc_40d0.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling loc_40d0's `ret`), so a
 * missing push16 in the loop body desyncs SP and the final ret misses CALLER_RET.
 *
 * Full run: 4 iterations, IX advances 0x8c30 -> 0x8c90, T=248, full pcSeq built from the loop shape.
 * TEETH: mis-charge `add ix,de` (15 T) as 11 T -> loses 4 T per iteration (16 total).
 *
 * Run: node --test games/pooyan/translated/test/loc_40bd.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_40bd } from "../loc_40bd.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x40bd, pcSeq: [],
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
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

function expectedSeq() {
  const seq = [0x40c1, 0x40c4, 0x40c6];
  for (let i = 0; i < 4; i++) {
    seq.push(0x40c7, 0x40d0, 0x40cb, 0x40cd);
    seq.push(i < 3 ? 0x40c6 : 0x40cf);
  }
  seq.push(CALLER_RET);
  return seq;
}

test("loc_40bd full sweep: 4 records, IX 0x8c30 -> 0x8c90, ret", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_40bd(m);

  assert.equal(m.tstates, 248, "T = setup 31 + 3*(40+13) + (40+8) + ret 10");
  assert.deepEqual(m.pcSeq, expectedSeq(), "step boundaries match the loop shape");
  assert.equal(m.calls.length, 4, "loc_40d0 called once per record");
  assert.ok(m.calls.every((a) => a === 0x40d0), "every call is loc_40d0");
  assert.equal(m.regs.ix, 0x8c90, "IX advanced by 4 * 0x18");
  assert.equal(m.regs.b, 0x00, "B counted down to 0");
  assert.equal(m.regs.de, 0x0018, "DE stride restored by the closing exx");
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (4 push16 each matched a callee ret)");
});

test("loc_40bd MUTATION: `add ix,de` mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x40cd ? 11 : cycles);
  seatCaller(m);

  loc_40bd(m);

  assert.equal(m.tstates, 232, "mutation loses 4 T * 4 iterations");
  assert.throws(
    () => assert.equal(m.tstates, 248, "full-sweep T-state total"),
    /248/,
    "the 248-T golden must fail on the mutant",
  );
});
