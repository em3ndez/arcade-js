// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c800 (ROM 0xc800). Gated $04 down-counter that, on reaching 0, arms the next
// state ($00=$02, clears $016b); every path tail-jmps 0x9749.
// Run: node --test games/tempest/translated/test/equivalence-c800.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c800 } from "../loc_c800.js";

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

test("loc_c800: ($03 & $016b)!=0 -> early bne, no state change, jmp 0x9749, 13 T", () => {
  const m = makeMachine();
  m.mem.write8(0x03, 0xff);
  m.mem.write8(0x016b, 0x01);
  m.mem.write8(0x02, 0x2a);

  loc_c800(m);

  assert.deepEqual(m.calls, [0x9749], "tail jmp 0x9749");
  assert.equal(m.pc, 0x9749);
  assert.equal(m.mem.read8(0x00), 0x00, "$00 untouched");
  assert.equal(m.mem.read8(0x016b), 0x01, "$016b untouched");
  assert.equal(m.cycles, 13, "3 + 4 + 3(bne taken) + 3(jmp)");
});

test("loc_c800: gate open, $04:1 -> dec to 0 -> arm next ($00=$02, $016b=0), 36 T", () => {
  const m = makeMachine();
  m.mem.write8(0x03, 0x00); // gate: and -> 0 -> bne falls
  m.mem.write8(0x016b, 0x55);
  m.mem.write8(0x04, 0x01);
  m.mem.write8(0x02, 0x2a);

  loc_c800(m);

  assert.deepEqual(m.calls, [0x9749]);
  assert.equal(m.mem.read8(0x04), 0x00, "$04 decremented to 0");
  assert.equal(m.mem.read8(0x00), 0x2a, "$00 = $02");
  assert.equal(m.mem.read8(0x016b), 0x00, "$016b cleared");
  assert.equal(m.cycles, 36, "3+4+2+3+2+5+2+3+3+2+4+3");
});

test("loc_c800: gate open, $04:3 -> dec to 2 -> bne taken, no arm, 25 T", () => {
  const m = makeMachine();
  m.mem.write8(0x03, 0x00);
  m.mem.write8(0x016b, 0x55);
  m.mem.write8(0x04, 0x03);
  m.mem.write8(0x02, 0x2a);

  loc_c800(m);

  assert.deepEqual(m.calls, [0x9749]);
  assert.equal(m.mem.read8(0x04), 0x02, "$04 = 2");
  assert.equal(m.mem.read8(0x00), 0x00, "$00 not armed");
  assert.equal(m.mem.read8(0x016b), 0x55, "$016b not cleared");
  assert.equal(m.cycles, 25, "3+4+2+3+2+5+3(bne taken)+3(jmp)");
});

test("loc_c800: gate open, $04:0 -> beq skips dec, arms next, 32 T", () => {
  const m = makeMachine();
  m.mem.write8(0x03, 0x00);
  m.mem.write8(0x016b, 0x55);
  m.mem.write8(0x04, 0x00);
  m.mem.write8(0x02, 0x11);

  loc_c800(m);

  assert.deepEqual(m.calls, [0x9749]);
  assert.equal(m.mem.read8(0x04), 0x00, "$04 stays 0");
  assert.equal(m.mem.read8(0x00), 0x11, "$00 = $02");
  assert.equal(m.mem.read8(0x016b), 0x00, "$016b cleared");
  assert.equal(m.cycles, 32, "3+4+2+3+3(beq taken)+2+3+3+2+4+3");
});
