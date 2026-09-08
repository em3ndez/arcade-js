// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_3068 (ROM 0x3068-0x3149). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_3068.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_3068 } from "../loc_3068.js";

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

test("loc_3068 $86 negative: silences the four sound regs and returns; 29 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x6665); // RTS -> pulled + 1 = 0x6666
  m.ram[0x0086] = 0x80; // bit7 set -> BPL not taken -> zero-out branch

  loc_3068(m);

  assert.equal(m.ram[0x1001], 0, "$1001 cleared");
  assert.equal(m.ram[0x1003], 0, "$1003 cleared");
  assert.equal(m.ram[0x1005], 0, "$1005 cleared");
  assert.equal(m.ram[0x1007], 0, "$1007 cleared");
  assert.equal(m.regs.x, 0x00, "X ends 0 (LDX #$00)");
  assert.equal(m.cycles, 3 + 2 + 2 + 4 + 4 + 4 + 4 + 6, "29 T");
  assert.equal(m.pc, 0x6666, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

test("loc_3068 all-zero timers: walks to the $b2 channel and writes 0x1002/0x1003; 112 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x6665); // -> 0x6666
  // $86=0 (BPL taken), $00=0 (LSR C=0 -> BCC $3099), $b4/$b5/$b6/$b7/$b2=0, $70/$f0/$43/$40/$ef/$f4=0

  loc_3068(m);

  assert.equal(m.ram[0x1002], 0xff, "$1002 = (~(($70^$f4)>>1))|0x80 = 0xff for zero inputs");
  assert.equal(m.ram[0x1003], 0xa4, "$1003 = 0xa4 constant on this path");
  assert.equal(m.ram[0x1001], 0x00, "$1001 = $b2 (0) via the 0x3101 channel");
  assert.equal(m.cycles, 112, "author-derived full-path T-state total");
  assert.equal(m.pc, 0x6666, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

test("loc_3068 MUTATION: BPL-not-taken mischarged 3T not 2T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x6665);
  m.ram[0x0086] = 0x80;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x306c ? 3 : c); // the BPL $307b not-taken step lands at 0x306c
  loc_3068(m);
  assert.notEqual(m.cycles, 29, "a mischarged cycle blows the golden T-state total");
});
