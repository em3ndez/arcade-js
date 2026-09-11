// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a1e4 (ROM 0xa1e4-0xa1f9). Minimal 6502 harness (Regs + flat RAM + page-1
// stack seam); JSR $a34b is opaque (harness records, does not run). Run: node --test games/tempest/translated/test/equivalence-a1e4.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a1e4 } from "../loc_a1e4.js";

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

test("loc_a1e4: $0200 != $02ad,x -> BNE to rts, no side effects; 17 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1000);
  m.regs.x = 0x00;
  m.ram[0x0200] = 0x05;
  m.ram[0x02ad] = 0x06; // mismatch -> BNE taken
  loc_a1e4(m);
  assert.equal(m.ram[0x0201], 0x00, "$0201 untouched");
  assert.deepEqual(m.calls, [], "no jsr");
  assert.equal(m.pc, 0x1001, "rts -> pushed+1");
  assert.equal(m.cycles, 4 + 4 + 3 + 6, "17 T");
});

test("loc_a1e4: match but $0201 negative -> BMI to rts; 23 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x2000);
  m.regs.x = 0x03;
  m.ram[0x0200] = 0x05;
  m.ram[0x02b0] = 0x05; // $02ad,3 = match
  m.ram[0x0201] = 0x80; // negative -> BMI taken
  loc_a1e4(m);
  assert.equal(m.ram[0x0201], 0x80, "$0201 untouched");
  assert.deepEqual(m.calls, [], "no jsr");
  assert.equal(m.pc, 0x2001, "rts -> pushed+1");
  assert.equal(m.cycles, 4 + 4 + 2 + 4 + 3 + 6, "23 T");
});

test("loc_a1e4: match and $0201 non-negative -> jsr a34b, $0201=0x81; 34 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x3000);
  m.regs.x = 0x00;
  m.ram[0x0200] = 0x05;
  m.ram[0x02ad] = 0x05; // match
  m.ram[0x0201] = 0x00; // non-negative -> BMI not taken
  loc_a1e4(m);
  assert.equal(m.ram[0x0201], 0x81, "$0201 set to 0x81 after jsr");
  assert.deepEqual(m.calls, [0xa34b], "jsr a34b");
  assert.equal(m.pc, 0x3001, "rts -> pushed+1");
  assert.equal(m.cycles, 4 + 4 + 2 + 4 + 2 + 6 + 2 + 4 + 6, "34 T");
});
