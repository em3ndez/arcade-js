// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_d931 (ROM 0xd931-0xd93e). Minimal 6502 harness (Regs + flat RAM + page-1 stack
// seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration check.
// Run: node --test games/tempest/translated/test/equivalence-d931.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_d931 } from "../loc_d931.js";

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

// path A: $01 < 0x20 -> BCC taken, sbc skipped; and #0x1f; tail-jmp 0xd8cd.
test("loc_d931: $01=0x05 (<0x20) -> BCC skips sbc, A=0x05&0x1f, tail 0xd8cd, 15 T", () => {
  const m = makeMachine();
  m.regs.a = 0x99;
  m.ram[0x0001] = 0x05;

  loc_d931(m);

  assert.equal(m.regs.y, 0x99, "tay copied original A into Y");
  assert.equal(m.regs.a, 0x05, "A=$01=0x05, &0x1f unchanged");
  assert.equal(m.regs.fC, false, "cmp 0x05 vs 0x20 -> C clear");
  assert.deepEqual(m.calls, [0xd8cd], "tail-jmp to 0xd8cd");
  assert.equal(m.pc, 0xd8cd, "PC at tail target");
  assert.equal(m.cycles, 2 + 3 + 2 + 3 + 2 + 3, "15 T (bcc taken)");
});

// path B: $01 >= 0x20 -> BCC not taken, sbc #0x18 (C set, no borrow), and #0x1f.
test("loc_d931: $01=0x25 (>=0x20) -> sbc #0x18 -> 0x0d, and 0x1f, tail 0xd8cd, 16 T", () => {
  const m = makeMachine();
  m.regs.a = 0x05;
  m.ram[0x0001] = 0x25;

  loc_d931(m);

  assert.equal(m.regs.y, 0x05, "tay copied A into Y");
  assert.equal(m.regs.a, 0x0d, "0x25 - 0x18 (C set) = 0x0d, &0x1f = 0x0d");
  assert.deepEqual(m.calls, [0xd8cd], "tail-jmp to 0xd8cd");
  assert.equal(m.cycles, 2 + 3 + 2 + 2 + 2 + 2 + 3, "16 T (bcc not taken + sbc)");
});
