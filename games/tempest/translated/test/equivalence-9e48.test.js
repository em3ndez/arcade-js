// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9e48 (ROM 0x9e48-0x9e5b) -- collision test: calls $a343 only when
// $02df,x == $0202 AND $02b9,x == $0200; otherwise returns. jsr $a343 pushes 0x9e58+2 = 0x9e5a.
// Run: node --test games/tempest/translated/test/equivalence-9e48.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9e48 } from "../loc_9e48.js";

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

test("hi coord mismatch -> bne 9e5b taken -> no call", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x02df] = 0x05; m.ram[0x0202] = 0x09;   // mismatch -> bne taken
  loc_9e48(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.pc, 0x5001, "final rts -> pushed return + 1");
  assert.equal(m.cycles, 17);
});

test("hi match, segment mismatch -> bne 9e5b taken -> no call", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x02df] = 0x05; m.ram[0x0202] = 0x05;   // match
  m.ram[0x02b9] = 0x03; m.ram[0x0200] = 0x09;   // mismatch -> bne taken
  loc_9e48(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 27);
});

test("both match -> jsr $a343 (pushes 0x9e5a), then rts", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x02df] = 0x05; m.ram[0x0202] = 0x05;
  m.ram[0x02b9] = 0x03; m.ram[0x0200] = 0x03;
  loc_9e48(m);
  assert.deepEqual(m.calls, [0xa343]);
  assert.equal(m.retAddrs[0], 0x9e5a, "jsr $a343 pushes 0x9e58+2");
  assert.equal(m.retAddrs.length, 1);
  assert.equal(m.pc, 0x5001, "final rts after the jsr returns");
  assert.equal(m.cycles, 32);
});

test("edge: abs,x page cross (x=0x80) adds +1 per crossing load, both match -> jsr", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x80;        // $02df+0x80=0x035f (cross), $02b9+0x80=0x0339 (cross)
  m.ram[0x035f] = 0x05; m.ram[0x0202] = 0x05;
  m.ram[0x0339] = 0x03; m.ram[0x0200] = 0x03;
  loc_9e48(m);
  assert.deepEqual(m.calls, [0xa343]);
  assert.equal(m.retAddrs[0], 0x9e5a);
  assert.equal(m.cycles, 34, "base 32 + 2 crossing loads");
});
