// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a38e (ROM 0xa38e-0xa397). loc_a38e sets $02f2,x=0xff, subtracts 4 from Y, then
// falls through into the separately registered loc_a398 -- modeled here as a tail-call to 0xa398 (pc left
// at the target). Run: node --test games/tempest/translated/test/equivalence-a38e.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a38e } from "../loc_a38e.js";

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

test("loc_a38e: $02f2,x=0xff, Y-=4, then falls through (tail-call) into loc_a398; 15 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.x = 0x00; m.regs.y = 0x05;
  loc_a38e(m);
  assert.equal(m.ram[0x02f2], 0xff, "$02f2,x (x=0) = 0xff");
  assert.equal(m.regs.a, 0x01, "A = Y - 4 = 0x01");
  assert.equal(m.regs.y, 0x01, "tay -> Y = A = 0x01");
  assert.deepEqual(m.calls, [0xa398], "fall through -> tail-call loc_a398 (no inlined body)");
  assert.equal(m.pc, 0xa398, "pc left at the fall-through target 0xa398");
  assert.equal(m.cycles, 15, "loc_a38e own body only: 2+5+2+2+2+2");
});

test("loc_a38e: sec+sbc#4 borrows when Y<4 (Y wraps), $02f2,x still flagged", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.x = 0x03; m.regs.y = 0x02;   // 0x02 - 0x04 = 0xfe with borrow
  loc_a38e(m);
  assert.equal(m.ram[0x02f5], 0xff, "$02f2,x (x=3) = 0xff");
  assert.equal(m.regs.y, 0xfe, "tay -> Y = (0x02 - 0x04) & 0xff = 0xfe");
  assert.deepEqual(m.calls, [0xa398], "tail-call loc_a398");
  assert.equal(m.pc, 0xa398, "pc at 0xa398");
  assert.equal(m.cycles, 15, "own body only");
});
