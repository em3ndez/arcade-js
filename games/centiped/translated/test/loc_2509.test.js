// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2509 (ROM 0x2509-0x252a). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2509.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2509 } from "../loc_2509.js";

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

test("loc_2509: $fe fans out to $bd/$bf, ports $1c07/$2400, and the $ef-$f8 block; 53 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> pulled + 1 = 0x1234
  m.ram[0x00fe] = 0x5a;

  loc_2509(m);

  assert.equal(m.regs.a, 0x5a, "A = $fe");
  const targets = [0x00bd, 0x00bf, 0x1c07, 0x2400, 0x00f5, 0x00f7, 0x00f6,
    0x00f0, 0x00ef, 0x00f1, 0x00f2, 0x00f3, 0x00f4, 0x00f8];
  for (const t of targets) assert.equal(m.ram[t], 0x5a, `ram[0x${t.toString(16)}] = $fe`);
  assert.equal(m.regs.fZ, false, "Z from $fe = 0x5a");
  assert.equal(m.regs.fN, false, "N clear (0x5a bit7=0)");
  assert.equal(m.cycles, 3 + 3 + 3 + 4 + 4 + 3 * 10 + 6, "53 T");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

test("loc_2509 MUTATION: STA $1c07 mischarged 3T not 4T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x00fe] = 0x5a;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2512 ? 3 : c); // STA $1c07 steps to 0x2512
  loc_2509(m);
  assert.notEqual(m.cycles, 53, "a mischarged cycle blows the golden T-state total");
});
