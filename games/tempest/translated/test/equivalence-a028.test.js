// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a028 (ROM 0xa028-0xa06e) -- scans the 16-column depth table $03ac,y starting at
// column (POKEY2 RANDOM $60da & $0f), keeping the deepest depth in $2d and its column in $29 (a 0 depth
// reads as $ff). Column $0f counts only while $0111==0. Winner -> $02b9,x, successor -> $02cc,x, $028a,x &= $7f.
// Run: node --test games/tempest/translated/test/equivalence-a028.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a028 } from "../loc_a028.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; (this.retAddrs ||= []).push(this.pull16()); } return undefined; },
  };
}

// all depths 0 -> each reads as $ff; with equal depths the >= test keeps updating, so the LAST column
// scanned wins. Start col 5, wrap down through 6 (16 iters) -> winner col 6.
test("all depths 0 ($ff): last-scanned column wins; col $0f included ($0111==0)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x6000); m.regs.x = 0x00;
  m.ram[0x60da] = 0x05; m.ram[0x0111] = 0x00;
  for (let i = 0; i < 16; i++) m.ram[0x03ac + i] = 0x00;
  m.ram[0x028a] = 0xff;
  loc_a028(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x2d], 0xff, "best depth = $ff (0 read as $ff)");
  assert.equal(m.ram[0x29], 0x06, "last-scanned column (start 5 -> wrap -> 6)");
  assert.equal(m.ram[0x02b9], 0x06, "$02b9,x := winning column");
  assert.equal(m.ram[0x02cc], 0x07, "$02cc,x := (winner+1) & $0f");
  assert.equal(m.ram[0x028a], 0x7f, "$028a,x &= $7f (bit7 cleared)");
  assert.equal(m.ram[0x0140], 0xff, "loop counter ran to $ff (16 iterations)");
  assert.equal(m.pc, 0x6001, "rts -> pushed return + 1");
  assert.equal(m.cycles, 668);
});

// one distinct deepest column (col 7 = $80) wins over the $10 field
test("distinct deepest column 7 wins", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x6000); m.regs.x = 0x00;
  m.ram[0x60da] = 0x00; m.ram[0x0111] = 0x01;
  for (let i = 0; i < 16; i++) m.ram[0x03ac + i] = 0x10;
  m.ram[0x03ac + 0x07] = 0x80;
  m.ram[0x028a] = 0x80;
  loc_a028(m);
  assert.equal(m.ram[0x2d], 0x80);
  assert.equal(m.ram[0x29], 0x07, "winning column 7");
  assert.equal(m.ram[0x02b9], 0x07);
  assert.equal(m.ram[0x02cc], 0x08, "successor col");
  assert.equal(m.ram[0x028a], 0x00, "$80 &= $7f");
  assert.equal(m.cycles, 605);
});

// col $0f is the deepest ($f0) but $0111 != 0 excludes it -> col 3 ($40) wins
test("col $0f excluded when $0111 != 0 -> col 3 wins", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x6000); m.regs.x = 0x00;
  m.ram[0x60da] = 0x00; m.ram[0x0111] = 0x01;
  for (let i = 0; i < 16; i++) m.ram[0x03ac + i] = 0x10;
  m.ram[0x03ac + 0x0f] = 0xf0;   // deepest, but excluded
  m.ram[0x03ac + 0x03] = 0x40;   // deepest among 0..$0e
  m.ram[0x028a] = 0x80;
  loc_a028(m);
  assert.equal(m.ram[0x2d], 0x40, "col $0f's $f0 ignored");
  assert.equal(m.ram[0x29], 0x03, "winning column 3");
  assert.equal(m.ram[0x02b9], 0x03);
  assert.equal(m.ram[0x02cc], 0x04);
  assert.equal(m.ram[0x028a], 0x00);
  assert.equal(m.cycles, 625);
});

// page-cross edge: x=0x80 pushes the abs,x stores/loads at the tail into page 0x03; $02b9,x load is fixed
test("edge: x=0x80 tail abs,x load crosses page (+1)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x6000); m.regs.x = 0x80;
  m.ram[0x60da] = 0x00; m.ram[0x0111] = 0x01;
  for (let i = 0; i < 16; i++) m.ram[0x03ac + i] = 0x10;
  m.ram[0x03ac + 0x05] = 0x90;
  m.ram[0x030a] = 0x80;   // $028a,x = 0x030a (crosses)
  loc_a028(m);
  assert.equal(m.ram[0x2d], 0x90);
  assert.equal(m.ram[0x29], 0x05);
  assert.equal(m.ram[0x0339], 0x05, "$02b9,x = 0x0339 := winner");
  assert.equal(m.ram[0x034c], 0x06, "$02cc,x = 0x034c := successor");
  assert.equal(m.ram[0x030a], 0x00, "$028a,x &= $7f at 0x030a");
  assert.equal(m.cycles, 616);
});
