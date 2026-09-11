// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b5d7 (ROM 0xb5d7-0xb5e0): RTS-trick computed dispatch to word($b5e1+Y)+1.
// The harness records the dispatched call. Run: node --test games/tempest/translated/test/equivalence-b5d7.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b5d7 } from "../loc_b5d7.js";

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

test("loc_b5d7: A=4 -> Y=4 indexes table $b5e1, dispatch to word+1; caller return preserved; 22 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x9abc); m._retPushed = false; // caller return already on stack; not a pending recorded-jsr return
  m.regs.a = 0x04;
  m.ram[0xb5e5] = 0x33; // $b5e1 + 4 (lo)
  m.ram[0xb5e6] = 0x12; // $b5e2 + 4 (hi) -> word 0x1233, +1 = 0x1234

  loc_b5d7(m);

  assert.equal(m.regs.y, 0x04, "tay");
  assert.deepEqual(m.calls, [0x1234], "dispatch to (word $b5e1+Y) + 1");
  assert.equal(m.pc, 0x1234, "PC at the dispatch target");
  assert.equal(m.regs.s, 0xfb, "S restored (pha,pha then rts pulls both)");
  assert.equal(m.mem.read16(0x01fc), 0x9abc, "caller return still on the stack below S");
  assert.equal(m.cycles, 2 + 4 + 3 + 4 + 3 + 6, "tay/lda/pha/lda/pha/rts");
});

test("loc_b5d7: A=0 -> Y=0 uses word at $b5e1", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x0001); m._retPushed = false;
  m.regs.a = 0x00;
  m.ram[0xb5e1] = 0x00; // lo
  m.ram[0xb5e2] = 0xac; // hi -> 0xac00, +1 = 0xac01

  loc_b5d7(m);

  assert.deepEqual(m.calls, [0xac01], "dispatch to word($b5e1) + 1");
  assert.equal(m.pc, 0xac01, "PC at target");
});
