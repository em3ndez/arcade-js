// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5835 (ROM 0x5835, Pooyan) -- the eagle spawn/step entry. If the
 * eagle-active flag (0x8d4a) is set it tail-jumps to loc_57c6; otherwise it marks the eagle active,
 * seeds the sprite fields, points the animation sequence via loc_381e (a real CALL, push16(0x5854)),
 * and falls through into loc_585b (tail). The mock's `call` POPS the pushed return, so the real CALL
 * to loc_381e must push16 or SP desyncs -- the stack tooth (positive control deletes that push16).
 *
 * Path ACTIVE: flag set -> tail to loc_57c6. Path SPAWN: flag clear -> seed fields, call loc_381e,
 * fall through to loc_585b; SP returns to baseline. MUTATION: mis-charge `ld (ix+0x0b),a` (19T) as 7T.
 *
 * Run: node --test games/pooyan/translated/test/loc_5835.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5835 } from "../loc_5835.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5835, pcSeq: [],
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
    // loc_381e's `ret` pops the return the CALL site pushed; loc_57c6/loc_585b are tail targets whose
    // ret pops the seated caller return. None of them change registers loc_5835 relies on afterward.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_5835 Path ACTIVE: eagle flag set -> tail-jump to loc_57c6", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d4a, 0x01); // already active

  loc_5835(m);

  assert.equal(m.tstates, 13 + 4 + 12, "ACTIVE T-state total");
  assert.deepEqual(m.pcSeq, [0x5838, 0x5839, 0x57c6], "jr nz tails to loc_57c6");
  assert.equal(m.pc, 0x57c6, "tail lands on loc_57c6");
  assert.deepEqual(m.calls, [0x57c6]);
  assert.equal(m.regs.sp, 0x8780, "tail callee's ret consumed the seated return -> baseline");
});

test("loc_5835 Path SPAWN: flag clear -> seed fields, call loc_381e, fall through to loc_585b", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d4a, 0x00); // inactive -> spawn
  m.regs.ix = 0x8b00;

  loc_5835(m);

  assert.equal(m.tstates, 172, "SPAWN T-state total");
  assert.deepEqual(m.pcSeq, [
    0x5838, 0x5839, 0x583b, 0x583d, 0x5840, 0x5843, 0x5847, 0x584a, 0x584e,
    0x5851, 0x381e, 0x5857, 0x5859, 0x585a, 0x585b,
  ], "seed + call loc_381e + fall through to loc_585b");
  assert.equal(m.pc, 0x585b, "fall-through lands on loc_585b");
  assert.deepEqual(m.calls, [0x381e, 0x585b], "call loc_381e then tail loc_585b");
  assert.equal(m.mem.read8(0x8d4a), 0x01, "eagle marked active");
  assert.equal(m.mem.read8(0x8b0b), 0x01, "(ix+0x0b) = 0x01");
  assert.equal(m.mem.read8(0x8b13), 0x03, "(ix+0x13) = 0x03");
  assert.equal(m.mem.read8(0x8b16), 0x01, "(ix+0x16) = 0x01");
  assert.equal(m.mem.read8(0x8b07), 0x02, "(ix+0x07) = 0x02");
  assert.equal(m.regs.hl, 0x0bb5, "HL seeded for loc_585b");
  assert.equal(m.regs.b, 0x52, "B length for loc_585b");
  assert.equal(m.regs.a, 0x00, "xor a -> A=0");
  assert.equal(m.regs.d, 0x00, "D=0 (ld d,a)");
  assert.equal(m.regs.e, 0x47, "E low byte of DE=0x3847 preserved");
  assert.equal(m.regs.sp, 0x8780, "every push16 matched a callee ret -> baseline");
});

test("loc_5835 MUTATION: `ld (ix+0x0b),a` mis-charged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5843 ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(0x8d4a, 0x00);
  m.regs.ix = 0x8b00;

  loc_5835(m);

  assert.equal(m.tstates, 160, "mutation loses 12 T (19 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 172, "SPAWN T-state total"),
    /172/,
    "the 172-T golden must fail on the mutant",
  );
});
