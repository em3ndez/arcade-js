// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a2a6 (ROM 0xa2a6-0xa303). Minimal 6502 harness; JSR $ccbd opaque
// (recorded). Run: node --test games/tempest/translated/test/equivalence-a2a6.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a2a6 } from "../loc_a2a6.js";

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

test("loc_a2a6: $0201 negative -> BMI to rts; 13 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1000);
  m.ram[0x0201] = 0x80;
  loc_a2a6(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.pc, 0x1001, "rts -> pushed+1");
  assert.equal(m.cycles, 4 + 3 + 6, "13 T");
});

test("loc_a2a6: all slots inactive -> 7 iterations of BEQ-skip, no jsr; 97 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x2000);
  m.ram[0x0201] = 0x00;
  // all $02df..$02e5 already 0 -> every iteration takes BEQ a300
  loc_a2a6(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.pc, 0x2001, "rts -> pushed+1");
  assert.equal(m.cycles, 97, "8 prologue + 6*12 + 11 + 6 rts");
});

test("loc_a2a6: active slot at X=6 passes all gates -> spawns into free $02db,y, jsr ccbd; 208 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x3000);
  m.ram[0x0201] = 0x00;
  m.ram[0x02df + 0x06] = 0x40; // $02e5 active, >= 0x30
  m.ram[0x028a + 0x06] = 0x40; // $0290 bit6 set
  m.ram[0x02a6 + 0x06] = 0x00; // $02ac timer: dec -> 0xff (negative) -> bpl not taken; inc -> 0x00
  m.ram[0x0283 + 0x06] = 0x00; // $0289 bit7 clear
  m.ram[0x60ca] = 0x80;        // RNG
  m.ram[0xa6] = 0x00;          // wave index
  m.ram[0xa304] = 0x10;        // table[0]; 0x80 >= 0x10 -> bcc not taken
  m.ram[0x011a] = 0x02;        // inner-loop start Y = 2
  m.ram[0x02db + 0x02] = 0x00; // $02dd free -> bne not taken -> fill
  m.ram[0x02b9 + 0x06] = 0x11; // $02bf spawn field
  m.ram[0x02cc + 0x06] = 0x22; // $02d2 spawn field
  m.ram[0x0119] = 0x33;        // timer reseed
  loc_a2a6(m);
  assert.equal(m.ram[0x02db + 0x02], 0x40, "$02db,y = $02df,x");
  assert.equal(m.ram[0x02b5 + 0x02], 0x11, "$02b5,y = $02b9,x");
  assert.equal(m.ram[0x02c8 + 0x02], 0x22, "$02c8,y = $02cc,x");
  assert.equal(m.ram[0x02a6 + 0x06], 0x33, "$02a6,x reseeded from $0119");
  assert.equal(m.ram[0xa6], 0x01, "$a6 incremented");
  assert.deepEqual(m.calls, [0xccbd], "jsr ccbd once");
  assert.equal(m.pc, 0x3001, "rts -> pushed+1");
  assert.equal(m.cycles, 208, "8 + 123(spawn iter) + 5*12 + 11 + 6");
});
