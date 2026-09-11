// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c423 (ROM 0xc423-0xc43b) -- gathers $032a/$031a/$034a/$033a,x into $61-$64,
// then tail-jumps to loc_c3ba (opaque here; the harness records the call). Author-derived 6502 harness.
// Run: node --test games/tempest/translated/test/equivalence-c423.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c423 } from "../loc_c423.js";

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

test("loc_c423: copies the four indexed cells into $61-$64, tail-jumps to $c3ba, 34 T", () => {
  const m = makeMachine();
  m.ram[0x37] = 0x05; // index
  m.ram[0x032a + 5] = 0x11;
  m.ram[0x031a + 5] = 0x22;
  m.ram[0x034a + 5] = 0x33;
  m.ram[0x033a + 5] = 0x44;

  loc_c423(m);

  assert.equal(m.regs.x, 0x05, "X = $37");
  assert.equal(m.ram[0x61], 0x11, "$61 <- $032a,x");
  assert.equal(m.ram[0x62], 0x22, "$62 <- $031a,x");
  assert.equal(m.ram[0x63], 0x33, "$63 <- $034a,x");
  assert.equal(m.ram[0x64], 0x44, "$64 <- $033a,x");
  assert.equal(m.regs.a, 0x44, "A holds the last load");
  assert.deepEqual(m.calls, [0xc3ba], "jmp $c3ba -> tail-call");
  assert.equal(m.pc, 0xc3ba, "PC at the jmp target");
  assert.equal(m.cycles, 3 + 4 + 3 + 4 + 3 + 4 + 3 + 4 + 3 + 3, "34 T");
});

test("loc_c423: index 0 reads the table bases", () => {
  const m = makeMachine();
  m.ram[0x37] = 0x00;
  m.ram[0x032a] = 0x7f;
  m.ram[0x031a] = 0x80;
  loc_c423(m);
  assert.equal(m.ram[0x61], 0x7f, "$61 base");
  assert.equal(m.ram[0x62], 0x80, "$62 base");
});
