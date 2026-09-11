// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9ef1 (ROM 0x9ef1-0x9f5e) -- per-slot(x) mover. bmi path: jsr $9c99 then dispatch
// (cmp #$80 / bit $0159) into loc_9f81/loc_9f8a/loc_9f5f. Else advance $029f/$02df,x by $0164/$0169, clamp
// hi at floor $0202, gate on $03ab / zp $9f / A vs #$20, then carry / $0159-sign pick the same three.
// Run: node --test games/tempest/translated/test/equivalence-9ef1.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9ef1 } from "../loc_9ef1.js";

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

// bmi taken (bit7 $028a,x set); jsr $9c99 returns A>=$80 (cmp C set), $0159 bit6 clear -> jsr loc_9f8a
test("bmi, A>=$80, V clear -> jsr loc_9f8a (via 9f55)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x028a] = 0x80;            // bit7 set -> bmi taken
  m.ram[0x0159] = 0x00;            // bit6 clear -> V clear -> bvc 9f55
  const orig = m.call.bind(m);
  m.call = (a) => { orig(a); m.regs.a = 0x80; }; // $9c99 leaves A = 0x80
  loc_9ef1(m);
  assert.deepEqual(m.calls, [0x9c99, 0x9f8a]);
  assert.equal(m.retAddrs[0], 0x9f45, "jsr $9c99 pushes 0x9f43+2");
  assert.equal(m.retAddrs[1], 0x9f57, "jsr $9f8a pushes 0x9f55+2");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 44);
});

// bmi taken; jsr $9c99 returns A<$80 -> bcc $9f5b -> jsr loc_9f5f
test("bmi, A<$80 -> bcc -> jsr loc_9f5f (via 9f5b)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x028a] = 0x80;
  const orig = m.call.bind(m);
  m.call = (a) => { orig(a); m.regs.a = 0x00; };
  loc_9ef1(m);
  assert.deepEqual(m.calls, [0x9c99, 0x9f5f]);
  assert.equal(m.retAddrs[0], 0x9f45);
  assert.equal(m.retAddrs[1], 0x9f5d, "jsr $9f5f pushes 0x9f5b+2");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 33);
});

// bmi taken; A>=$80, $0159 bit6 set (V set) -> bvc not taken -> jsr loc_9f81 (via 9f4f)
test("bmi, A>=$80, V set -> jsr loc_9f81 (via 9f4f)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x028a] = 0x80;
  m.ram[0x0159] = 0x40;            // bit6 set -> V set
  const orig = m.call.bind(m);
  m.call = (a) => { orig(a); m.regs.a = 0x90; };
  loc_9ef1(m);
  assert.deepEqual(m.calls, [0x9c99, 0x9f81]);
  assert.equal(m.retAddrs[1], 0x9f51, "jsr $9f81 pushes 0x9f4f+2");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 48);
});

// bmi NOT taken; advance, hi < floor -> clamp to $0202; carry clear -> $0159 N clear -> bpl -> jsr loc_9f8a
test("advance, hi<floor -> clamp, N clear -> jsr loc_9f8a (via 9f37)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x028a] = 0x00;            // bit7 clear -> bmi not taken
  m.ram[0x029f] = 0x00; m.ram[0x0164] = 0x01;   // lo := 0x01
  m.ram[0x02df] = 0x00; m.ram[0x0169] = 0x00;   // hi := 0x00
  m.ram[0x0202] = 0x10;            // floor -> hi < floor -> clamp
  m.ram[0x0159] = 0x00;            // N clear -> bpl 9f37 taken
  loc_9ef1(m);
  assert.deepEqual(m.calls, [0x9f8a]);
  assert.equal(m.retAddrs[0], 0x9f39, "jsr $9f8a pushes 0x9f37+2");
  assert.equal(m.ram[0x029f], 0x01, "lo advanced by $0164");
  assert.equal(m.ram[0x02df], 0x10, "hi clamped up to floor $0202");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 87);
});

