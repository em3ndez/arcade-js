// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_210b (ROM 0x210b-0x2156 + 0x2184-0x21cc, Pooyan) -- a one-shot
 * state advance gated by (0x8a80+7) bit4 and the (0x8f02) once-latch. It clears the trigger bit,
 * latches (0x8f02), optionally arms bit1 of the second 0x8c90 slot, then scans the two 0x8c90
 * slots (stride 0x18) for one whose bit0 is CLEAR. That slot is initialised (loc_2184 span) and the
 * routine tails to loc_22b1; if both slots have bit0 set, (0x8a3c) decides between a tail to
 * loc_2157 and a plain ret.
 *
 * The mock's `call` POPS the return address the call site pushed (rst 0x10 pushes 0x21bc; the tail
 * jp/jr to loc_22b1 / loc_2157 reuses the seated caller frame). Every path here ends with SP back
 * at the pre-seat baseline -- a missing push16 desyncs it (positive control confirmed).
 *
 * Branch coverage: T1 ret z@2117; T2 ret nz@211d; T3 jr c + loop fallout + ret@2156; T4 same, tail
 * jr@2154 -> loc_2157; T5 pre-block arm + span2 (bit1 set, bit3 e clear) -> loc_22b1; T6 loop
 * advance once + span2 (bit1 clear, bit3 e set); T7 jr nz@212f (D) taken; T8 jr nz@2135 (E) taken.
 * TEETH: T5 T=620 golden + a mutation charging `set 0,(iy+0)` at 19 T (not 23).
 *
 * Run: node --test games/pooyan/translated/test/loc_210b.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_210b } from "../loc_210b.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x210b, pcSeq: [],
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
    // rst 0x10 (loc_0010) and the tail jp/jr (loc_22b1 / loc_2157) each consume the address the
    // call/jump site left on the stack via their own `ret`.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_210b T1: trigger bit4 clear -> ret z at 0x2117 (slot flag still cleared)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8a87, 0x01); // (ix+7) bit4 clear (but non-zero) -> ret z; the ld (ix+7),0 still runs

  loc_210b(m);

  assert.equal(m.tstates, 14 + 20 + 19 + 11);
  assert.deepEqual(m.pcSeq, [0x210f, 0x2113, 0x2117, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(0x8a87), 0x00, "(ix+7) cleared before the ret");
  assert.equal(m.regs.sp, 0x8780);
  assert.deepEqual(m.calls, []);
});

test("loc_210b T2: bit4 set but (0x8f02) latched -> ret nz at 0x211d", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8a87, 0x10); // bit4 set -> ret z not taken
  m.mem.write8(0x8f02, 0x05); // already latched -> ret nz

  loc_210b(m);

  assert.equal(m.tstates, 14 + 20 + 19 + 5 + 10 + 7 + 4 + 11);
  assert.deepEqual(m.pcSeq, [0x210f, 0x2113, 0x2117, 0x2118, 0x211b, 0x211c, 0x211d, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(0x8f02), 0x05, "latch untouched (inc not reached)");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_210b T3: jr c, both slots bit0 set, (0x8a3c)==0 -> ret at 0x2156", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8a87, 0x10); // bit4 set
  m.mem.write8(0x8f02, 0x00); // not latched -> inc to 1
  m.mem.write8(0x8f30, 0x00); // < 2 -> jr c taken
  m.mem.write8(0x8c90, 0x01); // slot0 bit0 set
  m.mem.write8(0x8ca8, 0x01); // slot1 bit0 set
  m.mem.write8(0x8a3c, 0x00); // ixh:0x3c -> and a Z -> jr nz not taken -> ret

  loc_210b(m);

  assert.equal(m.tstates, 306);
  assert.deepEqual(m.pcSeq, [
    0x210f, 0x2113, 0x2117, 0x2118, 0x211b, 0x211c, 0x211d, 0x211e, 0x211f, 0x2123,
    0x2126, 0x2128, 0x213f, 0x2142, 0x2144, 0x2148, 0x214a, 0x214c, 0x2144, 0x2148,
    0x214a, 0x214c, 0x214e, 0x2150, 0x2152, 0x2153, 0x2154, 0x2156, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(0x8f02), 0x01, "latched");
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_210b T4: same as T3 but (0x8a3c)!=0 -> tail jr to loc_2157", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8a87, 0x10);
  m.mem.write8(0x8f02, 0x00);
  m.mem.write8(0x8f30, 0x00);
  m.mem.write8(0x8c90, 0x01);
  m.mem.write8(0x8ca8, 0x01);
  m.mem.write8(0x8a3c, 0x01); // and a NZ -> jr nz taken -> tail loc_2157

  loc_210b(m);

  assert.equal(m.tstates, 301);
  assert.deepEqual(m.pcSeq, [
    0x210f, 0x2113, 0x2117, 0x2118, 0x211b, 0x211c, 0x211d, 0x211e, 0x211f, 0x2123,
    0x2126, 0x2128, 0x213f, 0x2142, 0x2144, 0x2148, 0x214a, 0x214c, 0x2144, 0x2148,
    0x214a, 0x214c, 0x214e, 0x2150, 0x2152, 0x2153, 0x2154, 0x2157,
  ]);
  assert.equal(m.pc, 0x2157, "tail jr lands on loc_2157");
  assert.deepEqual(m.calls, [0x2157]);
  assert.equal(m.regs.sp, 0x8780, "tail jr: loc_2157's ret consumes the seated caller frame");
});

