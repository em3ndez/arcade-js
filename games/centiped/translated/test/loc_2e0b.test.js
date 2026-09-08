// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2e0b (ROM 0x2e0b-0x2e8c). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2e0b.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2e0b } from "../loc_2e0b.js";

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

// Full main-body traversal: BCC$2e16 taken, down through the velocity seed at $2e63, out via the
// $2e89 add and the fall-through into loc_2e8c. Memory set so every branch takes the intended arm.
test("loc_2e0b: main path seeds velocity and falls into loc_2e8c; 137 T", () => {
  const m = makeMachine();
  m.ram[0x0040] = 0x00; m.ram[0x00ef] = 0x00; // A=0 -> CMP #$34 C clear -> BCC $2e16 taken
  m.ram[0x0070] = 0xf8; m.ram[0x00f0] = 0x00; // A=0xf8 -> CMP #$f8 C set -> BCC $2e26 NOT taken
  m.ram[0x0000] = 0x00;                       // LDA $00 = 0 -> BEQ $2e29 taken
  m.ram[0x0088] = 0x00;                       // X = 0
  m.ram[0x009a] = 0x05;                       // LDA $9a,X = 5 -> CMP #$0b C clear -> BCS $2e26 NOT taken
  m.ram[0x100a] = 0x00;                       // AND #$03 = 0 -> BNE $2e26 NOT taken; later BEQ $2e5a taken
  m.ram[0x00ab] = 0x05;                       // LDA $ab,X = 5 -> CMP #$02 C set -> BCC $2e5a NOT taken
  m.ram[0x0043] = 0x00;                       // AND #$af = 0 -> BNE $2e9a NOT taken

  loc_2e0b(m);

  assert.equal(m.ram[0x00b8], 0x14, "STA $b8 = #$14");
  assert.equal(m.ram[0x0040], 0x30, "STA $40 = #$30 EOR $ef");
  assert.equal(m.ram[0x0050], 0x01, "STA $50 = velocity magnitude 1 (BIT $100a path)");
  assert.equal(m.ram[0x0060], 0x00, "STA $60 = 0");
  assert.equal(m.ram[0x0080], 0x00, "STA $80 = 0");
  assert.equal(m.ram[0x0070], 0x70, "STA $70 = (($100a & 0x78)+0x70) EOR $f0");
  assert.equal(m.regs.a, 0x01, "A = $60(0) + $50(1) after CLC/ADC $50");
  assert.equal(m.cycles, 137, "137 T along this path");
  assert.equal(m.pc, 0x2e8c, "PC at the fall-through target");
  assert.equal(m.pcSeq.length, 51, "51 opcodes executed");
  assert.equal(m.pcSeq[3], 0x2e16, "BCC $2e16 taken as the 4th step");
  assert.deepEqual(m.calls, [0x2e8c], "falls through into loc_2e8c");
});

// Early exit: CMP #$34 carry set -> BCC not taken -> JMP $2e94.
test("loc_2e0b: BCC$2e16 not taken jumps to loc_2e94; 13 T", () => {
  const m = makeMachine();
  m.ram[0x0040] = 0x40; m.ram[0x00ef] = 0x00; // A=0x40 -> CMP #$34 C set -> BCC NOT taken -> JMP $2e94

  loc_2e0b(m);

  assert.equal(m.cycles, 3 + 3 + 2 + 2 + 3, "13 T");
  assert.equal(m.pc, 0x2e94, "JMP $2e94");
  assert.deepEqual(m.pcSeq, [0x2e0d, 0x2e0f, 0x2e11, 0x2e13, 0x2e94], "step boundaries");
  assert.deepEqual(m.calls, [0x2e94], "exits to loc_2e94");
});

test("loc_2e0b MUTATION: the ADC $50 step mischarged 4T not 3T is caught by the T-state total", () => {
  const m = makeMachine();
  m.ram[0x0040] = 0x00; m.ram[0x00ef] = 0x00;
  m.ram[0x0070] = 0xf8; m.ram[0x00f0] = 0x00;
  m.ram[0x0000] = 0x00;
  m.ram[0x0088] = 0x00;
  m.ram[0x009a] = 0x05;
  m.ram[0x100a] = 0x00;
  m.ram[0x00ab] = 0x05;
  m.ram[0x0043] = 0x00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2e8c ? 4 : c); // the final ADC $50 step lands at 0x2e8c
  loc_2e0b(m);
  assert.notEqual(m.cycles, 137, "a mischarged cycle blows the golden T-state total");
});
