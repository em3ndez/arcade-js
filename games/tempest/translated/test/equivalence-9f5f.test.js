// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9f5f (ROM 0x9f5f-0x9f80) -- firing gate: needs $02df,x bit5 set AND POKEY2
// RANDOM $60da >= $015f, then bit6 of $0159 (V) and x parity pick loc_9f81 / loc_9f8a.
// Run: node --test games/tempest/translated/test/equivalence-9f5f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9f5f } from "../loc_9f5f.js";

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

// bit5 of $02df,x clear -> beq $9f80 -> immediate rts, no fire
test("bit5 clear -> beq rts", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x02df] = 0x00;
  loc_9f5f(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 15);
});

// bit5 set, RANDOM $60da < $015f -> bcc $9f80 -> rts (threshold not met)
test("RANDOM below threshold -> bcc rts", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x02df] = 0x20; m.ram[0x60da] = 0x05; m.ram[0x015f] = 0x10;
  loc_9f5f(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 25);
});

// fire, $0159 bit6 clear (V clear) -> bvc $9f7d -> jsr loc_9f8a
test("fire, V clear -> jsr loc_9f8a (via 9f7d)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x02df] = 0x20; m.ram[0x60da] = 0x50; m.ram[0x015f] = 0x10; m.ram[0x0159] = 0x00;
  loc_9f5f(m);
  assert.deepEqual(m.calls, [0x9f8a]);
  assert.equal(m.retAddrs[0], 0x9f7f, "jsr $9f8a pushes 0x9f7d+2");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 37);
});

// fire, V set, x odd (txa;lsr -> carry set) -> bcc not taken -> jsr loc_9f81
test("fire, V set, x odd -> jsr loc_9f81", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x01;
  m.ram[0x02e0] = 0x20; m.ram[0x60da] = 0x50; m.ram[0x015f] = 0x10; m.ram[0x0159] = 0x40;
  loc_9f5f(m);
  assert.deepEqual(m.calls, [0x9f81]);
  assert.equal(m.retAddrs[0], 0x9f79, "jsr $9f81 pushes 0x9f77+2");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 47);
});

// fire, V set, x even (txa;lsr -> carry clear) -> bcc $9f8a -> TAIL-branch into loc_9f8a (no push, no rts)
test("fire, V set, x even -> bcc tail into loc_9f8a", () => {
  const m = makeMachine();
  m.regs.x = 0x02;
  m.ram[0x02e1] = 0x20; m.ram[0x60da] = 0x50; m.ram[0x015f] = 0x10; m.ram[0x0159] = 0x40;
  loc_9f5f(m);
  assert.deepEqual(m.calls, [0x9f8a]);
  assert.deepEqual(m.retAddrs ?? [], [], "bcc into sibling pushes nothing");
  assert.equal(m.pc, 0x9f8a, "tail-branch leaves pc at the delegate entry (no local rts)");
  assert.equal(m.cycles, 31);
});

// page-cross edge: x=0x80 pushes $02df,x load into page 0x03 (+1); V-clear fire path (== test 37 + 1)
test("edge: abs,x page cross adds +1 (V-clear fire path)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x80;                 // 0x02df+0x80 = 0x035f crosses into page 0x03
  m.ram[0x035f] = 0x20; m.ram[0x60da] = 0x50; m.ram[0x015f] = 0x10; m.ram[0x0159] = 0x00;
  loc_9f5f(m);
  assert.deepEqual(m.calls, [0x9f8a]);
  assert.equal(m.cycles, 38, "37 + 1 crossing load");
});