test("loc_210b T5: pre-block arm (C/D/E not taken) + span2 (bit1 set, e bit3 clear) -> loc_22b1", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8a87, 0x10);
  m.mem.write8(0x8f02, 0x00);
  m.mem.write8(0x8f30, 0x02); // >= 2 -> jr c NOT taken
  m.mem.write8(0x8ca8, 0x02); // (iy+0x18)==2 -> jr nz@212f NOT taken
  m.mem.write8(0x8c90, 0x00); // (iy+0)==0 -> jr nz@2135 NOT taken; then set 1 -> 0x02
  m.mem.write8(0x8a84, 0x20); // (ix+4) -> (iy+4) = 0x20-3 = 0x1d
  m.mem.write8(0x8a86, 0x30); // (ix+6) -> (iy+6) = 0x30+4 = 0x34

  loc_210b(m);

  assert.equal(m.tstates, 620, "T5 span2 (bit1) T-state total");
  assert.deepEqual(m.pcSeq, [
    0x210f, 0x2113, 0x2117, 0x2118, 0x211b, 0x211c, 0x211d, 0x211e, 0x211f, 0x2123,
    0x2126, 0x2128, 0x212a, 0x212d, 0x212f, 0x2131, 0x2134, 0x2135, 0x2137, 0x213b,
    0x213f, 0x2142, 0x2144, 0x2148, 0x2184, 0x2188, 0x218b, 0x218d, 0x2190, 0x2193,
    0x2195,
    0x2198, 0x219c, 0x21a8, 0x21ac, 0x21b0, 0x21b2, 0x21b5, 0x21b6, 0x21b9, 0x21bb,
    0x0010, 0x21bf, 0x21c1, 0x21c2, 0x21c3, 0x21c5, 0x21c8, 0x21c9, 0x21ca, 0x21cb,
    0x21cc, 0x22b1,
  ]);
  assert.equal(m.pc, 0x22b1, "tail jp to loc_22b1");
  assert.deepEqual(m.calls, [0x0010, 0x22b1], "rst 0x10 fill, then tail loc_22b1");
  assert.equal(m.mem.read8(0x8ca8), 0x00, "(iy+0x18) cleared");
  assert.equal(m.mem.read8(0x8c90), 0x03, "slot flags: set 1 then set 0");
  assert.equal(m.mem.read8(0x8c94), 0x1d, "(iy+4)");
  assert.equal(m.mem.read8(0x8c96), 0x34, "(iy+6)");
  assert.equal(m.mem.read8(0x8c9f), 0x10, "(iy+0x0f) = 0x10 (bit1 branch)");
  assert.equal(m.mem.read8(0x8ca0), 0x40, "(iy+0x10) = 0x40");
  assert.equal(m.mem.read8(0x8d77), 0x01, "(0x8d77) armed");
  assert.equal(m.mem.read8(0x8d19), 0x00, "(0x8d19) side flag (bit3 e clear -> no inc)");
  assert.equal(m.mem.read8(0x8d1b), 0x00, "(0x8d1b) cleared");
  assert.equal(m.regs.sp, 0x8780, "tail jp: loc_22b1's ret consumes the seated caller frame");
});

