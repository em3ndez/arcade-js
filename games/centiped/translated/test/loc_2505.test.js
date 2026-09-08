// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2505 (ROM 0x2505-0x2509). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2505.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2505 } from "../loc_2505.js";

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

test("loc_2505: JSR $231f then RTS; 12 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> pulled + 1 = 0x1234

  loc_2505(m);

  assert.equal(m.cycles, 6 + 6, "12 T");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [0x231f], "one JSR to $231f");
});

test("loc_2505 MUTATION: RTS mischarged 5T not 6T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  const realRet = m.ret.bind(m);
  m.ret = () => realRet(5); // RTS should be 6T
  loc_2505(m);
  assert.notEqual(m.cycles, 12, "a mischarged cycle blows the golden T-state total");
});
