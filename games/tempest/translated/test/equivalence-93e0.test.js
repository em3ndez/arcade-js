// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_93e0 (ROM 0x93e0) -- 3x asl-a rol-$29 then X = (0x0d - ($29^0xff))>>1,
// A preserved across pha/pla. Minimal 6502 harness. Run: node --test .../equivalence-93e0.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_93e0 } from "../loc_93e0.js";

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

test("loc_93e0: A=0x05 -> $29=0xf8, X=0x0a, A preserved=0x28, 54 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // rts -> 0x1234
  m.regs.a = 0x05;

  loc_93e0(m);

  // asl/rol chain: 0x29 (init 0xff) rol'd 3x with C-out 1 each -> 0xf8; A shifted 0x05->0x28.
  assert.equal(m.mem.read8(0x29), 0xf8, "$29 after 3 rol");
  assert.equal(m.regs.y, 0xf8, "Y = $29");
  // A' = ($29^0xff)=0x07; +0x0d=0x14; >>1 = 0x0a -> X
  assert.equal(m.regs.x, 0x0a, "X = (0x0d - (~$29))>>1");
  assert.equal(m.regs.a, 0x28, "A restored by pla to post-asl value");
  assert.equal(m.regs.s, 0xfd, "stack balanced (pha/pla + rts)");
  assert.equal(m.pc, 0x1234, "rts -> pushed+1");
  assert.equal(m.cycles, 54, "sum of instruction T-states");
});

test("loc_93e0: A=0xa0 -> carry propagates: $29=0xfd, X=0x07, A restored=0x00", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);
  m.regs.a = 0xa0;

  loc_93e0(m);

  // asl-a carries 1,0,1 into the rol chain of 0xff -> 0xff,0xfe,0xfd
  assert.equal(m.mem.read8(0x29), 0xfd, "$29 = 0xfd");
  // (~0xfd)=0x02; +0x0d=0x0f; >>1=0x07
  assert.equal(m.regs.x, 0x07, "X = 0x07");
  assert.equal(m.regs.a, 0x00, "A restored (0xa0 asl'd 3x -> 0x00)");
  assert.equal(m.pc, 0x2001, "rts");
});
