// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_12d0 (ROM 0x12d0, Pooyan) -- table lookup + object-field dispatch.
 * Index (0x8907 & 0x1f) >> 2 picks a word from table 0x12fb via loc_0c45 (-> DE), ex de,hl; rst 0x20
 * keyed by (0x8d41 & 0x0f) fetches a byte into A -> C; then compares object field (ix+0x06):
 *   equal    -> tail jp 0x1383
 *   < 0x14   -> ret c
 *   else     -> (ix+0x08)=1, DE=0x3838, tail jp 0x381e
 *
 * The mock's `call` POPS the pushed return (so a missing push16 desyncs SP), and models the two real
 * callees: loc_0c45 (A=idx,HL=base -> DE=mem16[base+2*idx], HL=base+2*idx+1, A=idx*2) and the rst-0x20
 * helper loc_0020 (HL += A, A = (HL)). loc_1383/loc_381e are tail targets -> just the pop.
 *
 * Paths: Z (tail 0x1383, T=135), RETC (ret c, T=153), FALL (tail 0x381e, T=186).
 * TEETH: mis-charge `ld a,(ix+0x06)` (19 T) as 7 T -> the 135-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_12d0.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_12d0 } from "../loc_12d0.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x12d0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // The callee's `ret` pops the return address loc_12d0 pushed at the call site -- model that pop so
    // the stack stays balanced (a missing push16 then desyncs SP and fails the test). loc_0c45/loc_0020
    // additionally have net register effects the caller reads; loc_1383/loc_381e are tail jps (pop only).
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x0c45) {
        const base = regs.hl, idx = regs.a;
        const p = (base + 2 * idx) & 0xffff;
        regs.e = mem.read8(p);
        regs.d = mem.read8((p + 1) & 0xffff);
        regs.hl = (p + 1) & 0xffff;
        regs.a = (idx * 2) & 0xff;
      } else if (addr === 0x0020) {
        regs.hl = (regs.hl + regs.a) & 0xffff;
        regs.a = mem.read8(regs.hl);
      }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// Shared prefix: idx = (0x8907 & 0x1f) >> 2 = 0; table[0]=0x4000; rst-0x20 offset (0x8d41 & 0x0f)=5;
// mem[0x4000+5] = 0x07 -> C = 0x07. IX = 0x8b00.
function setupCommon(m) {
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8907, 0x00);   // idx = 0
  m.mem.write8(0x12fb, 0x00);   // table[0] LE = 0x4000
  m.mem.write8(0x12fc, 0x40);
  m.mem.write8(0x8d41, 0x05);   // rst-0x20 offset = 5
  m.mem.write8(0x4005, 0x07);   // fetched target byte -> C
}

const PC_PREFIX = [
  0x12d3, 0x12d6, 0x12d8, 0x12da, 0x12dc,
  0x0c45,                      // call 0x0c45 -> target
  0x12e0, 0x12e3, 0x12e5,
  0x0020,                      // rst 0x20 -> target
  0x12e7, 0x12ea, 0x12eb,
];

test("loc_12d0 Path Z: field (ix+6) == fetched byte -> tail jp 0x1383", () => {
  const m = makeMachine();
  setupCommon(m);
  m.mem.write8(0x8b06, 0x07); // (ix+6) == C -> cp c sets Z

  loc_12d0(m);

  assert.equal(m.tstates, 135, "Path Z T-state total");
  assert.deepEqual(m.pcSeq, [...PC_PREFIX, 0x1383]);
  assert.equal(m.pc, 0x1383, "tail jp lands on 0x1383");
  assert.deepEqual(m.calls, [0x0c45, 0x0020, 0x1383]);
  assert.equal(m.regs.c, 0x07, "C = fetched target byte");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline (tail callee ret pops CALLER_RET)");
});

test("loc_12d0 Path RETC: field (ix+6) != byte and < 0x14 -> ret c", () => {
  const m = makeMachine();
  setupCommon(m);
  m.mem.write8(0x8b06, 0x10); // != 0x07 (not Z) and < 0x14 (cp 0x14 sets carry)

  loc_12d0(m);

  assert.equal(m.tstates, 153, "Path RETC T-state total");
  assert.deepEqual(m.pcSeq, [...PC_PREFIX, 0x12ee, 0x12f0, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret c to seated caller");
  assert.deepEqual(m.calls, [0x0c45, 0x0020]);
  assert.equal(m.mem.read8(0x8b08), 0x00, "(ix+8) untouched on the ret path");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_12d0 Path FALL: field (ix+6) != byte and >= 0x14 -> set (ix+8)=1, tail jp 0x381e", () => {
  const m = makeMachine();
  setupCommon(m);
  m.mem.write8(0x8b06, 0x20); // != 0x07 (not Z) and >= 0x14 (no carry)

  loc_12d0(m);

  assert.equal(m.tstates, 186, "Path FALL T-state total");
  assert.deepEqual(m.pcSeq, [...PC_PREFIX, 0x12ee, 0x12f0, 0x12f1, 0x12f5, 0x12f8, 0x381e]);
  assert.equal(m.pc, 0x381e, "tail jp lands on 0x381e");
  assert.deepEqual(m.calls, [0x0c45, 0x0020, 0x381e]);
  assert.equal(m.mem.read8(0x8b08), 0x01, "(ix+8) := 1");
  assert.equal(m.regs.de, 0x3838, "DE := 0x3838 for 0x381e");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline (tail callee ret pops CALLER_RET)");
});

test("loc_12d0 MUTATION: `ld a,(ix+0x06)` mis-charged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x12ea ? 7 : cycles);
  setupCommon(m);
  m.mem.write8(0x8b06, 0x07);

  loc_12d0(m);

  assert.equal(m.tstates, 123, "mutation loses 12 T (19 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 135, "Path Z T-state total"),
    /135/,
    "the 135-T golden must fail on the mutant",
  );
});
