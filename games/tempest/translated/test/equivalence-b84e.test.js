// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b84e (ROM 0xb84e-0xb856): RTS-trick computed dispatch to word($b857+Y)+1.
// Run: node --test games/tempest/translated/test/equivalence-b84e.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b84e } from "../loc_b84e.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [], _retPushed: false,
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

test("loc_b84e: Y=2 -> dispatch to (word $b857+Y)+1; caller return preserved; 20 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0xb818); m._retPushed = false; // caller return already on stack; not a pending recorded-jsr return
  m.regs.y = 0x02;
  m.ram[0xb859] = 0x9c; // $b857 + 2 (lo)
  m.ram[0xb85a] = 0xdf; // $b858 + 2 (hi) -> word 0xdf9c, +1 = 0xdf9d

  loc_b84e(m);

  assert.deepEqual(m.calls, [0xdf9d], "dispatch to (word $b857+Y) + 1");
  assert.equal(m.pc, 0xdf9d, "PC at target");
  assert.equal(m.regs.s, 0xfb, "S restored");
  assert.equal(m.mem.read16(0x01fc), 0xb818, "caller return still on the stack");
  assert.equal(m.cycles, 4 + 3 + 4 + 3 + 6, "lda/pha/lda/pha/rts");
});
