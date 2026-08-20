// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_54c5 (ROM 0x54c5, Pooyan) -- spawn scheduler A. Gates on 0x8907 and
 * 0x8820, decrements the per-type countdown at 0x8d04, and only when it hits zero reloads it from table
 * 0x55ef (index 0x8d12&0x0f via rst 0x20), advances the index at 0x8d12, seeds IX/DE/B, and FALLS THROUGH
 * into the spawn loop loc_54f9.
 *
 * The mock's `call` POPS the return the call site pushed (modelling the callee's `ret`); rst 0x20 (0x0020)
 * also does HL += A then A = (HL); the fall-through target 0x54f9 is a black box whose net effect is to
 * return to loc_54c5's caller (loc_54c5 pushed nothing, so its `ret`/skip-return consumes CALLER_RET).
 * A missing push16 desyncs the stack -> the fall-through pops garbage and the final pc/sp assertions fail.
 *
 * Cases cover every branch: jr nc taken (>=4) full path; jr nc taken + ret nz; both 0x8820 thresholds
 * (old<2 vs old in {2,3}) with ret c taken and not-taken. TEETH: mis-charge `ld ix,nn` (14 T) as 10 T.
 *
 * Run: node --test games/pooyan/translated/test/loc_54c5.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_54c5 } from "../loc_54c5.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x54c5, pcSeq: [],
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
    call(addr) {
      this.calls.push(addr);
      if (addr === 0x0020) {                 // rst 0x20: pop the pushed return, then HL += A; A = (HL)
        this.pop16();
        const idx = (regs.hl + regs.a) & 0xffff;
        regs.hl = idx;
        regs.a = mem.read8(idx);
        return undefined;
      }
      if (addr === 0x54f9) {                 // fall-through target: black box that returns to CALLER_RET
        this.pc = this.pop16();
        return undefined;
      }
      this.pop16();
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_54c5 Case B: 0x8907>=4, countdown hits 0 -> reload + advance + fall into loc_54f9", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x05);   // >= 4 -> jr nc taken, skip the 0x8820 checks
  m.mem.write8(0x8d04, 0x01);   // countdown -> dec makes it 0 (ret nz not taken)
  m.mem.write8(0x8d12, 0x03);   // table index (& 0x0f)
  m.mem.write8(0x55f2, 0x2a);   // table[0x55ef + 3] -> reload value

  loc_54c5(m);

  assert.equal(m.tstates, 164, "Case B T-state total");
  assert.deepEqual(m.pcSeq, [
    0x54c8, 0x54ca, 0x54db, 0x54de, 0x54df, 0x54e0, 0x54e3, 0x54e6, 0x54e8,
    0x0020, 0x54ec, 0x54ef, 0x54f0, 0x54f4, 0x54f7, 0x54f9,
  ], "full path: jr nc taken, countdown 0, rst 0x20, fall into loc_54f9");
  assert.equal(m.pc, CALLER_RET, "fall-through loc_54f9 returns to loc_54c5's caller");
  assert.deepEqual(m.calls, [0x0020, 0x54f9], "rst 0x20 then the tail fall-through");
  assert.equal(m.mem.read8(0x8d04), 0x2a, "countdown reloaded from table");
  assert.equal(m.mem.read8(0x8d12), 0x04, "table index advanced");
  assert.equal(m.regs.ix, 0x8c30, "actor block base seeded");
  assert.equal(m.regs.de, 0x0018, "stride seeded");
  assert.equal(m.regs.b, 0x01, "slot count seeded");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_54c5 Case A: 0x8907>=4, countdown not yet 0 -> ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x05);
  m.mem.write8(0x8d04, 0x05);   // dec -> 4, nonzero -> ret nz

  loc_54c5(m);

  assert.equal(m.tstates, 64, "Case A T = ld a + cp + jr nc + ld hl + dec + ret nz");
  assert.deepEqual(m.pcSeq, [0x54c8, 0x54ca, 0x54db, 0x54de, 0x54df, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8d04), 0x04, "countdown decremented, not reloaded");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_54c5 Case C: 0x8907<2, 0x8820<3 -> ret c at 0x54da", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x01);   // < 2 -> jr c taken at 0x54d1
  m.mem.write8(0x8820, 0x02);   // 2 < 3 -> ret c at 0x54da

  loc_54c5(m);

  assert.equal(m.tstates, 77, "Case C T total");
  assert.deepEqual(m.pcSeq, [0x54c8, 0x54ca, 0x54cc, 0x54ce, 0x54d1, 0x54d8, 0x54da, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_54c5 Case D: 0x8907<2, 0x8820>=3 -> fall to 0x54db, ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x00);   // < 2
  m.mem.write8(0x8820, 0x03);   // 3 >= 3 -> ret c NOT taken at 0x54da
  m.mem.write8(0x8d04, 0x02);   // dec -> 1, nonzero -> ret nz

  loc_54c5(m);

  assert.equal(m.tstates, 103, "Case D T total");
  assert.deepEqual(m.pcSeq, [0x54c8, 0x54ca, 0x54cc, 0x54ce, 0x54d1, 0x54d8, 0x54da, 0x54db, 0x54de, 0x54df, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(0x8d04), 0x01);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_54c5 Case E: 0x8907 in {2,3}, 0x8820<2 -> ret c at 0x54d5", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x02);   // in {2,3} -> jr c NOT taken at 0x54d1
  m.mem.write8(0x8820, 0x01);   // 1 < 2 -> ret c at 0x54d5

  loc_54c5(m);

  assert.equal(m.tstates, 72, "Case E T total");
  assert.deepEqual(m.pcSeq, [0x54c8, 0x54ca, 0x54cc, 0x54ce, 0x54d1, 0x54d3, 0x54d5, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_54c5 Case F: 0x8907 in {2,3}, 0x8820>=2 -> jr 0x54db, ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x03);   // in {2,3}
  m.mem.write8(0x8820, 0x05);   // 5 >= 2 -> ret c NOT taken at 0x54d5 -> jr 0x54db
  m.mem.write8(0x8d04, 0x03);   // dec -> 2, nonzero -> ret nz

  loc_54c5(m);

  assert.equal(m.tstates, 110, "Case F T total");
  assert.deepEqual(m.pcSeq, [0x54c8, 0x54ca, 0x54cc, 0x54ce, 0x54d1, 0x54d3, 0x54d5, 0x54d6, 0x54db, 0x54de, 0x54df, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(0x8d04), 0x02);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_54c5 MUTATION: `ld ix,nn` mis-charged 10T (not 14T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x54f4 ? 10 : cycles);
  seatCaller(m);
  m.mem.write8(0x8907, 0x05);
  m.mem.write8(0x8d04, 0x01);
  m.mem.write8(0x8d12, 0x03);
  m.mem.write8(0x55f2, 0x2a);

  loc_54c5(m);

  assert.equal(m.tstates, 160, "mutation loses 4 T (14 -> 10)");
  assert.throws(() => assert.equal(m.tstates, 164, "golden"), /164/, "the 164-T golden must fail on the mutant");
});
