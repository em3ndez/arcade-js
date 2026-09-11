// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b967 (ROM 0xb967). Selects A/X pair from $ce87/$ce86 when $0415==0 else
// $ce6f/$ce6e. Run: node --test games/tempest/translated/test/equivalence-b967.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b967 } from "../loc_b967.js";

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

test("loc_b967: $0415==0 -> A=$ce87, X=$ce86, 21 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // rts -> 0x2001
  m.mem.write8(0x0415, 0x00);
  m.mem.write8(0xce87, 0xaa);
  m.mem.write8(0xce86, 0xbb);

  loc_b967(m);

  assert.equal(m.regs.a, 0xaa, "A from $ce87");
  assert.equal(m.regs.x, 0xbb, "X from $ce86");
  assert.equal(m.pc, 0x2001, "rts -> pushed + 1");
  assert.equal(m.cycles, 21, "4 + 3(beq taken) + 4 + 4 + 6");
});

test("loc_b967: $0415!=0 -> A=$ce6f, X=$ce6e, V cleared, 25 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000);
  m.mem.write8(0x0415, 0x05);
  m.mem.write8(0xce6f, 0x11);
  m.mem.write8(0xce6e, 0x22);
  m.regs.fV = true;

  loc_b967(m);

  assert.equal(m.regs.a, 0x11, "A from $ce6f");
  assert.equal(m.regs.x, 0x22, "X from $ce6e");
  assert.equal(m.regs.fV, false, "clv cleared V");
  assert.equal(m.pc, 0x3001);
  assert.equal(m.cycles, 25, "4 + 2(beq fall) + 4 + 4 + 2 + 3(bvc) + 6");
});
