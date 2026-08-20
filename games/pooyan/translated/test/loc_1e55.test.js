// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1e55 (ROM 0x1e55, Pooyan) -- per-frame update of the 0x8a80
 * object's state byte (ix+7). Leaf routine (no calls). A chain of guards clears (ix+7) and rets
 * (loc_1ea2) or rets early; the happy path reads an input (0xa0a0 or 0xa0c0 per 0x881f), complements
 * it into (ix+7), shifts its top bit through the 0x8f03 latch (rl (hl)), and if the low-3 latch != 1
 * clears bit4 of (ix+7).
 *
 * The mock's `call` still POPS (template fidelity) though this routine never calls. seatCaller seats
 * a return address so each terminal `ret` lands on it; the SP-baseline tooth asserts full unwind.
 *
 * Paths: ABORT (0x89e5|0x89fb nonzero -> jr nz -> loc_1ea2 zeroes ix+7), GATE (0x8806==0 -> ret z),
 * FULL (all guards clear, 0x881f nonzero -> 0xa0a0 input, latch low-3 != 1 -> res 4,(ix+7)),
 * LATCH1 (0x881f==0 -> 0xa0c0 input, latch low-3 == 1 -> ret z, ix+7 left as complemented input).
 * TEETH: mis-charge `res 4,(ix+7)` (23 T) as 19 T -> the 336-T FULL golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_1e55.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1e55 } from "../loc_1e55.js";

const CALLER_RET = 0xabcd;
const BASE_SP = 0x8780;
const IX7 = 0x8a87; // ix (0x8a80) + 7

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1e55, pcSeq: [],
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
  m.regs.sp = BASE_SP;
  m.push16(CALLER_RET);
}

test("loc_1e55 ABORT: 0x89e5|0x89fb nonzero -> jr nz -> loc_1ea2 zeroes (ix+7)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x89e5, 0x01); // b = 0x01 -> or with (0x89fb=0) -> nonzero -> jr nz
  m.mem.write8(0x89fb, 0x00);
  m.mem.write8(IX7, 0xff);     // pre-set to prove it is zeroed

  loc_1e55(m);

  assert.deepEqual(m.pcSeq, [
    0x1e58, 0x1e59, 0x1e5a, 0x1e5c, 0x1e5d, 0x1e5e, 0x1e5f, 0x1e60, 0x1e64,
    0x1ea2, 0x1ea6, CALLER_RET,
  ]);
  // 10+7+4+7+4+4+7+4+14 (=61) + 12 (jr nz taken) + 19 (ld (ix+7),0) + 10 (ret)
  assert.equal(m.tstates, 61 + 12 + 19 + 10);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.ix, 0x8a80, "ix = 0x8a80");
  assert.equal(m.mem.read8(IX7), 0x00, "(ix+7) zeroed by loc_1ea2");
  assert.equal(m.regs.sp, BASE_SP, "stack fully unwound");
  assert.deepEqual(m.calls, [], "leaf: no calls");
});

test("loc_1e55 GATE: guards clear but 0x8806 == 0 -> ret z", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x89e5, 0x00);
  m.mem.write8(0x89fb, 0x00);
  m.mem.write8(0x8806, 0x00); // gate closed -> ret z
  m.mem.write8(IX7, 0x55);

  loc_1e55(m);

  assert.deepEqual(m.pcSeq, [
    0x1e58, 0x1e59, 0x1e5a, 0x1e5c, 0x1e5d, 0x1e5e, 0x1e5f, 0x1e60, 0x1e64,
    0x1e66, 0x1e69, 0x1e6a, CALLER_RET,
  ]);
  // 61 (through ld ix) + 7 (jr nz not taken) + 13 (ld a,0x8806) + 4 (and a) + 11 (ret z)
  assert.equal(m.tstates, 61 + 7 + 13 + 4 + 11);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(IX7), 0x55, "(ix+7) untouched on the gate ret");
  assert.equal(m.regs.sp, BASE_SP, "stack fully unwound");
});

const PC_FULL = [
  0x1e58, 0x1e59, 0x1e5a, 0x1e5c, 0x1e5d, 0x1e5e, 0x1e5f, 0x1e60, 0x1e64,
  0x1e66, 0x1e69, 0x1e6a, 0x1e6b, 0x1e6f, 0x1e72, 0x1e73,
  0x1e75, 0x1e78, 0x1e7b, 0x1e7c, 0x1e7e, 0x1e81, 0x1e82, 0x1e85,
  0x1e8a, // jr nz taken -> keep 0xa0a0
  0x1e8b, 0x1e8e, 0x1e8f, 0x1e90, 0x1e91, 0x1e94, 0x1e95, 0x1e97, 0x1e98, 0x1e9a, 0x1e9c,
  0x1e9d, 0x1ea1, CALLER_RET,
];

