// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_24f8 (ROM 0x24f8-0x24ff). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_24f8.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_24f8 } from "../loc_24f8.js";

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

test("loc_24f8: X=$88; DEC $a4,X; JSR $26b8; falls into loc_24ff; 15 T", () => {
  const m = makeMachine();
  m.ram[0x0088] = 0x03; // X
  m.ram[0x00a7] = 0x05; // $a4 + 3 -> decremented to 0x04

  loc_24f8(m);

  assert.equal(m.regs.x, 0x03, "X = $88");
  assert.equal(m.ram[0x00a7], 0x04, "DEC $a4,X decremented ram[0xa7]");
  assert.equal(m.regs.fZ, false, "Z clear (0x04)");
  assert.equal(m.regs.fN, false, "N clear (0x04)");
  assert.equal(m.cycles, 3 + 6 + 6, "15 T");
  assert.equal(m.pc, 0x24ff, "PC at the JSR return / fall-through addr");
  assert.deepEqual(m.calls, [0x26b8, 0x24ff], "JSR $26b8 then fall into loc_24ff");
});

test("loc_24f8 MUTATION: DEC $a4,X mischarged 5T not 6T is caught by the T total", () => {
  const m = makeMachine();
  m.ram[0x0088] = 0x03;
  m.ram[0x00a7] = 0x05;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x24fc ? 5 : c); // DEC $a4,X lands at 0x24fc
  loc_24f8(m);
  assert.notEqual(m.cycles, 15, "a mischarged cycle blows the golden T total");
});
