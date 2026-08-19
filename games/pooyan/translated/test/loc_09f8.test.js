// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_09f8 (ROM 0x09f8-0x0a0b): four-record timer sweep + display-list call.
// Flat-RAM mock (real Regs). 0x4006 and 0x02ef are plain-ret, so every call is pattern-A: the stub
// runs m.ret() to pop the pushed return (a record-only stub would hide a stack/pattern-B bug).
//
// Run: node --test games/pooyan/translated/test/loc_09f8.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_09f8 } from "../loc_09f8.js";

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
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // plain-ret callees: pop the pattern-A return so the loop's stack is exercised for real.
    call(addr) { this.calls.push(addr); this.ret(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_09f8: 4-pass sweep, IX += 0x60, then 0x02ef; 283 T", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_09f8(m);

  assert.equal(m.tstates, 283, "full four-iteration T-state total");
  assert.equal(m.pc, CALLER_RET, "returns to caller via final ret");
  assert.equal(m.regs.ix, 0x8bd0, "IX advanced by 4 * 0x18 (0x8b70 -> 0x8bd0)");
  assert.equal(m.regs.b, 0x00, "loop counter drained");
  assert.equal(m.regs.de, 0x0018, "DE (record stride) unchanged");
  assert.equal(m.regs.sp, 0x8780, "stack balanced (5 pattern-A calls + final ret)");
  assert.deepEqual(m.calls, [0x4006, 0x4006, 0x4006, 0x4006, 0x02ef], "four handler calls then the builder");
  assert.deepEqual(m.pcSeq,
    [0x09fc, 0x09fe, 0x0a01,
     0x4006, 0x0a04, 0x0a06, 0x0a01,
     0x4006, 0x0a04, 0x0a06, 0x0a01,
     0x4006, 0x0a04, 0x0a06, 0x0a01,
     0x4006, 0x0a04, 0x0a06, 0x0a08,
     0x02ef, 0x0a0b, CALLER_RET],
    "boundary trace: 4 loop passes (djnz to 0x0a01) then fall out to 0x0a08");
});

test("loc_09f8 MUTATION: add ix,de mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0a06 ? 11 : c); // ADD IX,DE = 15T, not 11
  loc_09f8(m);
  assert.equal(m.tstates, 267, "mutation drops 4 T on each of 4 passes");
  assert.notEqual(m.tstates, 283, "golden total catches the mis-charged ADD IX,DE");
});
