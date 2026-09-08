// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_31d5 (ROM 0x31d5-0x3226). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_31d5.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_31d5 } from "../loc_31d5.js";

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

// The routine's loop bounds are fixed (inner1/inner2 = 8 each; outer runs until Y==0xc0 && $33==7),
// so it always processes 120 outer passes regardless of the block data. All-zero source data makes
// the ($32),Y reads never page-cross and every inner2 BCC take, giving one deterministic T-state total.
test("loc_31d5 zero source: transposes to completion; $33=7, Y=0xc0; 48177 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x4443); // RTS -> pulled + 1 = 0x4444; above the 0x0100-0x0177 scratch the routine clobbers

  loc_31d5(m);

  assert.equal(m.ram[0x0033], 0x07, "$33 counted up to 7 (loop terminator)");
  assert.equal(m.regs.y, 0xc0, "Y ends at 0xc0 (the other terminator)");
  assert.equal(m.ram[0x0032], 0x00, "$32 low byte untouched (0)");
  assert.equal(m.cycles, 48177, "author-derived 120-pass full-run T-state total");
  assert.equal(m.pc, 0x4444, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

test("loc_31d5 MUTATION: LDY #$00 mischarged 3T not 2T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x4443);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x31d7 ? 3 : c); // the opening LDY #$00 step lands at 0x31d7
  loc_31d5(m);
  assert.notEqual(m.cycles, 48177, "a mischarged cycle blows the golden T-state total");
});
