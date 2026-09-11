// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c453 (ROM 0xc453-0xc471) -- conditionally advances $57 by 0x0f (clamped to
// 0xf0). Exercises the early exits ($5b!=0, too-far, in-range) and both clamp routes. Author-derived.
// Run: node --test games/tempest/translated/test/equivalence-c453.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c453 } from "../loc_c453.js";

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
  };
}

test("loc_c453: $5b!=0 -> immediate rts, $57 untouched, 9 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1000);
  m.ram[0x5b] = 0x01;
  m.ram[0x57] = 0x20;
  loc_c453(m);
  assert.equal(m.ram[0x57], 0x20, "$57 unchanged");
  assert.equal(m.pc, 0x1001, "rts -> pushed + 1");
  assert.equal(m.cycles, 3 + 3 + 6, "lda + bne(taken) + rts");
});

test("loc_c453: $57 too far above $5f (>=0x0c) -> rts, $57 untouched", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1000);
  m.ram[0x5b] = 0x00;
  m.ram[0x57] = 0x30; // 0x30-0x10 = 0x20 >= 0x0c -> bcs exit
  m.ram[0x5f] = 0x10;
  loc_c453(m);
  assert.equal(m.ram[0x57], 0x30, "$57 unchanged (delta too large)");
  assert.equal(m.pc, 0x1001, "rts");
});

test("loc_c453: in-range, no clamp -> $57 = $5f + 0x0f", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1000);
  m.ram[0x5b] = 0x00;
  m.ram[0x57] = 0x10; // $57 < $5f -> bcc taken; carry clear -> bcs not taken
  m.ram[0x5f] = 0x20; // 0x20 + 0x0f = 0x2f, no carry, < 0xf0
  loc_c453(m);
  assert.equal(m.ram[0x57], 0x2f, "$57 = 0x20 + 0x0f");
  assert.equal(m.pc, 0x1001, "rts");
});

test("loc_c453: add overflows 0xff -> clamp to 0xf0 (bcs then bcc-not-taken route)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1000);
  m.ram[0x5b] = 0x00;
  m.ram[0x57] = 0x10; // < $5f -> bcc taken
  m.ram[0x5f] = 0xf5; // 0xf5 + 0x0f = 0x104 -> carry set -> bcs, then clamp to 0xf0
  loc_c453(m);
  assert.equal(m.ram[0x57], 0xf0, "$57 clamped to 0xf0");
});

test("loc_c453: sum >= 0xf0 without overflow -> clamp via cmp #$f0", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1000);
  m.ram[0x5b] = 0x00;
  m.ram[0x57] = 0x10;
  m.ram[0x5f] = 0xe5; // 0xe5 + 0x0f = 0xf4 (no carry) >= 0xf0 -> clamp
  loc_c453(m);
  assert.equal(m.ram[0x57], 0xf0, "$57 clamped to 0xf0 via cmp");
});
