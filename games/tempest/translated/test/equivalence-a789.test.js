// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a789 (ROM 0xa789-0xa7a5) -- zeroes $0283..$0292, then sets $010e/$010d=0x20,
// $01=0x04, $68/$69=0. Minimal 6502 harness (Regs + flat RAM + page-1 stack seam), author-derived; the
// whole-machine boot-first state diff vs MAME is the integration check.
// Run: node --test games/tempest/translated/test/equivalence-a789.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a789 } from "../loc_a789.js";

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

test("loc_a789: clears $0283..$0292, sets fixed cells, X ends 0xff, A ends 0, returns pushed+1", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // RTS -> 0x2001
  for (let a = 0x0282; a <= 0x0293; a++) m.ram[a] = 0xaa; // fill range + both neighbors

  loc_a789(m);

  for (let a = 0x0283; a <= 0x0292; a++) assert.equal(m.ram[a], 0x00, `$${a.toString(16)} cleared`);
  assert.equal(m.ram[0x0282], 0xaa, "neighbor below range untouched");
  assert.equal(m.ram[0x0293], 0xaa, "neighbor above range untouched");
  assert.equal(m.ram[0x010e], 0x20, "$010e = 0x20");
  assert.equal(m.ram[0x010d], 0x20, "$010d = 0x20");
  assert.equal(m.ram[0x01], 0x04, "$01 = 0x04");
  assert.equal(m.ram[0x68], 0x00, "$68 = 0");
  assert.equal(m.ram[0x69], 0x00, "$69 = 0");
  assert.equal(m.regs.x, 0xff, "X = 0xff after final dex underflow");
  assert.equal(m.regs.a, 0x00, "A = 0 (last write)");
  assert.equal(m.pc, 0x2001, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "no subroutine calls");
  // ldx#(2) + 16*(lda#2 + sta abs,x 5 + dex 2) + bpl 15*3 taken + 1*2 not-taken
  //         + lda#(2)+sta abs(4)+sta abs(4)+lda#(2)+sta zp(3)+lda#(2)+sta zp(3)+sta zp(3)+rts(6)
  assert.equal(m.cycles, 2 + 16 * 9 + (15 * 3 + 2) + 29, "222 T");
  assert.equal(m.cycles, 222, "222 T (explicit)");
});
