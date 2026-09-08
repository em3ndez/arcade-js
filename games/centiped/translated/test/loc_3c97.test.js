// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_3c97 (ROM 0x3c97-0x3d56). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_3c97.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_3c97 } from "../loc_3c97.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); return undefined; },
  };
}

// Full cold-init run over an all-zero board (callees are no-op records). Fixed-trip loops: the 256-entry
// page clear, the 16-entry $54/$64 seed, the 32 x 256 bank checksum, the 4-entry plot (all 4 pulled
// checksums are nonzero so each takes the JSR path), the 7-entry $018b->$8e copy, and a BCD compare that
// is skipped ($018b.. = 0). Falls through into loc_3d57. Author-derived T-total by loop arithmetic.
test("loc_3c97: cold init clears/seeds board state and falls into loc_3d57; 91942 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; // 4 checksum pushes/pulls stay high in page 1, clear of $018b..

  loc_3c97(m);

  // page clear + $0700 fill (X into $0700,X)
  assert.equal(m.ram[0x0700], 0x00, "$0700 = 0 (X=0)");
  assert.equal(m.ram[0x07ff], 0xff, "$07ff = 0xff (X=$ff)");
  assert.equal(m.ram[0x00d5], 0xff, "$d5 = X after DEX past 0");
  assert.equal(m.ram[0x00e3], 0xff, "$e3 = same");
  assert.equal(m.ram[0x1c03], 0x00, "$1c03 = A(=0)");
  assert.equal(m.ram[0x1c04], 0x00, "$1c04 = A(=0)");
  // $54,x / $64,x seeded to 0x80|x
  assert.equal(m.ram[0x0054], 0x80, "$54 = 0x80 | 0");
  assert.equal(m.ram[0x0063], 0x8f, "$63 = 0x80 | 0x0f");
  assert.equal(m.ram[0x0064], 0x80, "$64 = 0x80 | 0");
  assert.equal(m.ram[0x0073], 0x8f, "$73 = 0x80 | 0x0f");
  assert.equal(m.ram[0x100f], 0x03, "$100f = #$03");
  // checksum-loop bookkeeping
  assert.equal(m.ram[0x008b], 0x00, "$8b pointer low stays 0");
  assert.equal(m.ram[0x008c], 0x40, "$8c = 0x20 + 32 increments");
  assert.equal(m.ram[0x0092], 0x00, "$92: lda #$04 at 0x3cfa then overwritten by the $018b->$008e copy (Y=4 -> $92 = $018f = 0); BCD subtract skipped");
  assert.equal(m.ram[0x0091], 0x00, "$91: sta X^0x3f at 0x3d01 then overwritten by the copy (Y=3 -> $91 = $018e = 0)");
  assert.equal(m.ram[0x008d], 0xff, "$8d = Y(=$ff)");
  assert.equal(m.regs.s, 0xfd, "stack balanced: 4 pushes, 4 pulls");
  // registers + flags at the fall-through
  assert.equal(m.regs.x, 0xff, "X = $ff after the plot loop DEX past 0");
  assert.equal(m.regs.y, 0xff, "Y = $ff after the copy loop DEY past 0");
  assert.equal(m.regs.a, 0x00, "A = 0 from ORA $018d");
  assert.equal(m.regs.fZ, true, "Z set (ORA gave 0)");
  assert.equal(m.regs.fD, false, "D cleared by CLD");
  assert.equal(m.regs.fI, false, "I cleared by CLI");
  // control transfers, in order
  assert.deepEqual(m.calls, [
    0x3836, 0x3836, 0x384f, 0x3836, 0x3836, 0x384f,
    0x3836, 0x3836, 0x384f, 0x3836, 0x3836, 0x384f,
    0x3a99, 0x3d57,
  ], "12 plot JSRs, loc_3a99, then the fall-through into loc_3d57");
  assert.equal(m.pc, 0x3d57, "lands at loc_3d57 (fall-through)");
  assert.equal(
    m.cycles,
    2
    + (256 * 30 + 255 * 3 + 2)                                                       // loop1 (0x3c99)
    + 18                                                                             // 0x3cad..0x3cb8
    + (16 * 14 + 15 * 3 + 2)                                                         // loop2 (0x3cba)
    + 31                                                                             // 0x3cc4..0x3cdb
    + (32 * (2 + 4 + (256 * 7 + 255 * 3 + 2) + 10 + 5 + 2) + (28 * 3 + 4 * 7) + (31 * 3 + 2)) // outer (0x3cdd)
    + 7                                                                              // 0x3cf8..0x3cfc
    + (4 * 48 + 3 * 4 + 2)                                                           // plot loop (0x3cfe)
    + 8                                                                              // 0x3d1a..0x3d1d
    + (7 * 11 + 6 * 3 + 2)                                                           // copy loop (0x3d1f)
    + 17                                                                            // 0x3d28..0x3d32 (BEQ taken)
    + 7,                                                                            // 0x3d53..0x3d56
    "91942 T over the fixed-trip loops",
  );
  assert.equal(m.cycles, 91942, "the arithmetic resolves to 91942 T");
});

test("loc_3c97 MUTATION: the closing CLI mischarged 3T not 2T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3d57 ? 3 : c); // only the CLI lands at 0x3d57
  loc_3c97(m);
  assert.notEqual(m.cycles, 91942, "a mischarged cycle blows the golden T-state total");
});
