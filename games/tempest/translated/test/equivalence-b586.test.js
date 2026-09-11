// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b586 (ROM 0xb586-0xb5ac). Minimal 6502 harness (Regs + flat RAM + the page-1
// stack seam); jsr targets are recorded, not run. Run: node --test games/tempest/translated/test/equivalence-b586.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b586 } from "../loc_b586.js";

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

test("loc_b586: full path -> $9e=1, $57/$2f=$0202, builds ($51>>1&7)+1, jsr $bda0; 56 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000); // final RTS -> 0x1001
  m.ram[0x0202] = 0x50; // nonzero and < 0xf0
  m.ram[0x0201] = 0x00; // != 0x81
  m.ram[0x0200] = 0x33;
  m.ram[0x51] = 0x0e; // (0x0e >> 1) & 7 = 7; +1 = 8

  loc_b586(m);

  assert.equal(m.ram[0x9e], 1, "$9e = 1");
  assert.equal(m.ram[0x57], 0x50, "$57 = $0202");
  assert.equal(m.ram[0x2f], 0x50, "$2f = $0202");
  assert.equal(m.regs.y, 0x33, "Y = $0200");
  assert.equal(m.regs.a, 0x08, "A = ($51>>1 & 7) + 1 = 8");
  assert.deepEqual(m.calls, [0xbda0], "jsr $bda0");
  assert.equal(m.pc, 0x1001, "RTS -> pushed + 1");
  assert.equal(m.cycles, 56, "instruction-exact total");
});

test("loc_b586: $0202 == 0 -> beq early rts; 18 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);
  m.ram[0x0202] = 0x00;

  loc_b586(m);

  assert.equal(m.ram[0x9e], 1, "$9e = 1 still set");
  assert.deepEqual(m.calls, [], "no jsr");
  assert.equal(m.pc, 0x2001, "early RTS");
  assert.equal(m.cycles, 18, "2+3+4+3(beq taken)+6(rts)");
});

test("loc_b586: $0202 >= 0xf0 -> bcs early rts", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000);
  m.ram[0x0202] = 0xf5;

  loc_b586(m);

  assert.deepEqual(m.calls, [], "no jsr");
  assert.equal(m.pc, 0x3001, "bcs -> rts");
  assert.equal(m.cycles, 2 + 3 + 4 + 2 + 2 + 3 + 6, "lda#/sta/lda/beq fall/cmp/bcs taken/rts");
});
