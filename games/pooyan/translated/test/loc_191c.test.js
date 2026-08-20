// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_191c (ROM 0x191c, Pooyan) -- the gated target-column setup.
 * Leaf routine (no calls): returns early if 0x8901 or 0x8a82 is nonzero, aborts (ret z) if any
 * of the six 0x8ae2 table slots (stride 0x18) already holds 0x03, else bumps 0x880a and computes
 * a clamped column from 0x8907/0x8820/0x8903, stores it to 0x8900, and clears 0x8a87/0x8905/0x8906.
 *
 * The mock's `call` still POPS (template fidelity) though this routine never calls. seatCaller
 * seats a return address so the terminal `ret` lands on it; the SP-baseline tooth asserts the
 * stack fully unwinds (a ret mis-modelled as a no-op would leave SP off).
 *
 * Paths: GATE (0x8901 nonzero -> ret nz), TABLEHIT (slot==0x03 -> ret z in the scan loop),
 * MAIN (bit0 clear, value < 0x20, no clamp), SETCLAMP (bit0 set, value >= 0x20 -> clamp 0x1f).
 * TEETH: mis-charge `ld hl,0x880a` (10 T) as 7 T -> the 489-T MAIN golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_191c.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_191c } from "../loc_191c.js";

const CALLER_RET = 0xabcd;
const BASE_SP = 0x8780;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x191c, pcSeq: [],
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
    // A callee's `ret` pops the return address the call site pushed -- model that pop so a missing
    // push16 would desync SP (this leaf never calls, but the mock stays faithful to the template).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = BASE_SP;
  m.push16(CALLER_RET);
}

test("loc_191c GATE: 0x8901 nonzero -> ret nz immediately", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8901, 0x01);

  loc_191c(m);

  assert.equal(m.tstates, 13 + 4 + 11, "ld a + and a + ret nz");
  assert.deepEqual(m.pcSeq, [0x191f, 0x1920, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret nz to seated caller");
  assert.equal(m.regs.sp, BASE_SP, "stack fully unwound");
  assert.deepEqual(m.calls, [], "leaf: no calls");
});

test("loc_191c TABLEHIT: a 0x8ae2 slot holds 0x03 -> ret z in the scan", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8901, 0x00);
  m.mem.write8(0x8a82, 0x00);
  m.mem.write8(0x8ae2, 0x03); // first slot == 0x03 -> ret z on iter 1

  loc_191c(m);

  assert.deepEqual(m.pcSeq, [
    0x191f, 0x1920, 0x1921, 0x1924, 0x1925, 0x1926, 0x1929, 0x192c, 0x192e, 0x1930,
    0x1931, CALLER_RET,
  ]);
  // 13+4 +5 +13+4 +5 +10+10+7+7 (=78) + cp(hl) 7 + ret z 11
  assert.equal(m.tstates, 78 + 7 + 11);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, BASE_SP, "stack fully unwound");
});

const PC_MAIN = [
  0x191f, 0x1920, 0x1921, 0x1924, 0x1925, 0x1926, 0x1929, 0x192c, 0x192e, 0x1930,
  0x1931, 0x1932, 0x1933, 0x1930, // scan iter1
  0x1931, 0x1932, 0x1933, 0x1930, // iter2
  0x1931, 0x1932, 0x1933, 0x1930, // iter3
  0x1931, 0x1932, 0x1933, 0x1930, // iter4
  0x1931, 0x1932, 0x1933, 0x1930, // iter5
  0x1931, 0x1932, 0x1933, 0x1935, // iter6 -> djnz falls out
  0x1938, 0x1939, 0x193c, 0x193e, 0x1940, 0x1942, 0x1943, 0x1946, 0x1947, 0x1948,
  0x194b, 0x194c, 0x194d, 0x194f, 0x1953, 0x1960, 0x1963, 0x1964, 0x1967, 0x196a, 0x196d,
  CALLER_RET,
];

