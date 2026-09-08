// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_382b (ROM 0x382b-0x382d). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_382b.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_382b } from "../loc_382b.js";

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

test("loc_382b: N clear -> BPL taken -> 0x3832 bare RTS returns to caller; 3+6 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  m.regs.fN = false; // A non-negative

  loc_382b(m);

  assert.equal(m.pc, 0x1234, "0x3832 is a bare RTS -> returns to pushed + 1");
  assert.equal(m.cycles, 3 + 6, "taken branch 3T (no page-cross) + RTS 6T");
  assert.deepEqual(m.calls, [], "branch-to-RTS returns, no call");
});

test("loc_382b: N set -> BPL not taken -> falls into the 0x382d negate; 2 T", () => {
  const m = makeMachine();
  m.regs.fN = true; // A negative

  loc_382b(m);

  assert.equal(m.pc, 0x382d, "fall-through to the negate");
  assert.equal(m.cycles, 2, "not taken");
  assert.deepEqual(m.calls, [0x382d], "hands to the negate");
});

test("loc_382b MUTATION: taken branch mischarged 2T not 3T is caught", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.regs.fN = false;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3832 ? 2 : c);
  loc_382b(m);
  assert.notEqual(m.cycles, 3 + 6, "dropping the +1 taken penalty blows the total");
});
