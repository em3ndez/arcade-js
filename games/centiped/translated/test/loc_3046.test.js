// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_3046 (ROM 0x3046-0x3049). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_3046.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_3046 } from "../loc_3046.js";

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

test("loc_3046: JSR $2B79 (6T) then falls through to the 0x3049 routine", () => {
  const m = makeMachine();

  loc_3046(m);

  assert.equal(m.cycles, 6, "the lone JSR charges 6 T");
  assert.equal(m.pc, 0x3049, "step lands on the fall-through address after the JSR");
  assert.deepEqual(m.pcSeq, [0x3049], "one step boundary: the JSR return address");
  assert.deepEqual(m.calls, [0x2b79, 0x3049], "calls the subroutine, then tail-transfers into 0x3049");
});

test("loc_3046 MUTATION: JSR mischarged 5T not 6T is caught by the T-state total", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3049 ? 5 : c);
  loc_3046(m);
  assert.notEqual(m.cycles, 6, "a mischarged JSR blows the golden T-state total");
});
