// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ab17 (ROM 0xab17). Author-derived minimal 6502 harness. The mid-body jsr
// stubs (call recorder) do not model the callees' own rts, so the pha/pla pairing across the b0d1 jsr
// reads a harness artifact -- deliberately NOT asserted; the asserted outputs (list draw + call seq +
// cycles) are independent of it.
// Run: node --test games/tempest/translated/test/equivalence-ab17.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ab17 } from "../loc_ab17.js";

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
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(addr) { this.calls.push(addr); this.pc = addr; return addr; },
  };
}

test("loc_ab17: draws one word-pair from a list, single loop iteration, tail jmp loc_df5f", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.x = 0x00;   // -> $35=0, cpx #$2c != -> bne taken (skip $74/$75 copy)
  m.regs.a = 0xaa;   // -> $2b (later ldx $2b)

  // list-of-lists pointer ($ac/$ad) -> 0x4000; entry[0]=0x0050 (the list ptr $3b/$3c)
  m.mem.write8(0xac, 0x00); m.mem.write8(0xad, 0x40);
  m.mem.write8(0x4000, 0x50); m.mem.write8(0x4001, 0x00);
  // list at 0x0050: [0]=0x11 (-> $2a), [1]=0x82 (bit7 set -> loop exits after 1 iter)
  m.mem.write8(0x0050, 0x11);
  m.mem.write8(0x0051, 0x82);
  // scale byte $d121,x (x=0)
  m.mem.write8(0xd121, 0x35);
  // word table $31e4,x with x = (0x82 & 0x7f) = 0x02
  m.mem.write8(0x31e6, 0xc1);
  m.mem.write8(0x31e7, 0xd2);
  // output pointer $74/$75 -> 0x6000
  m.mem.write8(0x74, 0x00); m.mem.write8(0x75, 0x60);

  loc_ab17(m);

  assert.equal(m.mem.read8(0x35), 0x00, "stx $35");
  assert.equal(m.mem.read8(0x3b), 0x50, "reloaded list ptr low");
  assert.equal(m.mem.read8(0x3c), 0x00, "reloaded list ptr high");
  assert.equal(m.mem.read8(0x6000), 0xc1, "$31e4,x low word -> (0x74),0");
  assert.equal(m.mem.read8(0x6001), 0xd2, "$31e5,x high word -> (0x74),1");
  assert.equal(m.mem.read8(0x2a), 0x02, "$2a advanced by 2");
  assert.equal(m.mem.read8(0x2c), 0x02, "$2c = saved y");
  assert.equal(m.regs.y, 0x01, "ldy $2a(=2); dey -> 1");
  assert.deepEqual(m.calls, [0xab0d, 0xdf6a, 0xdf75, 0xb0d1, 0xb0dd, 0xdf5f], "sub-call sequence + tail");
  assert.equal(m.pc, 0xdf5f, "tail jmp target");
  assert.equal(m.cycles, 205, "full single-iteration path");
});

test("loc_ab17: x==0x2c copies $74/$75 into $b6/$b7 (bne not taken)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.x = 0x2c;   // cpx #$2c equal -> bne not taken -> the copy runs
  m.regs.a = 0x00;

  m.mem.write8(0xac, 0x00); m.mem.write8(0xad, 0x40);
  // ($ac),y at y=$35=0x2c and 0x2d
  m.mem.write8(0x402c, 0x50); m.mem.write8(0x402d, 0x00);
  m.mem.write8(0x0050, 0x00); // $2a
  m.mem.write8(0x0051, 0x80); // exit loop first iter
  m.mem.write8(0x74, 0x34); m.mem.write8(0x75, 0x12);
  m.mem.write8(0xd121 + 0x2c, 0x00);
  m.mem.write8(0x31e4, 0x00); m.mem.write8(0x31e5, 0x00);

  loc_ab17(m);

  assert.equal(m.mem.read8(0xb6), 0x34, "$74 -> $b6");
  assert.equal(m.mem.read8(0xb7), 0x12, "$75 -> $b7");
});
