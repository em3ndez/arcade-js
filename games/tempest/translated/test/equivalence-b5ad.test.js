// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b5ad (ROM 0xb5ad-0xb5d6). Minimal 6502 harness; jsr $b5d7 recorded, not run.
// Run: node --test games/tempest/translated/test/equivalence-b5ad.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b5ad } from "../loc_b5ad.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [], _retPushed: false,
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

test("loc_b5ad: $0106 negative -> bmi early rts; 13 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  m.ram[0x0106] = 0x80; // N set

  loc_b5ad(m);

  assert.deepEqual(m.calls, [], "no dispatch");
  assert.equal(m.pc, 0x1001, "early rts");
  assert.equal(m.cycles, 4 + 3 + 6, "lda/bmi taken/rts");
});

test("loc_b5ad: all $02df,x zero -> loop skips every body; 142 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);
  m.ram[0x0106] = 0x00; // positive

  loc_b5ad(m);

  assert.deepEqual(m.calls, [], "no body -> no jsr $b5d7");
  assert.equal(m.ram[0x37], 0xff, "loop ran X 6..0 then dec wrapped to 0xff");
  assert.equal(m.pc, 0x2001, "rts");
  assert.equal(m.cycles, 142, "entry 11 + 7 skip iterations + rts");
});

test("loc_b5ad: X=6 entry nonzero -> splits $0283,6 into $55/A, jsr $b5d7; 173 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000);
  m.ram[0x0106] = 0x00;
  m.ram[0x02e5] = 0x50; // $02df + 6, only X=6 nonzero
  m.ram[0x0289] = 0x1f; // $0283 + 6

  loc_b5ad(m);

  assert.equal(m.ram[0x57], 0x50, "$57 = the entry");
  assert.equal(m.ram[0x55], 0x03, "($0289 & 0x18) >> 3 = 3");
  assert.deepEqual(m.calls, [0xb5d7], "jsr $b5d7 dispatch");
  assert.equal(m.pc, 0x3001, "rts to caller");
  assert.equal(m.cycles, 173, "entry + body(X=6) + 6 skips + rts");
});
