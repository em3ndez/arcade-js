// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_3956 (ROM 0x3956-0x396d). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_3956.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_3956 } from "../loc_3956.js";

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

test("loc_3956: bit6 set & X<0x0c -> clamp A to 0x0c; DEX; BPL taken loops to $3907; 31 T", () => {
  const m = makeMachine();
  m.regs.x = 0x05;
  m.regs.a = 0xaa;
  m.ram[0x0039] = 0x40; // $34,X = $39: bit6 set -> BEQ not taken

  loc_3956(m);

  assert.equal(m.ram[0x07c5], 0xaa, "STA $07c0,X wrote A to 0x07c5");
  assert.equal(m.regs.a, 0x3d, "A = 0x0c | 0x39 = 0x3d (clamp then ORA)");
  assert.equal(m.ram[0x07f5], 0x3d, "STA $07f0,X wrote 0x3d to 0x07f5");
  assert.equal(m.regs.x, 0x04, "DEX -> 0x04");
  assert.equal(m.cycles, 5 + 4 + 2 + 2 + 2 + 2 + 2 + 2 + 5 + 2 + 3, "31 T (BEQ nt, BCS nt, BPL taken)");
  assert.equal(m.pc, 0x3907, "BPL taken lands at 0x3907");
  assert.deepEqual(m.calls, [0x3907], "loop tail-calls back into 0x3907");
});

test("loc_3956: bit6 clear -> BEQ taken skips clamp; X=0 DEX->0xff BPL not taken falls to $396d; 25 T", () => {
  const m = makeMachine();
  m.regs.x = 0x00;
  m.regs.a = 0x55;
  m.ram[0x0034] = 0x00; // $34,X = $34: bit6 clear -> BEQ taken

  loc_3956(m);

  assert.equal(m.ram[0x07c0], 0x55, "STA $07c0,X wrote A to 0x07c0");
  assert.equal(m.regs.a, 0x39, "A = 0x00 | 0x39 = 0x39 (BEQ skipped the CPX/clamp)");
  assert.equal(m.ram[0x07f0], 0x39, "STA $07f0,X wrote 0x39 to 0x07f0");
  assert.equal(m.regs.x, 0xff, "DEX 0x00 -> 0xff (N set) -> BPL not taken");
  assert.equal(m.cycles, 5 + 4 + 2 + 3 + 2 + 5 + 2 + 2, "25 T (BEQ taken, BPL not taken)");
  assert.equal(m.pc, 0x396d, "BPL not taken falls through to 0x396d");
  assert.deepEqual(m.calls, [0x396d], "fall-through tail-calls into 0x396d");
});

test("loc_3956 MUTATION: BPL-taken mischarged 2T not 3T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.x = 0x05;
  m.regs.a = 0xaa;
  m.ram[0x0039] = 0x40;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3907 ? 2 : c); // BPL-taken step lands at 0x3907
  loc_3956(m);
  assert.notEqual(m.cycles, 31, "a mischarged taken-branch cycle blows the golden T-state total");
});
