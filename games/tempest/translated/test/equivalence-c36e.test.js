// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c36e (ROM 0xc36e-0xc3b9) -- A!=0 rts; else load 4-byte vector from
// $032a/$031a/$034a/$033a,y into $61-$64, $c772 copies $74/$75 -> $b0/$b1, then loop $38+1 times drawing via
// $c423 with a $37 nibble-carry bump. Opaque-call harness, author-derived.
// Run: node --test games/tempest/translated/test/equivalence-c36e.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c36e } from "../loc_c36e.js";

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

test("loc_c36e: A!=0 -> bne $c3b9 -> immediate rts; 9 T, no calls", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x5000); // rts -> 0x5001
  m.regs.setNZ(0x01); // Z clear (A!=0)
  loc_c36e(m);
  assert.equal(m.pc, 0x5001, "rts -> pushed+1");
  assert.deepEqual(m.calls, [], "no work done on the A!=0 path");
  assert.equal(m.cycles, 9, "bne taken (3) + rts (6)");
});

test("loc_c36e: A==0, Y=0, $0111==0 -> vector load, c772, 16x c423 loop; rts", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x5000);
  m.regs.y = 0x00;
  m.regs.setNZ(0x00); // Z set (A==0)
  m.ram[0x032a] = 0x11; m.ram[0x031a] = 0x22; m.ram[0x034a] = 0x33; m.ram[0x033a] = 0x44;
  m.ram[0x74] = 0xaa; m.ram[0x75] = 0xbb;
  m.ram[0x0111] = 0x00; // beq taken -> X stays 0x0f
  loc_c36e(m);
  assert.equal(m.ram[0x61], 0x11, "$61 <- $032a,y");
  assert.equal(m.ram[0x62], 0x22, "$62 <- $031a,y");
  assert.equal(m.ram[0x63], 0x33, "$63 <- $034a,y");
  assert.equal(m.ram[0x64], 0x44, "$64 <- $033a,y");
  assert.equal(m.ram[0xb0], 0xaa, "$b0 <- $74");
  assert.equal(m.ram[0xb1], 0xbb, "$b1 <- $75");
  assert.equal(m.ram[0x73], 0xc0, "$73 = 0xc0");
  assert.equal(m.ram[0x38], 0xff, "loop counter $38 decremented past 0 to 0xff");
  assert.equal(m.regs.x, 0x0f, "$0111==0 skipped dex -> X=0x0f (16 iterations)");
  const expected = [0xc772];
  for (let i = 0; i < 16; i++) expected.push(0xc423);
  assert.deepEqual(m.calls, expected, "c772 then 16x c423");
  assert.equal(m.pc, 0x5001, "rts -> pushed+1");
});

test("loc_c36e: $0111!=0 -> dex makes X=0x0e -> 15 iterations of c423", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x5000);
  m.regs.y = 0x00;
  m.regs.setNZ(0x00);
  m.ram[0x0111] = 0x01; // beq not taken -> dex
  loc_c36e(m);
  assert.equal(m.regs.x, 0x0e, "dex applied -> X=0x0e");
  const c423 = m.calls.filter((a) => a === 0xc423).length;
  assert.equal(c423, 15, "15 c423 draws for counter 0x0e");
});
