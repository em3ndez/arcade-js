// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_3a1d (ROM 0x3a1d-0x3a69). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_3a1d.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_3a1d } from "../loc_3a1d.js";

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

// Loop A copies $3a69,X -> $02,X for X=0x2f..0 (48 passes; last DEX -> 0xff clears Z). JSR 3a08 is a no-op
// in the harness, so Z stays clear -> BNE 3a2a taken -> the clear block: zero-fill $0178..$01b6 (loop C,
// X=0x3e..0, 63 passes), then $fd&$7c -> $018a, RTS at 3a68.
test("loc_3a1d: loop A + clear-block loop C reach 0x3a68; 1282 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x0a00); // RTS -> 0x0a01
  m.ram[0x3a69] = 0xab; // table[0] -> $02 after loop A
  m.ram[0x00fd] = 0x7c; // $fd & $7c = 0x7c -> $018a at the tail

  loc_3a1d(m);

  const loopA = 48 * 10 + 47 * 3 + 1 * 2; // 623
  const loopC = 63 * 7 + 62 * 3 + 1 * 2;  // 629
  assert.equal(m.cycles, 2 + loopA + 6 + 3 + 2 + 2 + loopC + 3 + 2 + 4 + 6, "1282 T");
  assert.equal(m.ram[0x0002], 0xab, "loop A copied $3a69 -> $02 (X=0)");
  assert.equal(m.ram[0x0178], 0x00, "loop C zero-filled $0178 (X=0)");
  assert.equal(m.ram[0x01b6], 0x00, "loop C zero-filled $01b6 (X=0x3e)");
  assert.equal(m.ram[0x018a], 0x7c, "$fd & $7c stored to $018a after the fill");
  assert.equal(m.regs.a, 0x7c, "A = $fd & $7c");
  assert.equal(m.regs.x, 0xff, "loop C last DEX -> 0xff");
  assert.equal(m.regs.y, 0x00, "Y untouched by the routine");
  assert.equal(m.regs.fC, false, "no instruction touches C on this path");
  assert.equal(m.regs.fZ, false, "AND #$7c of 0x7c -> nonzero");
  assert.equal(m.regs.fN, false, "0x7c bit7 clear");
  assert.deepEqual(m.calls, [0x3a08], "only JSR 3a08");
  assert.equal(m.pc, 0x0a01, "RTS returns to pushed + 1");
});

test("loc_3a1d MUTATION: mischarging the 0x3a61 LDA $fd step blows the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x0a00);
  m.ram[0x00fd] = 0x7c;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3a63 ? 4 : c); // the LDA $fd step lands at 0x3a63
  loc_3a1d(m);
  assert.notEqual(m.cycles, 1282, "a mischarged cycle blows the golden T-state total");
});
