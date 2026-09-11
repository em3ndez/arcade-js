// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9eab (ROM 0x9eab-0x9ed6) -- gated per-slot(x) bit6 toggle on $0283,x.
// Gate $0111==0 -> rts. bit6 set: clear iff $02b9,x >= 0x0e. bit6 clear: set iff $02b9,x == 0.
// Run: node --test games/tempest/translated/test/equivalence-9eab.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9eab } from "../loc_9eab.js";

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
    // record any JSR's pushed return (must be jsraddr+2); loc_9eab makes none, so calls stays []
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; (this.retAddrs ||= []).push(this.pull16()); } return undefined; },
  };
}

test("gate $0111 == 0 -> immediate rts, no slot touched", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0111] = 0x00;
  m.ram[0x0283] = 0x40; // would be touched if not gated
  loc_9eab(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x0283], 0x40, "slot untouched");
  assert.equal(m.pc, 0x5001, "rts -> pushed return + 1");
  assert.equal(m.cycles, 13);
});

test("bit6 clear, $02b9,x != 0 -> bne taken, bit6 left clear", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0111] = 0x01;
  m.ram[0x0283] = 0x00; // bit6 clear
  m.ram[0x02b9] = 0x07; // != 0 -> bne
  loc_9eab(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x0283], 0x00, "bit6 stays clear");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 28);
});

test("bit6 clear, $02b9,x == 0 -> set bit6 of $0283,x", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0111] = 0x01;
  m.ram[0x0283] = 0x01; // bit6 clear, other bits preserved
  m.ram[0x02b9] = 0x00; // == 0
  loc_9eab(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x0283], 0x41, "bit6 set, low bit preserved (ora 0x40)");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 38);
});

test("bit6 set, $02b9,x < 0x0e -> bcc taken, bit6 kept", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0111] = 0x01;
  m.ram[0x0283] = 0x40; // bit6 set
  m.ram[0x02b9] = 0x05; // < 0x0e -> carry clear -> bcc
  loc_9eab(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x0283], 0x40, "bit6 kept");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 34);
});

test("bit6 set, $02b9,x >= 0x0e -> clear bit6 (and 0xbf)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0111] = 0x01;
  m.ram[0x0283] = 0xc1; // bit6 set + bit7 + bit0
  m.ram[0x02b9] = 0x20; // >= 0x0e -> carry set -> clear bit6
  loc_9eab(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x0283], 0x81, "bit6 cleared, other bits preserved");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 44);
});

test("edge: abs,x page cross adds +1 on each crossing load (clear-bit6 path)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x80; // 0x0283+0x80=0x0303, 0x02b9+0x80=0x0339 -- all abs,x loads cross into page 0x03
  m.ram[0x0111] = 0x01;
  m.ram[0x0303] = 0x40; // bit6 set
  m.ram[0x0339] = 0x20; // >= 0x0e -> clear bit6
  loc_9eab(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x0303], 0x00, "bit6 cleared");
  assert.equal(m.cycles, 47, "3 crossing loads add +3 over the 44-cycle base");
});
