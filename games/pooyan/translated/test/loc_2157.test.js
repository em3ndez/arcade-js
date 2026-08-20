// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_2157 (ROM 0x2157, Pooyan) -- scan 2 records at 0x8c90 (stride
 * 0x18), calling loc_21cf (boundary) for each whose (iy+0) bit0 is set; the loop counter lives in
 * 0x8f15 (seeded 2). After the loop, tamper-check 0x8f00 vs 0x0c + E (E=0xc9 from de=0x26c9): a
 * mismatch tail-jumps 0x22b1, a match zeroes 0x8f02 and returns.
 *
 * The mock's `call` POPS the pushed return address; boundary loc_21cf is register/memory preserving.
 * `call nz,0x21cf` push16 + pop when taken; the tail `jp nz,0x22b1` does NOT push16 (its callee ret
 * consumes CALLER_RET). pcSeq VISITS the call targets. TEETH: mis-charge `bit 0,(iy+0)` 7T (not 20T).
 *
 * Path JP: iter1 bit0 set (call taken), iter2 bit0 clear (call not taken), 0x8f00=0 -> tamper
 * mismatch -> tail jp 0x22b1. Path RET: both calls not taken, 0x8f00=0xd5 -> match -> ret at 0x2183.
 *
 * Run: node --test games/pooyan/translated/test/loc_2157.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2157 } from "../loc_2157.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x2157, pcSeq: [],
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

test("loc_2157 Path JP: iter1 call taken, iter2 not, tamper mismatch -> tail jp 0x22b1", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8c90, 0x01);        // record0 (iy+0) bit0 set -> call taken
  m.mem.write8(0x8ca8, 0x00);        // record1 (0x8c90+0x18) bit0 clear -> call not taken
  m.mem.write8(0x8f00, 0x00);        // 0 - 0x0c - 0xc9 != 0 -> jp nz taken

  loc_2157(m);

  assert.equal(m.tstates, 267, "Path JP T-state total");
  assert.deepEqual(m.pcSeq, [
    0x215b, 0x215d,
    0x2160, 0x2164, 0x21cf, 0x216a, 0x216c, 0x216f, 0x2171, 0x215d, // iter1 call taken, jr taken
    0x2160, 0x2164, 0x2167, 0x216a, 0x216c, 0x216f, 0x2171, 0x2173, // iter2 call not taken, jr out
    0x2176, 0x2179, 0x217b, 0x217c, 0x22b1,                         // tamper mismatch -> tail jp
  ], "loop 2x then tail jp");
  assert.equal(m.pc, 0x22b1, "tail jp lands on 0x22b1");
  assert.deepEqual(m.calls, [0x21cf, 0x22b1], "one loc_21cf + tail loc_22b1");
  assert.equal(m.regs.iy, 0x8cc0, "iy = 0x8c90 + 2*0x18");
  assert.equal(m.mem.read8(0x8f15), 0x01, "counter decremented to 1 on the last stored pass");
  assert.equal(m.regs.sp, 0x8780, "tail jp callee ret consumes CALLER_RET -> baseline");
});

test("loc_2157 Path RET: both calls not taken, tamper match -> ret at 0x2183", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8c90, 0x00);        // both records bit0 clear
  m.mem.write8(0x8ca8, 0x00);
  m.mem.write8(0x8f00, 0xd5);        // 0xd5 - 0x0c - 0xc9 == 0 -> jp nz not taken
  m.mem.write8(0x8f02, 0x55);        // will be zeroed

  loc_2157(m);

  assert.equal(m.tstates, 287, "Path RET T-state total");
  assert.deepEqual(m.pcSeq, [
    0x215b, 0x215d,
    0x2160, 0x2164, 0x2167, 0x216a, 0x216c, 0x216f, 0x2171, 0x215d, // iter1 call not taken, jr taken
    0x2160, 0x2164, 0x2167, 0x216a, 0x216c, 0x216f, 0x2171, 0x2173, // iter2 call not taken, jr out
    0x2176, 0x2179, 0x217b, 0x217c, 0x217f, 0x2180, 0x2183, CALLER_RET,
  ], "loop 2x then fall through to ret");
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.deepEqual(m.calls, [], "no calls -- both records inactive");
  assert.equal(m.mem.read8(0x8f02), 0x00, "0x8f02 zeroed");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_2157 MUTATION: `bit 0,(iy+0)` mis-charged 7T (not 20T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x2164 ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(0x8c90, 0x01);
  m.mem.write8(0x8ca8, 0x00);
  m.mem.write8(0x8f00, 0x00);

  loc_2157(m);

  assert.equal(m.tstates, 241, "mutation loses 2*13 T (20 -> 7 twice)");
  assert.throws(() => assert.equal(m.tstates, 267, "golden T"), /267/, "the 267-T golden must fail");
});
