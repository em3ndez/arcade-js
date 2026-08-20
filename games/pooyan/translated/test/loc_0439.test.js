// SPDX-License-Identifier: GPL-3.0-only
/**
 * Test for loc_0439 (ROM 0x0439-0x045f, Pooyan) -- the 10-row 0x89c0->0x8467 panel renderer.
 * Self-contained mock machine (real Regs, flat 64K RAM). loc_0439 calls 0x0429 (this batch); the
 * mock's `call` models the callee's contract exactly -- write low nibble to (hl), HL += DE, A =
 * high nibble, Z per high nibble -- and rebalances SP for the callee's ret, so loc_0439's own step
 * boundaries stay pure. Path A (full pcSeq): every source byte 0x12 -> both nibble pairs drawn,
 * 0x51 separator between them (jr z never taken). Golden 1646 T from the Z80 timings.
 * TEETH: mis-charge `ld ix,0x89c0` (14 T) as 10 T; the 1646-T golden must catch it.
 * Run: node --test games/pooyan/translated/test/loc_0439.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0439 } from "../loc_0439.js";

const CALLER_RET = 0xabcd;

// Faithful stand-in for loc_0429: split (ix) into nibbles, store low, advance HL, high -> A, set Z.
function emulate0429(regs, mem) {
  const raw = mem.read8(regs.ix & 0xffff);
  mem.write8(regs.hl, raw & 0x0f);
  regs.hl = (regs.hl + regs.de) & 0xffff;
  regs.a = (raw >> 4) & 0x0f;
  regs.and(0x0f); // sets Z when the high nibble is 0
}

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0439, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) {
      this.calls.push(addr);
      regs.sp = (regs.sp + 2) & 0xffff; // callee's ret pops the pushed return
      if (addr === 0x0429) emulate0429(regs, mem);
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// One iteration's step targets when the second 0x0429 high nibble is non-zero (jr z not taken).
const iter = (last) => [
  0x0445, 0x0447, 0x0429, 0x044b, 0x044c, 0x044e, 0x044f, 0x0451, 0x0429, 0x0456, 0x0457,
  0x0459, 0x045c, 0x045d, last ? 0x045f : 0x0442,
];

function buildPcSeq() {
  const pc = [0x043d, 0x0440, 0x0442];
  for (let i = 0; i < 10; i++) pc.push(...iter(i === 9));
  pc.push(CALLER_RET);
  return pc;
}

test("loc_0439 Path A: all bytes 0x12 -> nibble pairs + 0x51 separator, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  for (let a = 0x89c0; a <= 0x89e0; a++) m.mem.write8(a, 0x12); // low 2, high 1 everywhere

  loc_0439(m);

  assert.equal(m.pc, CALLER_RET, "ends via ret");
  assert.equal(m.tstates, 1646, "Path A T-state total");
  assert.deepEqual(m.calls, Array(20).fill(0x0429), "two 0x0429 calls per row");
  assert.deepEqual(m.pcSeq, buildPcSeq(), "step boundaries match the disassembly");

  for (let r = 0; r < 10; r++) {
    const start = 0x8467 + 2 * r;
    assert.equal(m.mem.read8(start), 0x02, `row ${r} pair1 low`);
    assert.equal(m.mem.read8((start + 0x20) & 0xffff), 0x01, `row ${r} pair1 high`);
    assert.equal(m.mem.read8((start + 0x40) & 0xffff), 0x51, `row ${r} separator tile`);
    assert.equal(m.mem.read8((start + 0x60) & 0xffff), 0x02, `row ${r} pair2 low`);
    assert.equal(m.mem.read8((start + 0x80) & 0xffff), 0x01, `row ${r} pair2 high`);
  }
  assert.equal(m.regs.b, 0x00, "B exhausted by djnz");
  assert.equal(m.regs.a, 0x01, "A = last high nibble");
  assert.equal(m.regs.hl, 0x847b, "HL = 0x8467 + 2*10");
  assert.equal(m.regs.ix, 0x89de, "IX = 0x89c0 + 3*10");
  assert.equal(m.regs.de, 0xff82, "DE = the last re-base delta");
});

test("loc_0439 Path B: second nibble high = 0 -> jr z suppresses the store", () => {
  const m = makeMachine();
  seatCaller(m);
  for (let a = 0x89c0; a <= 0x89e0; a++) m.mem.write8(a, 0x12);
  // Row 0's second 0429 reads (ix)=0x89c2; make its high nibble 0 (byte 0x07).
  m.mem.write8(0x89c2, 0x07);

  loc_0439(m);

  // The suppressed store target is 0x8467 + 0x80 = 0x84e7 for row 0; the low nibble still lands.
  assert.equal(m.mem.read8(0x84c7), 0x07, "row 0 pair2 low nibble still written");
  assert.equal(m.mem.read8(0x84e7), 0x00, "row 0 pair2 high suppressed (jr z taken) -- stays 0");
});

test("loc_0439 MUTATION: `ld ix,0x89c0` mis-charged 10 T (not 14) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  for (let a = 0x89c0; a <= 0x89e0; a++) m.mem.write8(a, 0x12);
  const real = m.step.bind(m);
  let first = true;
  m.step = (n, c) => { if (first && n === 0x043d) { first = false; return real(n, 10); } return real(n, c); };

  loc_0439(m);

  assert.equal(m.tstates, 1642, "mutant lost exactly 4 T");
  assert.throws(() => assert.equal(m.tstates, 1646, "Path A T-state total"), /Path A T-state total/);
});
