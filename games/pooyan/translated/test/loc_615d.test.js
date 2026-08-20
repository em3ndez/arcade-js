// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_615d (ROM 0x615d, Pooyan) -- scan loop body / djnz self-loop head.
 * Compares A with (ix+0x14): a match tail-jumps loc_6190 (boundary); otherwise IX += DE and djnz
 * loops back to 0x615d, falling to boundary 0x6166 when B reaches 0.
 *
 * No real CALL -- every exit is a tail-jump (m.call, no push16), including the djnz self-loop back to
 * 0x615d (re-entering the routine head with B already decremented). The mock's `call` POPS the seated
 * CALLER_RET, so SP unwinds to the pre-seat baseline 0x8780 on every path.
 *
 * Paths: MATCH (A == (ix+0x14) -> 0x6190, T=31); LOOP (miss, B>1, djnz -> 0x615d, T=54); FALLOUT
 * (miss, B==1, djnz falls out -> 0x6166, T=49). TOOTH: mis-charge `add ix,de` (15 T) as 11 T on the
 * LOOP path -> the 54-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_615d.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_615d } from "../loc_615d.js";

const CALLER_RET = 0xabcd;
const IX = 0x8b70;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x615d, pcSeq: [],
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
    // Tail-jump chain (incl. the djnz self-loop) rets to loc_615d's caller -- one net pop of CALLER_RET.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.ix = IX;
  m.regs.de = 0x0018;
}

test("loc_615d Path MATCH: A == (ix+0x14) -> tail-jump boundary 0x6190", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x05;
  m.regs.b = 0x06;
  m.mem.write8(IX + 0x14, 0x05); // match -> jr z taken

  loc_615d(m);

  assert.equal(m.tstates, 31, "Path MATCH T-state total");
  assert.deepEqual(m.pcSeq, [0x6160, 0x6190]);
  assert.equal(m.pc, 0x6190);
  assert.deepEqual(m.calls, [0x6190]);
  assert.equal(m.regs.ix, IX, "IX unchanged on an immediate match");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_615d Path LOOP: miss with B>1 -> IX += DE, djnz back to 0x615d", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x05;
  m.regs.b = 0x06;
  m.mem.write8(IX + 0x14, 0x99); // miss -> jr z not taken

  loc_615d(m);

  assert.equal(m.tstates, 54, "Path LOOP T-state total");
  assert.deepEqual(m.pcSeq, [0x6160, 0x6162, 0x6164, 0x615d]);
  assert.equal(m.pc, 0x615d, "djnz self-loop lands on the routine head");
  assert.deepEqual(m.calls, [0x615d]);
  assert.equal(m.regs.ix, (IX + 0x18) & 0xffff, "IX advanced by DE");
  assert.equal(m.regs.b, 0x05, "B decremented by djnz");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_615d Path FALLOUT: miss with B==1 -> djnz falls out to boundary 0x6166", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x05;
  m.regs.b = 0x01;
  m.mem.write8(IX + 0x14, 0x99); // miss

  loc_615d(m);

  assert.equal(m.tstates, 49, "Path FALLOUT T-state total");
  assert.deepEqual(m.pcSeq, [0x6160, 0x6162, 0x6164, 0x6166]);
  assert.equal(m.pc, 0x6166);
  assert.deepEqual(m.calls, [0x6166]);
  assert.equal(m.regs.ix, (IX + 0x18) & 0xffff, "IX advanced before falling out");
  assert.equal(m.regs.b, 0x00, "B decremented to 0");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_615d MUTATION: `add ix,de` mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6164 ? 11 : cycles);
  seatCaller(m);
  m.regs.a = 0x05;
  m.regs.b = 0x06;
  m.mem.write8(IX + 0x14, 0x99);

  loc_615d(m);

  assert.equal(m.tstates, 50, "mutation loses 4 T (15 -> 11)");
  assert.throws(
    () => assert.equal(m.tstates, 54, "Path LOOP T-state total"),
    /54/,
    "the 54-T golden must fail on the mutant",
  );
});
