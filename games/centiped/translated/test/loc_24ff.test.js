// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_24ff (ROM 0x24ff-0x2505). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_24ff.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_24ff } from "../loc_24ff.js";

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

test("loc_24ff: JSR $21c7; JSR $20e8; falls into loc_2505; 12 T", () => {
  const m = makeMachine();

  loc_24ff(m);

  assert.equal(m.cycles, 6 + 6, "12 T");
  assert.equal(m.pc, 0x2505, "PC at the second JSR return / fall-through addr");
  assert.deepEqual(m.calls, [0x21c7, 0x20e8, 0x2505], "two JSRs then fall into loc_2505");
});

test("loc_24ff MUTATION: JSR $21c7 mischarged 5T not 6T is caught by the T total", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2502 ? 5 : c); // JSR $21c7 lands at 0x2502
  loc_24ff(m);
  assert.notEqual(m.cycles, 12, "a mischarged cycle blows the golden T total");
});
