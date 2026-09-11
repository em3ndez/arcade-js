// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a69b (ROM 0xa69b-0xa6a8) -- signed random step: lsr a seeds carry from the
// caller's A bit0 (A discarded), reads $60da (POKEY2 RANDOM) & #$07, and if carry was set negates it. Leaf,
// no calls. Each case seeds a DECOY into $60ca (POKEY1) so a regression to the wrong chip would fail.
// Run: node --test games/tempest/translated/test/equivalence-a69b.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a69b } from "../loc_a69b.js";

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

// caller A even -> carry clear -> bcc taken -> positive value 0..7
test("A bit0 clear -> bcc taken -> positive", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.a = 0x04;                 // bit0 clear -> lsr leaves carry clear
  m.ram[0x60da] = 0x0a;            // POKEY2 RANDOM & 7 = 0x02
  m.ram[0x60ca] = 0x05;            // DECOY: reading POKEY1 here would give 0x05, not 0x02
  loc_a69b(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.a, 0x02, "returns $60da & 7 (not the $60ca decoy)");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 17);
});

// caller A odd -> carry set -> bcc not taken -> negate
test("A bit0 set -> bcc not taken -> negated", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.a = 0x05;                 // bit0 set -> lsr sets carry
  m.ram[0x60da] = 0x0a;            // POKEY2 & 7 = 0x02 -> negate -> 0xfe
  m.ram[0x60ca] = 0x05;            // DECOY (would negate to 0xfb)
  loc_a69b(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.a, 0xfe, "negate(0x02 from $60da, not the decoy)");
  assert.equal(m.regs.fC, false, "0xfd + 1 -> no carry");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 22);
});

// odd + random 0 -> negate of 0 wraps to 0 with carry out
test("A bit0 set, random 0 -> negate(0)=0, carry set", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.a = 0x01;
  m.ram[0x60da] = 0x08;            // POKEY2 & 7 = 0x00
  m.ram[0x60ca] = 0x0a;            // DECOY (& 7 = 0x02 would give a different result)
  loc_a69b(m);
  assert.equal(m.regs.a, 0x00, "negate(0) = 0 (0xff + 1)");
  assert.equal(m.regs.fC, true, "0xff + 1 carries");
  assert.equal(m.cycles, 22);
});
