// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1dd3 (ROM 0x1dd3, Pooyan) -- the idx1 field/row painter selector.
 * Keyed on 0x8904 / 0x8806 / 0x8907, it dispatches one of two blit jobs. HL is set to 0x8907 up
 * front and both entries into path B rely on it (the `ld a,(hl)` at 0x1deb). Path C (0x1e11) can
 * fall back to path B when 0x8f50 (attract) is set -- a backward edge into B.
 *
 * The mock's `call` POPS the return address loc_1dd3 pushed at the loc_075d call site (modelling the
 * callee's `ret`); a missing push16 then desyncs SP and the routine's own ret returns to the wrong
 * address. loc_075d leaves no register loc_1dd3 depends on afterward (HL/DE/A reloaded).
 *
 * Path C (0x8907 bit0 set, 0x8f50 clear): source 0x0859 via loc_075d, then 16 rows of tile 0x09 at
 * 0x811c (stride 0x20), ret at 0x1e2b. Full pcSeq + T=671. Path B (0x8904 set -> jr nz to 0x1deb,
 * 0x8907 even -> bc=0x0879): source via loc_075d, 4 rows of tile 0x0f at 0x8045 then 0x8046, ret at
 * 0x1e10, T=396. TEETH: mis-charge `call 0x075d` (17T) as 10T -> the 671-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_1dd3.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1dd3 } from "../loc_1dd3.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1dd3, pcSeq: [],
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

// Build the pcSeq of a djnz fill loop: (bodyA, bodyB, backEdge) x (n-1) then (bodyA, bodyB, exit).
function loopSeq(bodyA, bodyB, backEdge, exit, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(bodyA, bodyB, i < n - 1 ? backEdge : exit);
  return out;
}

const PC_C = [
  0x1dd6, 0x1dd7, 0x1dda, 0x1ddc, 0x1ddf, 0x1de0, 0x1de2, 0x1de3, 0x1de5, // A: 0x8907 bit0 set -> C
  0x1e11, 0x1e14, 0x1e15, 0x1e17, 0x1e1a, 0x075d, 0x1e20, 0x1e23, 0x1e25, 0x1e27, // C: call 0x075d
  ...loopSeq(0x1e28, 0x1e29, 0x1e27, 0x1e2b, 16),
  CALLER_RET,
];

function setupC(m) {
  seatCaller(m);
  m.mem.write8(0x8904, 0x00); // and a==0 -> jr nz not taken
  m.mem.write8(0x8806, 0x01); // and a!=0 -> jr z not taken
  m.mem.write8(0x8907, 0x01); // bit0 set -> jr nz 0x1e11 (C)
  m.mem.write8(0x8f50, 0x00); // attract clear -> jr nz not taken (stay in C)
}

test("loc_1dd3 Path C: 0x8907 bit0 set -> 16-row 0x09 fill at 0x811c", () => {
  const m = makeMachine();
  setupC(m);

  loc_1dd3(m);

  assert.equal(m.tstates, 671, "Path C T-state total");
  assert.deepEqual(m.pcSeq, PC_C, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "0x1e2b ret returns to the seated caller");
  assert.deepEqual(m.calls, [0x075d], "one loc_075d (source 0x0859)");
  assert.equal(m.mem.read8(0x811c), 0x09, "row 0 tile");
  assert.equal(m.mem.read8(0x813c), 0x09, "row 1 tile (stride 0x20)");
  assert.equal(m.mem.read8(0x82fc), 0x09, "row 15 tile (0x811c + 15*0x20)");
  assert.equal(m.mem.read8(0x831c), 0x00, "row 16 NOT written (loop is 16 iterations)");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_1dd3 Path B: 0x8904 set -> jr nz 0x1deb, 0x8907 even -> 4-row 0x0f fills", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8904, 0x01); // in progress -> jr nz 0x1deb (B)
  m.mem.write8(0x8907, 0x00); // and 0x01 == 0 -> jr nz not taken -> bc=0x0879

  loc_1dd3(m);

  assert.equal(m.tstates, 396, "Path B T-state total");
  assert.deepEqual(m.pcSeq, [
    0x1dd6, 0x1dd7, 0x1dda, // A: 0x8904 set -> jr nz 0x1deb
    0x1deb, 0x1dec, 0x1dee, 0x1df1, 0x1df3, 0x1df6, 0x075d, // B: even -> bc=0x0879, call 0x075d
    0x1dfb, 0x1dfe, 0x1e01, 0x1e03,
    ...loopSeq(0x1e04, 0x1e05, 0x1e03, 0x1e07, 4), // fill at 0x8045
    0x1e0a, 0x1e0c,
    ...loopSeq(0x1e0d, 0x1e0e, 0x1e0c, 0x1e10, 4), // fill at 0x8046
    CALLER_RET,
  ], "0x1deb path with the even-variant source and both 4-row loops");
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x075d]);
  assert.equal(m.regs.a, 0x0f, "fill tile in A");
  assert.equal(m.mem.read8(0x8045), 0x0f, "col A row 0");
  assert.equal(m.mem.read8(0x80a5), 0x0f, "col A row 3 (0x8045 + 3*0x20)");
  assert.equal(m.mem.read8(0x8046), 0x0f, "col B row 0");
  assert.equal(m.mem.read8(0x80a6), 0x0f, "col B row 3");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_1dd3 MUTATION: `call 0x075d` mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x075d ? 10 : cycles);
  setupC(m);

  loc_1dd3(m);

  assert.equal(m.tstates, 664, "mutation loses 7 T (17 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 671, "Path C T-state total"),
    /671/,
    "the 671-T golden must fail on the mutant",
  );
});
