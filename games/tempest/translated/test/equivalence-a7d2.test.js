// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a7d2 (ROM 0xa7d2) -- guarded loop remapping table $03fe,x[0..7] against $0115,
// OR'ing results into $29, clearing $0115 if all zero. Minimal 6502 harness (Regs + flat RAM + page-1
// stack seam), author-derived. Run: node --test games/tempest/translated/test/equivalence-a7d2.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a7d2 } from "../loc_a7d2.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
  };
}

test("loc_a7d2: $0115==0 -> immediate rts (early exit, page-cross taken beq)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x4000); // RTS -> 0x4001
  m.mem.write8(0x0115, 0x00);
  m.mem.write8(0x29, 0x55); // must stay untouched on the early path

  loc_a7d2(m);

  assert.equal(m.pc, 0x4001, "RTS -> pushed+1");
  assert.equal(m.mem.read8(0x29), 0x55, "$29 untouched on early exit");
  assert.equal(m.cycles, 14, "lda abs(4) + beq taken+pagecross(4) + rts(6)");
});

test("loc_a7d2: all entries zero, $0115 positive -> everything stays 0, $0115 cleared, 331 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x5000); // RTS -> 0x5001
  m.mem.write8(0x0115, 0x01); // positive (bit7 clear)
  for (let i = 0; i <= 7; i++) m.mem.write8(0x03fe + i, 0x00);

  loc_a7d2(m);

  for (let i = 0; i <= 7; i++) assert.equal(m.mem.read8(0x03fe + i), 0x00, `entry ${i} stays 0`);
  assert.equal(m.mem.read8(0x29), 0x00, "accumulator $29 = 0");
  assert.equal(m.mem.read8(0x37), 0xff, "loop counter $37 ran to 0xff");
  assert.equal(m.mem.read8(0x0115), 0x00, "$29==0 -> $0115 cleared");
  assert.equal(m.regs.x, 0x00, "X = last loop index");
  assert.equal(m.regs.a, 0x00, "A = $29 = 0");
  assert.equal(m.pc, 0x5001, "RTS -> pushed+1");
  assert.equal(m.cycles, 331, "16 pre + 300 loop (8 iters) + 15 post");
});

test("loc_a7d2: entry >= 0x17 with $0115 positive is remapped to V-7 and OR'd into $29", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x6000);
  m.mem.write8(0x0115, 0x01); // positive
  for (let i = 0; i <= 7; i++) m.mem.write8(0x03fe + i, 0x00);
  m.mem.write8(0x0405, 0x20); // x=7 entry; 0x20 >= 0x17 -> clamp path stores 0x20-7

  loc_a7d2(m);

  assert.equal(m.mem.read8(0x0405), 0x19, "0x20 - 7 = 0x19 stored back");
  for (let i = 0; i <= 6; i++) assert.equal(m.mem.read8(0x03fe + i), 0x00, `entry ${i} maps to 0`);
  assert.equal(m.mem.read8(0x29), 0x19, "$29 = OR of results = 0x19");
  assert.equal(m.mem.read8(0x0115), 0x01, "$29!=0 -> $0115 left unchanged");
  assert.equal(m.pc, 0x6001, "RTS -> pushed+1");
});
