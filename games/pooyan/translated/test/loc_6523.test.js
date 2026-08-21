// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6523 (ROM 0x6523, Pooyan) -- object-record init. Bails on `ret c`
 * (when (ix+0)|(ix+1) is odd, exposed by rrca) or `ret nz` (0x8ef0 gate held). Otherwise seats the IX
 * record, decrements the 0x8929 pool by 2, and emits display words via rst 0x38 (de=0x0611, then e=7
 * only when 0x8907 is clear). Five paths cover both early rets, the 0x8907!=0 ret, the full ret, plus a
 * mutation. The mock's `call` POPS the pushed return (models the rst-38 handler's ret) -- the stack tooth.
 *
 * Run: node --test games/pooyan/translated/test/loc_6523.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6523 } from "../loc_6523.js";

const CALLER_RET = 0xabcd;
const IX = 0x9000;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6523, pcSeq: [],
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
    // The callee's `ret` pops the return the call site pushed -- model that pop so the stack stays
    // balanced. The rst-0x38 handler leaves no register loc_6523 branches on, so the stub only pops.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.ix = IX;
}

// pcSeq from entry through `and a` on 0x8907 (0x6561), shared by both full-init paths.
const FULL = [
  0x6526, 0x6529, 0x652a, 0x652b, 0x652e, 0x652f, 0x6530,
  0x6534, 0x6537, 0x653a, 0x653e, 0x6541, 0x6544, 0x6546, 0x6549, 0x654d, 0x6551, 0x6555, 0x6559, 0x655c,
  0x0038, 0x6560, 0x6561,
];
const FULL_T =
  19 + 19 + 4 + 5 + 13 + 4 + 5 +
  19 + 19 + 19 + 19 + 13 + 19 + 7 + 13 + 19 + 19 + 19 + 19 + 10 +
  11 + 13 + 4;

test("loc_6523 Path 1: (ix+0)|(ix+1) odd -> rrca sets C -> ret c", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0, 0x01);
  m.mem.write8(IX + 1, 0x00);

  loc_6523(m);

  assert.equal(m.tstates, 19 + 19 + 4 + 11, "Path 1 T = ld a + or + rrca + ret c taken");
  assert.deepEqual(m.pcSeq, [0x6526, 0x6529, 0x652a, CALLER_RET], "rrca C -> ret c to caller");
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780, "ret unwound to baseline");
});

test("loc_6523 Path 2: even low bit, gate 0x8ef0 held -> ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0, 0x02);
  m.mem.write8(IX + 1, 0x00);
  m.mem.write8(0x8ef0, 0x05);

  loc_6523(m);

  assert.equal(m.tstates, 19 + 19 + 4 + 5 + 13 + 4 + 11, "Path 2 T-state total");
  assert.deepEqual(m.pcSeq, [0x6526, 0x6529, 0x652a, 0x652b, 0x652e, 0x652f, CALLER_RET],
    "ret c not taken, gate held -> ret nz");
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_6523 Path 3: full init, 0x8907 set -> ret nz after first rst 0x38", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0, 0x00);
  m.mem.write8(IX + 1, 0x00);
  m.mem.write8(0x8ef0, 0x00);
  m.mem.write8(0x8929, 0x20);
  m.mem.write8(0x8907, 0x01);

  loc_6523(m);

  assert.equal(m.tstates, FULL_T + 11, "Path 3 = FULL through and a + ret nz taken");
  assert.deepEqual(m.pcSeq, [...FULL, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x0038], "one rst 0x38 dispatched");
  assert.equal(m.regs.sp, 0x8780);
  assert.equal(m.mem.read8(IX + 0), 0x01);
  assert.equal(m.mem.read8(IX + 3), 0x00);
  assert.equal(m.mem.read8(IX + 5), 0x00);
  assert.equal(m.mem.read8(IX + 4), 0x15);
  assert.equal(m.mem.read8(IX + 6), 0x20, "(ix+6) seeded from 0x8929");
  assert.equal(m.mem.read8(0x8929), 0x1e, "pool decremented by 2");
  assert.equal(m.mem.read8(IX + 0x0f), 0x03);
  assert.equal(m.mem.read8(IX + 0x10), 0xc0);
  assert.equal(m.mem.read8(IX + 0x08), 0x30);
  assert.equal(m.mem.read8(IX + 0x09), 0xf0);
});

test("loc_6523 Path 4: full init, 0x8907 clear -> second rst 0x38 then ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0, 0x00);
  m.mem.write8(IX + 1, 0x00);
  m.mem.write8(0x8ef0, 0x00);
  m.mem.write8(0x8929, 0x20);
  m.mem.write8(0x8907, 0x00);

  loc_6523(m);

  assert.equal(m.tstates, FULL_T + 5 + 7 + 11 + 10, "Path 4 = FULL + ret nz nt + ld e + rst + ret");
  assert.deepEqual(m.pcSeq, [...FULL, 0x6562, 0x6564, 0x0038, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x0038, 0x0038], "both rst 0x38 dispatched");
  assert.equal(m.regs.sp, 0x8780);
  assert.equal(m.mem.read8(0x8929), 0x1e);
});

test("loc_6523 MUTATION: ld de mis-charged 9T (not 10T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x655c ? 9 : cycles);
  seatCaller(m);
  m.mem.write8(0x8929, 0x20);
  m.mem.write8(0x8907, 0x00);

  loc_6523(m);

  const golden = FULL_T + 5 + 7 + 11 + 10;
  assert.equal(m.tstates, golden - 1, "mutation loses 1 T");
  assert.throws(() => assert.equal(m.tstates, golden, "Path 4 T total"), /Path 4/);
});
