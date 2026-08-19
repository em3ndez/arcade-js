// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_7059 (ROM 0x7059-0x705e): the (0x8f47) tick helper. HL points at (0x8f47)
// on entry. rst 0x38 is a plain-ret enqueue, so the stub runs m.ret().
//
// Run: node --test games/pooyan/translated/test/loc_7059.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7059 } from "../loc_7059.js";

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

test("loc_7059: dec (0x8f47), queue sound via rst 0x38, ret; 52 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8f47;
  m.mem.write8(0x8f47, 0x05);

  loc_7059(m);

  assert.equal(m.tstates, 11 + 10 + 11 + 10 + 10, "52 T (dec 11 + ld de 10 + rst 11 + stub ret 10 + ret 10)");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
  assert.equal(m.mem.read8(0x8f47), 0x04, "(0x8f47) decremented");
  assert.equal(m.regs.de, 0x0315, "DE = queued sound command");
  assert.deepEqual(m.calls, [0x0038], "rst 0x38 enqueue");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq, [0x705a, 0x705d, 0x0038, 0x705e, CALLER_RET], "boundaries");
});

test("loc_7059 MUTATION: dec (hl) at 0x7059 mischarged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8f47;
  m.mem.write8(0x8f47, 0x05);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x705a ? 7 : c);
  loc_7059(m);
  assert.notEqual(m.tstates, 52, "golden 52 T catches the mischarge");
});
