// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for translated loc_17c1 (Pooyan ROM 0x17c1-0x18ae) -- the idx3 state handler.
 * Seeds four actor records at 0x8a80 from a ROM table selected by (0x8f50)/(0x8907), optionally
 * nudges (0x8a86), seats the script cursor (0x8f00)=0x26c9, runs the animators (loc_22b1), then
 * branches on (0x8f50): the 0-branch arms state 0x12 or copies a 0x43-terminated ROM string into
 * 0x89f0; the nonzero-branch (block C) fans out a sprite group at 0x8ae0 -- size from (0x8907),
 * tile base via loc_0c45(0x70eb), per-slot coord packing, loc_381e per slot -- then arms state 0x0f.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling each callee's `ret`),
 * so a missing push16 desyncs the stack and the closing `ret` misses CALLER_RET. loc_0c45 returns
 * the looked-up word in DE (loc_17c1 `ex de,hl`s it into HL); 0x22b1/0x381e leave IX/DE/HL as the
 * routine needs (it reloads what it uses), so those mock calls just pop.
 *
 * Paths: A ((0x8f50)=0, gate falls through, dec-nudge, ret at 0x1828, 808 T -- one 0x22b1 call);
 * STRINGCOPY ((0x8806)!=0 -> the 0x89f0 string copy, ret z at 0x1836, 939 T); C-FULL ((0x8f50)!=0,
 * bit1 of (0x8907) set -> 5-slot group build, 0x0c45 + 5x 0x381e, ret at 0x18ae, 1916 T).
 * TEETH: mis-charge `ld (0x88be),de` (ED 53 = 20 T) as 16 T; the 808-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_17c1.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_17c1 } from "../loc_17c1.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x17c1, pcSeq: [],
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
    // Each callee's `ret` pops the return address this call site pushed. loc_0c45 returns the
    // table word in DE (loc_17c1 ex-de-hl's it into HL); 0x22b1/0x381e leave the regs loc_17c1
    // relies on afterward (it reloads DE/A/B, and IX is preserved by both).
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x0c45) regs.de = 0x0212; // tile-base word -> becomes HL after `ex de,hl`
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// ROM table read by the 4x seed loop (HL=0x1e34) -- 4 records x {tile,colour}.
function seedTable(m) {
  const bytes = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88];
  bytes.forEach((v, i) => m.mem.write8(0x1e34 + i, v));
}

const LOOP1_BODY = [0x17ea, 0x17eb, 0x17ee, 0x17ef, 0x17f0, 0x17f3, 0x17f4, 0x17f6];
const LOOP1 = [
  ...LOOP1_BODY, 0x17e6, ...LOOP1_BODY, 0x17e6, ...LOOP1_BODY, 0x17e6, ...LOOP1_BODY, 0x17f8,
];

// Common assertions for the 4x seed loop's writes (IX = 0x8a80, stride 0x18).
function assertSeed(m, x86) {
  const b = (a) => m.mem.read8(a);
  assert.equal(m.mem.read16(0x88be), 0x84e9, "(0x88be) = selected table pointer");
  assert.deepEqual([b(0x8a80), b(0x8a84), b(0x8a86)], [0x01, 0x11, x86], "record 0");
  assert.deepEqual([b(0x8a98), b(0x8a9c), b(0x8a9e)], [0x01, 0x33, 0x44], "record 1");
  assert.deepEqual([b(0x8ab0), b(0x8ab4), b(0x8ab6)], [0x01, 0x55, 0x66], "record 2");
  assert.deepEqual([b(0x8ac8), b(0x8acc), b(0x8ace)], [0x01, 0x77, 0x88], "record 3");
  assert.equal(m.mem.read16(0x8f00), 0x26c9, "script cursor seated");
}

// ------------------------------------------------------------------ Path A: 0-branch, arm state 0x12
const PC_A = [
  0x17c5, 0x17c8, 0x17c9, 0x17cc, 0x17ce, 0x17d1, 0x17d3, 0x17d6, 0x17d8, 0x17db, 0x17dd, 0x17e1, 0x17e4, 0x17e6,
  ...LOOP1,
  0x17fc, 0x17ff, 0x1800, 0x1802, 0x1805, 0x1808, 0x180b, 0x180e,
  0x22b1,
  0x1814, 0x1815, 0x1817, 0x181a, 0x181b, 0x181d, 0x1820, 0x1821, 0x1823, 0x1826, 0x1828,
  CALLER_RET,
];

