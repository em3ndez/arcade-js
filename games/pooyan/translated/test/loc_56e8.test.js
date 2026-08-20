// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_56e8 (ROM 0x56e8, Pooyan). Countdown at 0x8d07: while nonzero
 * decrement and ret. At zero: if (0x8907) bit0 is clear, tail-jp to loc_5871; else gate (0x8901)
 * vs (0x8d40) with a threshold derived from (0x8900) ((>=3 -> 6) else (+4)); pass -> sweep the 6
 * records at 0x8ae0 via loc_572b.
 *
 * loc_5871 and loc_572b are untranslated BOUNDARIES. The mock's `call` POPS: for the tail jp z,
 * loc_5871's eventual ret consumes the seated CALLER_RET (SP returns to the pre-seat baseline);
 * for the call 0x572b, the pop models its ret so the 6 push16 stay balanced. loc_572b is a pure
 * pop (B is loc_56e8's own loop counter, reset to 6 at 0x571c).
 *
 * Paths: DEC; tail jp z -> loc_5871; ret z; ret c; the jr-c-not-taken threshold + ret nc; and the
 * full 6-record sweep (jr c taken). MUTATION: `bit 0,a` (8 T) mis-charged 4 T -> the 567-T golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_56e8.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_56e8 } from "../loc_56e8.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x56e8, pcSeq: [],
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
    // loc_572b (pure pop) and loc_5871 (tail dispatch) both ret; pop models that. The tail jp z has
    // no push16 at the call site, so its pop consumes the seated CALLER_RET -> SP back to baseline.
    call(addr) { this.calls.push(addr); this.pc = this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_56e8 DEC: 0x8d07 nonzero -> decrement and ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d07, 0x04);

  loc_56e8(m);

  assert.equal(m.tstates, 13 + 4 + 7 + 4 + 13 + 10);
  assert.deepEqual(m.pcSeq, [0x56eb, 0x56ec, 0x56ee, 0x56ef, 0x56f2, CALLER_RET]);
  assert.equal(m.mem.read8(0x8d07), 0x03);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_56e8 tail jp z: (0x8907) bit0 clear -> dispatch loc_5871", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d07, 0x00);
  m.mem.write8(0x8907, 0x00); // bit0 clear -> jp z taken

  loc_56e8(m);

  assert.equal(m.tstates, 13 + 4 + 12 + 13 + 8 + 10);
  assert.deepEqual(m.pcSeq, [0x56eb, 0x56ec, 0x56f3, 0x56f6, 0x56f8, 0x5871]);
  assert.equal(m.pc, CALLER_RET, "loc_5871 ran + ret'd to caller; dispatch verified by pcSeq/m.calls");
  assert.deepEqual(m.calls, [0x5871]);
  assert.equal(m.regs.sp, 0x8780, "tail dispatch: loc_5871's ret consumed the seated CALLER_RET");
});

test("loc_56e8 ret z: (0x8901) == (0x8d40)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d07, 0x00);
  m.mem.write8(0x8907, 0x01); // bit0 set -> jp z not taken
  m.mem.write8(0x8901, 0x05);
  m.mem.write8(0x8d40, 0x05);

  loc_56e8(m);

  assert.equal(m.tstates, 13 + 4 + 12 + 13 + 8 + 10 + 13 + 10 + 7 + 11);
  assert.deepEqual(m.pcSeq, [
    0x56eb, 0x56ec, 0x56f3, 0x56f6, 0x56f8, 0x56fb, 0x56fe, 0x5701, 0x5702, CALLER_RET,
  ]);
  assert.deepEqual(m.calls, []);
});

test("loc_56e8 ret c: (0x8901) < (0x8d40)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d07, 0x00);
  m.mem.write8(0x8907, 0x01);
  m.mem.write8(0x8901, 0x02);
  m.mem.write8(0x8d40, 0x05);

  loc_56e8(m);

  assert.equal(m.tstates, 13 + 4 + 12 + 13 + 8 + 10 + 13 + 10 + 7 + 5 + 11);
  assert.deepEqual(m.pcSeq, [
    0x56eb, 0x56ec, 0x56f3, 0x56f6, 0x56f8, 0x56fb, 0x56fe, 0x5701, 0x5702, 0x5703, CALLER_RET,
  ]);
});

