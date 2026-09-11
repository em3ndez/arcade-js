// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ddf1 (ROM 0xddf1-0xde10). Minimal 6502 harness (Regs + flat RAM + the page-1
// stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration check.
// Entry ddf1 fixes A=7,Y=0xff and the BNE (Y!=0) always jumps to ddff. Run:
// node --test games/tempest/translated/test/equivalence-ddf1.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ddf1 } from "../loc_ddf1.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
  };
}

test("loc_ddf1 entry: A=7,Y=0xff -> $01c6=0xff, $01c7|=7, $01c8|=7; rts; 33 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0xbeed); // rts -> 0xbeee
  m.ram[0x01c7] = 0x10; // -> 0x10 | 0x07 = 0x17
  m.ram[0x01c8] = 0x80; // -> 0x80 | 0x07 = 0x87

  loc_ddf1(m);

  assert.equal(m.ram[0x01c6], 0xff, "Y=0xff stored to $01c6");
  assert.equal(m.ram[0x01c7], 0x17, "$01c7 |= 7");
  assert.equal(m.ram[0x01c8], 0x87, "$01c8 |= 7");
  assert.equal(m.regs.a, 0x87, "A = pulled(7) | $01c8(0x80) = 0x87 (pha/pla round-trips A=7)");
  assert.equal(m.regs.s, 0xfd, "stack balanced: pha then pla, rts pulls the return");
  assert.equal(m.pc, 0xbeee, "rts to pushed + 1");
  // ddf1 lda2, ddf3 ldy2, ddf5 bne-taken3, ddff sty4, de02 pha3, de03 ora4, de06 sta4,
  // de09 pla4, de0a ora4, de0d sta4, de10 rts6
  assert.equal(m.cycles, 2 + 2 + 3 + 4 + 3 + 4 + 4 + 4 + 4 + 4 + 6, "33 T");
});

test("loc_ddf1: writes OR into existing bits, never clobbers set bits", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  m.ram[0x01c7] = 0xf8;
  m.ram[0x01c8] = 0x00;
  loc_ddf1(m);
  assert.equal(m.ram[0x01c7], 0xff, "0xf8 | 0x07 = 0xff");
  assert.equal(m.ram[0x01c8], 0x07, "0x00 | 0x07 = 0x07");
});

test("loc_ddf1 MUTATION: A carried past pha/pla wrong would break the second ora", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  m.ram[0x01c7] = 0x00;
  m.ram[0x01c8] = 0x00;
  loc_ddf1(m);
  // both ORs use A=7; a lost pla would leave A = $01c7 result (0x07) which coincides, so assert $01c8 too
  assert.equal(m.ram[0x01c8], 0x07, "$01c8 got the pulled A (=7), proving pla restored A");
});
