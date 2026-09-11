// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c81b (ROM 0xc81b-0xc890). Minimal 6502 harness (Regs + flat RAM + page-1 stack
// seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration check. All branch
// targets are in-range, so every path here runs entirely inside loc_c81b to its rts. Covers: the $4e&$60==0
// seeding path, the $50==0 early exit, the nonzero-count counter/clamp path, and the Y==0 (beq c86e) shortcut.
// Run: node --test games/tempest/translated/test/equivalence-c81b.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c81b } from "../loc_c81b.js";

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
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

test("loc_c81b: $4e&$60==0, $50!=0, $05 bit7 clear -> seeds $01/$04/$00/$02, clears $50/$0123; 63 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1000); // rts -> 0x1001
  m.ram[0x06] = 0x03;
  m.ram[0x4e] = 0x00; // & 0x60 == 0 -> beq c871
  m.ram[0x50] = 0x05; // nonzero -> continue
  m.ram[0x05] = 0x00; // bit7 clear -> bmi not taken

  loc_c81b(m);

  assert.equal(m.ram[0x4e], 0x00, "$4e zeroed by sty");
  assert.equal(m.ram[0x01], 0x10, "$01 = 0x10");
  assert.equal(m.ram[0x04], 0x20, "$04 = 0x20");
  assert.equal(m.ram[0x00], 0x0a, "$00 = 0x0a");
  assert.equal(m.ram[0x02], 0x14, "$02 = 0x14");
  assert.equal(m.ram[0x50], 0x00, "$50 cleared");
  assert.equal(m.ram[0x0123], 0x00, "$0123 cleared");
  assert.equal(m.pc, 0x1001, "rts -> pushed + 1");
  assert.equal(m.cycles, 63, "seeding path total");
});

test("loc_c81b: $4e&$60==0 but $50==0 -> early rts, no seeding; 30 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x2000);
  m.ram[0x06] = 0x03;
  m.ram[0x4e] = 0x00;
  m.ram[0x50] = 0x00; // zero -> beq c890 early exit
  m.ram[0x01] = 0xee; // must stay untouched

  loc_c81b(m);

  assert.equal(m.ram[0x4e], 0x00, "$4e zeroed");
  assert.equal(m.ram[0x01], 0xee, "$01 untouched (no seeding)");
  assert.equal(m.pc, 0x2001, "rts -> pushed + 1");
  assert.equal(m.cycles, 30, "early-exit path total");
});

test("loc_c81b: count=2 path bumps counter $040f, clamps $0100 (0x10+2->0x12); 117 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x3000);
  m.ram[0x06] = 0x03;   // cmp #2 -> C set (>=2)
  m.ram[0x4e] = 0x60;   // & 0x60 nonzero -> beq c871 NOT taken
  m.ram[0x05] = 0x01;   // ora #0xc0 -> 0xc1
  m.ram[0x040f] = 0x05; // inc -> 0x06 (x clamps to 3 -> $040c+3)
  m.ram[0x0100] = 0x10; // +$3e(=1)+C -> 0x12, below 0x63

  loc_c81b(m);

  assert.equal(m.ram[0x4e], 0x00, "$4e zeroed");
  assert.equal(m.ram[0x06], 0x01, "$06 decremented twice (3->1)");
  assert.equal(m.ram[0x3e], 0x01, "$3e = count(2) then dec -> 1");
  assert.equal(m.ram[0x05], 0xc1, "$05 |= 0xc0");
  assert.equal(m.ram[0x16], 0x00, "$16 cleared");
  assert.equal(m.ram[0x18], 0x00, "$18 cleared");
  assert.equal(m.ram[0x040f], 0x06, "$040c,x (x=3) incremented, no 16-bit carry");
  assert.equal(m.ram[0x0410], 0x00, "$040d,x not touched (low byte didn't wrap)");
  assert.equal(m.ram[0x0100], 0x12, "$0100 = 0x10 + $3e(1) + carry(1) = 0x12, unclamped");
  assert.equal(m.regs.y, 0x02, "Y counted to 2");
  assert.equal(m.regs.x, 0x03, "X clamped to 3");
  assert.equal(m.regs.a, 0x12, "A holds the clamped $0100 value");
  assert.equal(m.pc, 0x3001, "rts -> pushed + 1");
  assert.equal(m.cycles, 117, "full counter/clamp path total");
});

test("loc_c81b: count clamps $0100 to 0x63 when the sum exceeds it", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x4000);
  m.ram[0x06] = 0x03;
  m.ram[0x4e] = 0x60;
  m.ram[0x05] = 0x00;
  m.ram[0x0100] = 0x80; // 0x80 + 1 + C = 0x82 >= 0x63 -> clamp to 0x63

  loc_c81b(m);

  assert.equal(m.ram[0x0100], 0x63, "$0100 clamped to 0x63");
  assert.equal(m.regs.a, 0x63, "A = 0x63");
});

test("loc_c81b: Y==0 (beq c86e) shortcut -- no seeding, $06 not decremented; 48 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x06] = 0x01;   // cmp #2 -> C clear (<2), no dec on this path
  m.ram[0x4e] = 0x40;   // & 0x60 = 0x40 -> beq c871 not taken; and #0x20 -> 0 -> beq c83a, Y stays 0
  m.ram[0x05] = 0x77;   // must stay untouched (no ora on Y==0 path)

  loc_c81b(m);

  assert.equal(m.ram[0x4e], 0x00, "$4e zeroed");
  assert.equal(m.ram[0x3e], 0x00, "$3e = Y = 0");
  assert.equal(m.ram[0x06], 0x01, "$06 untouched on the Y==0 path");
  assert.equal(m.ram[0x05], 0x77, "$05 untouched (skipped the ora block)");
  assert.equal(m.regs.y, 0x00, "Y == 0");
  assert.equal(m.pc, 0x5001, "rts -> pushed + 1");
  assert.equal(m.cycles, 48, "Y==0 shortcut total");
});

test("loc_c81b MUTATION: dropping the X clamp (ldx #3) would hit $040d not $040f", () => {
  // Positive control: the count=2 path MUST write $040f (x clamped to 3), never $040d (x=1).
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x6000);
  m.ram[0x06] = 0x03;
  m.ram[0x4e] = 0x60;
  m.ram[0x0100] = 0x10;
  loc_c81b(m);
  assert.equal(m.ram[0x040f], 0x01, "counter landed at the clamped index $040f");
  assert.equal(m.ram[0x040d], 0x00, "$040d (unclamped index) stayed zero");
});
