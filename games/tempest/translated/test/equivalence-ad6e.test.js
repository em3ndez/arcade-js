// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ad6e (ROM 0xad6e-0xadcd). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam with a call recorder), author-derived; the whole-machine boot-first state diff vs
// MAME is the integration check. Run: node --test games/tempest/translated/test/equivalence-ad6e.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ad6e } from "../loc_ad6e.js";

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

test("loc_ad6e: ($03&0x1f)==0 and dec $0605->0 -> early exit Y(0x14)->$00, 31 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2fff); // RTS -> 0x3000
  m.ram[0x0003] = 0x20; // 0x20 & 0x1f = 0 -> bne not taken
  m.ram[0x0605] = 0x01; // dec -> 0 -> bne not taken -> early exit

  loc_ad6e(m);

  assert.equal(m.ram[0x0001], 0x06, "$01 = 6 always");
  assert.equal(m.ram[0x0605], 0x00, "$0605 decremented to 0");
  assert.equal(m.ram[0x0000], 0x14, "$00 = Y = 0x14 (early sty)");
  assert.equal(m.pc, 0x3000, "RTS -> pushed + 1");
  assert.deepEqual(m.calls, [], "early exit reaches no jsr");
  assert.equal(m.cycles, 31, "early-exit cycle total");
});

test("loc_ad6e: in-range positive slot, gate nonzero, $0604 step positive -> dex + zero slot, 95 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2fff);
  m.ram[0x0003] = 0x01; // ($03&0x1f)=1 -> bne taken -> $ad82
  m.ram[0x0602] = 0x00; // X=0
  m.ram[0x0606] = 0x05; // slot value 5 (positive, < 0x1b)
  m.ram[0x004e] = 0x1f; // gate: &0x18=0x18 (nonzero), &0x67=0x07 kept
  m.ram[0x0604] = 0x05; // dec -> 4 (bpl taken -> dex path)

  loc_ad6e(m);

  assert.equal(m.ram[0x0606], 0x05, "slot clamped value written back (loc_adce is opaque seam -> A kept)");
  assert.equal(m.ram[0x004e], 0x07, "$4e &= 0x67");
  assert.equal(m.ram[0x0602], 0xff, "$0602: 0x00 dec -> 0xff");
  assert.equal(m.ram[0x0604], 0x04, "$0604: 0x05 dec -> 0x04 (positive)");
  assert.equal(m.regs.x, 0xff, "dex: X 0 -> 0xff");
  assert.equal(m.regs.a, 0x00, "A = 0 (zeroing the slot)");
  assert.equal(m.ram[0x0705], 0x00, "sta $0606,x with X=0xff -> $0705 = 0");
  assert.deepEqual(m.calls, [0xadce], "jsr $adce only");
  assert.equal(m.pc, 0x3000, "RTS -> pushed + 1");
  assert.equal(m.cycles, 95, "positive-slot dex-path cycle total");
});

test("loc_ad6e: negative slot -> lda #0x1a clamp, $0604 step negative -> jsr $ddf7 + jsr $ad22 re-arm, 114 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2fff);
  m.ram[0x0003] = 0x01; // bne taken
  m.ram[0x0602] = 0x01; // X=1
  m.ram[0x0607] = 0x80; // slot value negative -> bpl NOT taken -> lda #0x1a
  m.ram[0x004e] = 0x08; // &0x18=0x08 nonzero; &0x67=0x00
  m.ram[0x0604] = 0x00; // dec -> 0xff (negative -> bpl not taken -> re-arm path)
  m.ram[0x003d] = 0x02; // ldx $3d -> 2; lda $0600,2 = $0602 (dec'd to 0) -> cmp #4 C clear -> jsr $ddf7

  loc_ad6e(m);

  assert.equal(m.ram[0x0607], 0x1a, "negative slot clamped to 0x1a and stored");
  assert.equal(m.ram[0x004e], 0x00, "$4e &= 0x67 -> 0");
  assert.equal(m.ram[0x0602], 0x00, "$0602: 0x01 dec -> 0x00");
  assert.equal(m.ram[0x0604], 0xff, "$0604: 0x00 dec -> 0xff (negative)");
  assert.deepEqual(m.calls, [0xadce, 0xddf7, 0xad22], "jsr $adce, then re-arm jsr $ddf7 + jsr $ad22");
  assert.equal(m.pc, 0x3000, "RTS -> pushed + 1");
  assert.equal(m.cycles, 114, "negative-clamp re-arm cycle total");
});
