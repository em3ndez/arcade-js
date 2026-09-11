// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b75b (ROM 0xb75b-0xb799). Minimal 6502 harness; jsr $bcfd recorded, not run.
// Run: node --test games/tempest/translated/test/equivalence-b75b.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b75b } from "../loc_b75b.js";

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

test("loc_b75b: all $02d3,x zero -> skip bodies, $0135<6 picks Y=4; 241 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  m.ram[0x0135] = 0x03; // < 6 -> first bcc taken

  loc_b75b(m);

  assert.deepEqual(m.calls, [], "no body -> no jsr $bcfd");
  assert.equal(m.ram[0x0808], 4, "Y = 4 stored to $0808");
  assert.equal(m.pc, 0x1001, "rts");
  assert.equal(m.cycles, 241, "entry + 12 skip iterations + tail(Y=4)");
});

test("loc_b75b: X=0x0b (>=8) and X=5 (<8) entries -> both jsr $bcfd branches; 298 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);
  m.ram[0x02de] = 0x40; // $02d3 + 0x0b, X>=8 path
  m.ram[0x02d8] = 0x30; // $02d3 + 5, X<8 path
  m.ram[0x03] = 0x05;   // X>=8 path: (0x05<<1 & 6) + 0x20
  m.ram[0x0135] = 0x03; // Y=4

  loc_b75b(m);

  assert.deepEqual(m.calls, [0xbcfd, 0xbcfd], "one jsr per nonzero entry");
  assert.equal(m.ram[0x57], 0x30, "$57 = last processed entry (X=5)");
  assert.equal(m.ram[0x2f], 0x30, "$2f = last processed entry");
  assert.equal(m.ram[0x0808], 4, "tail Y=4");
  assert.equal(m.pc, 0x2001, "rts");
  assert.equal(m.cycles, 298, "entry + bodies(X=0x0b,X=5) + skips + tail");
});

test("loc_b75b: $0135 in [6,8) picks Y=0x0b; >=8 picks Y=0x0c", () => {
  const m1 = makeMachine();
  m1.regs.s = 0xfd; m1.push16(0x3000);
  m1.ram[0x0135] = 0x07; // >=6, <8
  loc_b75b(m1);
  assert.equal(m1.ram[0x0808], 0x0b, "Y = 0x0b");

  const m2 = makeMachine();
  m2.regs.s = 0xfd; m2.push16(0x4000);
  m2.ram[0x0135] = 0x09; // >=8
  loc_b75b(m2);
  assert.equal(m2.ram[0x0808], 0x0c, "Y = 0x0c");
});
