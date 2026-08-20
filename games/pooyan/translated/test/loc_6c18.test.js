// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6c18 (ROM 0x6c18, Pooyan) -- the boot-gap record walker. Sets
 * ix=0x8840, iy=0x887c (stride 4), hl=0x8be8 (stride 0x18), B=3, and calls loc_6c3f (boundary) per
 * record; then clears bits 2,3 of 0x8a87 and zeroes 0x8d54.
 *
 * The mock's `call` POPS the pushed return address (models loc_6c3f's ret); the boundary is assumed
 * register-preserving. Each of the 3 iterations push16 + pop, so a missing push16 desyncs SP. pcSeq
 * VISITS the call target 0x6c3f three times. TEETH: mis-charge `res 2,(hl)` 7T (not 15T).
 *
 * Run: node --test games/pooyan/translated/test/loc_6c18.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6c18 } from "../loc_6c18.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6c18, pcSeq: [],
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
    call(addr) { this.calls.push(addr); this.pc = this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const PC = [
  0x6c1c, 0x6c20, 0x6c23, 0x6c25,
  0x6c3f, 0x6c2b, 0x6c2d, 0x6c2f, 0x6c30, 0x6c25, // iter1
  0x6c3f, 0x6c2b, 0x6c2d, 0x6c2f, 0x6c30, 0x6c25, // iter2
  0x6c3f, 0x6c2b, 0x6c2d, 0x6c2f, 0x6c30, 0x6c32, // iter3 -> djnz falls out
  0x6c35, 0x6c37, 0x6c39, 0x6c3c, 0x6c3e, CALLER_RET,
];

function setup(m) {
  seatCaller(m);
  m.mem.write8(0x8a87, 0xff); // bits 2,3 set -> res clears both
  m.mem.write8(0x8d54, 0x77); // will be zeroed
}

test("loc_6c18: 3-record walk + bit clears + zero", () => {
  const m = makeMachine();
  setup(m);

  loc_6c18(m);

  assert.equal(m.tstates, 329, "T-state total (3 iterations)");
  assert.deepEqual(m.pcSeq, PC, "step boundaries match ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.deepEqual(m.calls, [0x6c3f, 0x6c3f, 0x6c3f], "three loc_6c3f calls");
  assert.equal(m.regs.ix, 0x8840, "ix unchanged");
  assert.equal(m.regs.iy, 0x8888, "iy = 0x887c + 3*4");
  assert.equal(m.regs.b, 0x00, "B counted down to 0");
  assert.equal(m.mem.read8(0x8a87), 0xf3, "0xff with bits 2,3 cleared -> 0xf3");
  assert.equal(m.mem.read8(0x8d54), 0x00, "0x8d54 zeroed");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_6c18 MUTATION: `res 2,(hl)` mis-charged 7T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6c37 ? 7 : cycles);
  setup(m);

  loc_6c18(m);

  assert.equal(m.tstates, 321, "mutation loses 8 T (15 -> 7)");
  assert.throws(() => assert.equal(m.tstates, 329, "golden T"), /329/, "the 329-T golden must fail");
});
