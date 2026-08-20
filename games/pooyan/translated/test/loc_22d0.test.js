// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_22d0 (ROM 0x22d0-0x22e5, Pooyan): a 2-entry bit-0 tally over the object
// table at 0x8c90 (stride 0x18). For each entry `bit 0,(iy+0)` (Z=!bit0) gates an `rlca` of A (seeded 0);
// A is returned. Leaf, no calls -- the mock's `call` still POPS (template invariant) though it never fires.
// The `bit 0,(iy+0x00)` indexed form costs 20 T (not 12); the mutation tooth mis-charges it to 12.
// Run: node --test games/pooyan/translated/test/loc_22d0.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_22d0 } from "../loc_22d0.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x22d0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // POPS the return address a call site pushed (models the callee's `ret`); a missing push16 then desyncs.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_22d0 MIXED: entry0 bit0 set, entry1 bit0 clear -> both jr-z branches; 159 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8c90, 0x01); // entry 0: bit0 set   -> jr z not taken, rlca
  m.mem.write8(0x8ca8, 0x00); // entry 1: bit0 clear -> jr z taken, skip rlca

  loc_22d0(m);

  assert.equal(m.tstates, 159, "MIXED T-state total");
  assert.deepEqual(m.pcSeq, [
    0x22d4, 0x22d7, 0x22d9, 0x22da,
    0x22de, 0x22e0, 0x22e1, 0x22e3, 0x22da, // entry0: bit set -> rlca
    0x22de, 0x22e1, 0x22e3, 0x22e5,         // entry1: bit clear -> skip rlca -> djnz falls out
    CALLER_RET,
  ], "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller");
  assert.equal(m.regs.a, 0x00, "A = rlca of 0 = 0");
  assert.equal(m.regs.iy, 0x8cc0, "iy advanced by 2*0x18");
  assert.equal(m.regs.b, 0x00, "djnz drained B");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_22d0 BOTH-SET: both entries bit0 set -> rlca twice; 158 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8c90, 0x01);
  m.mem.write8(0x8ca8, 0x01);

  loc_22d0(m);

  assert.equal(m.tstates, 158, "BOTH-SET T-state total");
  assert.deepEqual(m.pcSeq, [
    0x22d4, 0x22d7, 0x22d9, 0x22da,
    0x22de, 0x22e0, 0x22e1, 0x22e3, 0x22da,
    0x22de, 0x22e0, 0x22e1, 0x22e3, 0x22e5,
    CALLER_RET,
  ]);
  assert.equal(m.regs.a, 0x00, "rlca of 0 stays 0");
  assert.equal(m.regs.iy, 0x8cc0);
});

test("loc_22d0 MUTATION: `bit 0,(iy+0)` mis-charged 12T (not 20T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x22de ? 12 : cycles);
  seatCaller(m);
  m.mem.write8(0x8c90, 0x01);
  m.mem.write8(0x8ca8, 0x00);

  loc_22d0(m);

  assert.equal(m.tstates, 143, "mutation loses 8 T per bit (2x) = 16");
  assert.throws(
    () => assert.equal(m.tstates, 159, "MIXED T-state total"),
    /159/,
    "the 159-T golden must fail on the mutant",
  );
});