test("loc_17c1 Path A: (0x8f50)=0, (0x881f)=0 dec-nudge, (0x8f3f)!=0 -> arm state 0x12", () => {
  const m = makeMachine();
  seatCaller(m);
  seedTable(m);
  m.mem.write8(0x8f50, 0x00); // head: jr nz not taken; 0x1815: 0-branch
  m.mem.write8(0x8907, 0x00); // bit 0 clear -> inner jr nz not taken
  m.mem.write8(0x881f, 0x00); // dec-nudge runs (dec (0x8a86) twice)
  m.mem.write8(0x8806, 0x00); // 0x181b: jr nz not taken
  m.mem.write8(0x8f3f, 0x01); // 0x1821: jr z not taken -> arm 0x12

  loc_17c1(m);

  assert.equal(m.tstates, 808, "Path A T-state total");
  assert.deepEqual(m.pcSeq, PC_A, "step boundaries match the disassembly");
  assertSeed(m, 0x20); // (0x8a86) 0x22 dec twice -> 0x20
  assert.equal(m.mem.read8(0x880a), 0x12, "state armed to 0x12");
  assert.equal(m.regs.ix, 0x8a80, "IX reset, block C not entered");
  assert.deepEqual(m.calls, [0x22b1], "only the animator call");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (0x22b1 push16 matched its ret)");
});

// ------------------------------------------------------------------ Path STRINGCOPY: 0x89f0 copy
const LOOP2_ITER = [0x1834, 0x1836, 0x1837, 0x1839, 0x183a, 0x183b, 0x183c, 0x1833];
const PC_STR = [
  0x17c5, 0x17c8, 0x17c9, 0x17cc, 0x17ce, 0x17d1, 0x17d3, 0x17d6, 0x17d8, 0x17db, 0x17dd, 0x17e1, 0x17e4, 0x17e6,
  ...LOOP1,
  0x17fc, 0x17ff, 0x1800, 0x1802, 0x1805, 0x1808, 0x180b, 0x180e,
  0x22b1,
  0x1814, 0x1815, 0x1817, 0x181a, 0x181b, 0x1829,
  0x182c, 0x182d, 0x1830, 0x1833,
  ...LOOP2_ITER, ...LOOP2_ITER,
  0x1834, 0x1836, CALLER_RET,
];

