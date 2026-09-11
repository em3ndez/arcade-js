// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a309 (ROM 0xa309-0xa339). Minimal 6502 harness (Regs + flat RAM + page-1 stack
// seam); JSRs are opaque (harness records + balances the pushed return). Run:
// node --test games/tempest/translated/test/equivalence-a309.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a309 } from "../loc_a309.js";

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

test("loc_a309: $60da&7 >= 3 -> clamp A to 0 (BCC not taken); saves/restores X, 81 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1233); // rts -> 0x1234
  m.regs.x = 0x02; m.regs.y = 0x0a;  // y-4 = 6 -> index 0x02bf
  m.ram[0x02bf] = 0x77;
  m.ram[0x60da] = 0x05;              // &7 = 5, cmp 3 -> carry set -> bcc NOT taken -> lda #0
  loc_a309(m);
  assert.equal(m.ram[0x37], 0x02, "X stashed in $37");
  assert.equal(m.ram[0x02f4], 0xff, "$02f2,x (x=2) = 0xff");
  assert.equal(m.ram[0x2d], 0x77, "$02b9,y -> $2d");
  assert.deepEqual(m.calls, [0xa3ca, 0xa06f, 0xca6c], "jsr a3ca, a06f, ca6c in order");
  assert.equal(m.regs.x, 0x02, "X restored from $37 (was 5 after tax)");
  assert.equal(m.pc, 0x1234, "rts -> pushed + 1");
  assert.equal(m.cycles, 81, "clamp path");
});

test("loc_a309: $60da&7 < 3 -> BCC taken, A kept (no lda #0), 80 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x2000);
  m.regs.x = 0x00; m.regs.y = 0x08;  // y-4 = 4 -> index 0x02bd
  m.ram[0x02bd] = 0x11;
  m.ram[0x60da] = 0x01;              // &7 = 1, cmp 3 -> carry clear -> bcc taken (A stays 1)
  loc_a309(m);
  assert.equal(m.ram[0x2d], 0x11, "$02b9,y -> $2d");
  assert.equal(m.regs.x, 0x00, "X restored");
  assert.equal(m.pc, 0x2001, "rts -> pushed + 1");
  assert.equal(m.cycles, 80, "branch-taken saves the lda #0 (2T)");
});
