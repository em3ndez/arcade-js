// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_7442 (ROM 0x7442-0x7447): the attract/self-test state dispatcher.
// It always delegates to loc_0028 (record-only m.call); A carries the masked selector and the
// inline table base 0x7448 is pushed for loc_0028 to pop.
//
// Run: node --test games/pooyan/translated/test/loc_7442.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7442 } from "../loc_7442.js";

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
    call(addr) { this.calls.push(addr); return undefined; }, // record-only (tail dispatch)
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_7442: masks (0x8921)&3, pushes table base 0x7448, delegates to loc_0028; 31 T", () => {
  const m = makeMachine();
  seatCaller(m);
  const sp0 = m.regs.sp;
  m.mem.write8(0x8921, 0x05); // selector 5 -> &3 = 1

  loc_7442(m);

  assert.equal(m.tstates, 31, "T-state total (13 + 7 + 11)");
  assert.deepEqual(m.calls, [0x0028], "dispatch delegated to loc_0028");
  assert.equal(m.regs.a, 1, "A = selector & 3 (loc_0028 does the *2)");
  assert.equal(m.regs.sp, (sp0 - 2) & 0xffff, "rst 0x28 pushed one word");
  assert.equal(m.mem.read16(m.regs.sp), 0x7448, "pushed value is the inline table base");
  assert.deepEqual(m.pcSeq, [0x7445, 0x7447, 0x0028], "step boundaries");
});

test("loc_7442 MUTATION: `and 0x03` dropped (selector not masked) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8921, 0x05);
  // A faithful routine masks to 1; a mutant that forgot the mask leaves A = 5.
  loc_7442(m);
  assert.equal(m.regs.a, 1, "masked selector, not the raw 5");
  assert.notEqual(m.regs.a, 5, "an unmasked selector would index past the 3-entry table");
});
