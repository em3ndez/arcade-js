// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for translated loc_6080 (ROM 0x6080-0x60bb, Pooyan). Entry (jp/jp-z target from
 * 0x61d4/0x61e6 + jump-table word at 0x2d01). Computes a signed X delta = IX[0] + (0x881f ? 6 : -2)
 * and takes |A| via the neg-if-negative idiom; |X| >= 9 tail-jumps loc_60f2 (miss). Then a signed Y
 * delta = (IX[2]+8) - (IY[0]) via E; |Y| >= 8 tail-jumps loc_60f2. On a hit it advances HL by 0x14,
 * points IY at 0x8ae0, loads (HL)/C=6/E=0x18 and falls through into loc_60bc.
 *
 * The mock's `call` POPS (tail callee ret consumes the seated CALLER_RET) -> SP back to baseline on
 * every path. loc_6080 has no internal pushing call. Paths cover every branch:
 *   HIT   (0x881f!=0 E=6; both deltas positive & in-window) -> fall through to loc_60bc
 *   MISS-X (0x881f==0 E=-2; neg at 0x609b; |X|>=9) -> loc_60f2
 *   MISS-Y (0x881f!=0; X in-window; neg at 0x60a9; |Y|>=8) -> loc_60f2
 * TEETH: mis-charge `ld a,(iy+0)` (19 T) as 7 T -> the HIT golden fails.
 *
 * Run: node --test games/pooyan/translated/test/loc_6080.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6080 } from "../loc_6080.js";

const CALLER_RET = 0xabcd;
const IX = 0x8868;
const IY = 0x8ac0;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6080, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; }, // tail callee ret pops CALLER_RET
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_6080 Path HIT: both deltas in window -> fall through into loc_60bc", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX; m.regs.iy = IY; m.regs.hl = 0x8b70;
  m.mem.write8(0x881f, 0x01);   // != 0 -> jr nz taken -> E stays 6
  m.mem.write8(IX + 0, 0x00);   // X: A = 0 + 6 = 6
  m.mem.write8(IX + 2, 0x00);   // D = 0 + 8 = 8
  m.mem.write8(IY + 0, 0x08);   // sub e(6) -> 2 (>=0), cp 9 -> in window
  m.mem.write8(IY + 2, 0x02);   // Y: A = 2 + 8 = 10, sub d(8) -> 2 (>=0), cp 8 -> in window
  m.mem.write8(0x8b84, 0x77);   // (HL+0x14) read into A at 0x60b7

  loc_6080(m);

  assert.equal(m.tstates, 254, "Path HIT T-state total");
  assert.deepEqual(m.pcSeq, [
    0x6082, 0x6085, 0x6086, 0x608a, 0x608d, 0x608e, 0x608f, 0x6092, 0x6094, 0x6095,
    0x6098, 0x6099, 0x609d, 0x609f, 0x60a1, 0x60a4, 0x60a6, 0x60a7, 0x60ab, 0x60ad,
    0x60af, 0x60b2, 0x60b3, 0x60b7, 0x60b8, 0x60ba, 0x60bc,
  ]);
  assert.equal(m.pc, 0x60bc, "last step lands on the loc_60bc entry");
  assert.deepEqual(m.calls, [0x60bc], "fall-through delegate to loc_60bc");
  assert.equal(m.regs.hl, 0x8b84, "HL advanced by 0x14");
  assert.equal(m.regs.iy, 0x8ae0, "IY repointed to 0x8ae0");
  assert.equal(m.regs.a, 0x77, "A = (HL+0x14)");
  assert.equal(m.regs.c, 0x06, "C = 6");
  assert.equal(m.regs.e, 0x18, "E = 0x18");
  assert.equal(m.regs.sp, 0x8780, "tail: stack unwound to baseline");
});

test("loc_6080 Path MISS-X: 0x881f==0 (E=-2), neg branch, |X|>=9 -> tail-jump loc_60f2", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX; m.regs.iy = IY; m.regs.hl = 0x8b70;
  m.mem.write8(0x881f, 0x00);   // == 0 -> jr nz NOT taken -> E = 0xfe
  m.mem.write8(IX + 0, 0x10);   // A = 0x10 + 0xfe = 0x0e, E = 0x0e
  m.mem.write8(IX + 2, 0x00);   // D = 8
  m.mem.write8(IY + 0, 0x00);   // sub e(0x0e) -> borrow -> jr nc NOT taken -> neg -> A = 0x0e
  // cp 0x09 -> 0x0e >= 9 -> jr nc taken -> tail loc_60f2

  loc_6080(m);

  assert.equal(m.tstates, 152, "Path MISS-X T-state total");
  assert.deepEqual(m.pcSeq, [
    0x6082, 0x6085, 0x6086, 0x6088, 0x608a, 0x608d, 0x608e, 0x608f, 0x6092, 0x6094,
    0x6095, 0x6098, 0x6099, 0x609b, 0x609d, 0x609f, 0x60f2,
  ]);
  assert.equal(m.pc, 0x60f2);
  assert.deepEqual(m.calls, [0x60f2]);
  assert.equal(m.regs.a, 0x0e, "|X delta| after neg");
  assert.equal(m.regs.sp, 0x8780, "tail: stack unwound to baseline");
});

test("loc_6080 Path MISS-Y: X in window, neg at 0x60a9, |Y|>=8 -> tail-jump loc_60f2", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX; m.regs.iy = IY; m.regs.hl = 0x8b70;
  m.mem.write8(0x881f, 0x01);   // != 0 -> E = 6
  m.mem.write8(IX + 0, 0x00);   // A = 6, E = 6
  m.mem.write8(IX + 2, 0x00);   // D = 8
  m.mem.write8(IY + 0, 0x08);   // sub e(6) -> 2 (>=0) -> cp 9 in window -> continue
  m.mem.write8(IY + 2, 0xf8);   // A = 0xf8 + 8 = 0x00, sub d(8) -> borrow -> neg -> A = 8, cp 8 -> miss

  loc_6080(m);

  assert.equal(m.tstates, 206, "Path MISS-Y T-state total");
  assert.deepEqual(m.pcSeq, [
    0x6082, 0x6085, 0x6086, 0x608a, 0x608d, 0x608e, 0x608f, 0x6092, 0x6094, 0x6095,
    0x6098, 0x6099, 0x609d, 0x609f, 0x60a1, 0x60a4, 0x60a6, 0x60a7, 0x60a9, 0x60ab,
    0x60ad, 0x60f2,
  ]);
  assert.equal(m.pc, 0x60f2);
  assert.deepEqual(m.calls, [0x60f2]);
  assert.equal(m.regs.a, 0x08, "|Y delta| after neg");
  assert.equal(m.regs.sp, 0x8780, "tail: stack unwound to baseline");
});

test("loc_6080 MUTATION: `ld a,(iy+0)` mis-charged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX; m.regs.iy = IY; m.regs.hl = 0x8b70;
  m.mem.write8(0x881f, 0x01);
  m.mem.write8(IX + 0, 0x00);
  m.mem.write8(IX + 2, 0x00);
  m.mem.write8(IY + 0, 0x08);
  m.mem.write8(IY + 2, 0x02);
  m.mem.write8(0x8b84, 0x77);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x6098 ? 7 : c); // ld a,(iy+0) steps to 0x6098

  loc_6080(m);

  assert.equal(m.tstates, 242, "mutation loses 12 T (19 -> 7)");
  assert.throws(() => assert.equal(m.tstates, 254, "Path HIT T-state total"), /254/,
    "the 254-T golden must fail on the mutant");
});
