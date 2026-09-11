// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a3d6 (ROM 0xa3d6-0xa415). Allocates an object slot: an empty $030a,x wins
// immediately (early exit), else the slot with the max $0312,x is reused and the count $0116 is decremented.
// Run: node --test games/tempest/translated/test/equivalence-a3d6.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a3d6 } from "../loc_a3d6.js";

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

test("loc_a3d6: free slot at x=7 -> early exit, writes into slot 7, only inc $0116, 72 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1900);
  m.regs.x = 0x03; m.regs.y = 0x09;
  m.ram[0x0311] = 0x00; // $030a,7 empty -> beq at first iteration (x=7)
  m.ram[0x2c] = 0xaa; m.ram[0x29] = 0xbb; m.ram[0x2d] = 0xcc;
  m.ram[0x0116] = 0x02;
  loc_a3d6(m);
  assert.equal(m.ram[0x35], 0x03, "X saved in $35");
  assert.equal(m.ram[0x36], 0x09, "Y saved in $36");
  assert.equal(m.ram[0x0319], 0x00, "$0312,7 zeroed");
  assert.equal(m.ram[0x0309], 0xaa, "$0302,7 = $2c");
  assert.equal(m.ram[0x0311], 0xbb, "$030a,7 = $29");
  assert.equal(m.ram[0x0301], 0xcc, "$02fa,7 = $2d");
  assert.equal(m.ram[0x0116], 0x03, "$0116 incremented (no dec on free-slot path)");
  assert.equal(m.regs.x, 0x03, "X restored");
  assert.equal(m.regs.y, 0x09, "Y restored");
  assert.equal(m.pc, 0x1901, "rts -> pushed + 1");
  assert.equal(m.cycles, 72, "free-slot path");
});

test("loc_a3d6: no free slot -> reuse max $0312,x (index 3), dec then inc $0116, 251 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1900);
  m.regs.x = 0x01; m.regs.y = 0x02;
  for (let x = 0; x < 8; x++) m.ram[0x030a + x] = 0x01;         // all slots active
  const timers = [0x10, 0x11, 0x12, 0x50, 0x14, 0x15, 0x16, 0x17]; // max at x=3
  for (let x = 0; x < 8; x++) m.ram[0x0312 + x] = timers[x];
  m.ram[0x2c] = 0xaa; m.ram[0x29] = 0xbb; m.ram[0x2d] = 0xcc;
  m.ram[0x0116] = 0x05;
  loc_a3d6(m);
  assert.equal(m.ram[0x2b], 0x03, "max-timer slot index = 3");
  assert.equal(m.ram[0x2a], 0x50, "max timer value = 0x50");
  assert.equal(m.ram[0x0315], 0x00, "$0312,3 zeroed");
  assert.equal(m.ram[0x0305], 0xaa, "$0302,3 = $2c");
  assert.equal(m.ram[0x030d], 0xbb, "$030a,3 = $29");
  assert.equal(m.ram[0x02fd], 0xcc, "$02fa,3 = $2d");
  assert.equal(m.ram[0x0116], 0x05, "$0116 net unchanged (dec then inc)");
  assert.equal(m.regs.x, 0x01, "X restored");
  assert.equal(m.regs.y, 0x02, "Y restored");
  assert.equal(m.pc, 0x1901, "rts -> pushed + 1");
  assert.equal(m.cycles, 251, "full 8-slot scan path");
});
