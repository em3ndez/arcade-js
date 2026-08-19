// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_7395 (ROM 0x7395-0x73cd): eagle-record state 1 (dive). Pins the even-record
// descend path where the row stays below 0x1d (ret c, no state advance). loc_4006 is a plain-ret callee.
//
// Run: node --test games/pooyan/translated/test/loc_7395.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7395 } from "../loc_7395.js";

const CALLER_RET = 0xabcd;

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
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(addr) { this.calls.push(addr); this.ret(); return undefined; },
  };
}
function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_7395 even record descend, row < 0x1d -> ret c; 156 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00; // bit3 of IXL clear -> even
  m.mem.write8(0x8b03, 0x00); // sub-pixel
  m.mem.write8(0x8b09, 0x01); // speed -> 0+1 = 1, no carry into row
  m.mem.write8(0x8b04, 0x00); // row 0 < 0x1d

  loc_7395(m);

  assert.equal(m.tstates, 17 + 10 + 8 + 8 + 7 + 19 + 19 + 19 + 12 + 19 + 7 + 11, "156 T");
  assert.equal(m.pc, CALLER_RET, "ret c returns to caller");
  assert.equal(m.mem.read8(0x8b03), 0x01, "(ix+3) integrated by the speed");
  assert.deepEqual(m.calls, [0x4006], "generic mover ran");
  assert.deepEqual(m.pcSeq,
    [0x4006, 0x7398, 0x739a, 0x739c, 0x739e, 0x73a1, 0x73a4, 0x73a7, 0x73ac, 0x73af, 0x73b1, CALLER_RET],
    "boundaries");
});

test("loc_7395 MUTATION: ld (ix+3),a at 0x73a4 mischarged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8b09, 0x01);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x73a7 ? 7 : c);
  loc_7395(m);
  assert.notEqual(m.tstates, 156, "golden 156 T catches the mischarge");
});
