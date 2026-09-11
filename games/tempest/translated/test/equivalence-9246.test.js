// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9246 (ROM 0x9246-0x926e) -- zero $0243..$0282, then pack tags into $0203,x and
// $0243,x = tag (or 0x0f when the tag is zero). Covers the BNE-not-taken (zero tag) and BNE-taken paths.
// Run: node --test games/tempest/translated/test/equivalence-9246.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9246 } from "../loc_9246.js";

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

test("loc_9246: zero-tag path (x=0, nibble=0) -> $0243 = 0x0f; 693 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x4000);
  m.ram[0x03ab] = 0x01; // loop2: x starts at 0, single iteration
  m.ram[0x60ca] = 0x00; // nibble 0 -> tag = (0<<4)|0 = 0 -> BNE not taken -> lda #0x0f
  // pre-dirty the clear region to prove loop1 zeroes it
  m.ram[0x0243] = 0x55; m.ram[0x0282] = 0x55;
  loc_9246(m);
  assert.equal(m.mem.read8(0x0282), 0x00, "loop1 zeroed the top of the block");
  assert.equal(m.mem.read8(0x0203), 0x00, "$0203 got the nibble (0)");
  assert.equal(m.mem.read8(0x0243), 0x0f, "zero tag -> 0x0f written");
  assert.equal(m.regs.a, 0x0f, "A = 0x0f after the not-taken branch");
  assert.equal(m.regs.x, 0xff, "x underflowed at loop2 exit");
  assert.equal(m.pc, 0x4001, "rts -> pushed+1");
  assert.equal(m.cycles, 4 + (63 * 10 + 9) + 6 + 38 + 6, "693 T");
});

test("loc_9246: nonzero-tag path (two iters, BNE taken) -> tags stored; 730 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x4000);
  m.ram[0x03ab] = 0x02; // loop2: x starts at 1, two iterations (x=1, x=0)
  m.ram[0x60ca] = 0x05; // nibble 0x05
  loc_9246(m);
  assert.equal(m.mem.read8(0x0204), 0x05, "iter x=1: $0203,1 = nibble");
  assert.equal(m.mem.read8(0x0244), 0x15, "iter x=1: tag (1<<4)|0x05 = 0x15");
  assert.equal(m.mem.read8(0x0203), 0x05, "iter x=0: $0203,0 = nibble");
  assert.equal(m.mem.read8(0x0243), 0x05, "iter x=0: tag (0<<4)|0x05 = 0x05");
  assert.equal(m.regs.a, 0x05, "A holds the last tag");
  assert.equal(m.pc, 0x4001, "rts -> pushed+1");
  assert.equal(m.cycles, 4 + (63 * 10 + 9) + 6 + 38 + 37 + 6, "730 T");
});