function setupMain(m) {
  seatCaller(m);
  m.mem.write8(0x8901, 0x00);
  m.mem.write8(0x8a82, 0x00);
  // six table slots (stride 0x18) none == 0x03 -> scan runs all 6, djnz falls out
  for (let i = 0; i < 6; i++) m.mem.write8(0x8ae2 + i * 0x18, 0x00);
  m.mem.write8(0x880a, 0x10); // counter pre-value -> inc -> 0x11
  m.mem.write8(0x8907, 0x08); // bit0 clear -> jr nz not taken; srl -> 0x04
  m.mem.write8(0x8820, 0x02); // A = 0x02 + 0x04 = 0x06
  m.mem.write8(0x8903, 0x03); // A = 0x03 + 0x06 = 0x09 (< 0x20 -> jr c, no clamp)
}

test("loc_191c MAIN: bit0 clear, value < 0x20 (no clamp) -> full store + clears", () => {
  const m = makeMachine();
  setupMain(m);

  loc_191c(m);

  assert.equal(m.tstates, 489, "MAIN T-state total");
  assert.deepEqual(m.pcSeq, PC_MAIN, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "final ret to seated caller");
  assert.equal(m.regs.sp, BASE_SP, "stack fully unwound");
  assert.equal(m.mem.read8(0x880a), 0x11, "0x880a incremented");
  assert.equal(m.mem.read8(0x8900), 0x09, "column = 0x8820 + srl(0x8907) + 0x8903");
  assert.equal(m.mem.read8(0x8a87), 0x00, "0x8a87 cleared");
  assert.equal(m.mem.read8(0x8905), 0x00, "0x8905 cleared");
  assert.equal(m.mem.read8(0x8906), 0x00, "0x8906 cleared");
  assert.equal(m.regs.a, 0x00, "A = 0 after xor a");
});

test("loc_191c SETCLAMP: bit0 set, value >= 0x20 -> clamp to 0x1f", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8901, 0x00);
  m.mem.write8(0x8a82, 0x00);
  for (let i = 0; i < 6; i++) m.mem.write8(0x8ae2 + i * 0x18, 0x00);
  m.mem.write8(0x880a, 0x00);
  m.mem.write8(0x8907, 0x01); // bit0 set -> jr nz to 0x1955; ld b,a uses A=0x01
  m.mem.write8(0x8820, 0x30); // A = 0x30 + 0x01 = 0x31 (>= 0x20 -> jr c not taken -> clamp)

  loc_191c(m);

  assert.deepEqual(m.pcSeq, [
    0x191f, 0x1920, 0x1921, 0x1924, 0x1925, 0x1926, 0x1929, 0x192c, 0x192e, 0x1930,
    0x1931, 0x1932, 0x1933, 0x1930,
    0x1931, 0x1932, 0x1933, 0x1930,
    0x1931, 0x1932, 0x1933, 0x1930,
    0x1931, 0x1932, 0x1933, 0x1930,
    0x1931, 0x1932, 0x1933, 0x1930,
    0x1931, 0x1932, 0x1933, 0x1935,
    0x1938, 0x1939, 0x193c, 0x193e, 0x1955, 0x1956, 0x1959, 0x195a, 0x195c, 0x195e,
    0x1960, 0x1963, 0x1964, 0x1967, 0x196a, 0x196d, CALLER_RET,
  ], "bit0-set branch (0x1955) with clamp (0x195e -> ld a,0x1f)");
  // 78 (pre) + 211 (scan) + 10+11+13+8 (ld hl/inc/ld a/bit) = 331 through 0x193e;
  // +12 jr nz + 4 ld b + 13 ld a + 4 add + 7 cp + 7 (jr c nt) + 7 (ld a,0x1f)
  // + 13+4+13+13+13 (store+xor+3 clears) + 10 ret
  assert.equal(m.tstates, 451, "SETCLAMP T-state total");
  assert.equal(m.mem.read8(0x8900), 0x1f, "clamped to 0x1f");
  assert.equal(m.regs.sp, BASE_SP, "stack fully unwound");
});

test("loc_191c MUTATION: `ld hl,0x880a` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1938 ? 7 : cycles);
  setupMain(m);

  loc_191c(m);

  assert.equal(m.tstates, 486, "mutation loses 3 T (10 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 489, "MAIN T-state total"),
    /489/,
    "the 489-T golden must fail on the mutant",
  );
});
