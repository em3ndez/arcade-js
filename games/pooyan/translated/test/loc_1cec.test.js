// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_1cec (ROM 0x1cec-0x1cf5): HL (caller-supplied) minus 0x20 twice,
// writing tiles 0x25 then 0x20, then ret. Flat-RAM mock, real Regs. HL is an input register.
//
// Run: node --test games/pooyan/translated/test/loc_1cec.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1cec } from "../loc_1cec.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// HL=0x84e0: 0x84e0-0x20=0x84c0 gets 0x25; 0x84c0-0x20=0x84a0 gets 0x20.
test("loc_1cec: HL=0x84e0 -> (0x84c0)=0x25,(0x84a0)=0x20, ret; 62 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x84e0;

  loc_1cec(m);

  assert.equal(m.tstates, 62, "T total (10+11+10+11+10+10)");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.regs.de, 0xffe0, "DE = -0x20");
  assert.equal(m.regs.hl, 0x84a0, "HL walked back two rows");
  assert.equal(m.mem.read8(0x84c0), 0x25, "tile 0x25 one row up");
  assert.equal(m.mem.read8(0x84a0), 0x20, "tile 0x20 two rows up");
  assert.equal(m.regs.sp, 0x8780, "stack popped by ret back to seated SP");
  assert.deepEqual(m.pcSeq, [0x1cef, 0x1cf0, 0x1cf2, 0x1cf3, 0x1cf5, CALLER_RET], "boundaries");
});

// HL=0x8740 entry (via jr 0x1cec from loc_1d0d): 0x8720 then 0x8700.
test("loc_1cec: HL=0x8740 entry writes at 0x8720/0x8700", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8740;

  loc_1cec(m);

  assert.equal(m.mem.read8(0x8720), 0x25, "tile 0x25 at 0x8720");
  assert.equal(m.mem.read8(0x8700), 0x20, "tile 0x20 at 0x8700");
  assert.equal(m.regs.hl, 0x8700, "HL final");
});

test("loc_1cec MUTATION: add hl,de mis-charged 6T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x84e0;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1cf0 ? 6 : c);

  loc_1cec(m);

  assert.equal(m.tstates, 57, "mutation loses 5 T (11 -> 6)");
  assert.notEqual(m.tstates, 62, "golden T-state total catches the mutant");
});
