// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b69b (ROM 0xb69b-0xb6f7) -- builds slot x's screen position ($56/$57/$58),
// optionally interpolating toward the next segment (jsr $b6fa) when phase $02cc,x bit7 is set, then
// dispatches ($c098/$c765/$bd3e), indexes the $cec8 word table by (($03&3)<<1)+0x4e, and jmp $df59.
// Run: node --test games/tempest/translated/test/equivalence-b69b.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b69b } from "../loc_b69b.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [], retAddrs: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    // a jmp/jsr delegate records the target; for a jsr, balance the pushed return and capture it (must be jsraddr+2)
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.retAddrs.push(this.pull16()); } return undefined; },
  };
}

// phase bit7 clear -> bpl 0xb6d5 taken -> no interpolation; straight to the dispatch tail
test("phase bit7 clear -> bpl taken -> no interpolation, tail dispatch", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x4000);
  m.regs.x = 0x00;
  m.ram[0x02df] = 0x55;            // -> $57
  m.ram[0x02b9] = 0x03;            // segment index y=3
  m.ram[0x03ce + 3] = 0x11;        // -> $56
  m.ram[0x03de + 3] = 0x22;        // -> $58
  m.ram[0x02cc] = 0x00;            // bit7 clear -> bpl taken
  m.ram[0x03] = 0x02;              // table index (2&3)*2+0x4e = 0x52
  m.ram[0xcec8 + 0x52] = 0xaa;     // -> A
  m.ram[0xcec9 + 0x52] = 0xbb;     // -> X
  loc_b69b(m);
  assert.deepEqual(m.calls, [0xc098, 0xc765, 0xbd3e, 0xdf59]);
  assert.deepEqual(m.retAddrs, [0xb6d7, 0xb6dc, 0xb6e3], "each jsr pushes jsraddr+2");
  assert.equal(m.ram[0x56], 0x11, "no interpolation -> $56 unchanged");
  assert.equal(m.ram[0x57], 0x55);
  assert.equal(m.ram[0x58], 0x22, "no interpolation -> $58 unchanged");
  assert.equal(m.ram[0xa9], 0x03, "sty $a9 stores Y from $bd3e (still segment index here)");
  assert.equal(m.regs.x, 0xbb, "X from $cec9 table");
  assert.equal(m.regs.a, 0xaa, "A from $cec8 table");
  assert.equal(m.regs.y, 0x03, "Y restored from $a9");
  assert.equal(m.pc, 0xdf59, "tail jmp target");
  assert.equal(m.cycles, 89);
});

// phase bit7 set -> bpl not taken -> interpolate both coords via jsr $b6fa (mocked as identity)
test("phase bit7 set -> bpl not taken -> interpolation path, two jsr $b6fa", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x4000);
  m.regs.x = 0x00;
  m.ram[0x02df] = 0x55;
  m.ram[0x02b9] = 0x03;            // y=3
  m.ram[0x03ce + 3] = 0x11; m.ram[0x03de + 3] = 0x22;
  m.ram[0x03ce + 4] = 0x40; m.ram[0x03de + 4] = 0x60; // next segment y=4
  m.ram[0x02cc] = 0x80;            // bit7 set -> interpolate
  m.ram[0x03] = 0x01;
  loc_b69b(m);
  // $b6fa mocked as identity: delta = next-$56, then +$56 restores next; so $56/$58 become the next-seg values
  assert.deepEqual(m.calls, [0xb6fa, 0xb6fa, 0xc098, 0xc765, 0xbd3e, 0xdf59]);
  assert.deepEqual(m.retAddrs, [0xb6c1, 0xb6cf, 0xb6d7, 0xb6dc, 0xb6e3], "jsr $b6fa pushes 0xb6c1/0xb6cf");
  assert.equal(m.ram[0x56], 0x40, "(next-$56 via identity) + $56 = next seg 0x40");
  assert.equal(m.ram[0x58], 0x60);
  assert.equal(m.pc, 0xdf59);
  assert.equal(m.cycles, 144);
});

// page-cross edge: x=0x47 crosses $02df,x/$02b9,x/$02cc,x into page 0x03 (+1 each) over the bpl-taken path
test("edge: x=0x47 crosses the three abs,x loads (+3 cycles)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x4000);
  m.regs.x = 0x47;                 // 0x02df+0x47=0x0326, 0x02b9+0x47=0x0300, 0x02cc+0x47=0x0313 all cross
  m.ram[(0x02df + 0x47) & 0xffff] = 0x00;
  m.ram[(0x02b9 + 0x47) & 0xffff] = 0x00; // y=0
  m.ram[(0x02cc + 0x47) & 0xffff] = 0x00; // bit7 clear -> bpl taken
  m.ram[0x03] = 0x00;
  loc_b69b(m);
  assert.deepEqual(m.calls, [0xc098, 0xc765, 0xbd3e, 0xdf59]);
  assert.equal(m.pc, 0xdf59);
  assert.equal(m.cycles, 92, "89 baseline + 3 page crosses");
});
