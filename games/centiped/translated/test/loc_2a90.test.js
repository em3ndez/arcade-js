// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2a90 (ROM 0x2a90-0x2a92). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2a90.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2a90 } from "../loc_2a90.js";

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
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); return undefined; },
  };
}

test("loc_2a90: STA $64,X writes A at ($64+X)&0xff, falls into loc_2a92; 4 T", () => {
  const m = makeMachine();
  m.regs.x = 0x03;
  m.regs.a = 0x77;
  m.ram[0x0067] = 0x00; // target starts clear

  loc_2a90(m);

  assert.equal(m.ram[0x0067], 0x77, "A stored at $64+X = $67");
  assert.equal(m.regs.a, 0x77, "A unchanged by STA");
  assert.equal(m.cycles, 4, "STA $64,X = 4 T");
  assert.equal(m.pc, 0x2a92, "last step lands at loc_2a92 before the fall-through call");
  assert.deepEqual(m.calls, [0x2a92], "fall through into loc_2a92");
});

test("loc_2a90: zero-page,X wraps within page 0 (X=0xa0 -> $64+$a0 = $04)", () => {
  const m = makeMachine();
  m.regs.x = 0xa0;
  m.regs.a = 0x42;

  loc_2a90(m);

  assert.equal(m.ram[0x0004], 0x42, "($64 + 0xa0) & 0xff = 0x04");
  assert.equal(m.ram[0x0104], 0x00, "no write to 0x0104 -- zp,X does not carry out of page 0");
});

test("loc_2a90 MUTATION: STA mischarged 5 T not 4 T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.x = 0x03;
  m.regs.a = 0x77;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2a92 ? 5 : c);
  loc_2a90(m);
  assert.notEqual(m.cycles, 4, "a mischarged store cycle blows the golden T-state total");
});
