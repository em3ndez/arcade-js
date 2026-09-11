// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b7eb (ROM 0xb7eb-0xb829). Minimal 6502 harness; jsr $c098/$c765/$b84e and the
// final jmp $df57 are recorded, not run. Run: node --test games/tempest/translated/test/equivalence-b7eb.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b7eb } from "../loc_b7eb.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [], _retPushed: false,
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

test("loc_b7eb: no-wrap ($013c>1), $b83d,x positive -> jsr $b84e, tail jmp $df57; 79 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.ram[0x29] = 0x02;
  m.ram[0x0437] = 0xaa; // $0435 + 2
  m.ram[0x0447] = 0xbb; // $0445 + 2
  m.ram[0x013b] = 0x03; // X
  m.ram[0x013c] = 0x05; // dec -> 0x04 (nonzero -> bne taken, no reload)
  m.ram[0xb840] = 0x10; // $b83d + 3, positive -> bmi not taken -> jsr $b84e
  m.ram[0xcef7] = 0x77; // $cec9 + 0x2e (Y = (3<<1)+0x28 = 0x2e)
  m.ram[0xcef6] = 0x99; // $cec8 + 0x2e

  loc_b7eb(m);

  assert.equal(m.ram[0x56], 0xaa, "$56 = $0435,Y");
  assert.equal(m.ram[0x58], 0xbb, "$58 = $0445,Y");
  assert.equal(m.ram[0x013c], 0x04, "$013c decremented, no reload");
  assert.equal(m.ram[0x013b], 0x03, "$013b unchanged (no wrap)");
  assert.equal(m.regs.y, 0x2e, "Y = ($013b<<1)+0x28");
  assert.equal(m.regs.x, 0x77, "X = $cec9,Y");
  assert.equal(m.regs.a, 0x99, "A = $cec8,Y");
  assert.deepEqual(m.calls, [0xc098, 0xc765, 0xb84e, 0xdf57], "jsr chain then tail jmp");
  assert.equal(m.pc, 0xdf57, "PC at jmp target");
  assert.equal(m.cycles, 79, "instruction-exact total");
});

test("loc_b7eb: wrap ($013c==1) reloads from $b82a,x; $b83d,x negative skips $b84e; 87 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.ram[0x29] = 0x02;
  m.ram[0x013b] = 0x03; // X
  m.ram[0x013c] = 0x01; // dec -> 0 -> bne fall -> inx + reload
  m.ram[0xb82e] = 0x30; // $b82a + 4 (X after inx)
  m.ram[0xb841] = 0x80; // $b83d + 4, negative -> bmi taken -> skip $b84e

  loc_b7eb(m);

  assert.equal(m.ram[0x013b], 0x04, "$013b bumped by inx");
  assert.equal(m.ram[0x013c], 0x30, "$013c reloaded from $b82a,x");
  assert.deepEqual(m.calls, [0xc098, 0xc765, 0xdf57], "no $b84e (bmi taken)");
  assert.equal(m.pc, 0xdf57, "tail jmp $df57");
  assert.equal(m.cycles, 87, "instruction-exact total");
});
