// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2280 (ROM 0x2280-0x22fa). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2280.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2280 } from "../loc_2280.js";

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

// Path: LDY #$00 leaves Z set -> BEQ 2287 taken -> 229c; LDA $61=$ff, CMP #$ff sets C -> BCS 22a0
// taken -> 22f6 -> JSR 21c7 -> RTS. (The JSR 2c2b/21c7 are recorded, not executed, in the drafter harness.)
test("loc_2280: $61=$ff routes through 0x22f6/0x21c7; 34 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x0800); // RTS -> 0x0801
  m.regs.a = 0x42;  // stored to $71
  m.ram[0x0061] = 0xff;

  loc_2280(m);

  assert.equal(m.ram[0x0071], 0x42, "STA $71 wrote A");
  assert.equal(m.regs.y, 0x00, "LDY #$00");
  assert.equal(m.regs.a, 0xff, "A = $61 = 0xff");
  assert.equal(m.regs.fC, true, "C set by CMP #$ff (0xff >= 0xff)");
  assert.equal(m.regs.fZ, true, "Z set by CMP #$ff (equal)");
  assert.equal(m.regs.fN, false, "N clear (0xff-0xff = 0)");
  assert.deepEqual(m.calls, [0x2c2b, 0x21c7], "JSR 2c2b then JSR 21c7");
  assert.equal(m.cycles, 3 + 2 + 6 + 3 + 3 + 2 + 3 + 6 + 6, "34 T");
  assert.equal(m.pc, 0x0801, "RTS returns to pushed + 1");
});

test("loc_2280 MUTATION: JSR 21c7 mischarged 7T not 6T blows the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x0800);
  m.regs.a = 0x42;
  m.ram[0x0061] = 0xff;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x22f9 ? 7 : c); // the JSR $21c7 step lands at 0x22f9
  loc_2280(m);
  assert.notEqual(m.cycles, 34, "a mischarged cycle blows the golden T-state total");
});
