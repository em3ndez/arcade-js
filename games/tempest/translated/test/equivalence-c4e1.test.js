// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c4e1 (ROM 0xc4e1). Fetches A/X via loc_c2e8 (overridden here to return
// A=0x0f,X=0x00 so the $36-indexed table reads stay on one page), runs the df6a/df4c/df75 setup, walks
// the 16-entry ($38) draw loop calling df75 each time, and tail-jmps df6a. The df75/df6a/df4c callees
// are opaque -- recorded only. Run: node --test games/tempest/translated/test/equivalence-c4e1.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c4e1 } from "../loc_c4e1.js";

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
    call(a) {
      this.calls.push(a);
      if (this._retPushed) { this._retPushed = false; this.pull16(); }
      if (a === 0xc2e8) { regs.a = 0x0f; regs.x = 0x00; } // loc_c2e8 returns A/X
      return undefined;
    },
  };
}

test("loc_c4e1: full 16-entry draw loop, calls df6a/df4c/df75 x17, tail-jmp df6a, 1047 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.mem.write8(0xc22d, 0x44); // $c22d,x (x=0) -> $9e
  m.mem.write8(0x0112, 0x00); // $0112 -> X index into $bccc,x
  m.mem.write8(0xbccc, 0x01); // nonzero -> bne skips the sbc #0x0f

  loc_c4e1(m);

  const expected = [0xc2e8, 0xdf6a, 0xdf4c, 0xdf75];
  for (let i = 0; i < 16; i++) expected.push(0xdf75);
  expected.push(0xdf6a);
  assert.deepEqual(m.calls, expected, "c2e8, df6a, df4c, 17x df75, tail df6a");
  assert.equal(m.mem.read8(0x9e), 0x44, "$9e = $c22d[0]");
  assert.equal(m.mem.read8(0x73), 0xc0, "$73 = 0xc0 from c520");
  assert.equal(m.mem.read8(0x35), 0x00, "$35 = X from c2e8");
  assert.equal(m.mem.read8(0x36) & 0xff, 0xff, "$36 = 0x0f - 16 = 0xff");
  assert.equal(m.mem.read8(0x38) & 0xff, 0xff, "$38 counted down past 0");
  assert.equal(m.pc, 0xdf6a, "tail jmp -> df6a");
  assert.equal(m.cycles, 1047, "99 prologue + 943 loop + 5 epilogue (no page crosses)");
});
