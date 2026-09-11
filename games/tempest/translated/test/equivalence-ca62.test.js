// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ca62 (ROM 0xca62-0xca6b). Minimal 6502 harness. Clears the 6-byte block $40..$45
// via the sta $40,x / dex / bpl loop, leaving neighbors untouched. Run:
//   node --test games/tempest/translated/test/equivalence-ca62.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ca62 } from "../loc_ca62.js";

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

test("loc_ca62: clears $40..$45, preserves neighbors, X=0xff; 63 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000); // rts -> 0x1001
  for (let a = 0x3f; a <= 0x46; a++) m.ram[a] = 0xaa; // fill the block + both neighbors
  loc_ca62(m);
  for (let a = 0x40; a <= 0x45; a++) assert.equal(m.ram[a], 0x00, `$${a.toString(16)} cleared`);
  assert.equal(m.ram[0x3f], 0xaa, "$3f (below block) preserved");
  assert.equal(m.ram[0x46], 0xaa, "$46 (above block) preserved");
  assert.equal(m.regs.a, 0x00, "A = 0");
  assert.equal(m.regs.x, 0xff, "X = 0xff (dex past 0)");
  assert.equal(m.pc, 0x1001, "rts");
  assert.equal(m.cycles, 63, "6-iteration loop T-state total");
});
