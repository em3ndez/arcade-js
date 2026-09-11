// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9923 (ROM 0x9923-0x994c) -- slot-expiry handler. Minimal 6502 harness; JSR $99a5
// and JSR $994d are opaque (recorded, not run). A per-test call stub can zero $29 to model $99a5's effect and
// reach the BEQ $9945 arm. Run: node --test games/tempest/translated/test/equivalence-9923.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9923 } from "../loc_9923.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } if (this._onCall) this._onCall(a); return undefined; },
  };
}

test("loc_9923: $29 stays set -> JSR $994d, slot allocated (Z clear), dec $03ab + clear $0243,x; 56 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x5000); // RTS -> 0x5001
  m.regs.x = 0x07;
  m.ram[0x0203 + 0x07] = 0x42; // -> $2a
  m.ram[0x03ab] = 0x09;
  m.ram[0x0243 + 0x07] = 0x3f;

  loc_9923(m);

  assert.equal(m.ram[0x29], 0xf0, "$29 seeded 0xf0 (JSR $99a5 opaque, leaves it set)");
  assert.equal(m.ram[0x2a], 0x42, "$2a = $0203,x");
  assert.equal(m.ram[0x35], 0x07, "x saved to $35");
  assert.equal(m.ram[0x03ab], 0x08, "$03ab decremented (alloc success path)");
  assert.equal(m.ram[0x0243 + 0x07], 0x00, "slot timer $0243,x cleared");
  assert.equal(m.pc, 0x5001, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [0x99a5, 0x994d], "calls $99a5 then $994d");
  assert.equal(m.cycles, 56, "56 T (see per-instruction breakdown)");
});

test("loc_9923: $99a5 stub zeroes $29 -> BEQ $9945: set $2f=0xff, re-arm timer; 48 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x5000);
  m.regs.x = 0x07;
  m.ram[0x0243 + 0x07] = 0x20;
  m._onCall = (a) => { if (a === 0x99a5) m.ram[0x29] = 0x00; }; // model $99a5 consuming $29

  loc_9923(m);

  assert.equal(m.ram[0x2f], 0xff, "$2f set to 0xff (re-arm arm)");
  assert.equal(m.ram[0x0243 + 0x07], 0x21, "slot timer $0243,x incremented");
  assert.deepEqual(m.calls, [0x99a5], "only $99a5 (BEQ $9945 skips $994d)");
  assert.equal(m.pc, 0x5001, "RTS returns to pushed + 1");
  assert.equal(m.cycles, 48, "48 T");
});

test("loc_9923 MUTATION: a mischarged final INC (6T not 7T) blows the 48 T total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x5000);
  m.regs.x = 0x07;
  m._onCall = (a) => { if (a === 0x99a5) m.ram[0x29] = 0x00; };
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x994c ? 6 : c); // the INC $0243,x step lands PC at 0x994c
  loc_9923(m);
  assert.notEqual(m.cycles, 48, "under-charging the RMW INC breaks the total");
});
