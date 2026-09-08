// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2b60 (ROM 0x2b60-0x2b79). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. m.call is a no-op recorder, so A after JSR $382b equals the pre-call SBC result.
// Run: node --test games/centiped/translated/test/loc_2b60.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2b60 } from "../loc_2b60.js";

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

test("loc_2b60: $EF!=0, single SBC borrows past then BCC $2b72, folded delta>=5 branches out to $2b86", () => {
  const m = makeMachine();
  m.ram[0x0072] = 0x10; // LDA $72
  m.ram[0x00ef] = 0x05; // LDX $ef -> X!=0 -> BEQ $2b64 not taken
  m.ram[0x008d] = 0x20; // SBC $8d: 0x10-0x20 -> borrow (C=0)

  loc_2b60(m);

  assert.equal(m.regs.a, 0xf0, "SBC $8d: 0x10 - 0x20 = 0xf0 (no-op JSR leaves A)");
  assert.equal(m.pc, 0x2b86, "CMP #$05 with 0xf0 -> C set -> BCS $2b86 out");
  assert.deepEqual(m.calls, [0x382b, 0x2b86], "the $382B fold then the BCS out-branch");
  assert.equal(m.cycles, 29, "golden T-state total for the $EF!=0 fold path");
});

test("loc_2b60: $EF==0 takes the BEQ, second SBC borrows and BCC $2b79 falls out to loc_2b79", () => {
  const m = makeMachine();
  m.ram[0x0072] = 0x03; // LDA $72
  m.ram[0x00ef] = 0x00; // LDX $ef -> X==0 -> BEQ $2b6d taken
  m.ram[0x008d] = 0x10; // SBC $8d: 0x03-0x10 -> borrow (C=0) -> BCC $2b79 out

  loc_2b60(m);

  assert.equal(m.pc, 0x2b79, "BCC $2b79 out lands at loc_2b79");
  assert.deepEqual(m.calls, [0x2b79], "no $382B fold on the early-out path");
  assert.equal(m.cycles, 17, "golden T-state total for the BEQ + early-out path");
});

test("loc_2b60 MUTATION: mischarging the JSR $382b (6T->5T) blows the golden total", () => {
  const m = makeMachine();
  m.ram[0x0072] = 0x10; m.ram[0x00ef] = 0x05; m.ram[0x008d] = 0x20;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2b75 ? 5 : c); // the JSR $382b step lands at 0x2b75
  loc_2b60(m);
  assert.notEqual(m.cycles, 29, "a mischarged JSR is caught by the T-state total");
});
