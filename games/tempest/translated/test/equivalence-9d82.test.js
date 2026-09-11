// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9d82 (ROM 0x9d82-0x9e2e) -- steps slot x's phase counter $02cc,x, then branches
// on ($0283,x & 7): ==4 settling path (jsr $9f81), !=4 recompute-target path (jsr $9ed7, add/subtract).
// Run: node --test games/tempest/translated/test/equivalence-9d82.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9d82 } from "../loc_9d82.js";

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

// state != 4 path; jsr $9ed7 result != $02cc,x -> bne 9dfc taken -> straight to epilogue (no add/sub)
test("state!=4, target mismatch -> bne 9dfc taken -> epilogue", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x00;            // bit6 clear -> iny; &7 = 0 != 4 -> state!=4 path
  m.ram[0x02cc] = 0x00;            // -> stored 0x81; A into cmp = 0x40 != 0x81
  loc_9d82(m);
  assert.deepEqual(m.calls, [0x9ed7]);
  assert.equal(m.retAddrs[0], 0x9df8, "jsr $9ed7 pushes addr+2 (0x9df6+2)");
  assert.equal(m.ram[0x02cc], 0x81, "phase counter iny'd, bit7 forced");
  assert.equal(m.ram[0x010c], 0x00, "$0283,x bit7 (clear) stashed to $010c");
  assert.equal(m.pc, 0x5001, "final rts -> pushed return + 1");
  assert.equal(m.cycles, 81);
});

// state != 4, jsr result == $02cc,x (mock sets A), $0283,x bit6 clear -> bne 9e08 not taken -> subtract branch
test("state!=4, target match, bit6 clear -> subtract branch", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x00;            // bit6 clear -> iny; !=4; after and #$7f bit6 clear -> subtract
  m.ram[0x02cc] = 0x00;            // stored 0x81
  m.ram[0x02b9] = 0x05;
  const orig = m.call.bind(m);
  m.call = (a) => { orig(a); m.regs.a = m.ram[0x02cc]; }; // model $9ed7 returning the matched target (0x81)
  loc_9d82(m);
  assert.deepEqual(m.calls, [0x9ed7]);
  assert.equal(m.retAddrs[0], 0x9df8);
  assert.equal(m.ram[0x02cc], 0x05, "02cc := old 02b9");
  assert.equal(m.ram[0x02b9], 0x04, "02b9 decremented (subtract), masked to nibble");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 119);
});

// state != 4, target match, $0283,x bit6 set -> bne 9e08 taken -> add branch (9e1b)
test("state!=4, target match, bit6 set -> add branch", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x40;            // bit6 set -> dey; &7 = 0 != 4; and #$7f keeps bit6 -> add
  m.ram[0x02cc] = 0x01;            // dey path: stored ((1-1)&0f)|0x80 = 0x80
  m.ram[0x02b9] = 0x07;
  const orig = m.call.bind(m);
  m.call = (a) => { orig(a); m.regs.a = m.ram[0x02cc]; }; // $9ed7 returns 0x80 == stored 02cc
  loc_9d82(m);
  assert.deepEqual(m.calls, [0x9ed7]);
  assert.equal(m.retAddrs[0], 0x9df8);
  assert.equal(m.ram[0x02cc], 0x08, "02cc := old 02b9 + 1 (add), masked to nibble");
  assert.equal(m.ram[0x0283], 0x40, "0283 &= $7f leaves bit6");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 106);
});

// state == 4, low nibble of $02cc,x != 0 -> bne 9da7 taken -> 9deb -> epilogue
test("state==4, phase low3 != 0 -> bne 9da7 taken -> 9deb", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x04;            // &7 = 4 -> state==4; bit6 clear -> iny
  m.ram[0x02cc] = 0x00;            // stored 0x81, &7 = 1 != 0 -> bne 9da7 taken
  loc_9d82(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x02cc], 0x81, "phase counter advanced, unchanged past 9deb");
  assert.equal(m.ram[0x010c], 0x00);
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 71);
});

