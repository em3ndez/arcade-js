// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_0020 (ROM 0x0020-0x0027): the rst 0x20 table-index helper (HL += A, A = (HL)).
// Self-contained mock machine (real Regs, flat 64K RAM). Ends in `ret`; the seated caller proves the exit.
// Run: node --test games/pooyan/translated/test/loc_0020.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0020 } from "../loc_0020.js";

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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_0020: HL=0x8900, A=5 -> HL=0x8905, A=(HL); 40 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x05;
  m.regs.hl = 0x8900;
  m.mem.write8(0x8905, 0x42); // table[5]

  loc_0020(m);

  assert.equal(m.tstates, 40, "loc_0020 T-state total (4+4+7+4+4+7+10)");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "leaf: no calls");
  assert.equal(m.regs.hl, 0x8905, "HL = base + index");
  assert.equal(m.regs.a, 0x42, "A = (base + index)");
  assert.deepEqual(m.pcSeq,
    [0x0021, 0x0022, 0x0024, 0x0025, 0x0026, 0x0027, CALLER_RET],
    "step boundaries (0x0022 -> 0x0024 spans the 2-byte ld a,0)");
});

test("loc_0020: low-byte carry bumps H (0x89f0 + 0x20 -> 0x8a10)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x20;
  m.regs.hl = 0x89f0;
  m.mem.write8(0x8a10, 0x7e); // table entry after the 16-bit carry

  loc_0020(m);

  assert.equal(m.regs.hl, 0x8a10, "add a,l set carry, adc a,h propagated it into H");
  assert.equal(m.regs.a, 0x7e, "A = (0x8a10)");
});

test("loc_0020 MUTATION: `ld a,0x00` mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x05;
  m.regs.hl = 0x8900;
  m.mem.write8(0x8905, 0x42);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0024 ? 4 : c); // ld a,0 landing under-charged
  loc_0020(m);
  assert.equal(m.tstates, 37, "mutation loses 3 T (7 -> 4)");
  assert.notEqual(m.tstates, 40, "golden T-state total catches the mutant");
});
