// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_26fd (ROM 0x26fd-0x2740). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_26fd.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_26fd } from "../loc_26fd.js";

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

// Scenario: X=13 cell ($41) = 0xF9 -> the "==$F9" reload path fires ($41 <- $D7 ^ $EF); X=12..0 cells are
// small so every other iteration takes the BCC@2703 shortcut to DEX; $43=0 so the tail BEQ@2724 exits.
test("loc_26fd: $41=$F9 reloads $41 from $D7^$EF; rest short-circuit; tail BEQ exits; 248 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> pulled + 1 = 0x1234
  m.ram[0x0041] = 0xf9; // $34+13 -> the reload cell
  for (let a = 0x34; a <= 0x40; a++) m.ram[a] = 0x00; // $34..$40 all < 0xf9 -> BCC@2703 shortcut
  m.ram[0x0043] = 0x00; // (& 0xaf) == 0 -> reach 2717 in iter13, and BEQ@2724 exits the tail
  m.ram[0x00d7] = 0x55;
  m.ram[0x00ef] = 0x0f;

  loc_26fd(m);

  assert.equal(m.ram[0x0041], 0x5a, "$41 <- $D7(0x55) ^ $EF(0x0f) = 0x5a");
  assert.equal(m.ram[0x0043], 0x00, "$43 untouched (INC path not reached)");
  assert.equal(m.regs.x, 0xff, "X = 0xff after the final DEX exits the loop");
  assert.equal(m.regs.y, 0x00, "Y = last-loaded $34 cell");
  assert.equal(m.regs.a, 0x00, "A = $43 & 0xaf in the tail");
  assert.equal(m.regs.fZ, true, "Z set (A = 0x00)");
  assert.equal(m.regs.fN, false, "N clear");
  assert.equal(m.cycles, 248, "248 T");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

test("loc_26fd MUTATION: LDA $43 (tail, -> 0x2722) mischarged 4T not 3T blows the golden T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x0041] = 0xf9;
  for (let a = 0x34; a <= 0x40; a++) m.ram[a] = 0x00;
  m.ram[0x0043] = 0x00;
  m.ram[0x00d7] = 0x55;
  m.ram[0x00ef] = 0x0f;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2722 ? 4 : c); // tail LDA $43 uniquely steps to 0x2722
  loc_26fd(m);
  assert.notEqual(m.cycles, 248, "a mischarged cycle blows the golden T-state total");
});
