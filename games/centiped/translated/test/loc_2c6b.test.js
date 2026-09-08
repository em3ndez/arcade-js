// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2c6b (ROM 0x2c6b-0x2c95). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2c6b.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2c6b } from "../loc_2c6b.js";

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
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); return undefined; },
  };
}

// X=1; slot Y=0x0c shares X's $64 column, is active (<0xf4), is not slot X, and its row delta is >=0xf4:
// a collision -> BCS $2c95 with carry SET on the first pass.
function setup() {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  m.regs.x = 0x01;
  m.ram[0x0070] = 0x50; // $64 field of slot Y=0x0c
  m.ram[0x0065] = 0x50; // $64,X (X=1) -> equal -> BNE not taken
  m.ram[0x0040] = 0x10; // $34 field of slot Y (< 0xf4) -> BCS not taken
  m.ram[0x0055] = 0x30; // $54,X
  m.ram[0x0060] = 0x20; // $54 field of slot Y -> SBC gives 0x10
  m.ram[0x0045] = 0xe5; // $44,X -> EOR gives 0xf5 (>= 0xf4) -> BCS $2c95
  return m;
}

test("loc_2c6b: collision on slot 0x0c returns carry set; 61 T; RTS", () => {
  const m = setup();
  loc_2c6b(m);

  assert.equal(m.regs.a, 0xf5, "A = the row-delta EOR result");
  assert.equal(m.regs.x, 0x01, "X unchanged");
  assert.equal(m.regs.y, 0x0c, "Y = the colliding slot");
  assert.equal(m.ram[0x008b], 0x01, "$8b = X");
  assert.equal(m.ram[0x008c], 0x02, "$8c = X + 1");
  assert.equal(m.regs.fC, true, "carry SET = collision found");
  assert.equal(m.regs.fN, false, "N clear from CMP #$f4 result 0x01");
  assert.equal(m.regs.fZ, false, "Z clear");
  assert.equal(m.cycles, 61, "61 T on this path");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
  assert.deepEqual(m.pcSeq, [
    0x2c6d, 0x2c6f, 0x2c71, 0x2c73, 0x2c76, 0x2c78, 0x2c7a, 0x2c7d, 0x2c7f, 0x2c81,
    0x2c83, 0x2c85, 0x2c87, 0x2c88, 0x2c8b, 0x2c8d, 0x2c8f, 0x2c95, 0x1234,
  ], "executed instruction/step boundary sequence");
});

test("loc_2c6b MUTATION: SBC $0054,Y mischarged 3T not 4T is caught by the T-state total", () => {
  const m = setup();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2c8b ? 3 : c); // only SBC $0054,Y steps to 0x2c8b
  loc_2c6b(m);
  assert.notEqual(m.cycles, 61, "a mischarged cycle blows the golden T-state total");
});
