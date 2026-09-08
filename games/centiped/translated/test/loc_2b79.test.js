// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2b79 (ROM 0x2b79-0x2b91). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2b79.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2b79 } from "../loc_2b79.js";

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

test("loc_2b79: $72=$73+(4^$f0), $62=$63, ($43&$af)==0 -> BEQ taken skips $42; 33 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  m.ram[0x00f0] = 0x00; // 4 ^ 0 = 4
  m.ram[0x0073] = 0x10; // 4 + 0x10 = 0x14
  m.ram[0x0063] = 0xaa;
  m.ram[0x0043] = 0x00; // & 0xaf == 0 -> BEQ taken
  m.ram[0x0042] = 0x99; // must stay untouched

  loc_2b79(m);

  assert.equal(m.ram[0x0072], 0x14, "$72 = $73 + (4 ^ $f0)");
  assert.equal(m.ram[0x0062], 0xaa, "$62 = $63");
  assert.equal(m.regs.a, 0x00, "A = $43 & $af = 0");
  assert.equal(m.regs.fZ, true, "Z set by the AND");
  assert.equal(m.ram[0x0042], 0x99, "$42 not written on the BEQ-taken path");
  assert.equal(m.cycles, 2 + 3 + 2 + 3 + 3 + 3 + 3 + 3 + 2 + 3 + 6, "33 T");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

test("loc_2b79: ($43 & $af) nonzero -> BEQ not taken, $42 = $28; 37 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x00f0] = 0x01; // 4 ^ 1 = 5
  m.ram[0x0073] = 0x20; // 5 + 0x20 = 0x25
  m.ram[0x0063] = 0x33;
  m.ram[0x0043] = 0x08; // & 0xaf == 0x08 -> BEQ not taken

  loc_2b79(m);

  assert.equal(m.ram[0x0072], 0x25, "$72 = $73 + (4 ^ $f0)");
  assert.equal(m.ram[0x0062], 0x33, "$62 = $63");
  assert.equal(m.ram[0x0042], 0x28, "$42 = #$28");
  assert.equal(m.regs.a, 0x28, "A = #$28");
  assert.equal(m.cycles, 2 + 3 + 2 + 3 + 3 + 3 + 3 + 3 + 2 + 2 + 2 + 3 + 6, "37 T");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
});

test("loc_2b79 MUTATION: EOR mischarged 2 T not 3 T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x0043] = 0x00; // BEQ-taken path, 33 T
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2b7d ? 2 : c); // EOR $f0 step lands at 0x2b7d
  loc_2b79(m);
  assert.notEqual(m.cycles, 33, "a mischarged cycle blows the golden T-state total");
});