test("loc_56e8 jr c not taken ((0x8900)>=3 -> b=6) then ret nc", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d07, 0x00);
  m.mem.write8(0x8907, 0x01);
  m.mem.write8(0x8901, 0x0a);
  m.mem.write8(0x8d40, 0x08); // 0x0a-0x08=2 (no z/c)
  m.mem.write8(0x8900, 0x05); // >= 3 -> jr c not taken -> b=6; (0x8d40)=8 >= 6 -> ret nc

  loc_56e8(m);

  assert.equal(m.tstates, 13 + 4 + 12 + 13 + 8 + 10 + 13 + 10 + 7 + 5 + 5 + 4 + 13 + 7 + 7 + 7 + 12 + 13 + 4 + 11);
  assert.deepEqual(m.pcSeq, [
    0x56eb, 0x56ec, 0x56f3, 0x56f6, 0x56f8, 0x56fb, 0x56fe, 0x5701, 0x5702, 0x5703, 0x5704,
    0x5705, 0x5708, 0x570a, 0x570c, 0x570e, 0x5713, 0x5716, 0x5717, CALLER_RET,
  ]);
  assert.deepEqual(m.calls, []);
});

test("loc_56e8 full sweep: jr c taken threshold, 6 records via loc_572b", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d07, 0x00);
  m.mem.write8(0x8907, 0x01);
  m.mem.write8(0x8901, 0x05);
  m.mem.write8(0x8d40, 0x02); // 0x05-0x02=3 (no z/c)
  m.mem.write8(0x8900, 0x01); // < 3 -> jr c taken -> A+4=5=b; (0x8d40)=2 < 5 -> ret nc not taken

  loc_56e8(m);

  const prefix = [
    0x56eb, 0x56ec, 0x56f3, 0x56f6, 0x56f8, 0x56fb, 0x56fe, 0x5701, 0x5702, 0x5703, 0x5704,
    0x5705, 0x5708, 0x570a, 0x5710, 0x5712, 0x5713, 0x5716, 0x5717, 0x5718, 0x571c, 0x571e,
  ];
  const iter = [0x5720, 0x572b, 0x5726, 0x5728, 0x571e];
  const lastIter = [0x5720, 0x572b, 0x5726, 0x5728, 0x572a];
  const expected = [...prefix];
  for (let i = 0; i < 5; i++) expected.push(...iter);
  expected.push(...lastIter, CALLER_RET);

  assert.deepEqual(m.pcSeq, expected, "6-iteration sweep visiting loc_572b each time");
  assert.equal(m.tstates, 567, "full sweep T-state total");
  assert.deepEqual(m.calls, [0x572b, 0x572b, 0x572b, 0x572b, 0x572b, 0x572b]);
  assert.equal(m.regs.ix, (0x8ae0 + 6 * 0x18) & 0xffff, "IX advanced by 6 strides of 0x18");
  assert.equal(m.regs.sp, 0x8780, "stack unwound: 6 push16 matched 6 callee rets, final ret popped CALLER_RET");
});

test("loc_56e8 MUTATION: `bit 0,a` mis-charged 4T (not 8T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x56f8 ? 4 : cycles);
  seatCaller(m);
  m.mem.write8(0x8d07, 0x00);
  m.mem.write8(0x8907, 0x01);
  m.mem.write8(0x8901, 0x05);
  m.mem.write8(0x8d40, 0x02);
  m.mem.write8(0x8900, 0x01);

  loc_56e8(m);

  assert.equal(m.tstates, 563, "mutation loses 4 T (8 -> 4)");
  assert.throws(() => assert.equal(m.tstates, 567, "full sweep T-state total"), /567/);
});
