// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_0a28 (ROM 0x0a28-0x0a3f): 4-phase animation frame paint. Flat-RAM
// mock, real Regs. loc_0c45 and loc_0a40 are plain-ret -> pattern-A; the stub rets to pop each
// pushed return (a record-only stub would hide the push de / pop de balance around the 0a40 call).
//
// Run: node --test games/pooyan/translated/test/loc_0a28.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0a28 } from "../loc_0a28.js";

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
    call(addr) { this.calls.push(addr); this.ret(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_0a28: bump phase counter, look up frame, two paints via loc_0a40; 154 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8d41;         // as loc_0a25 leaves it
  m.regs.de = 0x1234;         // stand-in source pointer (loc_0c45 stubbed)
  m.mem.write8(0x8d40, 0x05); // old phase counter

  loc_0a28(m);

  assert.equal(m.tstates, 154, "full-path T-state total");
  assert.equal(m.pc, CALLER_RET, "chain returns to caller after the tail paint");
  assert.equal(m.regs.a, 0x01, "A = old-counter(0x05) & 3 -- read BEFORE the inc(hl)");
  assert.equal(m.mem.read8(0x8d40), 0x06, "phase counter incremented (RMW)");
  assert.equal(m.mem.read8(0x8d41), 0x0a, "0x8d41 seeded to 0x0a");
  assert.equal(m.regs.de, 0x1234, "DE restored by pop de for the second paint");
  assert.equal(m.regs.hl, 0x86aa, "HL = second paint target (0x86aa)");
  assert.equal(m.regs.sp, 0x8780, "stack balanced (2 pattern-A calls + push/pop de + tail)");
  assert.deepEqual(m.calls, [0x0c45, 0x0a40, 0x0a40], "lookup then two paints");
  assert.deepEqual(m.pcSeq,
    [0x0a2a, 0x0a2b, 0x0a2c, 0x0a2d, 0x0a2f, 0x0a32,
     0x0c45, 0x0a35, 0x0a36, 0x0a39,
     0x0a40, 0x0a3c, 0x0a3d, 0x0a40,
     CALLER_RET],
    "boundary trace incl. both pattern-A rets and the tail hand-off");
});

test("loc_0a28 MUTATION: inc (hl) mis-charged 6T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8d41; m.regs.de = 0x1234; m.mem.write8(0x8d40, 0x05);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0a2d ? 6 : c); // INC (HL) = 11T
  loc_0a28(m);
  assert.equal(m.tstates, 149, "mutation drops 5 T");
  assert.notEqual(m.tstates, 154, "golden total catches the mis-charged INC (HL)");
});
