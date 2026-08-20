// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1a64 (ROM 0x1a64, Pooyan) -- a gameplay-state entry. While the 0x8f50
 * latch is set it tails to loc_1a01. Otherwise it runs the reset pair (loc_0f4e, loc_2527), clears
 * 0x89e3, and -- credit gate 0x8806 open -- counts the 0x8908 phase down: an already-zero or newly-zero
 * count tails to loc_1a96, else loc_03c2 renders and 0x880a is seeded 0x0a (0x0b for player 1) before ret.
 * Gate-closed tails to loc_1d3c.
 *
 * The mock's `call` POPS the return the call site pushed (modelling the callee's `ret`); a call site
 * missing its push16 desyncs the stack, so the ret path pops garbage (off-by-two SP, wrong PC) -- the
 * stack tooth. Six tests cover the latch tail, the gate, both zero-count tails, and both player branches.
 *
 * Run: node --test games/pooyan/translated/test/loc_1a64.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1a64 } from "../loc_1a64.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1a64, pcSeq: [],
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
    // balanced. None of loc_0f4e/loc_2527/loc_03c2 leave a register loc_1a64 branches on, so the stub
    // only pops; a missing push16 then desyncs SP and the final ret pops garbage.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// pcSeq through the reset pair up to `and a` on 0x8806 (0x1a78), shared by every gate path.
const GATE = [0x1a67, 0x1a68, 0x1a6a, 0x0f4e, 0x2527, 0x1a71, 0x1a74, 0x1a77, 0x1a78];
// ...and on through `and a` on 0x8908 (0x1a80) when the gate is open.
const OPEN = [...GATE, 0x1a7b, 0x1a7e, 0x1a7f, 0x1a80];

test("loc_1a64 Path 1: latch set (0x8f50!=0) -> tail into loc_1a01", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f50, 0x01);

  loc_1a64(m);

  assert.equal(m.tstates, 13 + 4 + 12, "Path 1 T = ld a + and a + jr nz taken");
  assert.deepEqual(m.pcSeq, [0x1a67, 0x1a68, 0x1a01], "jr nz tails to loc_1a01");
  assert.equal(m.pc, 0x1a01, "tail lands on loc_1a01");
  assert.deepEqual(m.calls, [0x1a01]);
  assert.equal(m.regs.sp, 0x8780, "tail unwound the stack to the pre-seat baseline");
});

test("loc_1a64 Path 2: latch clear, credit gate closed (0x8806=0) -> tail to loc_1d3c", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f50, 0x00);
  m.mem.write8(0x8806, 0x00);

  loc_1a64(m);

  assert.equal(m.tstates, 13+4+7 + 17+17 + 4+13+13+4 + 10, "Path 2 T-state total");
  assert.deepEqual(m.pcSeq, [...GATE, 0x1d3c], "reset pair, then jp z tails to loc_1d3c");
  assert.equal(m.pc, 0x1d3c);
  assert.deepEqual(m.calls, [0x0f4e, 0x2527, 0x1d3c]);
  assert.equal(m.mem.read8(0x89e3), 0x00, "0x89e3 cleared by xor a");
  assert.equal(m.regs.sp, 0x8780, "tail unwound the stack to the pre-seat baseline");
});

test("loc_1a64 Path 3: gate open, count already 0 (0x8908=0) -> tail to loc_1a96", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f50, 0x00);
  m.mem.write8(0x8806, 0x01);
  m.mem.write8(0x8908, 0x00);

  loc_1a64(m);

  assert.equal(m.tstates, 13+4+7 + 17+17 + 4+13+13+4 + 10 + 10+7+4 + 12, "Path 3 T-state total");
  assert.deepEqual(m.pcSeq, [...OPEN, 0x1a96], "and a on 0x8908=0 -> jr z tails to loc_1a96");
  assert.equal(m.pc, 0x1a96);
  assert.deepEqual(m.calls, [0x0f4e, 0x2527, 0x1a96]);
  assert.equal(m.mem.read8(0x8908), 0x00, "count untouched (not decremented on this path)");
  assert.equal(m.regs.sp, 0x8780, "tail unwound the stack to the pre-seat baseline");
});

