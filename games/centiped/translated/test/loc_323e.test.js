// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_323e (ROM 0x323e-0x32fe). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_323e.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_323e } from "../loc_323e.js";

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

// All-RAM-zero path: the decimal adds carry nothing (BCS $3283 not taken), the 24-bit table scan finds
// every slot equal so BCC $32c5 never diverts to the compactor. The Y scan always steps 0->0x18 by 3
// (8 bodies) for X = 1 then 0 (2 outer passes) regardless of data, so the iteration counts are fixed.
// $c2 stays 0xFF (set at entry) -> BMI $32b3 taken -> AND $c1 (0xFF) -> BPL not taken -> JSR $2d5c -> RTS.
const INNER = 8 * 34 + (7 * 3 + 2);       // 8 compare bodies (34 T each) + 7 taken + 1 not-taken loop = 295
const PASS1 = 2 + INNER + 2 + 3;          // X=1: ldy #$00 + inner + dex + bpl $3284 taken   = 302
const PASS2 = 2 + INNER + 2 + 2;          // X=0: ldy #$00 + inner + dex + bpl not-taken      = 301
const T = 54 + 37 + 2 + PASS1 + PASS2 + 36; // entry-adds + 2nd-add + cld + 2 outer passes + tail = 732

test("loc_323e all-zero scan: decimal adds 0, 2x8 slot compares all equal, BMI+AND -> JSR $2d5c -> RTS; 732 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x5000); // RTS -> pulled + 1 = 0x5001

  loc_323e(m);

  assert.equal(m.ram[0x00c1], 0xff, "$c1 = 0xFF set at entry, untouched");
  assert.equal(m.ram[0x00c2], 0xff, "$c2 = 0xFF (BMI taken skips the $c2 rewrite)");
  assert.equal(m.ram[0x00c0], 0x00, "$c0 cleared at 0x32b5");
  assert.equal(m.ram[0x0001], 0x00, "$01 = 0x00 written before JSR $2d5c");
  assert.equal(m.ram[0x018e], 0x00, "$018e counter add result = 0");
  assert.equal(m.ram[0x0191], 0x00, "$0191 counter add result = 0");
  assert.equal(m.regs.a, 0x00, "A = 0 from LDA #$00 at 0x32bd");
  assert.equal(m.regs.x, 0xff, "X = 0xFF after the outer DEX underflows");
  assert.equal(m.regs.y, 0x18, "Y = 0x18 at scan exit");
  assert.equal(m.regs.fZ, true, "Z set (A == 0)");
  assert.equal(m.regs.fN, false, "N clear");
  assert.equal(m.regs.fD, false, "D cleared by CLD at 0x3283");
  assert.deepEqual(m.calls, [0x2d5c], "only the $2d5c tail call is reached");
  assert.equal(m.cycles, T, "732 T (component sum)");
  assert.equal(m.cycles, 732, "732 T (literal)");
  assert.equal(m.pc, 0x5001, "RTS returns to pushed + 1");
});

test("loc_323e MUTATION: JSR $2d5c mischarged 5T not 6T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x5000);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x32c4 ? 5 : c); // the JSR $2d5c step lands at 0x32c4
  loc_323e(m);
  assert.notEqual(m.cycles, T, "a mischarged cycle blows the golden T-state total");
});
