// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_3226 (ROM 0x3226-0x323e). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_3226.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_3226 } from "../loc_3226.js";

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
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); return undefined; },
  };
}

test("loc_3226 A<0x08 (bcc-first arm): A=0x04 -> Y=0x02, A=0x00; 21 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x5554); // RTS -> pulled + 1 = 0x5555
  m.regs.a = 0x04;

  loc_3226(m);

  // clamp keeps A=0x04 at 0x3236; CMP #$80 clears C; ROR A -> 0x02 (C=0); TAY; LDA #$00; ROR A -> 0x00
  assert.equal(m.regs.y, 0x02, "Y = (clamped >> 1) with no carry-in");
  assert.equal(m.regs.a, 0x00, "A = second ROR of #$00 with carry-in 0");
  assert.equal(m.regs.fC, false, "C clear (bit0 of #$00)");
  assert.equal(m.cycles, 21, "2(cmp)+3(bcc taken)+2+2+2+2+2(tail)+6(rts)");
  assert.equal(m.pc, 0x5555, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

test("loc_3226 0x80<=A<0xf8 (clamp to 0xf8 path): A=0x90 -> Y=0xfc; 32 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x5554);
  m.regs.a = 0x90;

  loc_3226(m);

  // 0x90 >= 0x08, < 0xf8, >= 0x80 -> A clamped to 0xf8; CMP #$80 sets C; ROR -> (0xf8>>1)|0x80 = 0xfc
  assert.equal(m.regs.y, 0xfc, "Y = (0xf8 >> 1) | 0x80");
  assert.equal(m.regs.a, 0x00, "A = ROR of #$00 with carry-in 0 (0xf8 bit0 = 0)");
  assert.equal(m.cycles, 32, "both first branches fall through, then bcc taken");
  assert.equal(m.pc, 0x5555, "RTS returns to pushed + 1");
});

test("loc_3226 MUTATION: BCC-taken mischarged 2T not 3T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x5554);
  m.regs.a = 0x04;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3236 ? 2 : c); // the BCC $3236 taken step lands at 0x3236
  loc_3226(m);
  assert.notEqual(m.cycles, 21, "dropping the branch-taken +1 blows the golden T-state total");
});
