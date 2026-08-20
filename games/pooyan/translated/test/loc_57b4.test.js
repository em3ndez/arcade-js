// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_57b4 (ROM 0x57b4, Pooyan) -- the spawn-column clamp helper.
 * Pure leaf (no calls, no writes): bails with C unchanged when 0x8901 >= 3 (ret nc) or 0x8d7d <
 * 0x0c (ret c); otherwise C += (0x8d7d - 0x0c). Three paths, each asserting pcSeq/T/registers.
 * TEETH: mis-charge `sub 0x0c` (7 T) as 4 T -> the 68-T golden of the add path throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_57b4.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_57b4 } from "../loc_57b4.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x57b4, pcSeq: [],
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
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_57b4 ret nc: 0x8901 >= 3 -> bail, C unchanged", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.c = 0x05;
  m.mem.write8(0x8901, 0x03); // cp 0x03 -> NC

  loc_57b4(m);

  assert.equal(m.tstates, 13 + 7 + 11, "ld a + cp + ret nc");
  assert.deepEqual(m.pcSeq, [0x57b7, 0x57b9, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.c, 0x05, "C untouched");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound");
});

test("loc_57b4 ret c: 0x8d7d < 0x0c -> bail, C unchanged", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.c = 0x05;
  m.mem.write8(0x8901, 0x00); // < 3
  m.mem.write8(0x8d7d, 0x0b); // sub 0x0c -> borrow -> C

  loc_57b4(m);

  assert.equal(m.tstates, 13 + 7 + 5 + 13 + 7 + 11, "through ret c");
  assert.deepEqual(m.pcSeq, [0x57b7, 0x57b9, 0x57ba, 0x57bd, 0x57bf, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.c, 0x05, "C untouched");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_57b4 add path: C += (0x8d7d - 0x0c)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.c = 0x05;
  m.mem.write8(0x8901, 0x00); // < 3
  m.mem.write8(0x8d7d, 0x14); // sub 0x0c -> 0x08, NC

  loc_57b4(m);

  assert.equal(m.tstates, 13 + 7 + 5 + 13 + 7 + 5 + 4 + 4 + 10, "full add path = 68");
  assert.deepEqual(m.pcSeq, [0x57b7, 0x57b9, 0x57ba, 0x57bd, 0x57bf, 0x57c0, 0x57c1, 0x57c2, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.a, 0x0d, "A = 0x08 + C(0x05)");
  assert.equal(m.regs.c, 0x0d, "C updated");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_57b4 MUTATION: `sub 0x0c` mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x57bf ? 4 : cycles);
  seatCaller(m);
  m.regs.c = 0x05;
  m.mem.write8(0x8901, 0x00);
  m.mem.write8(0x8d7d, 0x14);

  loc_57b4(m);

  assert.equal(m.tstates, 65, "mutation loses 3 T (7 -> 4)");
  assert.throws(() => assert.equal(m.tstates, 68, "add path golden"), /68/);
});
