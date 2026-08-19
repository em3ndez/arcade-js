// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_780f (ROM 0x780f-0x7820): the 2x2 tile-block writer. Self-contained mock
// machine (real Regs for exact flags, flat 64K RAM). The single exit is `ret`, so the seated caller
// return proves the exit and the final PC. Run: node --test games/pooyan/translated/test/loc_780f.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_780f } from "../loc_780f.js";

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

test("loc_780f: writes the 2x2 block, DE+=4, HL=start-0x20; 117 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8500;
  m.regs.de = 0x9100;
  m.mem.write8(0x9100, 0x11);
  m.mem.write8(0x9101, 0x22);
  m.mem.write8(0x9102, 0x33);
  m.mem.write8(0x9103, 0x44);

  loc_780f(m);

  assert.equal(m.tstates, 117, "loc_780f T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "leaf: no calls");
  assert.equal(m.mem.read8(0x8500), 0x11, "(HL)   = src0");
  assert.equal(m.mem.read8(0x8501), 0x22, "(HL+1) = src1");
  assert.equal(m.mem.read8(0x84e1), 0x33, "(HL-0x1f) = src2 (row above)");
  assert.equal(m.mem.read8(0x84e0), 0x44, "(HL-0x20) = src3 (row above)");
  assert.equal(m.regs.de, 0x9103, "DE advanced by 3 (4 reads, 3 inc de)");
  assert.equal(m.regs.hl, 0x84e0, "HL = start - 0x20");
  assert.equal(m.regs.bc, 0xffe0, "BC = up-one-row step");
  assert.deepEqual(m.pcSeq,
    [0x7812, 0x7813, 0x7814, 0x7815, 0x7816, 0x7817, 0x7818, 0x7819,
     0x781a, 0x781b, 0x781c, 0x781d, 0x781e, 0x781f, 0x7820, CALLER_RET],
    "step boundaries");
});

test("loc_780f MUTATION: `add hl,bc` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8500;
  m.regs.de = 0x9100;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x781a ? 7 : c);
  loc_780f(m);
  assert.equal(m.tstates, 113, "mutation loses 4 T (11 -> 7)");
  assert.notEqual(m.tstates, 117, "golden T-state total catches the mutant");
});
