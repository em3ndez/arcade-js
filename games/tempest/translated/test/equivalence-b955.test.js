// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b955 (ROM 0xb955). $57>>4 then a do-while iny/lsr/bne counting shifts;
// A ends as 0+2 and Y is reset to 0. Run: node --test games/tempest/translated/test/equivalence-b955.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b955 } from "../loc_b955.js";

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

test("loc_b955: $57=0x80 -> 4 loop iters, A=2, Y=0, returns pushed+1, 52 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x4000); // rts -> 0x4001
  m.mem.write8(0x57, 0x80);

  loc_b955(m);

  assert.equal(m.regs.a, 0x02, "A = 0 + 2 after loop drains A to zero");
  assert.equal(m.regs.y, 0x00, "Y reset to 0 at b964");
  assert.equal(m.pc, 0x4001, "rts -> pushed + 1");
  assert.equal(m.cycles, 52, "3 + 4*2 + 2 + (3*7+6) + 2 + 2 + 2 + 6");
});

test("loc_b955: $57=0x0f -> high nibble 0, single do-while iter, A=2, Y=0, 31 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  m.mem.write8(0x57, 0x0f);

  loc_b955(m);

  assert.equal(m.regs.a, 0x02, "A = 2");
  assert.equal(m.regs.y, 0x00, "Y = 0");
  assert.equal(m.pc, 0x1001);
  assert.equal(m.cycles, 31, "3 + 8 + 2 + 6 + 2 + 2 + 2 + 6");
});