test("loc_1a64 Path 4: gate open, count reaches 0 (0x8908=1 -> dec) -> tail to loc_1a96", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f50, 0x00);
  m.mem.write8(0x8806, 0x01);
  m.mem.write8(0x8908, 0x01);

  loc_1a64(m);

  assert.equal(m.tstates, 13+4+7 + 17+17 + 4+13+13+4 + 10 + 10+7+4 + 7 + 11 + 12, "Path 4 T-state total");
  assert.deepEqual(m.pcSeq, [...OPEN, 0x1a82, 0x1a83, 0x1a96], "jr z not taken, dec (hl)->0, jr z tails to loc_1a96");
  assert.equal(m.pc, 0x1a96);
  assert.deepEqual(m.calls, [0x0f4e, 0x2527, 0x1a96]);
  assert.equal(m.mem.read8(0x8908), 0x00, "count decremented 1 -> 0");
  assert.equal(m.regs.sp, 0x8780, "tail unwound the stack to the pre-seat baseline");
});

test("loc_1a64 Path 5 player 0: gate open, count 2 -> dec to 1 -> render, 0x880a=0x0a, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f50, 0x00);
  m.mem.write8(0x8806, 0x01);
  m.mem.write8(0x8908, 0x02);
  m.mem.write8(0x880d, 0x00);   // player 0 -> jr z taken, c stays 0x0a

  loc_1a64(m);

  assert.equal(
    m.tstates,
    13+4+7 + 17+17 + 4+13+13+4 + 10 + 10+7+4 + 7 + 11 + 7 + 17 + 7+13+4 + 12 + 4+13 + 10,
    "Path 5 player-0 T-state total",
  );
  assert.deepEqual(m.pcSeq, [
    ...OPEN, 0x1a82, 0x1a83, 0x1a85, 0x03c2,
    0x1a8a, 0x1a8d, 0x1a8e, 0x1a91, 0x1a92, 0x1a95, CALLER_RET,
  ], "dec to 1, call loc_03c2, jr z (player 0), ret to caller");
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
  assert.deepEqual(m.calls, [0x0f4e, 0x2527, 0x03c2]);
  assert.equal(m.mem.read8(0x8908), 0x01, "count decremented 2 -> 1");
  assert.equal(m.mem.read8(0x880a), 0x0a, "0x880a seeded 0x0a for player 0");
});

test("loc_1a64 Path 5 player 1: 0x880d set -> inc c -> 0x880a=0x0b, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f50, 0x00);
  m.mem.write8(0x8806, 0x01);
  m.mem.write8(0x8908, 0x02);
  m.mem.write8(0x880d, 0x01);   // player 1 -> jr z not taken, inc c -> 0x0b

  loc_1a64(m);

  assert.equal(
    m.tstates,
    13+4+7 + 17+17 + 4+13+13+4 + 10 + 10+7+4 + 7 + 11 + 7 + 17 + 7+13+4 + 7 + 4 + 4+13 + 10,
    "Path 5 player-1 T-state total",
  );
  assert.deepEqual(m.pcSeq, [
    ...OPEN, 0x1a82, 0x1a83, 0x1a85, 0x03c2,
    0x1a8a, 0x1a8d, 0x1a8e, 0x1a90, 0x1a91, 0x1a92, 0x1a95, CALLER_RET,
  ], "player 1: jr z not taken, inc c, ret to caller");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
  assert.equal(m.mem.read8(0x880a), 0x0b, "0x880a seeded 0x0b for player 1");
});

test("loc_1a64 MUTATION: the loc_0f4e call mis-charged 16T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0f4e ? 16 : cycles);
  seatCaller(m);
  m.mem.write8(0x8f50, 0x00);
  m.mem.write8(0x8806, 0x01);
  m.mem.write8(0x8908, 0x02);
  m.mem.write8(0x880d, 0x00);

  loc_1a64(m);

  const golden = 13+4+7 + 17+17 + 4+13+13+4 + 10 + 10+7+4 + 7 + 11 + 7 + 17 + 7+13+4 + 12 + 4+13 + 10;
  assert.equal(m.tstates, golden - 1, "mutation loses 1 T");
  assert.throws(() => assert.equal(m.tstates, golden, "Path 5 player-0 T-state total"), /player-0/);
});
