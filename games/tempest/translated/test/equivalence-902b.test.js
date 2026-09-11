// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_902b (ROM 0x902b-0x904a) -- six init calls, then $0124=$0148=0xff, $0123=0x00, rts.
// The call stub records targets and rebalances each JSR push so the caller's return survives to the rts. Run:
//   node --test games/tempest/translated/test/equivalence-902b.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_902b } from "../loc_902b.js";

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

test("loc_902b: six inits, sets $0124/$0148=0xff, $0123=0x00, returns to pushed+1; 58 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000); // caller return -> rts pulls +1 = 0x1001
  loc_902b(m);
  assert.deepEqual(m.calls, [0x928f, 0x926f, 0x9246, 0x929f, 0x92ad, 0xc16e], "six init subroutines in order");
  assert.equal(m.mem.read8(0x0124), 0xff, "$0124 = 0xff");
  assert.equal(m.mem.read8(0x0148), 0xff, "$0148 = 0xff");
  assert.equal(m.mem.read8(0x0123), 0x00, "$0123 = 0x00");
  assert.equal(m.regs.a, 0x00, "A left holding 0x00");
  assert.equal(m.pc, 0x1001, "rts returns to caller pushed+1");
  assert.equal(m.regs.s, 0xfd, "stack balanced after rts");
  assert.equal(m.cycles, 6 * 6 + 2 + 4 + 4 + 2 + 4 + 6, "6*jsr + lda/sta*5 + rts = 58");
});
