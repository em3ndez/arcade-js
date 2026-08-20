// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5f6a (ROM 0x5f6a, Pooyan) -- the ungated actor-sweep driver.
 * Sweeps the 0x8848 table B=2 times (stride DE=4), calling loc_5f83 per pass with the I register
 * carrying the loop counter. The exx pair parks B and DE in the shadow set across the call.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling loc_5f83's `ret`), then
 * clobbers main B/DE the way the handler does -- so the exx protection has teeth and a missing push16
 * desyncs the stack (the final ret then pops the wrong word and misses pc/SP baseline).
 *
 * Path RUN: prologue + 2 loop passes (djnz taken then falling out) + ret. Full pcSeq + T=181,
 * iy=0x8850, two loc_5f83 calls, I=1 (ld a,b on the final pass with B=1).
 * TEETH: mis-charge `ld iy,0x8848` (14 T) as 10 T -> the 181-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_5f6a.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5f6a } from "../loc_5f6a.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5f6a, pcSeq: [],
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
    // loc_5f83's `ret` pops the pushed return address (balance); it also clobbers B/DE, which the exx
    // pair in loc_5f6a protects. Model both so the stack tooth and the exx protection have teeth.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x5f83) { regs.b = 0x04; regs.de = 0xdead; }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const PC_RUN = [
  0x5f6e, 0x5f70, 0x5f73, 0x5f74, 0x5f76,                 // prologue
  0x5f77, 0x5f83, 0x5f7b, 0x5f7d, 0x5f7e, 0x5f80, 0x5f76, // pass 1 (call -> target, djnz taken)
  0x5f77, 0x5f83, 0x5f7b, 0x5f7d, 0x5f7e, 0x5f80, 0x5f82, // pass 2 (djnz falls out)
  CALLER_RET,
];

test("loc_5f6a Path RUN: 2 sweep passes, exx protects B/DE across loc_5f83", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_5f6a(m);

  assert.equal(m.tstates, 181, "Path RUN T-state total");
  assert.deepEqual(m.pcSeq, PC_RUN, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret at 0x5f82 to the seated caller");
  assert.deepEqual(m.calls, [0x5f83, 0x5f83], "two loc_5f83 passes");
  assert.equal(m.regs.iy, 0x8850, "IY advanced 0x8848 + 2*4 (DE preserved across each call by exx)");
  assert.equal(m.regs.b, 0x00, "loop counter fully drained (protected from loc_5f83's b=4)");
  assert.equal(m.regs.i, 0x01, "I = loop counter on the final pass (ld a,b with B=1)");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to the pre-seat baseline");
});

test("loc_5f6a MUTATION: `ld iy,0x8848` mis-charged 10T (not 14T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5f6e ? 10 : cycles);
  seatCaller(m);

  loc_5f6a(m);

  assert.equal(m.tstates, 177, "mutation loses 4 T (14 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 181, "Path RUN T-state total"),
    /181/,
    "the 181-T golden must fail on the mutant",
  );
});
