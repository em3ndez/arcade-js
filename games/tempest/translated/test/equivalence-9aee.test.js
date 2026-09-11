// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9aee (ROM 0x9aee) -- loads 0x9b02,y -> $2c and 0x9afd,y -> $2d, stashes Y in
// $2b, reloads A from $29, rts. Run: node --test games/tempest/translated/test/equivalence-9aee.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9aee } from "../loc_9aee.js";

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

test("loc_9aee: Y=1 -> $2c=[0x9b03], $2d=[0x9afe], $2b=Y, A=[0x29]; returns pushed+1; 26 T", () => {
  const m = makeMachine();
  m.regs.y = 0x01;
  m.regs.s = 0xfd;
  m.push16(0x2000); // rts -> 0x2001
  m.ram[0x9b03] = 0xaa; // 0x9b02 + 1
  m.ram[0x9afe] = 0xbb; // 0x9afd + 1
  m.ram[0x29] = 0xcc;
  loc_9aee(m);
  assert.equal(m.ram[0x2c], 0xaa, "$2c = table 0x9b02,y");
  assert.equal(m.ram[0x2d], 0xbb, "$2d = table 0x9afd,y");
  assert.equal(m.ram[0x2b], 0x01, "$2b = Y");
  assert.equal(m.regs.a, 0xcc, "A reloaded from $29");
  assert.equal(m.regs.fN, true, "0xcc -> N set (from final lda $29)");
  assert.equal(m.pc, 0x2001, "rts -> pushed + 1");
  assert.equal(m.cycles, 26, "4+3+4+3+3+3+6");
});
