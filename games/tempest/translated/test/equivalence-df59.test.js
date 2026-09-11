// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_df59 (ROM 0xdf59-0xdf5e). Minimal 6502 harness (Regs + flat RAM + page-1 stack
// seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration check.
// Run: node --test games/tempest/translated/test/equivalence-df59.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_df59 } from "../loc_df59.js";

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

test("loc_df59: store A then X at ($74),y and +1, fall into 0xdf5f; 16 T", () => {
  const m = makeMachine();
  m.ram[0x0074] = 0x00; m.ram[0x0075] = 0x40; // ptr = 0x4000
  m.regs.y = 0x02;
  m.regs.a = 0xaa;
  m.regs.x = 0xbb;

  loc_df59(m);

  assert.equal(m.ram[0x4002], 0xaa, "A stored at ptr + y");
  assert.equal(m.ram[0x4003], 0xbb, "X (via txa) stored at ptr + y+1");
  assert.equal(m.regs.y, 0x03, "iny -> Y=0x03");
  assert.equal(m.regs.a, 0xbb, "txa -> A=X=0xbb");
  assert.equal(m.regs.fN, true, "0xbb -> N set from txa");
  assert.deepEqual(m.calls, [0xdf5f], "fall-through delegates to loc_df5f");
  assert.equal(m.pc, 0xdf5f, "PC at fall-through entry");
  assert.equal(m.cycles, 6 + 2 + 2 + 6, "16 T");
});