test("loc_210b T6: jr c, slot0 advance then slot1 span2 (bit1 clear, e bit3 set) -> loc_22b1", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8a87, 0x10);
  m.mem.write8(0x8f02, 0x00);
  m.mem.write8(0x8f30, 0x00); // jr c taken
  m.mem.write8(0x8c90, 0x01); // slot0 bit0 set -> advance
  m.mem.write8(0x8ca8, 0x00); // slot1 bit0 clear -> span2 with iy=0x8ca8; bit1 clear
  m.mem.write8(0x8a84, 0x40);
  m.mem.write8(0x8a86, 0x10);

  loc_210b(m);

  assert.equal(m.tstates, 531);
  assert.deepEqual(m.pcSeq, [
    0x210f, 0x2113, 0x2117, 0x2118, 0x211b, 0x211c, 0x211d, 0x211e, 0x211f, 0x2123,
    0x2126, 0x2128, 0x213f, 0x2142, 0x2144, 0x2148, 0x214a, 0x214c, 0x2144, 0x2148,
    0x2184, 0x2188, 0x218b, 0x218d, 0x2190, 0x2193, 0x2195, 0x2198, 0x219c, 0x219e,
    0x21a2, 0x21a6, 0x21bc, 0x21bf, 0x21c1, 0x21c2, 0x21c3, 0x21c5, 0x21c7, 0x21c8,
    0x21c9, 0x21ca, 0x21cb, 0x21cc, 0x22b1,
  ]);
  assert.equal(m.pc, 0x22b1);
  assert.deepEqual(m.calls, [0x22b1], "bit1-clear branch: no rst 0x10");
  assert.equal(m.mem.read8(0x8ca8), 0x01, "slot1 set 0");
  assert.equal(m.mem.read8(0x8cac), 0x3d, "(iy+4) = 0x40-3");
  assert.equal(m.mem.read8(0x8cae), 0x14, "(iy+6) = 0x10+4");
  assert.equal(m.mem.read8(0x8cb7), 0x14, "(iy+0x0f) = 0x14 (bit1-clear branch)");
  assert.equal(m.mem.read8(0x8cb8), 0x40, "(iy+0x10) = 0x40");
  assert.equal(m.mem.read8(0x8d1a), 0x00, "e bit3 set -> inc hl -> writes 0x8d1a");
  assert.equal(m.mem.read8(0x8d1c), 0x00, "(0x8d1c) cleared");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_210b T7: (0x8f30)>=2 and (iy+0x18)!=2 -> jr nz@212f taken, then ret at 0x2156", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8a87, 0x10);
  m.mem.write8(0x8f02, 0x00);
  m.mem.write8(0x8f30, 0x02); // jr c NOT taken
  m.mem.write8(0x8ca8, 0x01); // (iy+0x18) != 2 -> jr nz@212f taken; also bit0 set for the scan
  m.mem.write8(0x8c90, 0x01); // slot0 bit0 set
  m.mem.write8(0x8a3c, 0x00); // -> ret at 0x2156

  loc_210b(m);

  assert.equal(m.tstates, 339);
  assert.deepEqual(m.pcSeq, [
    0x210f, 0x2113, 0x2117, 0x2118, 0x211b, 0x211c, 0x211d, 0x211e, 0x211f, 0x2123,
    0x2126, 0x2128, 0x212a, 0x212d, 0x212f, 0x213f, 0x2142, 0x2144, 0x2148, 0x214a,
    0x214c, 0x2144, 0x2148, 0x214a, 0x214c, 0x214e, 0x2150, 0x2152, 0x2153, 0x2154,
    0x2156, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_210b T8: (iy+0x18)==2 but (iy+0)!=0 -> jr nz@2135 (E) taken, span2 bit1 set + e bit3 set", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8a87, 0x10);
  m.mem.write8(0x8f02, 0x00);
  m.mem.write8(0x8f30, 0x02); // jr c NOT taken
  m.mem.write8(0x8ca8, 0x02); // (iy+0x18)==2 -> jr nz@212f NOT taken
  m.mem.write8(0x8c90, 0x01); // (iy+0)!=0 -> jr nz@2135 taken (E); slot0 bit0 set -> advance
  m.mem.write8(0x8a84, 0x50);
  m.mem.write8(0x8a86, 0x22);

  loc_210b(m);

  assert.equal(m.tstates, 639);
  assert.deepEqual(m.pcSeq, [
    0x210f, 0x2113, 0x2117, 0x2118, 0x211b, 0x211c, 0x211d, 0x211e, 0x211f, 0x2123,
    0x2126, 0x2128, 0x212a, 0x212d, 0x212f, 0x2131, 0x2134, 0x2135, 0x213f, 0x2142,
    0x2144, 0x2148, 0x214a, 0x214c, 0x2144, 0x2148, 0x2184, 0x2188, 0x218b, 0x218d,
    0x2190, 0x2193, 0x2195, 0x2198, 0x219c, 0x21a8, 0x21ac, 0x21b0, 0x21b2, 0x21b5,
    0x21b6, 0x21b9, 0x21bb, 0x0010, 0x21bf, 0x21c1, 0x21c2, 0x21c3, 0x21c5, 0x21c7,
    0x21c8, 0x21c9, 0x21ca, 0x21cb, 0x21cc, 0x22b1,
  ]);
  assert.equal(m.pc, 0x22b1);
  assert.deepEqual(m.calls, [0x0010, 0x22b1]);
  assert.equal(m.mem.read8(0x8ca8), 0x03, "slot1 (span2 target): set 0 over the 0x02");
  assert.equal(m.mem.read8(0x8cac), 0x4d, "(iy+4) = 0x50-3");
  assert.equal(m.mem.read8(0x8cae), 0x26, "(iy+6) = 0x22+4");
  assert.equal(m.mem.read8(0x8d1a), 0x00, "e bit3 set -> inc hl");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_210b MUTATION: `set 0,(iy+0)` mis-charged 19 T (not 23) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x2188 ? 19 : cycles);
  seatCaller(m);
  m.mem.write8(0x8a87, 0x10);
  m.mem.write8(0x8f02, 0x00);
  m.mem.write8(0x8f30, 0x02);
  m.mem.write8(0x8ca8, 0x02);
  m.mem.write8(0x8c90, 0x00);
  m.mem.write8(0x8a84, 0x20);
  m.mem.write8(0x8a86, 0x30);

  loc_210b(m);

  assert.equal(m.tstates, 616, "mutation loses 4 T (23 -> 19)");
  assert.throws(() => assert.equal(m.tstates, 620, "T5 span2 total"), /620/);
});
