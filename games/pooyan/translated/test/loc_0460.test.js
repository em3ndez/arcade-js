// SPDX-License-Identifier: GPL-3.0-only
/**
 * Test for loc_0460 (ROM 0x0460-0x0495, Pooyan) -- the 10-row x 3-cell 0x8e00->0x8567 renderer.
 * Self-contained mock machine (real Regs, flat 64K RAM). No calls; a seated caller return proves
 * the final `ret`. Path A (full pcSeq): every (ix) non-zero -> each cell writes the byte itself
 * (jr nz taken); DE=0xffe0 climbs two rows then 0x0042 re-bases. Path B: (ix)=0 -> the blank tile
 * 0x40 is substituted (jr nz not taken). Golden 2256 T computed independently from Z80 timings.
 * TEETH: mis-charge the first `ld a,(ix+0)` (19 T) as 13 T; the 2256-T golden must catch it.
 * Run: node --test games/pooyan/translated/test/loc_0460.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0460 } from "../loc_0460.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0460, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); regs.sp = (regs.sp + 2) & 0xffff; return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// One iteration's step targets when all three cells take jr-nz (source byte non-zero).
const iter = (last) => [
  0x046c, 0x046f, 0x0470, 0x0474, 0x0475, 0x0476, 0x0478,
  0x047b, 0x047c, 0x0480, 0x0481, 0x0482, 0x0484,
  0x0487, 0x0488, 0x048c, 0x048d, 0x048f, 0x0492, 0x0493,
  last ? 0x0495 : 0x0469,
];

function buildPcSeq() {
  const pc = [0x0464, 0x0467, 0x0469];
  for (let i = 0; i < 10; i++) pc.push(...iter(i === 9));
  pc.push(CALLER_RET);
  return pc;
}

test("loc_0460 Path A: all cells non-zero -> byte written, DE climb/re-base, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  for (let a = 0x8e00; a <= 0x8e1d; a++) m.mem.write8(a, 0x55); // 10 rows x 3 non-zero bytes

  loc_0460(m);

  assert.equal(m.pc, CALLER_RET, "ends via ret");
  assert.equal(m.tstates, 2256, "Path A T-state total");
  assert.deepEqual(m.calls, [], "no calls");
  assert.deepEqual(m.pcSeq, buildPcSeq(), "step boundaries match the disassembly");

  for (let r = 0; r < 10; r++) {
    const start = 0x8567 + 2 * r;
    assert.equal(m.mem.read8(start), 0x55, `row ${r} cell1`);
    assert.equal(m.mem.read8((start - 0x20) & 0xffff), 0x55, `row ${r} cell2 (one row up)`);
    assert.equal(m.mem.read8((start - 0x40) & 0xffff), 0x55, `row ${r} cell3 (two rows up)`);
  }
  assert.equal(m.regs.b, 0x00, "B exhausted by djnz");
  assert.equal(m.regs.a, 0x55, "A = last non-zero source byte");
  assert.equal(m.regs.hl, 0x857b, "HL = 0x8567 + 2*10");
  assert.equal(m.regs.ix, 0x8e1e, "IX = 0x8e00 + 3*10");
  assert.equal(m.regs.de, 0x0042, "DE = the last re-base delta");
});

test("loc_0460 Path B: a zero source byte substitutes the blank tile 0x40", () => {
  const m = makeMachine();
  seatCaller(m);
  for (let a = 0x8e00; a <= 0x8e1d; a++) m.mem.write8(a, 0x55);
  m.mem.write8(0x8e00, 0x00); // row 0 cell 1 -> blank

  loc_0460(m);

  assert.equal(m.mem.read8(0x8567), 0x40, "zero byte rendered as blank tile 0x40");
  assert.equal(m.mem.read8(0x8547), 0x55, "cell 2 unaffected");
});

test("loc_0460 MUTATION: first `ld a,(ix+0)` mis-charged 13 T (not 19) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  for (let a = 0x8e00; a <= 0x8e1d; a++) m.mem.write8(a, 0x55);
  const real = m.step.bind(m);
  let first = true;
  m.step = (n, c) => { if (first && n === 0x046f) { first = false; return real(n, 13); } return real(n, c); };

  loc_0460(m);

  assert.equal(m.tstates, 2250, "mutant lost exactly 6 T");
  assert.throws(() => assert.equal(m.tstates, 2256, "Path A T-state total"), /Path A T-state total/);
});
