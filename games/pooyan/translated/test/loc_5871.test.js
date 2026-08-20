// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5871 (ROM 0x5871, Pooyan) -- the eagle-launch gate. Stores A into
 * 0x8900, then gates on (0x8901) - (0x8d40): ret z (equal), ret c (below), else ret nc when the count
 * (0x8d40) already reached 6; only a fully-open gate marks the eagle active and falls through into
 * loc_588e (tail). The mock's `call` POPS (models loc_588e's ret consuming the frame on the tail path).
 *
 * Four gate outcomes each get a case (ret z / ret c / ret nc / full launch), plus a T-state MUTATION.
 * The full-launch path ends via fall-through into loc_588e: SP returns to the pre-seat baseline.
 *
 * Run: node --test games/pooyan/translated/test/loc_5871.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5871 } from "../loc_5871.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5871, pcSeq: [],
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
    // loc_588e is reached by fall-through (tail): its `ret` pops the seated caller return.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_5871 ret z: threshold == count -> immediate return", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x03;
  m.mem.write8(0x8901, 0x05);
  m.mem.write8(0x8d40, 0x05);

  loc_5871(m);

  assert.equal(m.tstates, 13 + 13 + 10 + 7 + 11, "ret z T-state total");
  assert.deepEqual(m.pcSeq, [0x5874, 0x5877, 0x587a, 0x587b, CALLER_RET]);
  assert.equal(m.mem.read8(0x8900), 0x03, "A stored to 0x8900");
  assert.deepEqual(m.calls, [], "no launch");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_5871 ret c: threshold below count -> return", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x00;
  m.mem.write8(0x8901, 0x03);
  m.mem.write8(0x8d40, 0x05);

  loc_5871(m);

  assert.equal(m.tstates, 13 + 13 + 10 + 7 + 5 + 11, "ret c T-state total");
  assert.deepEqual(m.pcSeq, [0x5874, 0x5877, 0x587a, 0x587b, 0x587c, CALLER_RET]);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_5871 ret nc: count already reached 6 -> return", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x00;
  m.mem.write8(0x8901, 0x08);
  m.mem.write8(0x8d40, 0x06);

  loc_5871(m);

  assert.equal(m.tstates, 84, "ret nc T-state total");
  assert.deepEqual(m.pcSeq, [0x5874, 0x5877, 0x587a, 0x587b, 0x587c, 0x587d, 0x5880, 0x5882, CALLER_RET]);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8d4a), 0x00, "eagle not marked active");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_5871 full launch: gate open -> mark active + fall through into loc_588e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x07;
  m.mem.write8(0x8901, 0x08);
  m.mem.write8(0x8d40, 0x03);

  loc_5871(m);

  assert.equal(m.tstates, 119, "full-launch T-state total");
  assert.deepEqual(m.pcSeq, [
    0x5874, 0x5877, 0x587a, 0x587b, 0x587c, 0x587d, 0x5880, 0x5882, 0x5883,
    0x5885, 0x5888, 0x588c, 0x588e,
  ], "runs to the loc_588e fall-through");
  assert.equal(m.pc, 0x588e, "fall-through lands on loc_588e");
  assert.deepEqual(m.calls, [0x588e], "tail into loc_588e");
  assert.equal(m.mem.read8(0x8900), 0x07, "A stored");
  assert.equal(m.mem.read8(0x8d4a), 0x01, "eagle marked active");
  assert.equal(m.regs.ix, 0x8ae0, "IX -> eagle block base");
  assert.equal(m.regs.b, 0x06, "B = 6 blocks for loc_588e");
  assert.equal(m.regs.sp, 0x8780, "loc_588e's ret consumed the seated caller return -> baseline");
});

test("loc_5871 MUTATION: `ld ix,nn` mis-charged 10T (not 14T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x588c ? 10 : cycles);
  seatCaller(m);
  m.regs.a = 0x07;
  m.mem.write8(0x8901, 0x08);
  m.mem.write8(0x8d40, 0x03);

  loc_5871(m);

  assert.equal(m.tstates, 115, "mutation loses 4 T (14 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 119, "full-launch T-state total"),
    /119/,
    "the 119-T golden must fail on the mutant",
  );
});
