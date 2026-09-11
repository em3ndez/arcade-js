// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_af6e (ROM 0xaf6e) -- the bare-RTS second entry of loc_af3f.
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_af6e } from "../loc_af6e.js";

test("loc_af6e: bare RTS -> returns to pushed+1, 6 T", () => {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = { read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8) };
  const m = { regs, mem, cycles: 0, pc: 0,
    step(n, c) { this.pc = n; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); } };
  regs.s = 0xfd; m.push16(0x1233);
  loc_af6e(m);
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.equal(m.cycles, 6);
});
