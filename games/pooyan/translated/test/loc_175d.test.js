// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_175d (ROM 0x175d, Pooyan) -- the idx2 leaf handler. Runs loc_4381,
 * advances 0x88b7 (wraps at 0x1c, returns until then) and, on wrap, toggles the one-shot at 0x8920
 * (returns if it was 0). Past the guards it picks an action keyed on 0x8f50 / 0x8904 / 0x8806 /
 * 0x8907: arm sub-state 0x0d (0x880a) at loc_1792, or (loc_1798) mark 0x8904/0x8903 and run the
 * level-start batch (loc_1ead, loc_2065, loc_4a0b, seed 0x8a91/0x8f06/0x8f09=0x10, loc_540d,
 * loc_02ef) before forcing sub-state 3 at loc_17bb.
 *
 * The mock's `call` POPS the return address loc_175d pushed at each call site (modelling the callee's
 * `ret`); a missing push16 then desyncs SP and the routine's own ret returns to the wrong address --
 * so the pcSeq/SP assertions have real teeth. No callee leaves a register loc_175d depends on after.
 *
 * Paths: BATCH (wrap + one-shot set + 0x8904 set -> jr nz 0x17a1 -> five calls + seeds + 0x17bb,
 * T=329); ARM (0x8907 bit0 set -> loc_1792 sets 0x880a=0x0d + ret, T=250); GATE-NZ (0x88b7 not at
 * wrap -> ret nz, T=63); GATE-Z (one-shot 0x8920 was 0 -> ret z, T=110).
 * TEETH: mis-charge `inc (0x88b7)` (11T) as 7T -> the 329-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_175d.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_175d } from "../loc_175d.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x175d, pcSeq: [],
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

// Shared head: 0x88b7 reaches the wrap (0x1b -> 0x1c) and the one-shot 0x8920 was nonzero.
function setupWrap(m) {
  seatCaller(m);
  m.mem.write8(0x88b7, 0x1b); // inc -> 0x1c -> cp 0x1c -> ret nz not taken
  m.mem.write8(0x8920, 0x05); // nonzero one-shot -> ret z not taken, then cleared
}

const PC_BATCH = [
  0x4381, 0x1763, 0x1764, 0x1765, 0x1767, // call 0x4381, inc 0x88b7 -> 0x1c, ret nz not taken
  0x1768, 0x176a, 0x176d, 0x176e, 0x176f, 0x1770, 0x1771, 0x1772, 0x1773, 0x1776, 0x1777, // reset + one-shot
  0x1779, 0x177c, 0x177d, // 0x8904 set -> jr nz 0x17a1
  0x17a1, 0x1ead, 0x2065, 0x4a0b, 0x17ac, 0x17af, 0x17b2, 0x17b5, 0x540d, 0x02ef, // level-start batch
  0x17be, 0x17c0, CALLER_RET, // 0x17bb: force sub-state 3, ret
];

function setupBatch(m) {
  setupWrap(m);
  m.mem.write8(0x8f50, 0x00); // not attract -> jr nz not taken
  m.mem.write8(0x8904, 0x02); // already started -> jr nz 0x17a1
}

test("loc_175d BATCH: wrap + one-shot + 0x8904 set -> level-start batch + sub-state 3", () => {
  const m = makeMachine();
  setupBatch(m);

  loc_175d(m);

  assert.equal(m.tstates, 329, "BATCH T-state total");
  assert.deepEqual(m.pcSeq, PC_BATCH, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "0x17c0 ret returns to the seated caller");
  assert.deepEqual(m.calls, [0x4381, 0x1ead, 0x2065, 0x4a0b, 0x540d, 0x02ef], "call order");
  assert.equal(m.mem.read8(0x88b7), 0x00, "0x88b7 reset on wrap");
  assert.equal(m.mem.read8(0x8920), 0x00, "one-shot cleared");
  assert.equal(m.mem.read8(0x8a91), 0x10, "0x8a91 seeded");
  assert.equal(m.mem.read8(0x8f06), 0x10, "0x8f06 seeded");
  assert.equal(m.mem.read8(0x8f09), 0x10, "0x8f09 seeded");
  assert.equal(m.mem.read8(0x880a), 0x03, "sub-state forced to 3");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_175d ARM: 0x8907 bit0 set -> loc_1792 arms sub-state 0x0d + ret", () => {
  const m = makeMachine();
  setupWrap(m);
  m.mem.write8(0x8f50, 0x00); // not attract
  m.mem.write8(0x8904, 0x00); // not started -> jr nz not taken
  m.mem.write8(0x8806, 0x01); // credit -> jr z not taken
  m.mem.write8(0x8907, 0x01); // bit0 set -> jr nz 0x1792

  loc_175d(m);

  assert.equal(m.tstates, 250, "ARM T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4381, 0x1763, 0x1764, 0x1765, 0x1767,
    0x1768, 0x176a, 0x176d, 0x176e, 0x176f, 0x1770, 0x1771, 0x1772, 0x1773, 0x1776, 0x1777,
    0x1779, 0x177c, 0x177d, 0x177f, 0x1782, 0x1783, 0x1785, 0x1788, 0x178a, // -> jr nz 0x1792
    0x1792, 0x1794, 0x1797, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x4381], "only loc_4381 -- no level-start batch");
  assert.equal(m.mem.read8(0x880a), 0x0d, "sub-state armed to 0x0d");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_175d GATE-NZ: 0x88b7 not at wrap -> ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x88b7, 0x00); // inc -> 0x01 != 0x1c -> ret nz

  loc_175d(m);

  assert.equal(m.tstates, 17 + 10 + 11 + 7 + 7 + 11, "call + ld hl + inc(hl) + ld a + cp + ret nz");
  assert.deepEqual(m.pcSeq, [0x4381, 0x1763, 0x1764, 0x1765, 0x1767, CALLER_RET]);
  assert.deepEqual(m.calls, [0x4381]);
  assert.equal(m.mem.read8(0x88b7), 0x01, "counter advanced 0 -> 1");
  assert.equal(m.pc, CALLER_RET);
});

test("loc_175d GATE-Z: one-shot 0x8920 was 0 -> ret z", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x88b7, 0x1b); // reaches wrap
  m.mem.write8(0x8920, 0x00); // one-shot 0 -> ret z

  loc_175d(m);

  assert.equal(m.tstates, 110, "GATE-Z T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4381, 0x1763, 0x1764, 0x1765, 0x1767, 0x1768, 0x176a, 0x176d, 0x176e, 0x176f, 0x1770, CALLER_RET,
  ]);
  assert.deepEqual(m.calls, [0x4381]);
  assert.equal(m.mem.read8(0x88b7), 0x00, "0x88b7 reset on wrap");
  assert.equal(m.mem.read8(0x8920), 0x01, "one-shot incremented 0 -> 1");
  assert.equal(m.pc, CALLER_RET);
});

test("loc_175d MUTATION: `inc (0x88b7)` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1764 ? 7 : cycles);
  setupBatch(m);

  loc_175d(m);

  assert.equal(m.tstates, 325, "mutation loses 4 T (11 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 329, "BATCH T-state total"),
    /329/,
    "the 329-T golden must fail on the mutant",
  );
});
