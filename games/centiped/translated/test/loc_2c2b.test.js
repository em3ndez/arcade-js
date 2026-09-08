// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2c2b (ROM 0x2c2b-0x2c6a). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2c2b.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2c2b } from "../loc_2c2b.js";

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

// A=0x30, Y=0x02: builds ($32) = 0x0786 (row 7), Y!=... hits Y==7 with A<0xc0 (no wrap), reads the cell and
// EORs $ef in. Exercises BCS $2c48 taken, BNE $2c60 not taken, BCC $2c60 taken, BEQ $2c6a not taken.
function setup() {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  m.regs.a = 0x30;
  m.regs.y = 0x02;
  m.ram[0x008b] = 0x05; // added into the column accumulator
  m.ram[0x00ef] = 0x0f; // folded into the fetched cell
  m.ram[0x0786] = 0x55; // the map cell ($32)=0x0786 points at
  return m;
}

test("loc_2c2b: builds ($32)=0x0786, fetches cell 0x55, EORs $ef -> 0x5a; 94 T; RTS", () => {
  const m = setup();
  loc_2c2b(m);

  assert.equal(m.regs.a, 0x5a, "A = cell(0x55) ^ $ef(0x0f)");
  assert.equal(m.regs.y, 0x00, "Y = 0 (LDY #$00 before the fetch)");
  assert.equal(m.ram[0x0032], 0x86, "($32) low byte = the clamped column");
  assert.equal(m.ram[0x0033], 0x07, "($32) high byte = row 7 from the ROL pair");
  assert.equal(m.ram[0x008b], 0x15, "$8b = 0x10 + 0x05");
  assert.equal(m.regs.fC, false, "C clear from CMP #$c0 (0x86 < 0xc0)");
  assert.equal(m.regs.fN, false, "N clear from A = 0x5a");
  assert.equal(m.regs.fZ, false, "Z clear");
  assert.equal(m.cycles, 94, "94 T on this path");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
  assert.deepEqual(m.pcSeq, [
    0x2c2c, 0x2c2d, 0x2c2e, 0x2c30, 0x2c32, 0x2c34, 0x2c36, 0x2c37, 0x2c38, 0x2c39,
    0x2c3a, 0x2c3b, 0x2c3d, 0x2c3f, 0x2c41, 0x2c42, 0x2c44, 0x2c48, 0x2c4a, 0x2c4b,
    0x2c4d, 0x2c4e, 0x2c50, 0x2c52, 0x2c54, 0x2c56, 0x2c58, 0x2c5a, 0x2c60, 0x2c62,
    0x2c64, 0x2c66, 0x2c68, 0x2c6a, 0x1234,
  ], "executed instruction/step boundary sequence");
});

test("loc_2c2b MUTATION: ROL $33 mischarged 4T not 5T is caught by the T-state total", () => {
  const m = setup();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2c4d ? 4 : c); // only the first ROL $33 steps to 0x2c4d
  loc_2c2b(m);
  assert.notEqual(m.cycles, 94, "a mischarged cycle blows the golden T-state total");
});
