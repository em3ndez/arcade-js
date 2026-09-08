// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_37d5 (ROM 0x37d5-0x3825). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_37d5.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_37d5 } from "../loc_37d5.js";

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

// A single-iteration walk: index -> $346D table -> ($93) pointer = 0x0500; emit two header bytes ($91,$92),
// then the body loop reads $0504 = 0x80 (negative) so BPL $3803 is NOT taken and the routine RTSes.
test("loc_37d5: one loop iteration through the 0x0500 row; 123 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x37d0); // RTS -> pulled + 1 = 0x37d1
  m.regs.a = 0x01;  // ASL a -> 0x02, TAY, ASL a -> index math X=0x08
  m.ram[0x008c] = 0x00; // ROR $8c input; also LDX $8c -> N clear
  m.ram[0x00fd] = 0x00; // difficulty nibble
  m.ram[0x00ef] = 0x00; // player select -> BEQ $37f6 taken, Y stays 0
  m.ram[0x3475] = 0x00; // $346D+8 low  -> pointer 0x0500
  m.ram[0x3476] = 0x05; // $346E+8 high
  m.ram[0x0500] = 0x11; // header byte 0 -> $91
  m.ram[0x0501] = 0x22; // header byte 1 -> $92
  m.ram[0x0504] = 0x80; // body byte at Y=4: negative -> ends the loop

  loc_37d5(m);

  assert.equal(m.ram[0x0091], 0x11, "$91 = first pointer byte");
  assert.equal(m.ram[0x0092], 0x22, "$92 = second pointer byte");
  assert.equal(m.ram[0x008b], 0x05, "$8b index advanced by INC past the emitted byte");
  assert.equal(m.regs.a, 0x80, "A holds the terminating (negative) body byte");
  assert.deepEqual(m.calls, [0x3836], "one emit JSR in the single iteration");
  assert.equal(m.cycles, 123, "golden T-state total for this path");
  assert.equal(m.pc, 0x37d1, "RTS returns to pushed + 1");
});

test("loc_37d5 MUTATION: the terminating body LDA mischarged 6T not 5T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x37d0);
  m.regs.a = 0x01;
  m.ram[0x3476] = 0x05;
  m.ram[0x0504] = 0x80;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3822 ? 6 : c); // the 0x3820 LDA ($93),Y step lands at 0x3822
  loc_37d5(m);
  assert.notEqual(m.cycles, 123, "a mischarged (zp),Y read blows the golden T-state total");
});
