// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1171 (ROM 0x1171, Pooyan). Countdown at 0x8d07: while nonzero
 * just `dec (hl)` and ret. At zero, gate (0x8901) vs (0x8d40) -- equal/less/(0x8d40)>=6 all ret --
 * else sweep the 6 records at 0x8ae0 (stride 0x18), calling loc_119a on each with E=0x1d.
 *
 * loc_119a is an untranslated BOUNDARY; the mock models it as a pure pop (the loop counter B is
 * loc_1171's own, reloaded/decremented locally), so the 6-iteration djnz sweep is exercised.
 * The mock's `call` POPS so a missing push16 desyncs SP and fails the ret/baseline tooth.
 *
 * Paths: DEC (0x8d07!=0), ret z, ret c, ret nc, and the full 6-record sweep. MUTATION: `add ix,de`
 * (15 T) mis-charged 7 T -> the 491-T golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_1171.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1171 } from "../loc_1171.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1171, pcSeq: [],
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
    call(addr) { this.calls.push(addr); this.pc = this.pop16(); return undefined; }, // loc_119a: pop only
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_1171 DEC: 0x8d07 nonzero -> dec (hl) and ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d07, 0x03);

  loc_1171(m);

  assert.equal(m.tstates, 10 + 7 + 4 + 7 + 11 + 10);
  assert.deepEqual(m.pcSeq, [0x1174, 0x1175, 0x1176, 0x1178, 0x1179, CALLER_RET]);
  assert.equal(m.mem.read8(0x8d07), 0x02, "counter decremented");
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_1171 ret z: (0x8901) == (0x8d40)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d07, 0x00);
  m.mem.write8(0x8901, 0x05);
  m.mem.write8(0x8d40, 0x05);

  loc_1171(m);

  assert.equal(m.tstates, 10 + 7 + 4 + 12 + 13 + 7 + 7 + 11);
  assert.deepEqual(m.pcSeq, [0x1174, 0x1175, 0x1176, 0x117a, 0x117d, 0x117f, 0x1180, CALLER_RET]);
  assert.deepEqual(m.calls, []);
});

test("loc_1171 ret c: (0x8901) < (0x8d40)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d07, 0x00);
  m.mem.write8(0x8901, 0x02);
  m.mem.write8(0x8d40, 0x05);

  loc_1171(m);

  assert.equal(m.tstates, 10 + 7 + 4 + 12 + 13 + 7 + 7 + 5 + 11);
  assert.deepEqual(m.pcSeq, [0x1174, 0x1175, 0x1176, 0x117a, 0x117d, 0x117f, 0x1180, 0x1181, CALLER_RET]);
});

test("loc_1171 ret nc: (0x8d40) >= 6", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d07, 0x00);
  m.mem.write8(0x8901, 0x0a);
  m.mem.write8(0x8d40, 0x08); // > (0x8901)? no: 0x0a-0x08=2 no carry; (hl)=8 >= 6 -> ret nc

  loc_1171(m);

  assert.equal(m.tstates, 10 + 7 + 4 + 12 + 13 + 7 + 7 + 5 + 5 + 4 + 7 + 7 + 11);
  assert.deepEqual(m.pcSeq, [
    0x1174, 0x1175, 0x1176, 0x117a, 0x117d, 0x117f, 0x1180, 0x1181, 0x1182, 0x1183, 0x1184, 0x1186, CALLER_RET,
  ]);
  assert.deepEqual(m.calls, []);
});

test("loc_1171 full sweep: 6 records, calls loc_119a each", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d07, 0x00);
  m.mem.write8(0x8901, 0x05);
  m.mem.write8(0x8d40, 0x02); // (0x8901)-(0x8d40)=3 (no z/c); (hl)=2 < 6 -> ret nc not taken

  loc_1171(m);

  const prefix = [
    0x1174, 0x1175, 0x1176, 0x117a, 0x117d, 0x117f, 0x1180, 0x1181, 0x1182, 0x1183, 0x1184, 0x1186,
    0x1187, 0x118b, 0x118d,
  ];
  const iter = [0x118f, 0x119a, 0x1195, 0x1197, 0x118d];
  const lastIter = [0x118f, 0x119a, 0x1195, 0x1197, 0x1199];
  const expected = [...prefix];
  for (let i = 0; i < 5; i++) expected.push(...iter);
  expected.push(...lastIter, CALLER_RET);

  assert.deepEqual(m.pcSeq, expected, "6-iteration sweep visiting loc_119a each time");
  assert.equal(m.tstates, 491, "full sweep T-state total");
  assert.deepEqual(m.calls, [0x119a, 0x119a, 0x119a, 0x119a, 0x119a, 0x119a]);
  assert.equal(m.regs.ix, (0x8ae0 + 6 * 0x18) & 0xffff, "IX advanced by 6 strides of 0x18");
  assert.equal(m.regs.sp, 0x8780, "stack unwound: 6 push16 matched 6 callee rets, final ret popped CALLER_RET");
});

test("loc_1171 MUTATION: `add ix,de` mis-charged 7T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1197 ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(0x8d07, 0x00);
  m.mem.write8(0x8901, 0x05);
  m.mem.write8(0x8d40, 0x02);

  loc_1171(m);

  assert.equal(m.tstates, 491 - 6 * 8, "6 add ix,de each lose 8 T");
  assert.throws(() => assert.equal(m.tstates, 491, "full sweep T-state total"), /491/);
});