// state == 4, low3 == 0, bit3 set -> bump 02b9; $03ab == 0; hi coord matches $0202 -> jsr $9f81
test("state==4, settling with $03ab==0 and 02df==0202 -> jsr $9f81", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x04;            // state==4; bit6 clear -> iny
  m.ram[0x02cc] = 0x07;            // stored ((7+1)&0f)|0x80 = 0x88: &7=0, &8=8 (bit3 set) -> bump 02b9
  m.ram[0x02b9] = 0x03;
  m.ram[0x028a] = 0x00;
  m.ram[0x03ab] = 0x00;            // -> bne 9dd3 not taken
  m.ram[0x02df] = 0x00; m.ram[0x0202] = 0x00; // equal -> bne 9ddb not taken -> jsr $9f81
  loc_9d82(m);
  assert.deepEqual(m.calls, [0x9f81]);
  assert.equal(m.retAddrs[0], 0x9ddf, "jsr $9f81 pushes addr+2 (0x9ddd+2)");
  assert.equal(m.ram[0x02b9], 0x04, "02b9 bumped (bit3 set path)");
  assert.equal(m.ram[0x0283], 0x04, "0283 &= $7f");
  assert.equal(m.ram[0x02cc], 0x20, "02cc reseeded to $20");
  assert.equal(m.ram[0x028a], 0x80, "028a sign flipped (eor #$80)");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 149);
});

// state == 4, settling, $03ab != 0 -> bne 9dd3 taken -> 9deb (no jsr)
test("state==4, settling but $03ab != 0 -> bne 9dd3 taken -> no jsr", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x04;
  m.ram[0x02cc] = 0x07;            // 0x88 -> bit3 set, bump 02b9
  m.ram[0x02b9] = 0x03;
  m.ram[0x03ab] = 0x01;            // != 0 -> bne 9dd3 taken
  loc_9d82(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x02b9], 0x04, "02b9 still bumped before the 03ab test");
  assert.equal(m.ram[0x02cc], 0x20, "02cc reseeded");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 129);
});

// state == 4, low3==0 but bit3 clear -> beq 9dae taken (skip 02b9 bump); $03ab==0, 02df != 0202 -> 9de3 path
test("state==4, bit3 clear (beq skip), hi coord mismatch -> 9de3 isolate", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x04;
  m.ram[0x02cc] = 0x0f;            // stored ((0f+1)&0f)|0x80 = 0x80: &7=0, &8=0 -> beq taken, skip bump
  m.ram[0x02b9] = 0x03;
  m.ram[0x028a] = 0x03;           // eor #$80 at 9dcb -> 0x83; and #$80 at 9de3 -> 0x80
  m.ram[0x03ab] = 0x00;
  m.ram[0x02df] = 0x05; m.ram[0x0202] = 0x00; // mismatch -> bne 9ddb taken -> 9de3
  loc_9d82(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x02b9], 0x03, "02b9 NOT bumped (beq skipped it)");
  assert.equal(m.ram[0x02cc], 0x20, "02cc reseeded");
  assert.equal(m.ram[0x028a], 0x80, "028a isolated to bit7 (and #$80) at 9de3");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 136);
});

// page-cross edge: x=0x80 pushes every abs,x load into page 0x03 (+1 each); mismatch path like test 1
test("edge: abs,x page cross adds +1 per crossing load (state!=4 mismatch)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x80;                 // 0x0283+0x80=0x0303, all abs,x loads cross into page 0x03
  m.ram[0x0303] = 0x00;            // $0283,x: bit6 clear -> iny, &7 != 4
  m.ram[0x034c] = 0x00;            // $02cc,x -> stored 0x81
  loc_9d82(m);
  assert.deepEqual(m.calls, [0x9ed7]);
  assert.equal(m.retAddrs[0], 0x9df8);
  assert.equal(m.ram[0x034c], 0x81, "phase counter at 0x034c");
  assert.equal(m.cycles, 88, "test1 81 + 7 crossing loads");
});
