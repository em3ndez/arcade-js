// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9c0c (ROM 0x9c0c-0x9c20) -- dec $0298,x; if still nonzero tail-jump into exported
// loc_9c17 (m.call, no push), else inc $010b and fall to the shared rts at $9c20. dec $0298,x is an abs,x
// RMW: fixed 7 cycles, NO page-cross penalty (verified by the x=0x80 case).
// Run: node --test games/tempest/translated/test/equivalence-9c0c.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9c0c } from "../loc_9c0c.js";

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

test("timer stays nonzero -> bne tail-jumps into exported loc_9c17 (no push)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000); m._retPushed = false; // caller's return; not a jsr push
  m.regs.x = 0x00;
  m.ram[0x0298] = 0x05;         // dec -> 0x04, nonzero
  loc_9c0c(m);
  assert.deepEqual(m.calls, [0x9c17], "delegates to exported loc_9c17");
  assert.deepEqual(m.retAddrs ?? [], [], "branch delegate does NOT push a return (no jsr)");
  assert.equal(m.ram[0x0298], 0x04, "timer decremented");
  assert.equal(m.pc, 0x9c17, "PC at the delegate target");
  assert.equal(m.cycles, 10, "dec 7 + taken branch 3");
});

test("timer hits zero -> bne not taken -> inc $010b, clv;bvc join, shared rts", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000); m._retPushed = false;
  m.regs.x = 0x00;
  m.ram[0x0298] = 0x01;         // dec -> 0x00
  m.ram[0x010b] = 0x10;
  loc_9c0c(m);
  assert.deepEqual(m.calls, [], "no delegate on the zero path");
  assert.equal(m.ram[0x0298], 0x00, "timer decremented to zero");
  assert.equal(m.ram[0x010b], 0x11, "counter bumped");
  assert.equal(m.pc, 0x5001, "shared rts -> pushed return + 1");
  assert.equal(m.cycles, 26, "dec 7 + bne 2 + inc 6 + clv 2 + bvc 3 + rts 6");
});

test("edge: x=0x80 crosses $0298,x into page $03 but abs,x RMW stays fixed 7", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000); m._retPushed = false;
  m.regs.x = 0x80;              // $0298+0x80=$0318 (page $02->$03), RMW has no cross penalty
  m.ram[0x0318] = 0x05;         // dec -> 0x04, nonzero
  loc_9c0c(m);
  assert.deepEqual(m.calls, [0x9c17]);
  assert.equal(m.ram[0x0318], 0x04, "decremented at $0318");
  assert.equal(m.cycles, 10, "no page-cross penalty on abs,x RMW");
});
