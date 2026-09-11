// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_af71 (ROM 0xaf71-0xaf76) -- clamp A to <= 0x63, then fall/tail into loc_af77.
// Minimal author-derived 6502 harness; whole-machine diff vs MAME is the integration check.
// Run: node --test games/tempest/translated/test/equivalence-af71.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_af71 } from "../loc_af71.js";

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

test("loc_af71: A < 0x63 -> unclamped, BCC tail to loc_af77; 5 T", () => {
  const m = makeMachine();
  m.regs.a = 0x50;
  loc_af71(m);
  assert.equal(m.regs.a, 0x50, "A under the cap passes through unchanged");
  assert.equal(m.regs.fC, false, "CMP: 0x50 < 0x63 -> carry clear");
  assert.equal(m.pc, 0xaf77, "BCC taken -> loc_af77");
  assert.deepEqual(m.calls, [0xaf77], "tail-call loc_af77");
  assert.equal(m.cycles, 2 + 3, "cmp imm (2) + bcc taken (3)");
});

test("loc_af71: A > 0x63 -> clamped to 0x63, falls into loc_af77; 6 T", () => {
  const m = makeMachine();
  m.regs.a = 0x80;
  loc_af71(m);
  assert.equal(m.regs.a, 0x63, "A over the cap clamped to 0x63");
  assert.equal(m.regs.fC, true, "CMP: 0x80 >= 0x63 -> carry set");
  assert.equal(m.pc, 0xaf77, "falls through to loc_af77 start");
  assert.deepEqual(m.calls, [0xaf77], "fall-through delegates to loc_af77");
  assert.equal(m.cycles, 2 + 2 + 2, "cmp (2) + bcc not-taken (2) + lda imm (2)");
});

test("loc_af71: A == 0x63 -> boundary takes the clamp (BCC not taken)", () => {
  const m = makeMachine();
  m.regs.a = 0x63;
  loc_af71(m);
  assert.equal(m.regs.a, 0x63, "A == cap stays 0x63");
  assert.equal(m.regs.fC, true, "0x63 >= 0x63 -> carry set -> BCC not taken");
  assert.equal(m.pc, 0xaf77);
});
