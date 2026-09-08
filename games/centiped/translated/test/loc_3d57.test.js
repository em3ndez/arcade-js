// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_3d57 (ROM 0x3d57-0x3fd6). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_3d57.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_3d57 } from "../loc_3d57.js";

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

// $8a bit0 set -> the entry LSR/BCC wait falls through in one pass; every input port = 0 so each of the
// four (col-nibble & 3 == 2) blocks is skipped (BNE taken), the 0x3fd8 credit-icon block is skipped
// (top-nibble of $0801 == 0), the BVC skips the $f2 store, and $e4 EOR $ff != 0 drives the 3f3d branch
// down the 3f3f..3f52 JMP $3fd6 tail (loc_3fd6). The 3e17/3ecb/display loops all run to their fixed
// counts. Golden totals cross-checked against an independent listing replay.
function setup() {
  const m = makeMachine();
  m.ram[0x008a] = 0x01; // LSR -> C set -> BCC $3d57 not taken (one pass)
  m.ram[0x00bb] = 0x01; // SBC $bb operand; irrelevant to the path but pinned for determinism
  return m;
}

test("loc_3d57: attract/status tick, all-zero inputs -> JMP $3fd6 tail; 2248 T", () => {
  const m = setup();
  loc_3d57(m);

  assert.equal(m.pc, 0x3fd6, "JMP $3fd6 lands the tail-call target");
  assert.equal(m.regs.a, 0x25, "A = the PLA'd 0x25 restored at 0x3f4e");
  assert.equal(m.regs.s, 0x00, "S left at 0 by the display-loop TXS/PLA balance");
  assert.equal(m.ram[0x2000], 0x00, "$2000 written 0 at 0x3d62");
  assert.equal(m.ram[0x0091], 0x3b, "$91 = last draw-pointer lo (0x3f42)");
  assert.equal(m.ram[0x0092], 0x04, "$92 = width from 0x3f1f");
  assert.equal(m.ram[0x0093], 0xee, "$93 = 0xee (BVC skipped the 0xf2 store)");
  assert.equal(m.ram[0x0094], 0x3f, "$94 = 0x3f from 0x3e86");
  assert.equal(m.ram[0x008b], 0xfc, "$8b = 1 then DEC'd 5x in the 0x3e17 loop");
  assert.equal(m.ram[0x01b5], 0x10, "$01b5 = Y (0x10) left by the display loop");
  assert.equal(m.cycles, 2248, "golden T-state total for this path");
  assert.deepEqual(m.calls, [
    0x3836, 0x3836, 0x3836, 0x3836, 0x3836, // 0x3e1f x5 (the 0x3e17 loop)
    0x3836,                                  // 0x3e2d
    0x3836,                                  // 0x3e3d
    0x3836,                                  // 0x3e4f
    0x3825,                                  // 0x3e97
    0x3836,                                  // 0x3f31
    0x3ac0,                                  // 0x3f34
    0x3a08,                                  // 0x3f37
    0x3836,                                  // 0x3f46
    0x3836,                                  // 0x3f4b
    0x384f,                                  // 0x3f4f
    0x3fd6,                                  // 0x3f52 jmp $3fd6 (tail)
  ], "JSR/JMP target sequence");
});

test("loc_3d57 MUTATION: ROL $ea mischarged 4T not 5T is caught by the T-state total", () => {
  const m = setup();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3d6b ? 4 : c); // only ROL $ea steps to 0x3d6b
  loc_3d57(m);
  assert.notEqual(m.cycles, 2248, "a mischarged cycle blows the golden T-state total");
});
