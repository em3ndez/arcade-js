// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b0ab (ROM 0xb0ab-0xb0c5) -- reads $0200, calls adce (opaque here), clamps A to
// [0..$0127] with a negative->0 branch, writes $0200 and Y. Minimal 6502 harness; JSR $adce is recorded but
// not run, so the clamp is exercised on the value the routine itself carries. Run:
//   node --test games/tempest/translated/test/equivalence-b0ab.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b0ab } from "../loc_b0ab.js";

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

test("loc_b0ab: A within range (< $0127) passes through, 34 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  m.ram[0x0200] = 0x50;
  m.ram[0x0127] = 0x60;

  loc_b0ab(m);

  assert.equal(m.ram[0x0200], 0x50, "$0200 unchanged (0x50 < 0x60)");
  assert.equal(m.regs.a, 0x50, "A = 0x50");
  assert.equal(m.regs.y, 0x50, "Y = A");
  assert.deepEqual(m.calls, [0xadce], "JSR $adce recorded");
  assert.equal(m.pc, 0x1234, "RTS -> pushed + 1");
  assert.equal(m.cycles, 4 + 6 + 2 + 3 + 4 + 3 + 4 + 2 + 6, "34 T (bpl taken, bcc taken)");
});

test("loc_b0ab: A >= $0127 is clamped to $0127, 37 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  m.ram[0x0200] = 0x70;
  m.ram[0x0127] = 0x60;

  loc_b0ab(m);

  assert.equal(m.ram[0x0200], 0x60, "clamped down to $0127 = 0x60");
  assert.equal(m.regs.a, 0x60, "A = 0x60");
  assert.equal(m.regs.y, 0x60, "Y = clamped A");
  assert.equal(m.cycles, 4 + 6 + 2 + 3 + 4 + 2 + 4 + 4 + 2 + 6, "37 T (bpl taken, bcc fall, lda $0127)");
});

test("loc_b0ab: negative A -> 0 (bpl fall, clv/bvc), 33 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  m.ram[0x0200] = 0x90; // bit7 set -> tay sets N -> bpl not taken
  m.ram[0x0127] = 0x60;

  loc_b0ab(m);

  assert.equal(m.ram[0x0200], 0x00, "negative value forced to 0");
  assert.equal(m.regs.a, 0x00, "A = 0");
  assert.equal(m.regs.y, 0x00, "Y = 0");
  assert.equal(m.regs.fZ, true, "0 -> Z set");
  assert.equal(m.cycles, 4 + 6 + 2 + 2 + 2 + 2 + 3 + 4 + 2 + 6, "33 T (bpl fall, lda #0, clv, bvc taken)");
});
