// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_02ce (ROM 0x02ce, Pooyan) -- draws a row of B
 * tiles via `rst 0x10` (loc_0010 fill), advances the pointer at (0x880b) by adding
 * DE=0x20-B, and decrements the counter at (0x8809). Self-contained mock (real Regs,
 * flat 64K RAM); the mock's `call` pops the pushed return to model loc_0010's `ret`,
 * so HL is left inert across the fill and add hl,de operates on the loaded pointer.
 *
 * Pins one path: B=0x1d -> E=0x03, (0x880b)=0x8500 -> 0x8503, (0x8809) 0x05 -> 0x04,
 * one call to 0x0010, T = 114, full pcSeq.
 * TEETH: mis-charge `ld hl,(0x880b)` as 13 T (the `ld a,(nn)` timing) not 16.
 *
 * Run: node --test games/pooyan/translated/test/loc_02ce.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_02ce } from "../loc_02ce.js";

const CALLER_RET = 0xabcd;
const F_N = 0x02, F_C = 0x01, F_Z = 0x40;

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x02ce, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write16(regs.sp, v); },
    pop16() { const v = mem.read16(regs.sp); regs.sp = (regs.sp + 2) & 0xffff; return v; },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

const EXPECTED_PC_SEQ = [
  0x02d0, 0x02d1, 0x02d2, 0x02d4, 0x02d7, 0x02d9,
  0x0010, // rst 0x10
  0x02db, 0x02de, 0x02e1, 0x02e2,
  CALLER_RET,
];

function setup(m) {
  seatCaller(m);
  m.regs.b = 0x1d;              // caller-supplied count (as loc_02c9 sets it)
  m.mem.write16(0x880b, 0x8500); // current draw pointer
  m.mem.write8(0x8809, 0x05);    // rows-remaining counter
}

test("loc_02ce: E=0x20-B, pointer +DE, counter dec, one rst 0x10, ret", () => {
  const m = makeMachine();
  setup(m);
  loc_02ce(m);

  assert.equal(m.regs.a, 0x10, "A = fill value 0x10 at end");
  assert.equal(m.regs.e, 0x03, "E = 0x20 - 0x1d = 0x03");
  assert.equal(m.regs.d, 0x00, "D = 0");
  assert.equal(m.regs.hl, 0x8809, "HL = counter address (last load)");
  assert.equal(m.mem.read16(0x880b), 0x8503, "(0x880b) = 0x8500 + DE(0x03)");
  assert.equal(m.mem.read8(0x8809), 0x04, "(0x8809) decremented 0x05 -> 0x04");
  assert.equal(m.regs.f & F_N, F_N, "dec (hl) leaves N set");
  assert.equal(m.regs.f & F_Z, 0, "counter 0x04 != 0 -> Z clear");
  assert.equal(m.tstates, 114, "T = 7+4+4+7+16+7+11+11+16+10+11+10");
  assert.equal(m.pc, CALLER_RET, "ret popped the seated caller address");
  assert.deepEqual(m.calls, [0x0010], "one rst 0x10 -> loc_0010");
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ, "step boundaries match the disasm");
});

test("loc_02ce: sub b sets no-borrow (A=0x20 >= B) -> C clear", () => {
  const m = makeMachine();
  setup(m);
  loc_02ce(m);
  // C reflects the LAST carry-touching op; dec(hl) preserves carry, so it is the
  // sub b result: 0x20 - 0x1d had no borrow.
  assert.equal(m.regs.f & F_C, 0, "sub b: 0x20 - 0x1d, no borrow -> C clear");
});

test("loc_02ce MUTATION: `ld hl,(0x880b)` mis-charged 13T (not 16) is caught", () => {
  const m = makeMachine();
  setup(m);
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) =>
    realStep(nextAddr, nextAddr === 0x02d7 ? 13 : cycles);
  loc_02ce(m);

  assert.equal(m.tstates, 111, "mutation loses 3 T (16 -> 13)");
  assert.throws(
    () => assert.equal(m.tstates, 114, "T = 7+4+4+7+16+7+11+11+16+10+11+10"),
    /16\+7\+11/,
    "the T-state golden must fail on the mutant",
  );
});
