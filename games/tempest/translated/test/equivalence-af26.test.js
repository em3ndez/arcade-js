// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_af26 (ROM 0xaf26-0xaf3e) -- if $0600|$0601==0 tail to the shared rts $af6e;
// else draw slot 0 (jsr $af3f) and fall through into loc_af3f with x=1. Author-derived 6502 harness.
// Run: node --test games/tempest/translated/test/equivalence-af26.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_af26 } from "../loc_af26.js";

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

test("loc_af26: both slot counts zero -> tail to shared rts $af6e; 11 T", () => {
  const m = makeMachine();
  m.ram[0x0600] = 0x00;
  m.ram[0x0601] = 0x00;
  loc_af26(m);
  assert.equal(m.regs.fZ, true, "$0600 | $0601 == 0 -> Z set");
  assert.equal(m.pc, 0xaf6e, "BEQ taken -> shared rts at $af6e");
  assert.deepEqual(m.calls, [0xaf6e], "tail to $af6e");
  assert.equal(m.cycles, 4 + 4 + 3, "lda abs (4) + ora abs (4) + beq taken (3)");
});

test("loc_af26: nonzero counts -> draws slot 0 then falls into loc_af3f (x=1); 36 T", () => {
  const m = makeMachine();
  m.ram[0x0600] = 0x05;
  m.ram[0x0601] = 0x00; // 0x05 | 0x00 = 0x05 -> Z clear
  loc_af26(m);
  assert.equal(m.regs.fZ, false, "combined count nonzero -> Z clear");
  assert.equal(m.regs.x, 0x01, "ldx #$01 for the fall-through slot 1");
  assert.equal(m.regs.a, 0x63, "lda #$63 (the score-digit base) still live in A");
  assert.equal(m.pc, 0xaf3f, "fall-through PC is loc_af3f start");
  assert.deepEqual(m.calls, [0xab14, 0xaf71, 0xaf3f, 0xaf3f],
    "jsr $ab14, jsr $af71, jsr $af3f (slot 0), then fall into loc_af3f (slot 1)");
  assert.equal(m.cycles, 4 + 4 + 2 + 2 + 6 + 2 + 6 + 2 + 6 + 2, "36 T");
});
