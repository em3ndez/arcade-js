// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_dce6 (ROM 0xdce6-0xdd0c). Minimal 6502 harness (Regs + flat RAM + page-1 stack
// seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration check.
// Run: node --test games/tempest/translated/test/equivalence-dce6.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_dce6 } from "../loc_dce6.js";

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

test("loc_dce6: first slot free ($6040>=0) -> loads $6060->A,$6070->Y, X=$0f, rts", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x2000); // rts -> 0x2001
  m.regs.a = 0x99; m.regs.x = 0x77;
  m.mem.write8(0x6040, 0x00); // >= 0 -> bmi $dcfe not taken
  m.mem.write8(0x6060, 0x5a);
  m.mem.write8(0x6070, 0x3c);

  loc_dce6(m);

  assert.equal(m.mem.read8(0x0073), 0x00, "$73 = 0");
  assert.equal(m.mem.read8(0x0414), 0x00, "$0414 = 0");
  assert.equal(m.mem.read8(0x608e), 0x99, "$608e = live-in A");
  assert.equal(m.mem.read8(0x608f), 0x77, "$608f = live-in X");
  assert.equal(m.mem.read8(0x6090), 0x00, "$6090 = 0");
  assert.equal(m.mem.read8(0x608c), 0x10, "$608c = $10");
  assert.equal(m.mem.read8(0x6094), 0x10, "$6094 = $10");
  assert.equal(m.regs.a, 0x5a, "A = $6060");
  assert.equal(m.regs.y, 0x3c, "Y = $6070");
  assert.equal(m.regs.x, 0x0f, "X = $10 - 1");
  assert.equal(m.pc, 0x2001, "rts -> pushed + 1");
  assert.equal(m.cycles, 55, "prologue 31 + found path 24");
});

test("loc_dce6: all slots negative -> dex underflows, exits via bmi $dd0c, X=$ff", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1000); // rts -> 0x1001
  m.regs.a = 0x11; m.regs.x = 0x22;
  m.mem.write8(0x6040, 0x80); // negative -> bmi $dcfe taken every pass

  loc_dce6(m);

  assert.equal(m.regs.x, 0xff, "X wrapped past 0 -> $ff");
  assert.equal(m.regs.a, 0x80, "A holds last $6040 read");
  assert.equal(m.mem.read8(0x608e), 0x11, "$608e = live-in A");
  assert.equal(m.pc, 0x1001, "rts -> pushed + 1");
  assert.equal(m.cycles, 234, "prologue 31 + 16 loops*12 + tail 11");
});
