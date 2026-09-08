// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2195 (ROM 0x2195-0x21b3). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2195.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2195 } from "../loc_2195.js";

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

test("loc_2195: stashes $ae/$b0, drives the writers, tail-JMPs $384f; 47 T", () => {
  const m = makeMachine();
  m.regs.a = 0x77;    // survives to STA $ae
  m.regs.y = 0x02;    // index from loc_21b3; 0x21c0+2 stays in page -> no cross
  m.ram[0x21c2] = 0x40;

  loc_2195(m);

  assert.equal(m.ram[0x00ae], 0x77, "STA $ae wrote the entry A");
  assert.equal(m.ram[0x00b0], 0x40, "STA $b0 wrote table[Y]");
  assert.equal(m.regs.a, 0x00, "final A = 0x00 (LDA #$00 before the tail JMP)");
  assert.equal(m.regs.fZ, true, "Z set by LDA #$00");
  assert.equal(m.regs.fN, false, "N clear by LDA #$00");
  assert.equal(m.cycles, 6 + 3 + 4 + 3 + 2 + 6 + 3 + 6 + 3 + 6 + 2 + 3, "47 T");
  assert.equal(m.pc, 0x384f, "tail JMP lands PC at 0x384f");
  assert.deepEqual(m.calls, [0x21b3, 0x37d5, 0x385c, 0x384f, 0x384f], "call sequence incl. tail JMP");
});

test("loc_2195 MUTATION: LDA $21c0,Y mischarged 5T is caught by the T total", () => {
  const m = makeMachine();
  m.regs.a = 0x77;
  m.regs.y = 0x02;
  m.ram[0x21c2] = 0x40;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x219d ? 5 : c); // LDA $21c0,Y lands at 0x219d
  loc_2195(m);
  assert.notEqual(m.cycles, 47, "a mischarged cycle blows the golden T total");
});
