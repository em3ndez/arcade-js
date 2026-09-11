// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c3ee (ROM 0xc3ee-0xc422) -- saves X in $37 and pushes the color A; draws it via
// $c423 ($73=color), then a shadow pass ($73=0), restores color from the stack (pla) and calls $c43c/$c3ba;
// reloads X from $37; rts. Exercises the pha/pla balance across intervening JSRs. Opaque-call harness.
// Run: node --test games/tempest/translated/test/equivalence-c3ee.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c3ee } from "../loc_c3ee.js";

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
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

test("loc_c3ee: X=7, A=0x0c color -> two draws, pla restores color, X reloaded; 102 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x7000); // rts -> 0x7001
  m.regs.x = 0x07;
  m.regs.a = 0x0c;
  m.ram[0x9e] = 0x06;
  loc_c3ee(m);
  assert.equal(m.ram[0x37], 0x06, "$37 = X(7) then dec -> 0x06");
  assert.equal(m.ram[0x73], 0x0c, "$73 restored to the color after the shadow pass");
  assert.equal(m.regs.x, 0x06, "X reloaded from $37 (0x06)");
  assert.equal(m.regs.a, 0x0c, "A = color pulled back off the stack");
  assert.equal(m.regs.s, 0xfd, "stack balanced (pha/pla/jsr all matched)");
  assert.deepEqual(
    m.calls,
    [0xdf4c, 0xc43c, 0xc772, 0xc423, 0xdf4c, 0xc423, 0xc43c, 0xc3ba],
    "call order across both passes",
  );
  assert.equal(m.pc, 0x7001, "rts -> pushed+1");
  assert.equal(m.cycles, 102, "golden T-state total");
});
