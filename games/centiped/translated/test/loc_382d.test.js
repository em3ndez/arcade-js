// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_382d (ROM 0x382d-0x3833). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_382d.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_382d } from "../loc_382d.js";

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

test("loc_382d: negates A (~A + 1); 12 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // RTS -> pulled + 1 = 0x2001
  m.regs.a = 0x05;

  loc_382d(m);

  assert.equal(m.regs.a, 0xfb, "A = -0x05 = 0xFB two's complement");
  assert.equal(m.regs.fC, false, "0xFA + 1 does not carry out");
  assert.equal(m.regs.fN, true, "N from 0xFB bit7");
  assert.equal(m.regs.fZ, false, "Z clear");
  assert.equal(m.regs.fV, false, "V clear");
  assert.equal(m.cycles, 2 + 2 + 2 + 6, "12 T");
  assert.equal(m.pc, 0x2001, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

test("loc_382d: negate of 0 stays 0 and carries", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);
  m.regs.a = 0x00;
  loc_382d(m);
  assert.equal(m.regs.a, 0x00, "-0 = 0");
  assert.equal(m.regs.fZ, true, "Z set");
  assert.equal(m.regs.fC, true, "0xFF + 1 carries");
});

test("loc_382d MUTATION: RTS mischarged 5T not 6T blows the golden T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);
  m.regs.a = 0x05;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2001 ? 5 : c); // the RTS step lands at 0x2001
  loc_382d(m);
  assert.notEqual(m.cycles, 12, "a mischarged cycle blows the golden T-state total");
});
