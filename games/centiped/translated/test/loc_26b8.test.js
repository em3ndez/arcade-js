// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_26b8 (ROM 0x26b8-0x26fd). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_26b8.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_26b8 } from "../loc_26b8.js";

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

// [a5]=0x0a keeps loop1's X positive (BPL taken all 6); [a6]=0x06 makes loop2's X start 0 (BPL not taken
// all 6). Both loops run 6 times ($8b starts 6, DEC to 0). Cycle budget: 26 + 125 + 28 + 131 + 6 = 316.
function setup(m) {
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> pulled + 1 = 0x1234
  m.ram[0x00f6] = 0x20;
  m.ram[0x00f7] = 0x11;
  m.ram[0x00a5] = 0x0a;
  m.ram[0x00a6] = 0x06;
}

test("loc_26b8: builds $91/$92, runs two 6x $3836 loops, RTS; 316 T", () => {
  const m = makeMachine();
  setup(m);

  loc_26b8(m);

  assert.equal(m.ram[0x0092], 0x17, "$92 = 0x06 ^ $F7 = 0x17 (last write wins)");
  assert.equal(m.ram[0x0091], 0x7f, "$91 = 0x5f ^ $F6 = 0x7f (last write wins)");
  assert.equal(m.ram[0x008b], 0x00, "$8b decremented to 0 by loop2");
  assert.equal(m.regs.a, 0x1f, "A = 0x1f (loop2 BPL-not-taken path, JSR is a no-op here)");
  assert.equal(m.regs.x, 0xfa, "X = 0x100 - 6 = 0xFA after loop2's 6 DEX from 0");
  assert.equal(m.regs.fZ, true, "Z set by the final DEC $8b -> 0");
  assert.equal(m.regs.fN, false, "N clear (0)");
  assert.equal(m.regs.fC, true, "C from SEC/SBC still set (no later carry op)");
  assert.equal(m.cycles, 316, "316 T total");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, new Array(12).fill(0x3836), "12 x JSR $3836 (6 per loop)");
});

test("loc_26b8 MUTATION: RTS mischarged 5T not 6T is caught by the T-state total", () => {
  const m = makeMachine();
  setup(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1234 ? 5 : c); // the RTS step lands at 0x1234
  loc_26b8(m);
  assert.notEqual(m.cycles, 316, "a mischarged cycle blows the golden T-state total");
});
