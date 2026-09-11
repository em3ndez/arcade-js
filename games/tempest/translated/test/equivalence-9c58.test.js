// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9c58 (ROM 0x9c58-0x9cb5) -- steps slot x's 16-bit coord ($029f lo / $02df hi)
// by the $0160/$0165,y delta (y=$0283,x&7). Sign of $028a,x picks add (9c63) vs subtract (9c99).
// Run: node --test games/tempest/translated/test/equivalence-9c58.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9c58, loc_9c63, loc_9c99 } from "../loc_9c58.js";

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
    // record the JSR's pushed return address (must be jsraddr+2) so a wrong push16 fails, then pop to balance S
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; (this.retAddrs ||= []).push(this.pull16()); } return undefined; },
  };
}

test("bmi taken -> subtract path, hi stays below $f0 -> bcc taken, no floor", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x00;           // &7 -> y = 0
  m.ram[0x028a] = 0x80;           // negative -> bmi taken (subtract)
  m.ram[0x029f] = 0x00; m.ram[0x02df] = 0x50; // 16-bit coord
  m.ram[0x0160] = 0x00; m.ram[0x0165] = 0x00; // zero delta
  loc_9c58(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x029f], 0x00, "lo unchanged");
  assert.equal(m.ram[0x02df], 0x50, "hi unchanged (no floor)");
  assert.equal(m.pc, 0x5001, "rts -> pushed return + 1");
  assert.equal(m.cycles, 54);
});

test("subtract path underflow past $f0 -> floor hi to $f2", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x00;
  m.ram[0x028a] = 0x80;           // subtract
  m.ram[0x029f] = 0x00; m.ram[0x02df] = 0xf5; // hi >= $f0 after sub
  m.ram[0x0160] = 0x00; m.ram[0x0165] = 0x00;
  loc_9c58(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x02df], 0xf2, "hi floored to $f2");
  assert.equal(m.cycles, 60);
});

test("add path, hi == $0202 -> beq taken -> jsr $9d06", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x00;
  m.ram[0x028a] = 0x00;           // positive -> add path
  m.ram[0x029f] = 0x00; m.ram[0x02df] = 0x10;
  m.ram[0x0160] = 0x00; m.ram[0x0165] = 0x00;
  m.ram[0x0202] = 0x10;           // equal -> beq taken
  loc_9c58(m);
  assert.deepEqual(m.calls, [0x9d06]);
  assert.equal(m.retAddrs[0], 0x9c7f, "jsr $9d06 pushes addr+2 (0x9c7d+2)");
  assert.equal(m.pc, 0x5001, "final rts unaffected by mid jsr");
  assert.equal(m.cycles, 71);
});

test("add path, hi < $0202 -> beq+bcs both not taken -> falls into jsr $9d06", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x00; m.ram[0x028a] = 0x00;
  m.ram[0x029f] = 0x00; m.ram[0x02df] = 0x05;
  m.ram[0x0160] = 0x00; m.ram[0x0165] = 0x00;
  m.ram[0x0202] = 0x10;           // hi 0x05 < 0x10
  loc_9c58(m);
  assert.deepEqual(m.calls, [0x9d06]);
  assert.equal(m.retAddrs[0], 0x9c7f, "jsr $9d06 pushes addr+2");
  assert.equal(m.cycles, 72);
});

test("add path, hi > $0202 and hi >= $20 -> bcs to $20 check, bcs to 9c96, no call", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x00; m.ram[0x028a] = 0x00;
  m.ram[0x029f] = 0x00; m.ram[0x02df] = 0x30;
  m.ram[0x0160] = 0x00; m.ram[0x0165] = 0x00;
  m.ram[0x0202] = 0x10;           // hi 0x30 > 0x10 -> bcs; 0x30 >= 0x20 -> bcs to 9c96
  loc_9c58(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.cycles, 67);
});

test("add path, $0202 < hi < $20 and ($028a,x & 3) != 0 -> jsr $a06f, X preserved", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x00;
  m.ram[0x028a] = 0x01;           // positive, &3 = 1 != 0
  m.ram[0x029f] = 0x00; m.ram[0x02df] = 0x18;
  m.ram[0x0160] = 0x00; m.ram[0x0165] = 0x00;
  m.ram[0x0202] = 0x10;           // hi 0x18 > 0x10 -> bcs; 0x18 < 0x20 -> a06f branch reachable
  loc_9c58(m);
  assert.deepEqual(m.calls, [0xa06f]);
  assert.equal(m.retAddrs[0], 0x9c93, "jsr $a06f pushes addr+2 (0x9c91+2)");
  assert.equal(m.regs.x, 0x00, "X restored by pla/tax after jsr");
  assert.equal(m.cycles, 93);
});

test("add path, $0202 < hi < $20 but ($028a,x & 3) == 0 -> beq to 9c96, no call", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x00;
  m.ram[0x028a] = 0x04;           // positive, &3 = 0
  m.ram[0x029f] = 0x00; m.ram[0x02df] = 0x18;
  m.ram[0x0160] = 0x00; m.ram[0x0165] = 0x00;
  m.ram[0x0202] = 0x10;
  loc_9c58(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.cycles, 75);
});

test("edge: abs,x page cross adds +1 on each crossing load (subtract path)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x80;                // 0x0283+0x80=0x0303, all abs,x loads cross into page 0x03
  m.ram[0x0303] = 0x00;           // &7 -> y = 0
  m.ram[0x030a] = 0x80;           // $028a,x negative -> subtract
  m.ram[0x031f] = 0x00;           // $029f,x lo
  m.ram[0x035f] = 0x50;           // $02df,x hi
  m.ram[0x0160] = 0x00; m.ram[0x0165] = 0x00;
  loc_9c58(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x035f], 0x50, "hi unchanged");
  assert.equal(m.cycles, 58, "hdr 2 crossing loads +2, sub 2 crossing loads +2");
});

test("direct dispatch entry loc_9c63 (add-only) is independently callable", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00; m.regs.y = 0x00;
  m.ram[0x029f] = 0x01; m.ram[0x02df] = 0x30;
  m.ram[0x0160] = 0x01; m.ram[0x0165] = 0x00; // +1 to lo
  m.ram[0x0202] = 0x10;           // hi 0x30 > 0x10, >= 0x20 -> 9c96, no call
  loc_9c63(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x029f], 0x02, "lo advanced by delta");
  assert.equal(m.pc, 0x5001);
});

test("direct dispatch entry loc_9c99 (subtract-only) is independently callable", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00; m.regs.y = 0x00;
  m.ram[0x029f] = 0x05; m.ram[0x02df] = 0x40;
  m.ram[0x0160] = 0x01; m.ram[0x0165] = 0x00; // -1 from lo
  loc_9c99(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x029f], 0x04, "lo decremented by delta");
  assert.equal(m.ram[0x02df], 0x40, "hi unchanged, above floor");
  assert.equal(m.pc, 0x5001);
});
