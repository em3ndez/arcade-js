// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_cf24 (ROM 0xcf24) -- the 3-lane $0d/$10/$13,x update loop + $16/$17/$18
// score accumulation (data table 0xcfd9) + $13,x fix-up passes. Minimal 6502 harness (Regs + flat
// RAM + page-1 stack seam), author-derived; the whole-machine boot-first diff vs MAME is the
// integration check. Expected values captured from the translated routine's own execution and
// hand-cross-checked against the disassembly's control flow.
// Run: node --test games/tempest/translated/test/equivalence-cf24.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_cf24 } from "../loc_cf24.js";

// Lookup table the routine reads via `sbc 0xcfd9,y` (ROM bytes 0xcfd9-0xcfe0).
const TABLE = [0x7f, 0x02, 0x04, 0x04, 0x05, 0x03, 0x7f, 0x7f];

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  for (let i = 0; i < TABLE.length; i++) ram[0xcfd9 + i] = TABLE[i]; // ROM data table
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

test("loc_cf24: all-zero input -> 3 loop passes reload $0c, no score, returns pushed+1", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  // all zero-page cells default 0; mem[0x08]=0 -> bit3 clear -> $0c reloads 0xf0 each pass.

  loc_cf24(m);

  // Each pass: $08 bit3 clear -> lda #$f0/sta $0c, then lda $0c(!=0)/dec -> 0xef; lanes cleared.
  assert.equal(m.mem.read8(0x0c), 0xef, "$0c reloaded to 0xf0 then dec'd to 0xef");
  assert.equal(m.mem.read8(0x0d), 0x00, "$0d lane cleared");
  assert.equal(m.mem.read8(0x0e), 0x00, "$0e lane cleared");
  assert.equal(m.mem.read8(0x0f), 0x00, "$0f lane cleared");
  assert.equal(m.mem.read8(0x10), 0x00, "$10 timer 0");
  assert.equal(m.mem.read8(0x11), 0x00, "$11 timer 0");
  assert.equal(m.mem.read8(0x12), 0x00, "$12 timer 0");
  assert.equal(m.mem.read8(0x16), 0x00, "$16 not written (sbc went negative -> bmi)");
  assert.equal(m.mem.read8(0x17), 0x00, "$17 = A(0) at d002");
  assert.equal(m.mem.read8(0x18), 0x00, "$18 untouched");
  assert.equal(m.mem.read8(0x06), 0x00, "$06 untouched (beq d002 skipped inc path)");
  assert.equal(m.regs.a, 0x00, "A live-out 0");
  assert.equal(m.regs.x, 0xff, "X = 0xff after final dex/bmi and d022 pass");
  assert.equal(m.regs.y, 0x00, "Y live-out 0");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.equal(m.cycles, 377, "traced total T-states for the all-zero path");
});

test("loc_cf24: $08 bit3 set (no $0c reload) + active lanes decrement, $09 drives fix-ups", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // RTS -> 0x2001
  m.mem.write8(0x08, 0x08); // bit3 set -> skip the $0c reload
  m.mem.write8(0x09, 0x64);
  m.mem.write8(0x07, 0x00);
  m.mem.write8(0x0d, 0x05); m.mem.write8(0x0e, 0x1c); m.mem.write8(0x0f, 0x00);
  m.mem.write8(0x10, 0x03); m.mem.write8(0x11, 0x00); m.mem.write8(0x12, 0x01);
  m.mem.write8(0x13, 0x12); m.mem.write8(0x14, 0x00); m.mem.write8(0x15, 0x08);
  m.mem.write8(0x0c, 0x02);

  loc_cf24(m);

  assert.equal(m.mem.read8(0x0c), 0x00, "$0c dec'd 0x02->0x01->0x00 across the passes it runs");
  assert.equal(m.mem.read8(0x0d), 0x05, "$0d lane preserved (cleared then rewritten path)");
  assert.equal(m.mem.read8(0x10), 0x02, "$10 timer dec'd 0x03->0x02");
  assert.equal(m.mem.read8(0x13), 0x02, "$13 counter after fix-up pass (0x12>=0x10 -> +0xef)");
  assert.equal(m.mem.read8(0x15), 0x08, "$15 counter unchanged (<0x10)");
  assert.equal(m.mem.read8(0x16), 0x00, "$16 accumulator");
  assert.equal(m.mem.read8(0x17), 0x00, "$17 accumulator");
  assert.equal(m.mem.read8(0x18), 0x00, "$18 accumulator");
  assert.equal(m.regs.a, 0x01, "A live-out");
  assert.equal(m.regs.x, 0xff, "X = 0xff after final dex/bpl");
  assert.equal(m.regs.y, 0x01, "Y counts lanes that wrapped in the fix-up pass");
  assert.equal(m.pc, 0x2001, "RTS returns to pushed + 1");
  assert.equal(m.cycles, 361, "traced total T-states for this path");
});
