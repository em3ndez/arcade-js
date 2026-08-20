// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_20d4 (ROM 0x20d4, Pooyan) -- the update gate + fixed helper chain.
 * (0x8f50) set probes the 0x8df8/0x8df9 pair (else falls back to (0x8d32)); the selected byte non-zero
 * tail-jumps to loc_241e. Otherwise IX=0x8a80 and loc_2329/2101/2563/25a6/308b run in order, then ret.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`), so a
 * missing push16 at any of the five call sites desyncs SP and the final ret misses CALLER_RET.
 *
 * Path RUN (0x8f50==0, (0x8d32)==0 -> chain of five calls + ret): full pcSeq + T=169, ends via ret to
 * the seated caller with SP unwound. Path BR (0x8f50!=0, 0x8df8&0x8df9!=0 -> tail jp 0x241e): the tail
 * call's callee ret consumes CALLER_RET, so SP returns to the PRE-SEAT baseline. Path LB exercises the
 * `ld l,b` restore (jr nz not taken) into the shared 0x20e8 block. TEETH: mis-charge `ld ix` (14->10).
 *
 * Run: node --test games/pooyan/translated/test/loc_20d4.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_20d4 } from "../loc_20d4.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x20d4, pcSeq: [],
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
    // The callee's `ret` pops the return address loc_20d4 pushed at the call site -- model that pop.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const PC_RUN = [
  0x20d7, 0x20da, 0x20db, 0x20e8, 0x20e9, 0x20ea, 0x20ed, 0x20f1, // gate open -> IX
  0x2329, 0x2101, 0x2563, 0x25a6, 0x308b, // five call targets
  CALLER_RET,
];

test("loc_20d4 Path RUN: 0x8f50==0, (0x8d32)==0 -> five-call chain + ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f50, 0x00); // jr z -> 0x20e8
  m.mem.write8(0x8d32, 0x00); // and a -> Z -> jp nz not taken

  loc_20d4(m);

  assert.equal(m.tstates, 169, "Path RUN T-state total");
  assert.deepEqual(m.pcSeq, PC_RUN, "step boundaries match the ROM bytes");
  assert.deepEqual(m.calls, [0x2329, 0x2101, 0x2563, 0x25a6, 0x308b], "the five helpers in ROM order");
  assert.equal(m.regs.ix, 0x8a80, "IX seeded");
  assert.equal(m.pc, CALLER_RET, "ret at 0x2100 to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (all five push16 matched a callee ret)");
});

test("loc_20d4 Path BR: 0x8f50!=0, 0x8df8&0x8df9!=0 -> tail jp 0x241e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f50, 0x01); // jr z not taken
  m.mem.write8(0x8df8, 0xff);
  m.mem.write8(0x8df9, 0xff); // and (hl) -> 0xff (NZ) -> jr nz to 0x20ea, jp nz taken

  loc_20d4(m);

  assert.equal(m.tstates, 97, "Path BR T-state total");
  assert.deepEqual(m.pcSeq, [
    0x20d7, 0x20da, 0x20db, 0x20dd, 0x20df, 0x20e0, 0x20e2, 0x20e3, 0x20e4, 0x20e5,
    0x20ea, // jr nz,0x20ea taken (skips ld l,b / ld a,(hl) / and a)
    0x241e, // jp nz,0x241e taken (tail)
  ], "0x8f50!=0 probe, pair non-zero -> tail-jump to loc_241e");
  assert.deepEqual(m.calls, [0x241e], "only the tail helper");
  assert.equal(m.mem.read8(0x8d32), 0x00, "(0x8d32) cleared by ld (hl),0x00");
  assert.equal(m.pc, 0x241e, "tail jp lands on loc_241e");
  // Tail jp reuses the caller frame: loc_241e's ret pops the seated CALLER_RET.
  assert.equal(m.regs.sp, 0x8780, "SP back to the pre-seat baseline (tail call consumed CALLER_RET)");
});

test("loc_20d4 Path LB: 0x8f50!=0, pair masks to 0 -> ld l,b restore -> five-call chain", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f50, 0x01); // jr z not taken
  m.mem.write8(0x8df8, 0x00); // and (hl) -> 0 (Z) -> jr nz not taken -> ld l,b
  m.mem.write8(0x8df9, 0xff);
  // ld (hl),0x00 zeroed 0x8d32 already; ld l,b restores HL=0x8d32 -> ld a,(hl)=0 -> and a Z -> chain

  loc_20d4(m);

  assert.equal(m.tstates, 216, "Path LB T-state total");
  assert.deepEqual(m.pcSeq, [
    0x20d7, 0x20da, 0x20db, 0x20dd, 0x20df, 0x20e0, 0x20e2, 0x20e3, 0x20e4, 0x20e5,
    0x20e7, 0x20e8, 0x20e9, 0x20ea, // jr nz not taken -> ld l,b -> shared 0x20e8 block
    0x20ed, 0x20f1, 0x2329, 0x2101, 0x2563, 0x25a6, 0x308b,
    CALLER_RET,
  ], "ld l,b restores HL then the and a gate opens the five-call chain");
  assert.deepEqual(m.calls, [0x2329, 0x2101, 0x2563, 0x25a6, 0x308b]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound");
});

test("loc_20d4 MUTATION: `ld ix,0x8a80` mis-charged 10T (not 14T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x20f1 ? 10 : cycles);
  seatCaller(m);
  m.mem.write8(0x8f50, 0x00);
  m.mem.write8(0x8d32, 0x00);

  loc_20d4(m);

  assert.equal(m.tstates, 165, "mutation loses 4 T (14 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 169, "Path RUN T-state total"),
    /169/,
    "the 169-T golden must fail on the mutant",
  );
});
