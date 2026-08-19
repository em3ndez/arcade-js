// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_0028 (ROM 0x0028-0x0032): the rst 0x28 dispatch trampoline.
// The caller pushes a handler-return, then the rst pushes the inline table base (top of stack);
// loc_0028 pops the base, reads word table[A], and tail-dispatches (`jp (hl)`) to the handler --
// which later ret's to the handler-return still seated below. m.call is record-only (tail dispatch,
// no balance). Run: node --test games/pooyan/translated/test/loc_0028.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0028 } from "../loc_0028.js";

const HANDLER_RET = 0xbbbb;

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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

// Seat the stack exactly as the rst arrives: handler-return below, inline table base on top.
function seatDispatch(m, tableBase) {
  m.regs.sp = 0x8780;
  m.push16(HANDLER_RET);
  m.push16(tableBase);
}

test("loc_0028: A=1 selects table[1] and tail-dispatches to it; 64 T", () => {
  const m = makeMachine();
  seatDispatch(m, 0x0c56);
  m.regs.a = 0x01;
  m.mem.write16(0x0c58, 0xdead); // table[1] word at base + 2*1

  loc_0028(m);

  assert.equal(m.tstates, 64, "loc_0028 T-state total (4+10+4+7+11+7+6+7+4+4)");
  assert.equal(m.pc, 0xdead, "jp (hl) landed on the selected handler");
  assert.deepEqual(m.calls, [0xdead], "tail-dispatched to table[1]");
  assert.equal(m.regs.a, 0x02, "A doubled to the byte index");
  assert.equal(m.regs.hl, 0xdead, "HL = handler address (ex de,hl)");
  assert.equal(m.regs.sp, 0x877e, "table base popped; handler-return still seated");
  assert.equal(m.mem.read16(0x877e), HANDLER_RET, "handler ret target preserved on stack");
  assert.deepEqual(m.pcSeq,
    [0x0029, 0x002a, 0x002b, 0x002d, 0x002e, 0x002f, 0x0030, 0x0031, 0x0032, 0xdead],
    "step boundaries (0x002b -> 0x002d spans the 2-byte ld d,0)");
});

test("loc_0028: A=0 selects table[0]", () => {
  const m = makeMachine();
  seatDispatch(m, 0x08a1);
  m.regs.a = 0x00;
  m.mem.write16(0x08a1, 0x08b3); // pooyan attract table[0] = loc_08b3

  loc_0028(m);

  assert.equal(m.regs.hl, 0x08b3, "index 0 reads the base word");
  assert.deepEqual(m.calls, [0x08b3], "dispatched to loc_08b3");
});

test("loc_0028 MUTATION: `add hl,de` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  seatDispatch(m, 0x0c56);
  m.regs.a = 0x01;
  m.mem.write16(0x0c58, 0xdead);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x002e ? 7 : c); // add hl,de landing under-charged
  loc_0028(m);
  assert.equal(m.tstates, 60, "mutation loses 4 T (11 -> 7)");
  assert.notEqual(m.tstates, 64, "golden T-state total catches the mutant");
});
