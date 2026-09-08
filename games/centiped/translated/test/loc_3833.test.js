// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_3833 (ROM 0x3833-0x3836). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_3833.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_3833 } from "../loc_3833.js";

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

test("loc_3833: LDA $001A,Y into A, no page-cross, falls into 0x3836; 4 T", () => {
  const m = makeMachine();
  m.regs.y = 0x04;
  m.ram[0x001e] = 0x42; // $001A + 4

  loc_3833(m);

  assert.equal(m.regs.a, 0x42, "A = ram[$001A + Y]");
  assert.equal(m.regs.fN, false, "N clear (0x42)");
  assert.equal(m.regs.fZ, false, "Z clear");
  assert.equal(m.cycles, 4, "no page-cross");
  assert.equal(m.pc, 0x3836, "falls into 0x3836");
  assert.deepEqual(m.calls, [0x3836], "hands to 0x3836");
});

test("loc_3833: Y crossing into page 1 adds the +1 page-cross cycle", () => {
  const m = makeMachine();
  m.regs.y = 0xf0;       // $001A + 0xF0 = 0x010A -> page 0x0100 != 0x0000
  m.ram[0x010a] = 0x99;

  loc_3833(m);

  assert.equal(m.regs.a, 0x99, "A = ram[0x010A]");
  assert.equal(m.regs.fN, true, "N set (0x99 bit7)");
  assert.equal(m.cycles, 5, "4 base + 1 page-cross");
  assert.equal(m.pc, 0x3836);
});

test("loc_3833 MUTATION: charging the page-cross case only 4T is caught", () => {
  const m = makeMachine();
  m.regs.y = 0xf0;
  m.ram[0x010a] = 0x99;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3836 ? 4 : c); // drop the +1 cross penalty
  loc_3833(m);
  assert.notEqual(m.cycles, 5, "dropping the page-cross +1 blows the total");
});
