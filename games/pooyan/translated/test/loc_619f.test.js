// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_619f (ROM 0x619f, Pooyan) -- initialize a fresh 0x18-byte actor
 * record at (HL): (+0)=0x00, (+1)=0x01, (+2)=0x08, (+0x12)=0xff, DE stored at (+0x16)/(+0x17).
 * Pure straight-line leaf, no calls -- single path. The mock `call` still pops (unused here).
 * TEETH: mis-charge `add hl,bc` (11 T) as 7 T -> the 121-T golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_619f.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_619f } from "../loc_619f.js";

const CALLER_RET = 0xabcd;
const BASE = 0x8b00;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x619f, pcSeq: [],
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

const PC = [
  0x61a1, 0x61a2, 0x61a4, 0x61a5, 0x61a7, 0x61aa, 0x61ab, 0x61ad, 0x61af, 0x61b0, 0x61b1, 0x61b2, 0x61b3,
  CALLER_RET,
];

test("loc_619f: writes the record fields and stores DE, returns to caller", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = BASE;
  m.regs.de = 0xddee; // d=0xdd, e=0xee

  loc_619f(m);

  assert.equal(m.tstates, 121, "T-state total");
  assert.deepEqual(m.pcSeq, PC, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller");
  assert.equal(m.regs.hl, (BASE + 0x17) & 0xffff, "HL ends at record offset 0x17");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (ret consumed CALLER_RET)");
  assert.deepEqual(m.calls, [], "leaf -- no calls");
  assert.equal(m.mem.read8(BASE + 0x00), 0x00, "(+0)=0x00");
  assert.equal(m.mem.read8(BASE + 0x01), 0x01, "(+1)=0x01");
  assert.equal(m.mem.read8(BASE + 0x02), 0x08, "(+2)=0x08");
  assert.equal(m.mem.read8(BASE + 0x12), 0xff, "(+0x12)=0xff");
  assert.equal(m.mem.read8(BASE + 0x16), 0xee, "(+0x16)=E");
  assert.equal(m.mem.read8(BASE + 0x17), 0xdd, "(+0x17)=D");
});

test("loc_619f MUTATION: `add hl,bc` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  // the first add hl,bc is the step landing on 0x61ab
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x61ab ? 7 : cycles);
  seatCaller(m);
  m.regs.hl = BASE;
  m.regs.de = 0xddee;

  loc_619f(m);

  assert.equal(m.tstates, 117, "mutation loses 4 T (11 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 121, "T-state total"),
    /121/,
    "the 121-T golden must fail on the mutant",
  );
});
