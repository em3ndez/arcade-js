// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1f8c (ROM 0x1f8c, Pooyan) -- blit a 4-row x 3-column glyph block
 * from (DE) into (HL), using the I register as the spare row counter (init 4). Leaf (no calls).
 *
 * Concrete path: DE=0x2000 (12 source bytes), HL=0x8000. Four rows of 3 bytes each; HL += 0x1d
 * between rows; the `ld a,i / dec a / ret z` chain exits after the 4th row. Full pcSeq + T=681,
 * final registers (I=1, A=0, HL=0x8080, DE=0x200c) and the 12 VRAM writes. MUTATION tooth: the entry
 * `ld a,0x04` mis-charged 4T (not 7T) is caught. No push16 in this leaf -> the "delete a push16"
 * positive control is N/A; the mutation tooth and ret-to-caller assertion are the falsification controls.
 *
 * Run: node --test games/pooyan/translated/test/loc_1f8c.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1f8c } from "../loc_1f8c.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1f8c, pcSeq: [],
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

const SRC = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc];

// one inner byte-copy (ld a,(de); ld (hl),a; inc l; inc de)
const INNER = [0x1f93, 0x1f94, 0x1f95, 0x1f96];
const OUTER_NONFINAL = [
  0x1f92,               // ld b,0x03
  ...INNER, 0x1f92,     // inner iter1 -> djnz taken
  ...INNER, 0x1f92,     // inner iter2 -> djnz taken
  ...INNER, 0x1f98,     // inner iter3 -> djnz falls out
  0x1f9a, 0x1f9b, 0x1f9d, 0x1f9e, 0x1f9f, 0x1fa1, 0x1f90, // row advance + ret z not taken + jr
];
const OUTER_FINAL = [
  0x1f92,
  ...INNER, 0x1f92,
  ...INNER, 0x1f92,
  ...INNER, 0x1f98,
  0x1f9a, 0x1f9b, 0x1f9d, 0x1f9e, CALLER_RET,             // ret z TAKEN on the 4th row
];

test("loc_1f8c: 4 rows x 3 cols blit, exits via ret z on the last row", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.de = 0x2000;
  m.regs.hl = 0x8000;
  for (let i = 0; i < SRC.length; i++) m.mem.write8(0x2000 + i, SRC[i]);

  loc_1f8c(m);

  const expected = [
    0x1f8e, 0x1f90,
    ...OUTER_NONFINAL, ...OUTER_NONFINAL, ...OUTER_NONFINAL,
    ...OUTER_FINAL,
  ];

  assert.equal(m.tstates, 681, "T-state total for 4 rows");
  assert.deepEqual(m.pcSeq, expected, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret z returns to seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound");
  assert.equal(m.regs.i, 0x01, "I row counter at the last-row exit");
  assert.equal(m.regs.a, 0x00, "A = I-1 = 0 (drove the ret z)");
  assert.equal(m.regs.hl, 0x8080, "HL after 4 rows of +3 then +0x1d");
  assert.equal(m.regs.de, 0x200c, "DE advanced past 12 source bytes");
  // VRAM: row r origin = 0x8000 + r*0x20
  const rows = [0x8000, 0x8020, 0x8040, 0x8060];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      assert.equal(m.mem.read8(rows[r] + c), SRC[r * 3 + c], `row ${r} col ${c}`);
    }
  }
});

test("loc_1f8c MUTATION: entry `ld a,0x04` mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1f8e ? 4 : cycles);
  seatCaller(m);
  m.regs.de = 0x2000;
  m.regs.hl = 0x8000;

  loc_1f8c(m);

  assert.equal(m.tstates, 678, "mutation loses 3 T (7 -> 4)");
  assert.throws(
    () => assert.equal(m.tstates, 681, "T-state total for 4 rows"),
    /681/,
    "the 681-T golden must fail on the mutant",
  );
});