// bmi NOT taken; hi >= floor and $03ab == 0 -> beq $9f29 -> early rts, no dispatch
test("advance, hi>=floor, $03ab==0 -> beq early rts", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x028a] = 0x00;
  m.ram[0x029f] = 0x00; m.ram[0x0164] = 0x00;
  m.ram[0x02df] = 0x50; m.ram[0x0169] = 0x00;
  m.ram[0x0202] = 0x10;            // hi 0x50 >= floor -> bcs 9f19
  m.ram[0x03ab] = 0x00;            // -> beq 9f29 rts
  loc_9ef1(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x02df], 0x50, "hi kept (>= floor)");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 56);
});

// bmi NOT taken; hi>=floor, $03ab!=0, zp $9f >= #$11 (bcs skip A test) -> carry set -> bcs 9f2a -> jsr loc_9f5f
test("advance, $03ab!=0, $9f>=$11 -> carry -> jsr loc_9f5f (via 9f3d)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x028a] = 0x00;
  m.ram[0x029f] = 0x00; m.ram[0x0164] = 0x00;
  m.ram[0x02df] = 0x50; m.ram[0x0169] = 0x00;
  m.ram[0x0202] = 0x10;
  m.ram[0x03ab] = 0x01;            // != 0 -> beq not taken
  m.ram[0x9f] = 0x20;              // >= 0x11 -> bcs 9f26, carry stays set
  loc_9ef1(m);
  assert.deepEqual(m.calls, [0x9f5f]);
  assert.equal(m.retAddrs[0], 0x9f3f, "jsr $9f5f pushes 0x9f3d+2");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 82);
});

// bmi NOT taken; $03ab!=0, zp $9f < #$11 (cmp A vs #$20 -> carry clear), $0159 N set -> jsr loc_9f81 (via 9f31)
test("advance, $9f<$11, A<$20 -> carry clear, N set -> jsr loc_9f81 (via 9f31)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x028a] = 0x00;
  m.ram[0x029f] = 0x00; m.ram[0x0164] = 0x00;
  m.ram[0x02df] = 0x10; m.ram[0x0169] = 0x00;   // hi := 0x10
  m.ram[0x0202] = 0x05;            // floor low -> bcs 9f19 taken
  m.ram[0x03ab] = 0x01;
  m.ram[0x9f] = 0x05;              // < 0x11 -> bcs not taken -> cmp #$20 (0x10 < 0x20 -> carry clear)
  m.ram[0x0159] = 0x80;            // N set -> bpl not taken -> jsr 9f81
  loc_9ef1(m);
  assert.deepEqual(m.calls, [0x9f81]);
  assert.equal(m.retAddrs[0], 0x9f33, "jsr $9f81 pushes 0x9f31+2");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 98);
});

// page-cross edge: x=0x80 pushes the $028a/$029f/$02df,x loads into page 0x03 (+1 each); clamp path (== 87 + 3)
test("edge: abs,x page cross adds +1 per crossing load (clamp path)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x80;                 // 0x028a/0x029f/0x02df +0x80 all cross into page 0x03
  m.ram[0x030a] = 0x00;            // $028a,x: bit7 clear -> bmi not taken
  m.ram[0x031f] = 0x00; m.ram[0x0164] = 0x01;   // $029f,x lo := 0x01
  m.ram[0x035f] = 0x00; m.ram[0x0169] = 0x00;   // $02df,x hi := 0x00
  m.ram[0x0202] = 0x10;
  m.ram[0x0159] = 0x00;            // N clear -> jsr loc_9f8a
  loc_9ef1(m);
  assert.deepEqual(m.calls, [0x9f8a]);
  assert.equal(m.ram[0x031f], 0x01, "lo at 0x031f");
  assert.equal(m.ram[0x035f], 0x10, "hi clamped at 0x035f");
  assert.equal(m.cycles, 90, "87 + 3 crossing loads");
});
