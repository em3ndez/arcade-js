// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_72cf (ROM 0x72cf-0x72da): per eagle-record dispatch. Two paths: an active
// record tail-dispatches through rst 0x28 (record-only call), an inactive record returns early.
//
// Run: node --test games/pooyan/translated/test/loc_72cf.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_72cf } from "../loc_72cf.js";

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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}
function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_72cf active record: rst 0x28 dispatch on (ix+2); 77 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8b00, 0x01); // active (low bit set)
  m.mem.write8(0x8b01, 0x00);
  m.mem.write8(0x8b02, 0x00); // state 0

  loc_72cf(m);

  assert.equal(m.tstates, 19 + 19 + 4 + 5 + 19 + 11, "77 T");
  assert.equal(m.pc, 0x0028, "tail into rst-0x28 trampoline");
  assert.deepEqual(m.calls, [0x0028], "delegates to loc_0028");
  assert.equal(m.mem.read16(0x877c), 0x72db, "pushed inline table base 0x72db");
  assert.deepEqual(m.pcSeq, [0x72d2, 0x72d5, 0x72d6, 0x72d7, 0x72da, 0x0028], "boundaries");
});

test("loc_72cf inactive record: ret nc; 53 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00; // all zero -> low bit clear
  loc_72cf(m);
  assert.equal(m.tstates, 19 + 19 + 4 + 11, "53 T");
  assert.equal(m.pc, CALLER_RET, "ret nc returns to caller");
  assert.deepEqual(m.calls, [], "no dispatch");
  assert.deepEqual(m.pcSeq, [0x72d2, 0x72d5, 0x72d6, CALLER_RET], "boundaries");
});

test("loc_72cf MUTATION: or (ix+1) at 0x72d2 mischarged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8b00, 0x01);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x72d5 ? 7 : c);
  loc_72cf(m);
  assert.notEqual(m.tstates, 77, "golden 77 T catches the mischarge");
});
