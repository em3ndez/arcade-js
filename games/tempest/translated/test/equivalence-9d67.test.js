// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9d67 (ROM 0x9d67-0x9d81) -- calls loc_a7a6, then the asl carry sets (ora #$40)
// or clears (and #$bf) bit6 of $0283,x. Run: node --test games/tempest/translated/test/equivalence-9d67.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9d67 } from "../loc_9d67.js";

function makeMachine(a7a6ret) {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = { read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; } };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    // stub loc_a7a6: leaves A = a7a6ret (the asl below reads A); record + pop the pushed return
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; (this.retAddrs ||= []).push(this.pull16()); } if (a === 0xa7a6) regs.a = a7a6ret; return undefined; },
  };
}

test("a7a6 result bit7 set -> asl C=1 -> bcs taken -> clear bit6 (and #$bf)", () => {
  const m = makeMachine(0x80); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.mem.write8(0x02b9, 0x11); m.mem.write8(0x0200, 0x22); m.mem.write8(0x0283, 0xff);
  loc_9d67(m);
  assert.deepEqual(m.calls, [0xa7a6]);
  assert.equal(m.retAddrs[0], 0x9d70, "jsr a7a6 pushes addr+2 (0x9d6e+2)");
  assert.equal(m.regs.y, 0x11, "Y = $02b9,x");
  assert.equal(m.mem.read8(0x0283), 0xbf, "bit6 cleared (0xff & 0xbf)");
  assert.equal(m.pc, 0x5001, "rts");
  assert.equal(m.cycles, 4 + 2 + 4 + 6 + 2 + 4 + 3 + 2 + 5 + 6, "in-page total, bcs-taken path");
});

test("a7a6 result bit7 clear -> asl C=0 -> bcs not taken -> set bit6 (ora #$40)", () => {
  const m = makeMachine(0x00); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.mem.write8(0x02b9, 0x11); m.mem.write8(0x0200, 0x22); m.mem.write8(0x0283, 0x00);
  loc_9d67(m);
  assert.equal(m.retAddrs[0], 0x9d70, "jsr a7a6 pushes addr+2");
  assert.equal(m.mem.read8(0x0283), 0x40, "bit6 set (0x00 | 0x40)");
  assert.equal(m.cycles, 4 + 2 + 4 + 6 + 2 + 4 + 2 + 2 + 2 + 3 + 5 + 6, "ora path (42): bcs not-taken 2 + ora 2 + clv 2 + bvc 3");
});

test("page-cross: x=0x80 -> $02b9,x and $0283,x cross into page 3 (+1 each)", () => {
  const m = makeMachine(0x00); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x80; // 0x02b9+0x80=0x0339, 0x0283+0x80=0x0303 -- both cross to page 0x03
  m.mem.write8(0x0339, 0x05); m.mem.write8(0x0200, 0x00); m.mem.write8(0x0303, 0x01);
  loc_9d67(m);
  assert.equal(m.regs.y, 0x05, "Y = $02b9,x (crossed)");
  assert.equal(m.mem.read8(0x0303), 0x41, "bit6 set on the crossed address");
  assert.equal(m.cycles, 5 + 2 + 4 + 6 + 2 + 5 + 2 + 2 + 2 + 3 + 5 + 6, "both indexed loads +1 cross (44)");
});
