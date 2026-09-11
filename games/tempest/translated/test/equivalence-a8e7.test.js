// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a8e7 (ROM 0xa8e7) -- per-frame setup. Minimal 6502 harness.
// Two paths: the $00==4 skip (no big block), and the full block with both build loops.
// Run: node --test games/tempest/translated/test/equivalence-a8e7.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a8e7 } from "../loc_a8e7.js";

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

test("loc_a8e7: $00==4 skips the big block; bmi + beq path -> early rts, 67 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // routine's own rts -> 0x2001

  m.mem.write8(0x05, 0x80);   // bit $05 -> N set -> bmi 0xa8fe taken (skip ora/clv/bvc)
  m.mem.write8(0x3e, 0x00);   // lda $3e = 0 -> beq 0xa908 taken (skip 2nd a97f jsr)
  m.mem.write8(0x00, 0x04);   // cmp #4 -> beq 0xa943 taken (skip big block)
  m.mem.write8(0x0123, 0x00); // bpl 0xa954 taken (skip a951 jsr)
  // $00 (=4) at 0xa954 != 0x18 -> bne 0xa97c taken -> rts

  loc_a8e7(m);

  assert.deepEqual(m.calls, [0xaaa8, 0xa97f, 0xdf39], "aaa8, one a97f, df39");
  assert.equal(m.regs.a, 0x04, "A = $00 = 4 at the exit compare");
  assert.equal(m.pc, 0x2001, "rts -> seed+1");
  assert.equal(m.cycles, 67, "traced T-states for the skip path");
});

test("loc_a8e7: full big block (ora/bvc + both build loops) -> rts, 315 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // -> 0x2001

  m.mem.write8(0x05, 0x00);   // bit $05 -> N clear -> bmi NOT taken -> ora/clv/bvc block
  m.mem.write8(0x43, 0x01);   // ora chain -> A=1 (nonzero) -> beq 0xa908 NOT taken -> a905 jsr a97f
  m.mem.write8(0x44, 0x00);
  m.mem.write8(0x45, 0x00);
  m.mem.write8(0x00, 0x00);   // != 4 -> beq 0xa943 NOT taken -> big block; also != 0x18 at a954 -> bne -> rts
  m.mem.write8(0xcde4, 0x10); // ldx for a9d7 arg
  m.mem.write8(0xcde5, 0x00); // ldx base for loop2 (x=0)
  m.mem.write8(0x31fa, 0x55); // loop2 payload (table index resolves to 0)
  m.mem.write8(0x0123, 0x00); // bpl 0xa954 taken (skip a951 jsr)
  // $061b+0..2 and $aace+0..10 left 0 -> eor checksum stays 0xa7, table index 0

  loc_a8e7(m);

  assert.equal(m.mem.read8(0x3b), 0x1d, "$3b := 0x1d");
  assert.equal(m.mem.read8(0x3c), 0x07, "$3c := 0x07");
  assert.equal(m.mem.read8(0x016c), 0xa7, "$016c := eor checksum (0xa7 ^ zeros)");
  assert.equal(m.mem.read8(0x2f60), 0x55, "loop2 write x=0");
  assert.equal(m.mem.read8(0x2f62), 0x55, "loop2 write x=2");
  assert.equal(m.mem.read8(0x2f64), 0x55, "loop2 write x=4");
  assert.deepEqual(m.calls, [0xaaa8, 0xa97f, 0xa97f, 0xa9d7, 0xdf39], "aaa8, two a97f, a9d7, df39");
  assert.equal(m.pc, 0x2001, "rts -> seed+1");
  assert.equal(m.cycles, 315, "traced T-states incl. loop1 (11 iters) + loop2 (3 iters)");
});
