// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2ba8 (ROM 0x2ba8-0x2bd8). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2ba8.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2ba8 } from "../loc_2ba8.js";

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

// $32 cell empty, low code 0x15 (>=0x14, X!=0) -> BCS $2bce: bump $d7,X, then write $3f^$ef through ($32).
function setup() {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> pulled + 1 = 0x1234
  m.ram[0x32] = 0x15;   // ($32) low byte and the classified column code
  m.ram[0x33] = 0x40;   // ($32) points at 0x4015
  m.ram[0x4015] = 0x00; // the pointed cell is empty -> BNE $2bd8 not taken
  m.ram[0x00ef] = 0x02; // X<-$ef nonzero -> the >=0x14 branch; also the EOR mask
  m.ram[0x0088] = 0x03; // X<-$88 selects $d7+3 = $da
  m.ram[0x00da] = 0x10; // INC $d7,X target
  return m;
}

test("loc_2ba8: empty cell, code 0x15 -> INC $da, write 0x3d through ($32); 62 T; RTS", () => {
  const m = setup();
  loc_2ba8(m);

  assert.equal(m.regs.a, 0x3d, "A = 0x3f ^ $ef(0x02)");
  assert.equal(m.regs.x, 0x03, "X = $88");
  assert.equal(m.regs.y, 0x00, "Y stays 0");
  assert.equal(m.ram[0x00da], 0x11, "INC $d7,X bumped $da");
  assert.equal(m.ram[0x4015], 0x3d, "STA ($32),Y wrote the new cell");
  assert.equal(m.regs.fC, true, "C set by CMP #$14 (0x15 >= 0x14)");
  assert.equal(m.regs.fN, false, "N clear from A = 0x3d");
  assert.equal(m.regs.fZ, false, "Z clear");
  assert.equal(m.cycles, 62, "62 T on this path");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
  assert.deepEqual(m.pcSeq, [
    0x2baa, 0x2bac, 0x2bae, 0x2bb0, 0x2bb2, 0x2bb4, 0x2bb6, 0x2bb8, 0x2bba, 0x2bbc,
    0x2bbe, 0x2bc0, 0x2bc2, 0x2bc4, 0x2bce, 0x2bd0, 0x2bd2, 0x2bd4, 0x2bd6, 0x2bd8, 0x1234,
  ], "executed instruction/step boundary sequence");
});

test("loc_2ba8 MUTATION: INC $d7,X mischarged 5T not 6T is caught by the T-state total", () => {
  const m = setup();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2bd2 ? 5 : c); // only INC $d7,X steps to 0x2bd2 here
  loc_2ba8(m);
  assert.notEqual(m.cycles, 62, "a mischarged cycle blows the golden T-state total");
});
