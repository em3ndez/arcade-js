// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a618 (ROM 0xa618-0xa65a) -- 16-slot walk ($37=0x0f..0x00): live slot ($0283,x!=0)
// -> jsr $a6a9 + jsr $a721 + mark $010d; free slot with $010e!=0 -> jsr $a65b; then countdown $010e and, if
// $010d stayed 0, set $00=0x12. abs,x index is the bounded loop counter 0..0x0f (base 0x0283 -> max 0x0292,
// same page): the abs,x LOAD can never page-cross in real operation (guard present, term always 0).
// Run: node --test games/tempest/translated/test/equivalence-a618.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a618 } from "../loc_a618.js";

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

// all slots free, $010e==0 -> no calls; $010d stays 0 -> set $00=0x12 (even frame $03=0)
test("all free, no spawn, nothing active -> $00=0x12", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x03] = 0x00; m.ram[0x010e] = 0x00;
  loc_a618(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x010d], 0x00, "$010d untouched -> 0");
  assert.equal(m.ram[0x00], 0x12, "$00 set because nothing active");
  assert.equal(m.ram[0x010e], 0x00, "$010e stays 0");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 507);
});

// odd frame ($03 bit0 set) -> countdown skipped; still $00=0x12 since $010d==0
test("odd frame -> $010e countdown skipped, $00 still set", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x03] = 0x01; m.ram[0x010e] = 0x00;
  loc_a618(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x010e], 0x00, "$010e NOT decremented (odd-frame branch taken)");
  assert.equal(m.ram[0x00], 0x12);
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 501);
});

// all slots free but $010e!=0 -> jsr $a65b every slot (16 spawns); tail decrements $010e once; $010d!=0 skips $00
test("all free with $010e!=0 -> 16 spawns, countdown, no $00", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x03] = 0x00; m.ram[0x010e] = 0x05;
  loc_a618(m);
  assert.equal(m.calls.length, 16, "one spawn per free slot");
  assert.ok(m.calls.every((a) => a === 0xa65b), "all calls are $a65b");
  assert.equal(m.retAddrs.length, 16);
  assert.ok(m.retAddrs.every((r) => r === 0xa630), "jsr $a65b pushes 0xa62e+2");
  assert.equal(m.ram[0x010e], 0x04, "$010e decremented once in tail (even frame)");
  assert.equal(m.ram[0x00], 0x00, "$00 NOT set ($010d nonzero from prologue copy)");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 588);
});

// all slots live ($0283,x!=0) -> jsr $a6a9 + jsr $a721 per slot; $010d=0xff -> $00 skipped
test("all live -> move+step per slot (32 calls), $00 skipped", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x03] = 0x00; m.ram[0x010e] = 0x00;
  for (let x = 0; x <= 0x0f; x++) m.ram[0x0283 + x] = 0x40; // every slot live
  loc_a618(m);
  assert.equal(m.calls.length, 32);
  assert.deepEqual(m.calls.slice(0, 4), [0xa6a9, 0xa721, 0xa6a9, 0xa721], "move then step, repeated");
  assert.equal(m.retAddrs[0], 0xa636, "jsr $a6a9 pushes 0xa634+2");
  assert.equal(m.retAddrs[1], 0xa639, "jsr $a721 pushes 0xa637+2");
  assert.equal(m.ram[0x010d], 0xff, "$010d marked active");
  assert.equal(m.ram[0x00], 0x00, "$00 NOT set ($010d==0xff)");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 615);
});
