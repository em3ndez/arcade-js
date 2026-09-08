// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_384f (ROM 0x384f-0x385c). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_384f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_384f } from "../loc_384f.js";

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

test("loc_384f: A=0x7A -> JSR $385c with high nibble 0x07, then AND $0f -> 0x0A falls into loc_385c; 30 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.a = 0x7a;
  // capture A at each call (the JSR passes the high nibble; the fall-through passes the low nibble)
  const callA = [];
  const realCall = m.call.bind(m);
  m.call = (a) => { callA.push(m.regs.a); return realCall(a); };

  loc_384f(m);

  assert.equal(m.regs.a, 0x0a, "A = low nibble of 0x7A after AND #$0f");
  assert.deepEqual(m.calls, [0x385c, 0x385c], "JSR $385c then fall-through into loc_385c");
  assert.deepEqual(callA, [0x07, 0x0a], "high nibble (0x7A>>4) at the JSR, low nibble at the fall");
  assert.equal(m.regs.fN, false, "N clear (0x0A bit7=0)");
  assert.equal(m.regs.fZ, false, "Z clear (0x0A != 0)");
  assert.equal(m.regs.fI, true, "I preserved by PLP from the pushed PHP status (power-on I set)");
  assert.equal(m.pc, 0x385c, "PC falls into loc_385c");
  assert.equal(m.cycles, 3 + 3 + 2 + 2 + 2 + 2 + 4 + 6 + 4 + 2, "30 T");
  assert.equal(m.regs.s, 0xfd, "stack balanced: PHA/PHP pushed, PLP/PLA pulled");
});

test("loc_384f MUTATION: PLA mischarged 5T not 4T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.a = 0x7a;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x385a ? 5 : c); // the PLA step lands at 0x385a
  loc_384f(m);
  assert.notEqual(m.cycles, 30, "a mischarged cycle blows the golden T-state total");
});
