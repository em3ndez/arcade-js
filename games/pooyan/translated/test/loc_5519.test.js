// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5519 (ROM 0x5519, Pooyan) -- spawn scheduler B. Gates on 0x8907 (>=2
 * skips the 0x8820 check; <2 requires 0x8820 >= 2), decrements the per-type countdown at 0x8d05, and only
 * when it hits zero reloads it from table 0x55ff (index 0x8d13&0x0f via rst 0x20), advances the index at
 * 0x8d13, seeds IX/DE/B, and FALLS THROUGH into the spawn loop loc_5544.
 *
 * The mock's `call` POPS the return the call site pushed; rst 0x20 (0x0020) also does HL += A then A = (HL).
 * The fall-through target 0x5544 is a black box whose net effect is to return to loc_5519's caller. A
 * missing push16 desyncs the stack -> the fall-through pops garbage and the final pc/sp assertions fail.
 *
 * Cases cover every branch: jr nc taken (>=2) full path and ret nz; jr nc not taken with ret c taken and
 * not-taken. TEETH: mis-charge `ld ix,nn` (14 T) as 10 T -> the 164-T golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_5519.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5519 } from "../loc_5519.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5519, pcSeq: [],
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
      if (addr === 0x5544) {                 // fall-through target: black box that returns to CALLER_RET
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

test("loc_5519 Case B: 0x8907>=2, countdown hits 0 -> reload + advance + fall into loc_5544", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x02);   // >= 2 -> jr nc taken
  m.mem.write8(0x8d05, 0x01);   // dec -> 0 (ret nz not taken)
  m.mem.write8(0x8d13, 0x05);   // table index (& 0x0f)
  m.mem.write8(0x5604, 0x33);   // table[0x55ff + 5] -> reload value

  loc_5519(m);

  assert.equal(m.tstates, 164, "Case B T-state total");
  assert.deepEqual(m.pcSeq, [
    0x551c, 0x551e, 0x5526, 0x5529, 0x552a, 0x552b, 0x552e, 0x5531, 0x5533,
    0x0020, 0x5537, 0x553a, 0x553b, 0x553f, 0x5542, 0x5544,
  ], "full path: jr nc taken, countdown 0, rst 0x20, fall into loc_5544");
  assert.equal(m.pc, CALLER_RET, "fall-through loc_5544 returns to loc_5519's caller");
  assert.deepEqual(m.calls, [0x0020, 0x5544]);
  assert.equal(m.mem.read8(0x8d05), 0x33, "countdown reloaded from table");
  assert.equal(m.mem.read8(0x8d13), 0x06, "table index advanced");
  assert.equal(m.regs.ix, 0x8c48, "actor block base seeded");
  assert.equal(m.regs.de, 0x0018, "stride seeded");
  assert.equal(m.regs.b, 0x01, "slot count seeded");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_5519 Case A: 0x8907>=2, countdown not yet 0 -> ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x02);
  m.mem.write8(0x8d05, 0x05);   // dec -> 4, nonzero -> ret nz

  loc_5519(m);

  assert.equal(m.tstates, 64, "Case A T total");
  assert.deepEqual(m.pcSeq, [0x551c, 0x551e, 0x5526, 0x5529, 0x552a, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8d05), 0x04, "countdown decremented, not reloaded");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_5519 Case C: 0x8907<2, 0x8820<2 -> ret c", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x01);   // < 2 -> jr nc not taken
  m.mem.write8(0x8820, 0x01);   // 1 < 2 -> ret c

  loc_5519(m);

  assert.equal(m.tstates, 58, "Case C T total");
  assert.deepEqual(m.pcSeq, [0x551c, 0x551e, 0x5520, 0x5523, 0x5525, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_5519 Case D: 0x8907<2, 0x8820>=2 -> fall to 0x5526, ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x00);   // < 2
  m.mem.write8(0x8820, 0x03);   // 3 >= 2 -> ret c NOT taken
  m.mem.write8(0x8d05, 0x02);   // dec -> 1, nonzero -> ret nz

  loc_5519(m);

  assert.equal(m.tstates, 84, "Case D T total");
  assert.deepEqual(m.pcSeq, [0x551c, 0x551e, 0x5520, 0x5523, 0x5525, 0x5526, 0x5529, 0x552a, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(0x8d05), 0x01);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_5519 MUTATION: `ld ix,nn` mis-charged 10T (not 14T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x553f ? 10 : cycles);
  seatCaller(m);
  m.mem.write8(0x8907, 0x02);
  m.mem.write8(0x8d05, 0x01);
  m.mem.write8(0x8d13, 0x05);
  m.mem.write8(0x5604, 0x33);

  loc_5519(m);

  assert.equal(m.tstates, 160, "mutation loses 4 T (14 -> 10)");
  assert.throws(() => assert.equal(m.tstates, 164, "golden"), /164/, "the 164-T golden must fail on the mutant");
});
