// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2561 (ROM 0x2561-0x2656). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Branch-heavy caller: an early RTS at 0x257e, a shared RTS at 0x25b7, and a deep path that clears
// the object tables and tail-JMPs loc_26b8. Run: node --test games/centiped/translated/test/loc_2561.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2561 } from "../loc_2561.js";

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

test("loc_2561: $86 positive -> early RTS at 0x257e; 40 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);       // RTS -> pulled + 1 = 0x1234
  m.ram[0x0801] = 0x05;   // & 3 = 1 -> BNE $2570 taken (skip the $c8 = 2 default)
  m.ram[0x00fd] = 0x00;   // ($fd & 0x0c) >> 2 + C(0) + 2 = 2 -> $a4
  m.ram[0x0086] = 0x00;   // positive -> BMI not taken -> RTS

  loc_2561(m);

  assert.equal(m.ram[0x00d3], 0x05, "$d3 = $0801");
  assert.equal(m.ram[0x008d], 0x01, "$8d = $0801 & 3");
  assert.equal(m.ram[0x00a4], 0x02, "$a4 = 2");
  assert.equal(m.regs.a, 0x00, "A = $86");
  assert.equal(m.regs.fZ, true, "Z from A = 0");
  assert.equal(m.regs.fN, false, "N clear -> BMI not taken");
  assert.equal(m.cycles, 40, "40 T on the early-RTS path");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "no m.call on the early-RTS path");
  assert.deepEqual(m.pcSeq, [
    0x2564, 0x2566, 0x2568, 0x256a, 0x2570, 0x2572, 0x2574, 0x2575, 0x2576,
    0x2578, 0x257a, 0x257c, 0x257e, 0x1234,
  ], "executed instruction/step boundary sequence");
});

test("loc_2561: $0801 & 3 == 0 -> BNE-not-taken installs $c8 = 2 then early RTS; 44 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x0801] = 0x04;   // & 3 = 0 -> BNE not taken -> LDA #$02 / STA $c8
  m.ram[0x00fd] = 0x00;
  m.ram[0x0086] = 0x00;   // BMI not taken -> RTS

  loc_2561(m);

  assert.equal(m.ram[0x00c8], 0x02, "$c8 = 2 (BNE-not-taken default)");
  assert.equal(m.ram[0x008d], 0x00, "$8d = $0801 & 3 = 0");
  assert.equal(m.ram[0x00a4], 0x02, "$a4 = 2");
  assert.equal(m.cycles, 44, "44 T: the BNE-not-taken path adds LDA #$02 + STA $c8");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "no m.call on this early-RTS path");
});

// Deep path to the tail JMP $26b8: BNE taken, BMI taken, BEQ-not-taken JSR $37d5, main body through the
// $3836 emitters, the 0x25f1 BCC page-cross into 0x2607, BCS-not-taken into 0x260f, tables cleared, tail JMP.
function setupDeep() {
  const m = makeMachine();
  m.ram[0x0801] = 0x01;   // & 3 = 1 -> BNE $2570; $8d = 1 (non-zero -> BEQ $2586 not taken)
  m.ram[0x00fd] = 0x00;   // $a4 = 2
  m.ram[0x0086] = 0x80;   // negative -> BMI $257f taken; later INC -> 0x81
  m.ram[0x0000] = 0x00;   // -> $8d = 0
  m.ram[0x00c8] = 0x01;   // ORA non-zero; CMP<0xa BCC $25d4; LDX=1 non-zero BEQ nt; CPX<2 -> BCC $2607
  m.ram[0x00c9] = 0x00;   // ORA source; LDA $c9 == 0 -> BEQ $25df taken (skip LDA #$1e)
  m.ram[0x00dc] = 0x10;   // positive -> BPL $25bf taken; and BMI $25b7 not taken
  m.ram[0x0c01] = 0x00;   // LSR A -> C clear -> BCS $25b7 not taken -> 0x260f
  m.ram[0x00ff] = 0x02;   // LDX $ff -> X = 2
  m.ram[0x21c0] = 0x33;   // LDA $21c0,Y (Y = 0) -> A
  m.ram[0x0c00] = 0x00;   // & 0x10 == 0 -> BEQ $2650 taken (skip JSR $2509)
  return m;
}

test("loc_2561: deep path clears the object tables and tail-JMPs loc_26b8; 241 T", () => {
  const m = setupDeep();
  loc_2561(m);

  assert.equal(m.ram[0x008d], 0x00, "$8d recomputed to 0 at 0x258c");
  assert.equal(m.ram[0x00c8], 0x00, "$c8 = 1 - 1 (single DEC at 0x260f on the BCC-taken branch)");
  assert.equal(m.ram[0x00a4], 0x02, "$a4 = 2");
  assert.equal(m.ram[0x1c03], 0xff, "$1c03 latched 0xff at 0x2613");
  assert.equal(m.ram[0x1c04], 0x00, "$1c04: 0xff then STA $1c02,X (X=2) overwrites with 0");
  assert.equal(m.ram[0x0089], 0x02, "$89 = X = $ff-value = 2");
  assert.equal(m.ram[0x00a5], 0x01, "$a5 = $a4 - 1");
  assert.equal(m.ram[0x0086], 0x81, "$86 incremented");
  assert.equal(m.ram[0x00b0], 0x33, "$b0 = $21c0,Y");
  assert.equal(m.ram[0x00b1], 0x33, "$b1 = $21c0,Y");
  assert.equal(m.ram[0x00fb], 0x00, "$fb cleared");
  assert.equal(m.ram[0x00ca], 0x00, "$ca cleared");
  assert.equal(m.cycles, 241, "241 T through the tail JMP");
  assert.equal(m.pc, 0x26b8, "PC at loc_26b8 entry (tail JMP)");
  assert.deepEqual(m.calls, [0x37d5, 0x37d5, 0x3836, 0x3836, 0x26a0, 0x21b3, 0x2872, 0x26b8],
    "the emitter calls, the two table setups, JSR $2872, and the tail JMP $26b8");
});

test("loc_2561 MUTATION: the 0x25f1 BCC page-cross (4T not 3T) is load-bearing", () => {
  const m = setupDeep();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2607 ? 3 : c); // only the 0x25f1 BCC steps to 0x2607 here
  loc_2561(m);
  assert.notEqual(m.cycles, 241, "dropping the taken-branch page-cross +1 blows the golden T-state total");
});
