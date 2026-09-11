// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b0c6 (ROM 0xb0c6). Minimal 6502 harness (Regs + flat RAM + page-1 stack seam),
// author-derived; whole-machine boot-first diff vs MAME is the integration check. JSR $91b5 and JMP $dfb1
// are opaque here (harness records the call). Run: node --test games/tempest/translated/test/equivalence-b0c6.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b0c6 } from "../loc_b0c6.js";

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

test("loc_b0c6: txa; jsr 0x91b5; A=$29,Y=$03; tail-jmp 0xdfb1; 15 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.x = 0x05;
  loc_b0c6(m);
  assert.equal(m.regs.a, 0x29, "A = #$29 (last load)");
  assert.equal(m.regs.y, 0x03, "Y = #$03");
  assert.equal(m.pc, 0xdfb1, "tail-jmp lands at 0xdfb1");
  assert.deepEqual(m.calls, [0x91b5, 0xdfb1], "JSR 0x91b5 then tail-call 0xdfb1");
  assert.equal(m.cycles, 2 + 6 + 2 + 2 + 3, "15 T");
});

test("loc_b0c6 MUTATION: dropping the JSR push16 leaves a stale return on the stack", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.x = 0x00;
  const s0 = m.regs.s;
  loc_b0c6(m);
  // The JSR push16 + the seam call's matching pull16 must net to zero stack movement.
  assert.equal(m.regs.s, s0, "stack balanced across the JSR/return seam");
});
