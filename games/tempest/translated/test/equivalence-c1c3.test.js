// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c1c3 (ROM 0xc1c3-0xc1fc) -- zeroes a fixed zp set + the $6080-$6090 block
// (skipping $608c), then $608c=$0f. Minimal 6502 harness (Regs + flat RAM + page-1 stack seam),
// author-derived. Run: node --test games/tempest/translated/test/equivalence-c1c3.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c1c3 } from "../loc_c1c3.js";

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

test("loc_c1c3: clears the zp set + $6080 block, sets $608c=$0f, RTS, 82 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  // pre-seed every touched cell non-zero so the writes are observable
  for (const a of [0x81, 0x91, 0x80, 0x78, 0x90, 0x88]) m.ram[a] = 0xaa;
  for (const a of [0x6080, 0x6081, 0x6084, 0x6085, 0x6086, 0x6087, 0x6089, 0x6083,
    0x608c, 0x608d, 0x608e, 0x608f, 0x6090]) m.ram[a] = 0xbb;

  loc_c1c3(m);

  for (const a of [0x81, 0x91, 0x80, 0x78, 0x90, 0x88]) assert.equal(m.ram[a], 0x00, `zp $${a.toString(16)} cleared`);
  for (const a of [0x6080, 0x6081, 0x6084, 0x6085, 0x6086, 0x6087, 0x6089, 0x6083,
    0x608d, 0x608e, 0x608f, 0x6090]) assert.equal(m.ram[a], 0x00, `$${a.toString(16)} cleared`);
  assert.equal(m.ram[0x608c], 0x0f, "$608c = 0x0f");
  assert.equal(m.regs.a, 0x0f, "A holds 0x0f at exit");
  assert.equal(m.regs.fZ, false, "0x0f -> Z clear");
  assert.equal(m.regs.fN, false, "0x0f -> N clear");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "no calls");
  assert.equal(m.cycles, 82, "2 + 6*3 + 2 + 12*4 + 2 + 4 + 6 = 82");
});
