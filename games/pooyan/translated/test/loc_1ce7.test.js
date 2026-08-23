// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_1ce7 (ROM 0x1ce7-0x1cf5): sprite-slot tail -- store 0x02/0x25/0x20
// down 0x84e0/0x84c0/0x84a0 (stride -0x20) with the tail INLINED, then ret. Flat-RAM mock, real
// Regs; a caller return is seated so the ret lands somewhere.
//
// Run: node --test games/pooyan/translated/test/loc_1ce7.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1ce7 } from "../loc_1ce7.js";

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
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(a) { this.calls.push(a); return undefined; },
  };
}
function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_1ce7: 0x02/0x25/0x20 down 0x84e0/0x84c0/0x84a0, ret; 82 T", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_1ce7(m);

  assert.equal(m.tstates, 82, "inlined tail + ret T-state total");
  assert.equal(m.mem.read8(0x84e0), 0x02, "(0x84e0)=0x02");
  assert.equal(m.mem.read8(0x84c0), 0x25, "(0x84c0)=0x25");
  assert.equal(m.mem.read8(0x84a0), 0x20, "(0x84a0)=0x20");
  assert.equal(m.regs.hl, 0x84a0, "HL walked -0x20 twice to 0x84a0");
  assert.deepEqual(m.calls, [], "tail is inlined -- no delegate call");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.regs.sp, 0x8780, "ret pops the seated caller return");
  assert.deepEqual(m.pcSeq, [0x1cea, 0x1cec, 0x1cef, 0x1cf0, 0x1cf2, 0x1cf3, 0x1cf5, CALLER_RET], "boundaries");
});

test("loc_1ce7 MUTATION: `ld (hl),0x02` (0x1cec) mis-charged 4T (not 10T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1cec ? 4 : c);

  loc_1ce7(m);

  assert.equal(m.tstates, 76, "mutation loses 6 T (10 -> 4)");
  assert.notEqual(m.tstates, 82, "golden T-state total catches the mutant");
});
