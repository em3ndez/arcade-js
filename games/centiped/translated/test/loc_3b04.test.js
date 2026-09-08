// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_3b04 (ROM 0x3b04-0x3c97). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_3b04.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_3b04 } from "../loc_3b04.js";

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

// Normal cold boot ($0c00 bit5 SET -> self-test OFF): clears RAM 0x00-0xff and pages 1,4-7 (256 passes
// of the store loop), seeds $fd/$86/$c1/$c2/$ff, JSR $3a99, JSR $3a1d, JMP $200e.
// Cycles: entry 10 + loop (256*31 stores/dex + 255*3 taken + 1*2 fall = 8703) + 24 (post-loop..BEQ fall)
//         + 38 (tail through JMP) = 8775 T.
test("loc_3b04: normal boot clears RAM, seeds vars, and jumps to $200e; 8775 T", () => {
  const m = makeMachine();
  m.ram[0x0c00] = 0x20; // bit5 set -> BEQ $3b4a not taken -> normal path
  m.ram[0x0800] = 0x37; // copied into $fd
  m.ram[0x0000] = 0xaa; // proves the clear loop zeroed page 0
  m.ram[0x0055] = 0xaa;

  loc_3b04(m);

  assert.equal(m.ram[0x0000], 0x00, "zero page cleared by the store loop");
  assert.equal(m.ram[0x0055], 0x00, "zero page cleared by the store loop");
  assert.equal(m.ram[0x00fd], 0x37, "$fd = $0800 read");
  assert.equal(m.ram[0x0086], 0xff, "$86 = X (0xff after DEX)");
  assert.equal(m.ram[0x00c1], 0xff, "$c1 = 0xff");
  assert.equal(m.ram[0x00c2], 0xff, "$c2 = 0xff");
  assert.equal(m.ram[0x00ff], 0x01, "$ff = 0x01");
  assert.equal(m.regs.a, 0x01, "A = #$01 held through to the JMP");
  assert.equal(m.regs.x, 0xff, "X = 0xff after the post-clear DEX");
  assert.equal(m.cycles, 8775, "8775 T on the normal boot path");
  assert.equal(m.pc, 0x200e, "JMP $200e lands the main entry");
  assert.deepEqual(m.calls, [0x3a99, 0x3a1d, 0x200e], "the two init JSRs then the JMP to $200e");
});

test("loc_3b04 MUTATION: the JMP $200e mischarged 4T not 3T is caught by the T-state total", () => {
  const m = makeMachine();
  m.ram[0x0c00] = 0x20;
  m.ram[0x0800] = 0x37;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x200e ? 4 : c); // JMP $200e steps to 0x200e
  loc_3b04(m);
  assert.notEqual(m.cycles, 8775, "a mischarged cycle blows the golden T-state total");
});