function setupFull(m) {
  seatCaller(m);
  m.mem.write8(0x89e5, 0x00);
  m.mem.write8(0x89fb, 0x00);
  m.mem.write8(0x8806, 0x01); // gate open
  m.mem.write8(0x8a82, 0x00); // (ix+2) == 0 -> jr nz not taken
  m.mem.write8(0x8f24, 0x00);
  m.mem.write8(0x8f57, 0x00); // 0x8f24 | (0x8f57) == 0 -> jr nz not taken
  m.mem.write8(0x881f, 0x01); // nonzero -> jr nz taken -> input = 0xa0a0
  m.mem.write8(0xa0a0, 0x00); // cpl -> 0xff into (ix+7)
  m.mem.write8(0x8f03, 0x02); // rl (hl) with carry-in 1 -> 0x05 (low-3 = 5 != 1)
  m.mem.write8(IX7, 0x00);
}

test("loc_1e55 FULL: all guards clear, latch low-3 != 1 -> res 4,(ix+7)", () => {
  const m = makeMachine();
  setupFull(m);

  loc_1e55(m);

  assert.equal(m.tstates, 336, "FULL T-state total");
  assert.deepEqual(m.pcSeq, PC_FULL, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "final ret to seated caller");
  assert.equal(m.regs.sp, BASE_SP, "stack fully unwound");
  // cpl(0x00)=0xff -> (ix+7); then res bit4 -> 0xff & ~0x10 = 0xef
  assert.equal(m.mem.read8(IX7), 0xef, "(ix+7) = complemented input with bit4 cleared");
  assert.equal(m.mem.read8(0x8f03), 0x05, "latch rotated: (0x02<<1)|carry = 0x05");
  assert.deepEqual(m.calls, [], "leaf: no calls");
});

test("loc_1e55 LATCH1: 0x881f==0 -> 0xa0c0 input, latch low-3 == 1 -> ret z (ix+7 kept)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x89e5, 0x00);
  m.mem.write8(0x89fb, 0x00);
  m.mem.write8(0x8806, 0x01);
  m.mem.write8(0x8a82, 0x00);
  m.mem.write8(0x8f24, 0x00);
  m.mem.write8(0x8f57, 0x00);
  m.mem.write8(0x881f, 0x00); // zero -> jr nz not taken -> input = 0xa0c0
  m.mem.write8(0xa0c0, 0x00); // cpl -> 0xff into (ix+7)
  m.mem.write8(0x8f03, 0x00); // rl (hl) with carry-in 1 -> 0x01 (low-3 == 1 -> ret z)
  m.mem.write8(IX7, 0x00);

  loc_1e55(m);

  assert.deepEqual(m.pcSeq, [
    0x1e58, 0x1e59, 0x1e5a, 0x1e5c, 0x1e5d, 0x1e5e, 0x1e5f, 0x1e60, 0x1e64,
    0x1e66, 0x1e69, 0x1e6a, 0x1e6b, 0x1e6f, 0x1e72, 0x1e73,
    0x1e75, 0x1e78, 0x1e7b, 0x1e7c, 0x1e7e, 0x1e81, 0x1e82, 0x1e85,
    0x1e87, // jr nz not taken -> ld a,(0xa0c0)
    0x1e8a, 0x1e8b, 0x1e8e, 0x1e8f, 0x1e90, 0x1e91, 0x1e94, 0x1e95, 0x1e97, 0x1e98, 0x1e9a, 0x1e9c,
    CALLER_RET, // ret z taken at 0x1e9c
  ]);
  // through 0x1e81 (=188) + 13(ld a0a0) +7(jr nz nt) +13(ld a0c0) +4(cpl) +19(ld ix+7,a)
  //  +4+4+4(3 rla) +10(ld hl) +4(rla) +15(rl hl) +7(ld a) +7(and) +7(cp) +11(ret z)
  assert.equal(m.tstates, 317, "LATCH1 T-state total");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(IX7), 0xff, "(ix+7) left as the complemented input (no res)");
  assert.equal(m.mem.read8(0x8f03), 0x01, "latch (0x00<<1)|carry = 0x01");
  assert.equal(m.regs.sp, BASE_SP, "stack fully unwound");
});

test("loc_1e55 MUTATION: `res 4,(ix+7)` mis-charged 19T (not 23T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1ea1 ? 19 : cycles);
  setupFull(m);

  loc_1e55(m);

  assert.equal(m.tstates, 332, "mutation loses 4 T (23 -> 19)");
  assert.throws(
    () => assert.equal(m.tstates, 336, "FULL T-state total"),
    /336/,
    "the 336-T golden must fail on the mutant",
  );
});
