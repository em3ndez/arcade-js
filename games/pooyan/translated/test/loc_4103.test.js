// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_4103 (ROM 0x4103, Pooyan) -- a per-object frame-advance step.
 * loc_4006 animates; (ix+11h) is a dwell countdown (ret while non-zero). On expiry it bumps the
 * phase (ix+02h), clears (ix+13h), and -- only when 0x8a5f reads zero -- sums the low nibbles of
 * 0x38 bytes at 0x557f into DE (E = sum low byte, D = carry count). If the checksum is the sentinel
 * (E==0x67 and D==1) it returns untouched; otherwise it bumps the 0x8a38 counter and returns.
 *
 * The mock's `call` POPS the pushed return address (modelling loc_4006's `ret`); a missing push16
 * then desyncs SP and the unwind tooth fails. loc_4006 writes only (ix+0ch..10h), none of the cells
 * loc_4103 reads, so the mock just pops.
 *
 * Path DWELL ((ix+11h)=2 -> 1): ret nz at 0x4109. T=51.
 * Path GATE  ((ix+11h)=1 -> 0, 0x8a5f!=0): ret nz at 0x4115. T=115.
 * Path BUMP  (all bytes 0 -> E=0 != 0x67): jr nz taken, inc (0x8a38), ret. Loop all jr-nc-taken.
 * Path SENTINEL (checksum E=0x67,D=1): the one carrying iteration takes inc d; jr nz not taken;
 *   sub d == 0 -> ret z at 0x4131. Exercises the inc-d branch and the ret-z terminal.
 * MUTATION: mis-charge `dec (ix+11h)` (23 T) as 11 T -> the golden T fails.
 *
 * Run: node --test games/pooyan/translated/test/loc_4103.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_4103 } from "../loc_4103.js";

const CALLER_RET = 0xabcd;
const IX = 0x9100;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x4103, pcSeq: [],
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
  m.regs.ix = IX;
}

// Build the expected pcSeq for a full-loop path. `carrySet` = 0-based loop indices whose `add a,e`
// carries (jr nc NOT taken -> inc d). `suffix` = the tail after the loop (post-0x4129).
function fullSeq(carrySet, suffix) {
  const seq = [
    0x4006, 0x4109, 0x410a, 0x410d, 0x4111, 0x4114, 0x4115, 0x4116,
    0x4119, 0x411b, 0x411c, 0x411d, 0x411e,
  ];
  for (let i = 0; i < 0x38; i++) {
    seq.push(0x411f, 0x4121, 0x4122, 0x4123);
    if (carrySet.has(i)) seq.push(0x4125, 0x4126); // inc d then inc hl target
    else seq.push(0x4126);
    seq.push(0x4127);
    seq.push(i < 0x37 ? 0x411e : 0x4129); // djnz taken vs fall-through
  }
  seq.push(...suffix);
  return seq;
}

test("loc_4103 Path DWELL: (ix+11h)!=0 after dec -> ret nz at 0x4109", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x02);

  loc_4103(m);

  assert.equal(m.tstates, 17 + 23 + 11, "call + dec + ret nz");
  assert.deepEqual(m.pcSeq, [0x4006, 0x4109, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x4006]);
  assert.equal(m.mem.read8(IX + 0x11), 0x01, "dwell decremented");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_4103 Path GATE: dwell expired but 0x8a5f != 0 -> ret nz at 0x4115", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x01);
  m.mem.write8(IX + 0x02, 0x00);
  m.mem.write8(0x8a5f, 0x01); // gate: non-zero -> ret nz

  loc_4103(m);

  assert.equal(m.tstates, 17 + 23 + 5 + 23 + 19 + 13 + 4 + 11, "through the 0x8a5f gate");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x4109, 0x410a, 0x410d, 0x4111, 0x4114, 0x4115, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x4006]);
  assert.equal(m.mem.read8(IX + 0x02), 0x01, "phase bumped");
  assert.equal(m.mem.read8(IX + 0x13), 0x00, "(ix+13h) cleared");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_4103 Path BUMP: checksum != sentinel -> jr nz taken, inc (0x8a38), ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x01);
  m.mem.write8(0x8a5f, 0x00);            // gate open
  for (let i = 0; i < 0x38; i++) m.mem.write8(0x557f + i, 0x00); // all zero -> E stays 0
  m.mem.write8(0x8a38, 0x40);

  loc_4103(m);

  // prefix 138 + loop(all jr-nc-taken) + suffix(jr nz taken path)
  const loopT = 0x37 * (40 + 13) + (40 + 8); // 55 iters djnz-taken + last djnz not-taken
  assert.equal(m.tstates, 138 + loopT + (7 + 4 + 12 + 10 + 11 + 10), "Path BUMP T");
  assert.equal(m.tstates, 3155, "Path BUMP T (absolute)");
  assert.deepEqual(m.pcSeq, fullSeq(new Set(), [0x412b, 0x412c, 0x4132, 0x4135, 0x4136, CALLER_RET]));
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x4006]);
  assert.equal(m.mem.read8(0x8a38), 0x41, "counter bumped 0x40 -> 0x41");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_4103 Path SENTINEL: checksum E=0x67,D=1 -> inc d branch, sub d, ret z at 0x4131", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x01);
  m.mem.write8(0x8a5f, 0x00);
  // 23 bytes of 0x0f then one 0x0e = 345 + 14 = 359 = 0x167 -> E=0x67, D=1.
  // The 18th add (index 17: 15*17=255, +15) is the single carry -> inc d once.
  for (let i = 0; i < 0x38; i++) m.mem.write8(0x557f + i, 0x00);
  for (let i = 0; i < 23; i++) m.mem.write8(0x557f + i, 0x0f);
  m.mem.write8(0x557f + 23, 0x0e);
  m.mem.write8(0x8a38, 0x40);

  loc_4103(m);

  const loopT = 0x37 * 13 + 8       // djnz: 55 taken + last not-taken
    + 0x37 * 40 + 39;               // bodies: 55 jr-nc-taken (40) + 1 jr-nc-not-taken (39)
  assert.equal(m.tstates, 138 + loopT + (7 + 4 + 7 + 7 + 4 + 11), "Path SENTINEL T");
  assert.equal(m.tstates, 3140, "Path SENTINEL T (absolute)");
  assert.deepEqual(
    m.pcSeq,
    fullSeq(new Set([17]), [0x412b, 0x412c, 0x412e, 0x4130, 0x4131, CALLER_RET]),
  );
  assert.equal(m.pc, CALLER_RET, "ret z at 0x4131");
  assert.deepEqual(m.calls, [0x4006]);
  assert.equal(m.mem.read8(0x8a38), 0x40, "counter NOT bumped on the sentinel path");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_4103 MUTATION: `dec (ix+11h)` mis-charged 11T (not 23T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x4109 ? 11 : cycles);
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x02);

  loc_4103(m);

  assert.equal(m.tstates, 17 + 11 + 11, "mutation loses 12 T");
  assert.throws(() => assert.equal(m.tstates, 51, "golden"), /51/, "golden T must fail on the mutant");
});
