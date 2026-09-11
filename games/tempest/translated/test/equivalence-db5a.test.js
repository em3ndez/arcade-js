// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_db5a (ROM 0xdb5a). Minimal 6502 harness (Regs + flat RAM + page-1 stack +
// call recorder). Run: node --test games/tempest/translated/test/equivalence-db5a.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_db5a } from "../loc_db5a.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(target) { this.calls.push(target); this.pc = target; if (this._retPushed) { this._retPushed = false; this.pull16(); } },
  };
}

test("loc_db5a: ($01ca | $01c7) != 0 -> bne straight to rts; no jsr; 17 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // rts -> 0x1234
  m._retPushed = false;
  m.ram[0x01ca] = 0x00;
  m.ram[0x01c7] = 0x04; // ora -> 0x04 nonzero -> bne taken

  loc_db5a(m);

  assert.equal(m.regs.a, 0x04, "A = $01ca | $01c7");
  assert.equal(m.regs.fZ, false, "Z clear -> bne taken");
  assert.deepEqual(m.calls, [], "no subroutine call on the taken path");
  assert.equal(m.mem.read8(0x7c), 0x00, "$7c untouched on the taken path");
  assert.equal(m.pc, 0x1234, "rts to pushed + 1");
  assert.equal(m.cycles, 4 + 4 + 3 + 6, "17 T (lda + ora + bne taken + rts)");
});

test("loc_db5a: ($01ca | $01c7) == 0 -> jsr de11, $7c=$01c9, $00=2, rts; 34 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // rts -> 0x2001
  m._retPushed = false;
  m.ram[0x01ca] = 0x00;
  m.ram[0x01c7] = 0x00; // ora -> 0 -> bne NOT taken
  m.ram[0x01c9] = 0x99;

  loc_db5a(m);

  assert.deepEqual(m.calls, [0xde11], "jsr de11 on the fall path");
  assert.equal(m.mem.read8(0x7c), 0x99, "$7c = $01c9");
  assert.equal(m.mem.read8(0x00), 0x02, "$00 = 2");
  assert.equal(m.pc, 0x2001, "rts to the original pushed + 1 (jsr's return was balanced)");
  assert.equal(m.cycles, 4 + 4 + 2 + 6 + 4 + 3 + 2 + 3 + 6, "34 T");
});
