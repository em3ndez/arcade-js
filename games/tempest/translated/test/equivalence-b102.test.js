// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b102 (ROM 0xb102-0xb130) -- seeds A/X, calls loc_b15a, then clamps the
// paired cursors $014e/$014d (wrap $014e by +0x14, step $014d by +8 with a 0xa0 ceiling). No abs,x
// load exists here, so there is no page-cross edge to probe; each path pins exact cycles + memory.
// Run: node --test games/tempest/translated/test/equivalence-b102.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b102 } from "../loc_b102.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; (this.retAddrs ||= []).push(this.pull16()); } return undefined; },
  };
}

// $014e >= 0xa0 -> bcs taken (no wrap); $014e >= 0x50 -> bcc @b117 not taken; $014d+8 < $014e -> bcc @b125 taken -> rts
test("bcs taken, bcc@b117 not taken, bcc@b125 taken -> rts (mid store)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x014e] = 0xa0;              // >= 0xa0 -> bcs taken, $014e unchanged
  m.ram[0x014d] = 0x40;             // 0x40 + 8 = 0x48 < 0xa0 -> bcc @b125 taken
  loc_b102(m);
  assert.deepEqual(m.calls, [0xb15a]);
  assert.equal(m.retAddrs[0], 0xb108, "jsr 0xb15a pushes jsraddr+2 (0xb106+2)");
  assert.equal(m.ram[0x014e], 0xa0, "$014e untouched (bcs skipped the wrap)");
  assert.equal(m.ram[0x014d], 0x48, "$014d stepped +8");
  assert.equal(m.ram[0x01], 0x00, "$01 not written on the early rts");
  assert.equal(m.pc, 0x5001, "rts -> pushed return + 1");
  assert.equal(m.cycles, 48);
});

// $014e < 0xa0 -> bcs not taken -> wrap +0x14; wrapped result < 0x50 -> bcc @b117 taken -> rts
test("bcs not taken -> wrap $014e by +0x14, then bcc@b117 taken -> rts", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x014e] = 0x30;             // < 0xa0 -> wrap: 0x30 + 0x14 = 0x44 (carry clear)
  m.ram[0x014d] = 0x11;            // untouched on this path
  loc_b102(m);
  assert.deepEqual(m.calls, [0xb15a]);
  assert.equal(m.retAddrs[0], 0xb108);
  assert.equal(m.ram[0x014e], 0x44, "$014e wrapped to 0x44");
  assert.equal(m.ram[0x014d], 0x11, "$014d untouched (returned before the step)");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 35);
});

// full tail: bcs taken; bcc@b117 not taken; $014d+8 >= $014e -> bcc@b125 not taken -> pin $014d=0xa0, $01=0x14
test("full tail -> bcc@b125 not taken -> $014d=0xa0, $01=0x14", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x014e] = 0xb0;             // >= 0xa0 -> bcs taken
  m.ram[0x014d] = 0xf0;            // 0xf0 + 8 = 0xf8 >= 0xb0 -> bcc @b125 NOT taken -> tail
  loc_b102(m);
  assert.deepEqual(m.calls, [0xb15a]);
  assert.equal(m.retAddrs[0], 0xb108);
  assert.equal(m.ram[0x014d], 0xa0, "$014d pinned to 0xa0 (overwrites the 0xf8)");
  assert.equal(m.ram[0x01], 0x14, "$01 set to 0x14");
  assert.equal(m.ram[0x014e], 0xb0, "$014e untouched");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 58);
});
