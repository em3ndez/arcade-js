// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_7421 (ROM 0x7421-0x7441): bonus phase 2 (teardown). Pins the (0x8f36)-hold
// tick path and the expiry teardown (two rst 0x10 clears + state handoff (0x8e51)=7).
//
// Run: node --test games/pooyan/translated/test/loc_7421.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7421 } from "../loc_7421.js";

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

test("loc_7421 hold: (0x8f36)!=0 -> dec, ret; 49 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f36, 0x05);

  loc_7421(m);

  assert.equal(m.tstates, 10 + 7 + 4 + 7 + 11 + 10, "49 T");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
  assert.equal(m.mem.read8(0x8f36), 0x04, "hold ticked");
  assert.deepEqual(m.pcSeq, [0x7424, 0x7425, 0x7426, 0x7428, 0x7429, CALLER_RET], "boundaries");
});

test("loc_7421 expiry: two rst 0x10 clears, (0x8e51)=7 handoff; 165 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f36, 0x00);

  loc_7421(m);

  assert.equal(m.tstates,
    10 + 7 + 4 + 12 + 10 + 7 + 11 + 10 + 10 + 7 + 11 + 10 + 13 + 13 + 7 + 13 + 10, "165 T");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
  assert.equal(m.mem.read8(0x880a), 0x00, "(0x880a) cleared");
  assert.equal(m.mem.read8(0x8e51), 0x07, "attract-state selector handed off");
  assert.deepEqual(m.calls, [0x0010, 0x0010], "two rst-0x10 clears");
  assert.deepEqual(m.pcSeq,
    [0x7424, 0x7425, 0x7426, 0x742a, 0x742d, 0x742f, 0x0010, 0x7430, 0x7433, 0x7435, 0x0010, 0x7436,
     0x7439, 0x743c, 0x743e, 0x7441, CALLER_RET], "boundaries");
});

test("loc_7421 MUTATION: ld (0x8e51),a at 0x743e mischarged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f36, 0x00);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x7441 ? 7 : c);
  loc_7421(m);
  assert.notEqual(m.tstates, 165, "golden 165 T catches the mischarge");
});
