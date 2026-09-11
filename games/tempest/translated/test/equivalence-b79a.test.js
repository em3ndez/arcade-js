// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b79a (ROM 0xb79a-0xb7e4). Minimal 6502 harness; jsr $b7eb/$bcfd recorded, not run.
// Run: node --test games/tempest/translated/test/equivalence-b79a.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b79a } from "../loc_b79a.js";

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

test("loc_b79a: all $030a,x zero, $0720==0 -> skip bodies then beq rts; $9e cleared; 166 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  m.ram[0x0720] = 0x00;

  loc_b79a(m);

  assert.equal(m.ram[0x9e], 0, "$9e = 0");
  assert.deepEqual(m.calls, [], "no bodies -> no jsr");
  assert.equal(m.pc, 0x1001, "beq $b7e4 -> rts");
  assert.equal(m.cycles, 166, "entry + 8 skips + tail(beq rts)");
});

test("loc_b79a: X=7 Y=0 body (Y!=1, Y<2) -> adc table $b7e5 + jsr $bcfd; $0720!=0 & $9f>=0x0d -> sta $01ff; 223 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);
  m.ram[0x0311] = 0x50; // $030a + 7
  m.ram[0x0301] = 0x22; // $02fa + 7 -> $29
  m.ram[0x0309] = 0x00; // $0302 + 7 -> Y=0 (!=1, <2 -> bcc taken, keeps A)
  m.ram[0x0319] = 0x08; // $0312 + 7
  m.ram[0xb7e5] = 0x10; // $b7e5 + 0
  m.ram[0x0720] = 0x01; // nonzero
  m.ram[0x9f] = 0x0d;   // >= 0x0d

  loc_b79a(m);

  assert.equal(m.ram[0x57], 0x50, "$57 = entry");
  assert.equal(m.ram[0x29], 0x22, "$29 = $02fa,x");
  assert.deepEqual(m.calls, [0xbcfd], "jsr $bcfd (Y!=1 branch)");
  assert.equal(m.ram[0x01ff], 0x0d, "$9f stored to $01ff");
  assert.equal(m.pc, 0x2001, "rts");
  assert.equal(m.cycles, 223, "entry + body(X=7, bcc taken; lda $02fa,x @0x0301 crosses page $02->$03 = +1) + 7 skips + tail(sta $01ff)");
});

test("loc_b79a: X=7 Y==1 body -> jsr $b7eb, bvc skips; $0720==0 -> rts; 195 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000);
  m.ram[0x0311] = 0x50; // $030a + 7
  m.ram[0x0301] = 0x22; // $02fa + 7 -> $29
  m.ram[0x0309] = 0x01; // Y == 1
  m.ram[0x0720] = 0x00;

  loc_b79a(m);

  assert.equal(m.ram[0x29], 0x22, "$29 set before dispatch");
  assert.deepEqual(m.calls, [0xb7eb], "jsr $b7eb (Y==1 branch)");
  assert.equal(m.pc, 0x3001, "rts");
  assert.equal(m.cycles, 195, "entry + body(Y==1; lda $02fa,x @0x0301 crosses page $02->$03 = +1) + 7 skips + tail(beq rts)");
});
