// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a721 (ROM 0xa721-0xa75c) -- seeds $29=$fd, steps 3 axis velocity pairs through
// loc_a75d, stores results; if $29 stayed nonzero skip, else zero $0283,x. Verifies jsr $a75d pushes addr+2.
// Run: node --test games/tempest/translated/test/equivalence-a721.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a721 } from "../loc_a721.js";

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

// delegate leaves $29 = $fd (nonzero) -> bne taken -> skip the $0283,x zeroing
test("$29 nonzero -> bne taken -> skip", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000); m.regs.x = 0x00;
  m.ram[0x0283] = 0x77;
  loc_a721(m);
  assert.deepEqual(m.calls, [0xa75d, 0xa75d, 0xa75d]);
  assert.deepEqual(m.retAddrs, [0xa72d, 0xa73d, 0xa74d], "each jsr $a75d pushes jsraddr+2");
  assert.equal(m.ram[0x29], 0xfd, "seed unchanged by inert delegate");
  assert.equal(m.ram[0x0283], 0x77, "not zeroed (bne taken)");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 95);
});

// delegate saturates $29 to 0 -> bne not taken -> store A (=0) into $0283,x
test("$29 == 0 -> bne not taken -> zero $0283,x", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000); m.regs.x = 0x00;
  m.ram[0x0283] = 0x77;
  const orig = m.call.bind(m);
  m.call = (a) => { orig(a); m.ram[0x29] = 0x00; }; // model loc_a75d saturating the flag
  loc_a721(m);
  assert.deepEqual(m.calls, [0xa75d, 0xa75d, 0xa75d]);
  assert.deepEqual(m.retAddrs, [0xa72d, 0xa73d, 0xa74d]);
  assert.equal(m.ram[0x29], 0x00);
  assert.equal(m.ram[0x0283], 0x00, "$0283,x zeroed (bne not taken)");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 99);
});

// page-cross edge: x=0x80 crosses two of the six abs,x loads (+2)
test("edge: abs,x page cross adds cycles", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000); m.regs.x = 0x80;
  loc_a721(m);
  assert.deepEqual(m.calls, [0xa75d, 0xa75d, 0xa75d]);
  assert.deepEqual(m.retAddrs, [0xa72d, 0xa73d, 0xa74d]);
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 97, "test1 95 + 2 crossing loads");
});
