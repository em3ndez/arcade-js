// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2ace (ROM 0x2ace-0x2aeb). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2ace.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2ace } from "../loc_2ace.js";

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

// $86>=0 and ($43 & 0xAF)==0 open the body: it swaps $B9(0x56) with $FE(0x34), runs $3226 (harness no-op,
// so A stays 0x56), accumulates A + $84(0x02) with C clear -> $84 = 0x58, and leaves the old $FE in A via
// TYA, then falls into loc_2aeb. Author-derived cycle budget = 42 T.
function setup(m) {
  m.ram[0x86] = 0x00; m.ram[0x43] = 0x00; m.ram[0x73] = 0x12; m.ram[0xfe] = 0x34;
  m.ram[0xb9] = 0x56; m.ram[0x84] = 0x02;
}

test("loc_2ace: swaps $B9/$FE, accumulates $3226 into $84, falls into loc_2aeb; 42 T", () => {
  const m = makeMachine();
  setup(m);

  loc_2ace(m);

  assert.equal(m.ram[0x8d], 0x12, "$8d <- $73");
  assert.equal(m.ram[0xb9], 0x34, "$B9 <- old $FE (0x34)");
  assert.equal(m.ram[0x84], 0x58, "$84 = 0x56 + 0x02 (C clear) = 0x58");
  assert.equal(m.regs.a, 0x34, "A = Y = old $FE (TYA)");
  assert.equal(m.regs.y, 0x34, "Y still the loaded $FE");
  assert.equal(m.cycles, 42, "42 T total");
  assert.equal(m.pc, 0x2aeb, "no RTS: PC falls through to loc_2aeb");
  assert.deepEqual(m.calls, [0x3226, 0x2aeb], "JSR $3226, then tail-call into loc_2aeb");
});

test("loc_2ace: $86 negative takes the early RTS (11 T, no callees)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1500); // RTS -> pulled + 1 = 0x1501
  m.ram[0x86] = 0x80; // bit7 set -> BPL not taken -> RTS

  loc_2ace(m);

  assert.equal(m.cycles, 11, "LDA(3) + BPL not taken(2) + RTS(6) = 11 T");
  assert.equal(m.pc, 0x1501, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "early-out: no callees");
});

test("loc_2ace MUTATION: the TYA exit step mischarged 3T not 2T is caught by the T-state total", () => {
  const m = makeMachine();
  setup(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2aeb ? 3 : c); // the 2aea TYA step lands at 0x2aeb (once)
  loc_2ace(m);
  assert.notEqual(m.cycles, 42, "a mischarged cycle blows the golden T-state total");
});
