// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_733c (ROM 0x733c-0x7394): eagle-record state 0 (approach). Pins the
// column-mismatch early return.
//
// Run: node --test games/pooyan/translated/test/loc_733c.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_733c } from "../loc_733c.js";

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

test("loc_733c column mismatch: ret nz; 97 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8c96, 0x00); // grid column = 0
  m.mem.write8(0x8b06, 0x05); // (ix+6) != 0 and != 1 -> no match

  loc_733c(m);

  assert.equal(m.tstates, 13 + 8 + 8 + 8 + 19 + 7 + 4 + 19 + 11, "97 T");
  assert.equal(m.pc, CALLER_RET, "ret nz returns to caller");
  assert.deepEqual(m.calls, [], "no state advance");
  assert.deepEqual(m.pcSeq, [0x733f, 0x7341, 0x7343, 0x7345, 0x7348, 0x734a, 0x734b, 0x734e, CALLER_RET], "boundaries");
});

test("loc_733c MUTATION: cp (ix+6) at 0x734b mischarged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8b06, 0x05);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x734e ? 7 : c);
  loc_733c(m);
  assert.notEqual(m.tstates, 97, "golden 97 T catches the mischarge");
});
