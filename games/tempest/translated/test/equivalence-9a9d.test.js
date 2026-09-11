// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9a9d (ROM 0x9a9d) -- from its entry the ldy #0/beq always dispatches to loc_9af6
// (a real committed mid-entry), so this exercises the whole loc_9a9d -> loc_9af6 chain end to end.
// Run: node --test games/tempest/translated/test/equivalence-9a9d.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9a9d } from "../loc_9a9d.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = { read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; } };
  return {
    regs, mem, ram, cycles: 0, pc: 0,
    step(n, c) { this.pc = n; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
  };
}

test("loc_9a9d: ldy#0 -> beq loc_9af6; $2c=[$9b02], $2b=0, $2d=[$015d], A=[$29]; rts", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x3000);
  m.regs.y = 0x77; // clobbered by ldy #0
  m.mem.write8(0x9b02, 0x12); // -> $2c
  m.mem.write8(0x015d, 0x34); // -> A, then $2d via loc_9af6's sta $2d
  m.mem.write8(0x29, 0x56);   // final A
  loc_9a9d(m);
  assert.equal(m.mem.read8(0x2c), 0x12, "$2c = [$9b02]");
  assert.equal(m.mem.read8(0x2b), 0x00, "$2b = Y (0, from ldy #0)");
  assert.equal(m.mem.read8(0x2d), 0x34, "$2d = [$015d] (carried as A into loc_9af6's sta $2d)");
  assert.equal(m.regs.a, 0x56, "A reloaded from $29 by loc_9af6");
  assert.equal(m.pc, 0x3001, "rts -> pushed + 1");
  assert.equal(m.cycles, 4 + 3 + 4 + 2 + 3 + (3 + 3 + 3 + 6), "9a9d head 16 + beq 3 + loc_9af6 15 = 31");
});
