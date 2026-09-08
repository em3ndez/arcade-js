// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2119 (ROM 0x2119-0x218d). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2119.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2119 } from "../loc_2119.js";

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

// deep path: $86 negative (bit7) -> full body; $00!=0 skips $37d5; $00&0x80==0 falls past the $218c gate;
// $43&0xaf!=0 takes BNE $217d, skipping the $53/$83 clamps; then $2b60 + the $2120 EOR checksum into $fe.
function armDeep(m) {
  m.regs.s = 0xfd;
  m.push16(0x4000);        // RTS -> pulled + 1 = 0x4001
  m.ram[0x0086] = 0x80;    // bit7 set -> BPL not taken
  m.ram[0x0000] = 0x01;    // $00 nonzero -> BNE $213c taken; and 0x01 & 0x80 == 0 -> BNE $218c not taken
  m.ram[0x0600] = 0x00;    // X source for STX $ff
  m.ram[0x0043] = 0x01;    // 0x01 & 0xaf != 0 -> BNE $217d taken
  // ram[0x2120..0x2133] left 0 -> EOR leaves A = 0xfa
}

const DEEP_T =
  3 + 2 +                             // 2119 lda $86 ; 211b bpl (fall)
  6 +                                 // 211d jsr $2195
  2 + 3 + 2 + 3 + 2 + 3 + 2 + 3 +     // 2120..212e prime $93/$94/$91/$92
  6 +                                 // 2130 jsr $3825
  3 + 3 +                             // 2133 lda $00 ; 2135 bne $213c (taken)
  3 + 4 + 3 + 2 + 2 +                 // 213c lda $00 ; ldx $0600 ; stx $ff ; and #$80 ; 2145 bne (fall)
  3 + 2 + 3 +                         // 2147 lda $43 ; and #$af ; 214b bne $217d (taken)
  6 + 2 + 2 +                         // 217d jsr $2b60 ; 2180 ldx #$13 ; 2182 lda #$fa
  (20 * 4 + 20 * 2 + 19 * 3 + 2) +    // 2184 loop: 20x(eor+dex) + 19 taken bpl + 1 not-taken bpl = 179
  3 + 6;                              // 218a sta $fe ; 218c rts  => 263 T

test("loc_2119 deep path: primes $91-$94, checksums $2120 block into $fe, tail-calls the movers; 263 T", () => {
  const m = makeMachine();
  armDeep(m);

  loc_2119(m);

  assert.equal(m.ram[0x0091], 0x40, "$91 = 0x40");
  assert.equal(m.ram[0x0092], 0x05, "$92 = 0x05");
  assert.equal(m.ram[0x0093], 0x03, "$93 = 0x03");
  assert.equal(m.ram[0x0094], 0x20, "$94 = 0x20");
  assert.equal(m.ram[0x00ff], 0x00, "$ff = X from $0600");
  assert.equal(m.ram[0x00fe], 0xfa, "$fe = 0xFA EOR (zeroed $2120 block)");
  assert.equal(m.regs.a, 0xfa, "A = checksum result");
  assert.equal(m.regs.x, 0xff, "X = 0xFF after the DEX loop underflows");
  assert.equal(m.regs.y, 0x00, "Y untouched on this path");
  assert.equal(m.regs.fN, true, "N set from the final DEX -> 0xFF");
  assert.equal(m.regs.fZ, false, "Z clear");
  assert.deepEqual(m.calls, [0x2195, 0x3825, 0x2b60], "$37d5/$2aeb/$2b24 skipped on this path");
  assert.equal(m.cycles, DEEP_T, "263 T");
  assert.equal(m.cycles, 263, "263 T (literal)");
  assert.equal(m.pc, 0x4001, "RTS returns to pushed + 1");
});

test("loc_2119 short path: $86 positive -> BPL $218c straight to RTS; 12 T; no calls", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x4000);
  m.ram[0x0086] = 0x00; // bit7 clear -> BPL $218c taken

  loc_2119(m);

  assert.equal(m.regs.a, 0x00, "A = $86");
  assert.equal(m.regs.fZ, true, "Z set (A == 0)");
  assert.equal(m.regs.fN, false, "N clear");
  assert.deepEqual(m.calls, [], "no callees reached");
  assert.equal(m.cycles, 3 + 3 + 6, "12 T");
  assert.equal(m.pc, 0x4001, "RTS returns to pushed + 1");
});

test("loc_2119 MUTATION: LDX $0600 mischarged 5T not 4T is caught by the T-state total", () => {
  const m = makeMachine();
  armDeep(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2141 ? 5 : c); // the LDX $0600 step lands at 0x2141
  loc_2119(m);
  assert.notEqual(m.cycles, DEEP_T, "a mischarged cycle blows the golden T-state total");
});
