// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_26a0 (ROM 0x26a0-0x26b7). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_26a0.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_26a0 } from "../loc_26a0.js";

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

test("loc_26a0: $C1/$C2=0xFF, copies $02-$0A/$1A-$22 up to $0178,X/$0181,X (X:8..0), JMP $3A08; 219 T", () => {
  const m = makeMachine();
  for (let i = 0; i <= 8; i++) { m.ram[0x02 + i] = 0x10 + i; m.ram[0x1a + i] = 0x20 + i; }

  loc_26a0(m);

  assert.equal(m.ram[0x00c1], 0xff, "$c1 = 0xff");
  assert.equal(m.ram[0x00c2], 0xff, "$c2 = 0xff");
  assert.equal(m.ram[0x0178], 0x10, "$0178 = $02 (X=0)");
  assert.equal(m.ram[0x0180], 0x18, "$0180 = $0A (X=8)");
  assert.equal(m.ram[0x0181], 0x20, "$0181 = $1A (X=0)");
  assert.equal(m.ram[0x0189], 0x28, "$0189 = $22 (X=8)");
  assert.equal(m.regs.x, 0xff, "X = 0xff after the final DEX");
  assert.equal(m.regs.fN, true, "N set (X = 0xff)");
  assert.equal(m.cycles, 219, "219 T: 9 body iters + 8 taken/1 untaken BPL + JMP");
  assert.equal(m.pc, 0x3a08, "tail JMP lands at 0x3a08");
  assert.deepEqual(m.calls, [0x3a08], "JMP $3A08 routed through m.call");
});

test("loc_26a0 MUTATION: a taken BPL mischarged 2T not 3T (dropped the +1) blows the total", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x26a8 ? 2 : c); // BPL taken re-enters the loop at 0x26a8
  loc_26a0(m);
  assert.notEqual(m.cycles, 219, "dropping the taken +1 on 8 branches blows the golden T-state total");
});
