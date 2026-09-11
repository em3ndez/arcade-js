// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_904b (ROM 0x904b-0x90c1) -- scroll/position accumulator: sign-extends $0121
// into $2b:$2a:$29, double-ror's it, folds into the 24-bit $69:$68:$0122, adds $18 to $5b:$5f (clamps
// $0115 at high>=$fc), then either tail-jmps or resets $5f/$5b and clears $0102,$3d before the tail.
// The routine ends with `jmp 0x9749`: a tail-delegate (m.call, NO push16 -> retAddrs stays empty).
// Run: node --test games/tempest/translated/test/equivalence-904b.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_904b } from "../loc_904b.js";

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

// tail-delegate is a jmp, not a jsr: no push16, so pc lands on 0x9749 with an empty retAddrs
function assertTail(m) {
  assert.deepEqual(m.calls, [0x9749], "tail-jmp records a single call to loc_9749");
  assert.equal(m.retAddrs, undefined, "jmp pushes no return address");
  assert.equal(m.pc, 0x9749, "pc lands on the delegate entry");
}

// $0121 positive (bpl taken -> no sign-extend), small high byte (no clamp), nonzero high-diff -> tail
test("positive $0121, no clamp, nonzero high-diff -> tail", () => {
  const m = makeMachine();
  m.ram[0x0121] = 0x00; m.ram[0x5f] = 0x00; m.ram[0x5b] = 0x02; m.ram[0x5d] = 0x00;
  loc_904b(m);
  assert.equal(m.ram[0x0202], 0x10, "$0202 seeded to $10");
  assert.equal(m.ram[0x2b], 0x00, "bpl taken: $2b NOT decremented");
  assert.equal(m.ram[0x2a], 0x00);
  assert.equal(m.ram[0x29], 0x00);
  assert.equal(m.ram[0x5f], 0x18, "$5f += $18");
  assert.equal(m.ram[0x5b], 0x02, "$5b unchanged (no carry), tail path leaves it");
  assert.equal(m.ram[0x0115], 0x00, "no clamp");
  assert.equal(m.ram[0x0114], 0xff, "$0114 always $ff");
  assert.equal(m.ram[0x00], 0x00, "90a3 block skipped -> $00 untouched");
  assertTail(m);
  assert.equal(m.cycles, 146);
});

// $0121 negative (bit7 set): bpl NOT taken -> dec $2b sign-extends; exercises the dex/bpl loop math
test("negative $0121 -> dec $2b + double-ror loop (2 iterations)", () => {
  const m = makeMachine();
  m.ram[0x0121] = 0x80; m.ram[0x5f] = 0x00; m.ram[0x5b] = 0x02; m.ram[0x5d] = 0x00;
  loc_904b(m);
  assert.equal(m.ram[0x2b], 0xff, "bpl not taken: $2b decremented to $ff (sign-extend)");
  assert.equal(m.ram[0x2a], 0xe0, "double-ror of $80 -> $2a = $e0");
  assert.equal(m.ram[0x29], 0x00, "double-ror low byte -> $29 = $00");
  assert.equal(m.ram[0x68], 0xe0, "$68 := $2a + $68 + carry");
  assert.equal(m.ram[0x69], 0xff, "$69 := $2b + $69 + carry");
  assert.equal(m.ram[0x0122], 0x00, "$0122 := $29 + $0122");
  assertTail(m);
  assert.equal(m.cycles, 150);
});

// high byte reaches $fc after the +$18 add -> clamp sets $0115 = 1
test("high byte >= $fc -> clamp $0115 = 1", () => {
  const m = makeMachine();
  m.ram[0x0121] = 0x00; m.ram[0x5f] = 0x00; m.ram[0x5b] = 0xfc; m.ram[0x5d] = 0x00;
  loc_904b(m);
  assert.equal(m.ram[0x5f], 0x18);
  assert.equal(m.ram[0x5b], 0xfc, "no low-byte carry -> high byte stays $fc");
  assert.equal(m.ram[0x0115], 0x01, "bcc not taken -> clamp flag set");
  assert.equal(m.ram[0x0114], 0xff);
  assertTail(m);
  assert.equal(m.cycles, 151);
});

// zero high-diff (beq $909d taken, bne $90a1 not taken) -> 90a3 reset block; bit7 of $05 set -> $00 = $04
test("zero high-diff + bit7($05) set -> reset block, $00 = $04, clears $0102,$3d", () => {
  const m = makeMachine();
  m.ram[0x0121] = 0x00; m.ram[0x5f] = 0x00; m.ram[0x5b] = 0x00; m.ram[0x5d] = 0x07;
  m.ram[0x05] = 0x80;   // bit7 set -> bmi taken -> keep $04
  m.ram[0x3d] = 0x04;   // ldx $3d -> store target $0102+4 = $0106
  m.ram[0x0106] = 0xaa; // pre-seed to prove the store clears it
  loc_904b(m);
  assert.equal(m.ram[0x5f], 0x07, "$5f := $5d");
  assert.equal(m.ram[0x5b], 0xff, "$5b := $ff");
  assert.equal(m.ram[0x00], 0x04, "bmi taken: $00 = $04");
  assert.equal(m.ram[0x0106], 0x00, "$0102,$3d cleared to 0");
  assert.equal(m.ram[0x0114], 0xff);
  assertTail(m);
  assert.equal(m.cycles, 176);
});

// zero high-diff -> 90a3 block; bit7 of $05 clear -> bmi NOT taken -> $00 = $08, store at $0102 (x=0)
test("zero high-diff + bit7($05) clear -> $00 = $08", () => {
  const m = makeMachine();
  m.ram[0x0121] = 0x00; m.ram[0x5f] = 0x00; m.ram[0x5b] = 0x00; m.ram[0x5d] = 0x07;
  m.ram[0x05] = 0x00;   // bit7 clear -> bmi not taken -> $00 = $08
  m.ram[0x3d] = 0x00;
  m.ram[0x0102] = 0xaa;
  loc_904b(m);
  assert.equal(m.ram[0x5f], 0x07);
  assert.equal(m.ram[0x5b], 0xff);
  assert.equal(m.ram[0x00], 0x08, "bmi not taken: $00 = $08");
  assert.equal(m.ram[0x0102], 0x00, "$0102,$3d (x=0) cleared");
  assertTail(m);
  assert.equal(m.cycles, 177);
});