test("loc_17c1 STRINGCOPY: (0x8806)!=0 -> copy 0x43-terminated string into 0x89f0", () => {
  const m = makeMachine();
  seatCaller(m);
  seedTable(m);
  m.mem.write8(0x8f50, 0x00);
  m.mem.write8(0x8907, 0x00);
  m.mem.write8(0x881f, 0x00);
  m.mem.write8(0x8806, 0x01); // 0x181b: jr nz taken -> 0x1829 string copy
  // string at 0x183f: two chars then the 0x43 terminator
  m.mem.write8(0x183f, 0x90);
  m.mem.write8(0x1840, 0x91);
  m.mem.write8(0x1841, 0x43);

  loc_17c1(m);

  assert.equal(m.tstates, 939, "STRINGCOPY T-state total");
  assert.deepEqual(m.pcSeq, PC_STR, "step boundaries match the disassembly");
  assertSeed(m, 0x20);
  assert.equal(m.mem.read8(0x880a), 0x01, "state bumped by inc (hl)");
  assert.equal(m.mem.read8(0x89f0), 0x08, "char0 - 0x88");
  assert.equal(m.mem.read8(0x89f1), 0x09, "char1 - 0x88");
  assert.deepEqual(m.calls, [0x22b1]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
});

// ------------------------------------------------------------------ Path C-FULL: block C, 5 slots
const LOOP3_BODY = [
  0x187e, 0x1882, 0x1886, 0x1889, 0x188a, 0x188c, 0x188d, 0x188e, 0x188f, 0x1891, 0x1892, 0x1893,
  0x1896, 0x189c, 0x189f, 0x381e, 0x18a5, 0x18a7, // 0x18a2 (call return addr) steps to 0x18a5
];
const PC_C = [
  0x17c5, 0x17c8, 0x17c9, 0x17cc, 0x17d8, 0x17db, 0x17dd, 0x17e1, 0x17e4, 0x17e6,
  ...LOOP1,
  0x17fc, 0x17ff, 0x1800, 0x1808, 0x180b, 0x180e,
  0x22b1,
  0x1814, 0x1815, 0x1848,
  0x184b, 0x184d, 0x184f, 0x1852, 0x1854, 0x1856, 0x185e, 0x1860, 0x1862, 0x1863, 0x1865,
  0x1868, 0x1869, 0x186c,
  0x0c45,
  0x1870, 0x1874, 0x1877, 0x1878, 0x187a,
  ...LOOP3_BODY, 0x187a, ...LOOP3_BODY, 0x187a, ...LOOP3_BODY, 0x187a, ...LOOP3_BODY, 0x187a, ...LOOP3_BODY, 0x18a9,
  0x18ac, 0x18ae, CALLER_RET,
];

test("loc_17c1 C-FULL: (0x8f50)!=0 block C -> 5-slot group build via loc_0c45 + loc_381e", () => {
  const m = makeMachine();
  seatCaller(m);
  seedTable(m);
  m.mem.write8(0x8f50, 0x01); // head: jr nz taken; 0x1815: jr nz taken -> block C
  m.mem.write8(0x881f, 0x01); // dec-nudge skipped
  m.mem.write8(0x8907, 0x02); // bit1 set (block runs); >>1=1 -> count<7; group size 5

  loc_17c1(m);

  assert.equal(m.tstates, 1916, "C-FULL T-state total");
  assert.deepEqual(m.pcSeq, PC_C, "step boundaries match the disassembly");
  assert.equal(m.mem.read16(0x88be), 0x84e9, "table pointer");
  assert.equal(m.mem.read8(0x8f47), 0x05, "group size 5");
  const slot = (base, packed, hi) => {
    const b = (a) => m.mem.read8(a);
    assert.deepEqual(
      [b(base + 0x00), b(base + 0x05), b(base + 0x06), b(base + 0x04), b(base + 0x03)],
      [0x01, 0x80, 0x04, hi, packed],
      `slot at ${base.toString(16)}`,
    );
  };
  // word 0x0212 -> H seq [02,04,06,08,0a], packed-C seq [10,20,30,40,50] across the 5 slots
  slot(0x8ae0, 0x10, 0x02);
  slot(0x8af8, 0x20, 0x04);
  slot(0x8b10, 0x30, 0x06);
  slot(0x8b28, 0x40, 0x08);
  slot(0x8b40, 0x50, 0x0a);
  assert.equal(m.regs.ix, 0x8b58, "IX walked 5 strides from 0x8ae0");
  assert.equal(m.regs.b, 0x00, "djnz exhausted");
  assert.equal(m.regs.c, 0x50, "final packed low-nibble accumulator");
  assert.equal(m.mem.read8(0x880a), 0x0f, "state armed to 0x0f");
  assert.deepEqual(m.calls, [0x22b1, 0x0c45, 0x381e, 0x381e, 0x381e, 0x381e, 0x381e]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "all 7 push16 matched their callee rets");
});

test("loc_17c1 MUTATION: `ld (0x88be),de` mis-charged 16T (not 20T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x17e1 ? 16 : cycles);
  seatCaller(m);
  seedTable(m);
  m.mem.write8(0x8f50, 0x00);
  m.mem.write8(0x8907, 0x00);
  m.mem.write8(0x881f, 0x00);
  m.mem.write8(0x8806, 0x00);
  m.mem.write8(0x8f3f, 0x01);

  loc_17c1(m);

  assert.equal(m.tstates, 804, "mutation loses 4 T (20 -> 16)");
  assert.throws(() => assert.equal(m.tstates, 808, "Path A T-state total"), /Path A/);
});
