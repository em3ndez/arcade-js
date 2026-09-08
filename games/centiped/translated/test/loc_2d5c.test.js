// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2d5c (ROM 0x2d5c-0x2dad). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2d5c.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2d5c } from "../loc_2d5c.js";

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

// The loop has no early exit: $8d advances +3 per pass (STY $8d, then INC $8d twice, then INY), so entry
// Y = 0,3,6,...,21 -> 8 passes; on the 8th, INY makes Y = $18 so CPY #$18 sets C and BCC 2d65 falls to RTS.
// The $91 index (LDX #$5c, then AND #$1f / ORA #$40 / DEX) walks 0x5c,0x5b,...,0x55 -> ends X = 0x54.
test("loc_2d5c: 8 passes of the $384f/$3836/$3833 fan; 953 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x0900); // RTS -> 0x0901

  loc_2d5c(m);

  const body = 114; // per-pass cycles 0x2d65..0x2da8 (CPY), excluding the BCC
  assert.equal(m.cycles, 12 + 8 * body + 7 * 3 + 1 * 2 + 6, "953 T (12 preamble + 8 bodies + 7 taken + 1 fall + RTS)");
  assert.equal(m.regs.y, 0x18, "Y ends at $18 (loop exit)");
  assert.equal(m.regs.x, 0x54, "X = 0x55 (8th $91) then TAX/DEX -> 0x54");
  assert.equal(m.regs.a, 0x55, "A = 8th $91 value after AND $1f | ORA $40");
  assert.equal(m.ram[0x0091], 0x55, "last STX $91");
  assert.equal(m.ram[0x0092], 0x05, "STA $92 each pass");
  assert.equal(m.ram[0x008d], 0x17, "$8d after the 8th pass's two INC (23)");
  assert.equal(m.regs.fC, true, "CPY #$18 with Y=$18 sets C");
  assert.equal(m.regs.fZ, true, "CPY #$18 equal -> Z");
  assert.equal(m.regs.fN, false, "N clear");

  const expected = [0x37d5];
  for (let i = 0; i < 8; i++) expected.push(0x384f, 0x384f, 0x384f, 0x3836, 0x3833, 0x3833, 0x3833);
  assert.deepEqual(m.calls, expected, "1 preamble JSR + 7 JSRs x 8 passes");
  assert.equal(m.pc, 0x0901, "RTS returns to pushed + 1");
});

test("loc_2d5c MUTATION: mischarging the first LDA #$07 step blows the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x0900);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2d5e ? 3 : c); // the LDA #$07 step lands at 0x2d5e
  loc_2d5c(m);
  assert.notEqual(m.cycles, 953, "a mischarged cycle blows the golden T-state total");
});
