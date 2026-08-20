// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_540d (ROM 0x540d, Pooyan) -- enemy-spawn driver. Gated on 0x8907
 * bit0 (`ret z` when clear). Blanks two 6-byte HUD rows via rst 0x10 (loc_0010), then walks 3 object
 * blocks at IX (base 0x8c30, stride 0x18), calling loc_5433 on each. `exx` parks the loop counter B
 * and stride DE across loc_5433's clobber of BC/DE/HL; IX is untouched by exx and by loc_5433.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`). For
 * loc_5433 it also garbages the *current* (post-exx alt) BC/DE/HL -- if the exx round-trip were broken
 * the corrupted B would derail the djnz count, so "loop ran exactly 3 times / IX = 0x8c78 / DE = 0x18"
 * proves the register-bank protection. Because the mock pops, a missing push16 desyncs SP -> the final
 * ret misses CALLER_RET, giving the SP-baseline assertion real teeth.
 *
 * Path RUN (gate open): full pcSeq visiting the call TARGETS (0x0010, 0x5433), T=280, IX/B/DE final.
 * Path GATE (bit0 clear): `ret z` immediately, T=31. TEETH: mis-charge `ld ix,nn` as 10 T (a plain
 * ld rr,nn) -> the 280-T golden catches the missing IX-prefix cost.
 *
 * Run: node --test games/pooyan/translated/test/loc_540d.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_540d } from "../loc_540d.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x540d, pcSeq: [],
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
    // The callee's `ret` pops the return address loc_540d pushed at the call site -- model that pop so
    // a missing push16 desyncs SP and fails the test. loc_5433 clobbers the (post-exx) BC/DE/HL bank;
    // garbage it to prove the exx round-trip restores the caller's counter B + stride DE. loc_0010
    // (rst 0x10) clobbers B/HL, both reloaded by loc_540d before use.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x5433) {
        regs.b = 0xff; regs.c = 0xee; regs.de = 0x1234; regs.hl = 0x5678;
      }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const PC_RUN = [
  0x5410, 0x5412, 0x5413, 0x5414, 0x5417, 0x5419,
  0x0010,                                     // rst 0x10 #1 -> target
  0x541d, 0x541f,
  0x0010,                                     // rst 0x10 #2 -> target
  0x5424, 0x5427, 0x5429,
  0x542a, 0x5433, 0x542e, 0x5430, 0x5429,     // block 1 (djnz taken)
  0x542a, 0x5433, 0x542e, 0x5430, 0x5429,     // block 2 (djnz taken)
  0x542a, 0x5433, 0x542e, 0x5430, 0x5432,     // block 3 (djnz falls out)
  CALLER_RET,
];

test("loc_540d Path RUN: gate open -> blank 2 rows, process 3 blocks", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x01); // bit0 set -> gate open (ret z not taken)

  loc_540d(m);

  assert.equal(m.tstates, 280, "Path RUN T-state total");
  assert.deepEqual(m.pcSeq, PC_RUN, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret at 0x5432 to the seated caller");
  assert.deepEqual(m.calls, [0x0010, 0x0010, 0x5433, 0x5433, 0x5433], "two rst-0x10 fills + three loc_5433");
  assert.equal(m.regs.ix, 0x8c78, "IX advanced 3 x 0x18 from 0x8c30");
  assert.equal(m.regs.de, 0x0018, "stride DE preserved by exx across loc_5433");
  assert.equal(m.regs.b, 0x00, "djnz counted the 3 blocks to zero (exx protected B)");
  // stack fully unwound: every push16 matched a callee pop, final ret consumed CALLER_RET.
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_540d Path GATE: 0x8907 bit0 clear -> ret z immediately", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x00); // bit0 clear -> and 0x01 == 0 -> ret z

  loc_540d(m);

  assert.equal(m.tstates, 13 + 7 + 11, "ld a + and + ret z taken");
  assert.deepEqual(m.pcSeq, [0x5410, 0x5412, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret z to the seated caller");
  assert.deepEqual(m.calls, [], "no work done");
  assert.equal(m.regs.sp, 0x8780, "stack unwound (ret z popped CALLER_RET)");
});

test("loc_540d MUTATION: `ld ix,nn` mis-charged 10T (not 14T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5424 ? 10 : cycles);
  seatCaller(m);
  m.mem.write8(0x8907, 0x01);

  loc_540d(m);

  assert.equal(m.tstates, 276, "mutation loses 4 T (14 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 280, "Path RUN T-state total"),
    /280/,
    "the 280-T golden must fail on the mutant",
  );
});
