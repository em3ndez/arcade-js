// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_dbe0 (ROM 0xdbe0-0xdbf6). Minimal 6502 harness (Regs + flat RAM + the page-1
// stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration check.
// Run: node --test games/tempest/translated/test/equivalence-dbe0.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_dbe0 } from "../loc_dbe0.js";

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

test("loc_dbe0: A stored to $60db; low 3 bits of $60d8 OR'd with bit5-of-$60c8 >> 2; 30 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0xc0de); // rts -> 0xc0df
  m.regs.a = 0x99; // arg
  m.ram[0x60d8] = 0xf5; // & 7 = 0x05
  m.ram[0x60c8] = 0x20; // & 0x20 = 0x20 -> lsr lsr = 0x08

  loc_dbe0(m);

  assert.equal(m.ram[0x60db], 0x99, "arg A stored to $60db");
  assert.equal(m.ram[0x37], 0x05, "$37 = $60d8 & 7");
  assert.equal(m.ram[0x60cb], 0x05, "$60cb also = $60d8 & 7");
  assert.equal(m.regs.a, 0x0d, "A = 0x05 | (0x20 >> 2) = 0x05 | 0x08 = 0x0d");
  assert.equal(m.regs.fZ, false, "0x0d -> Z clear");
  assert.equal(m.pc, 0xc0df, "rts to pushed + 1");
  assert.equal(m.cycles, 4 + 4 + 2 + 3 + 4 + 4 + 2 + 2 + 2 + 3 + 6, "30 T");
});

test("loc_dbe0: $60c8 bit5 clear -> high nibble contributes 0", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  m.regs.a = 0x00;
  m.ram[0x60d8] = 0x02; // & 7 = 0x02
  m.ram[0x60c8] = 0xdf; // bit5 clear (0x20 masked to 0) -> 0

  loc_dbe0(m);

  assert.equal(m.ram[0x37], 0x02, "$37 = 0x02");
  assert.equal(m.regs.a, 0x02, "A = 0x02 | 0x00 = 0x02");
});

test("loc_dbe0 MUTATION: swapping ora $37 for a no-op is caught (result would be 0x08 not 0x0d)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);
  m.regs.a = 0x11;
  m.ram[0x60d8] = 0x07; // & 7 = 0x07
  m.ram[0x60c8] = 0x20; // -> 0x08
  loc_dbe0(m);
  assert.equal(m.regs.a, 0x0f, "0x07 | 0x08 = 0x0f (not 0x08, proves the ora ran)");
});
