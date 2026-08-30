// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_50f1 (ROM 0x50f1, Pooyan) -- a gated table-checksum walker.
 * If (0x89fb) != 0 it tail-jumps to loc_5119. Otherwise it walks the byte table at 0x6ac5,
 * summing each byte into E (carry into D) until 0xc9, then loads HL=0x5119, sets A=E,
 * `cp (hl)`, and tail-jumps into 0x6ac5.
 *
 * Pinned paths:
 *   gate (0x89fb=1): jr nz taken -> tail call loc_5119.
 *     T = 13 + 4 + 12 = 29. calls = [0x5119], A = 1.
 *   walk (0x89fb=0): table {0x10, 0xff, 0xc9}. iter1 sums 0x10 (no carry); iter2 sums 0xff
 *     -> E wraps 0x10->0x0f with carry -> inc D=1; iter3 hits 0xc9. Final E=0x0f, D=1.
 *     T = 44 (prologue) + 59 (iter1) + 58 (iter2, inc d branch) + 26 (iter3 term) + 31 (tail)
 *       = 218. calls = [0x6ac5], A = E = 0x0f.
 *
 * TEETH: mis-charge `inc hl` (6 T) as 4 T -- fired twice (iter1+iter2), total 218 -> 214.
 *
 * Run: node --test games/pooyan/translated/test/loc_50f1.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_50f1 } from "../loc_50f1.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x50f1, pcSeq: [],
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
    call(addr, site) { this.calls.push(addr); this.site = site; return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_50f1: gate (0x89fb != 0) tail-jumps to loc_5119", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x89fb, 0x01);
  loc_50f1(m);

  assert.equal(m.tstates, 29, "T = 13 + 4 + 12(jr nz taken)");
  assert.deepEqual(m.pcSeq, [0x50f4, 0x50f5, 0x5119], "and a, then jr nz to the alternate handler");
  assert.deepEqual(m.calls, [0x5119], "tail call to loc_5119");
  assert.equal(m.regs.a, 0x01, "A = (0x89fb) preserved");
  // tail jump reuses the caller frame: SP untouched, caller return still on top.
  assert.equal(m.pop16(), CALLER_RET, "caller return still seated (no push)");
});

test("loc_50f1: walk (0x89fb == 0) sums the table at 0x6ac5 until 0xc9, then tail-jumps to 0x6ac5", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x89fb, 0x00);
  m.mem.write8(0x6ac5, 0x10); // iter1: +0x10, no carry
  m.mem.write8(0x6ac6, 0xff); // iter2: +0xff -> wrap + carry -> inc D
  m.mem.write8(0x6ac7, 0xc9); // iter3: terminator
  m.mem.write8(0x5119, 0xed); // cp (0x5119) reads the alternate handler's first byte
  loc_50f1(m);

  assert.equal(m.tstates, 218, "44 prologue + 59 iter1 + 58 iter2 + 26 iter3 + 31 tail");
  assert.deepEqual(m.pcSeq, [
    0x50f4, 0x50f5, 0x50f7, 0x50fa, 0x50fd, // prologue
    0x50fe, 0x5100, 0x5102, 0x5103, 0x5104, 0x5107, 0x5108, 0x50fd, // iter1 (jr nc taken)
    0x50fe, 0x5100, 0x5102, 0x5103, 0x5104, 0x5106, 0x5107, 0x5108, 0x50fd, // iter2 (inc d)
    0x50fe, 0x5100, 0x510a, // iter3 (terminator)
    0x510d, 0x510e, 0x510f, 0x6ac5, // loc_510a tail
  ], "prologue, two summing iters (carry branch differs), terminator, then the tail jump");
  assert.deepEqual(m.calls, [0x6ac5], "tail-jumps into the table at 0x6ac5");
  assert.equal(m.regs.e, 0x0f, "E = (0x10 + 0xff) & 0xff = 0x0f");
  assert.equal(m.regs.d, 0x01, "D incremented once by the carry on iter2");
  assert.equal(m.regs.a, 0x0f, "A = E (ld a,e) before the tail jump");
  assert.equal(m.pop16(), CALLER_RET, "tail jump: caller return still seated");
});

test("loc_50f1 MUTATION: `inc hl` mis-charged 4T (not 6T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  // inc hl steps to 0x5108; mis-charge it 4T instead of 6T (fires on iter1 and iter2).
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5108 ? 4 : cycles);
  seatCaller(m);
  m.mem.write8(0x89fb, 0x00);
  m.mem.write8(0x6ac5, 0x10);
  m.mem.write8(0x6ac6, 0xff);
  m.mem.write8(0x6ac7, 0xc9);
  loc_50f1(m);

  assert.equal(m.tstates, 214, "mutation loses 2 T x2 inc hl (6 -> 4)");
});
