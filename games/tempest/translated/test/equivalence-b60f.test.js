// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b60f (ROM 0xb60f-0xb61b) -- table lookup + tail-jmp to loc_bcfd.
// Run: node --test games/tempest/translated/test/equivalence-b60f.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b60f } from "../loc_b60f.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = { read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; } };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(n, c) { this.pc = n; this.cycles += c; },
    call(t) { this.calls.push(t); },
  };
}

test("loc_b60f: A=table[$028a,x & 3], Y=$02b9,x, tail-jmp loc_bcfd", () => {
  const m = makeMachine(); m.regs.x = 0x00;
  m.mem.write8(0x028a, 0x06);        // & 3 -> 2
  m.mem.write8(0xb61e + 2, 0x55);    // table[2]
  m.mem.write8(0x02b9, 0x33);
  loc_b60f(m);
  assert.equal(m.regs.a, 0x55, "A = 0xb61e[2]");
  assert.equal(m.regs.y, 0x33, "Y = $02b9,x");
  assert.equal(m.pc, 0xbcfd, "jmp target");
  assert.deepEqual(m.calls, [0xbcfd], "tail-calls loc_bcfd");
  assert.equal(m.cycles, 4 + 2 + 2 + 4 + 4 + 3, "in-page: lda 4/and 2/tay 2/lda 4/ldy 4/jmp 3");
});

test("loc_b60f: page-cross on $028a,x and $02b9,x (x=0x80) adds +1 each", () => {
  const m = makeMachine(); m.regs.x = 0x80; // 0x030a, 0x0339 -- cross to page 3
  m.mem.write8(0x030a, 0x01);        // & 3 -> 1
  m.mem.write8(0xb61e + 1, 0xaa);
  m.mem.write8(0x0339, 0x44);
  loc_b60f(m);
  assert.equal(m.regs.a, 0xaa);
  assert.equal(m.regs.y, 0x44);
  assert.equal(m.cycles, 5 + 2 + 2 + 4 + 5 + 3, "two crossing abs,x loads +1 each; table load in-page");
});
