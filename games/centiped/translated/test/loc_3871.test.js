// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_3871 (ROM 0x3871-0x3955), the IRQ-handler front block. Minimal 6502 harness
// (Regs + flat RAM + the page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME
// is the integration check. JSR $39ea/$382d/$2656 are opaque (harness records the call, does not run it), and
// both tested paths avoid the 0x38a8/0x38ae BCS-to-self watchdog spins.
// Run: node --test games/centiped/translated/test/loc_3871.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_3871 } from "../loc_3871.js";

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

test("loc_3871: $d2==0 skips the coin latch, 32V bit clear -> JMP $396d; pushes A/X/Y; 30 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.a = 0x11; m.regs.x = 0x22; m.regs.y = 0x33;
  m.ram[0x00d2] = 0x00; // BEQ taken -> skip STA $1002/$1003
  m.ram[0x0c00] = 0x00; // BIT: V (bit6) clear -> BVS not taken -> JMP $396d
  loc_3871(m);
  assert.equal(m.ram[0x01fd], 0x11, "PHA pushed A first");
  assert.equal(m.ram[0x01fc], 0x22, "PHA pushed X (via TXA) second");
  assert.equal(m.ram[0x01fb], 0x33, "PHA pushed Y (via TYA) third");
  assert.equal(m.regs.s, 0xfa, "S decremented by three pushes");
  assert.equal(m.regs.a, 0x00, "A = LDA $d2 = 0x00 (BIT leaves A)");
  assert.equal(m.regs.fV, false, "V clear from BIT $0c00");
  assert.equal(m.regs.fZ, true, "Z set: A & $0c00 == 0");
  assert.equal(m.ram[0x1002], 0x00, "coin-latch STA skipped");
  assert.equal(m.pc, 0x396d, "BVS not taken -> JMP $396d");
  assert.deepEqual(m.calls, [0x396d], "tail-jump to loc_396d");
  assert.equal(m.cycles, 3 + 2 + 3 + 2 + 3 + 2 + 3 + 3 + 4 + 2 + 3, "30 T");
});

test("loc_3871: coin latch + 32V beat, object-shadow refresh, no wrap -> JMP $3956; 211 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.a = 0x00; m.regs.x = 0x00; m.regs.y = 0x00;
  m.ram[0x00d2] = 0x05; // BEQ not taken -> writes coin latch
  m.ram[0x0c00] = 0x40; // bit6 set -> BVS taken; bit5 clear -> AND #$20 == 0 -> BNE not taken -> JMP $3956
  m.ram[0x008a] = 0x00; // INC -> 0x01; later LDA $8a = 0x01 (< 8, no spin)
  m.ram[0x0000] = 0x05; // INC -> 0x06 (nonzero) -> BNE $38a4 taken (skip the BCD timer)
  m.ram[0x00c8] = 0x10; // < 0x25, no spin; < 0x13 -> BCC $38b8 taken
  m.ram[0x0088] = 0x00; // LDX $88 -> X = 0
  m.ram[0x00c2] = 0x10; // $c2,0: bit7 clear, < 0x40 -> BMI nt, BCC $3905 taken
  m.ram[0x0043] = 0xab; // $34,x with X=0x0f -> $43: final A
  loc_3871(m);
  assert.equal(m.ram[0x1002], 0x10, "coin latch $1002 = 0x10");
  assert.equal(m.ram[0x1003], 0xaf, "coin latch $1003 = 0xaf");
  assert.equal(m.ram[0x008a], 0x01, "INC $8a");
  assert.equal(m.ram[0x0000], 0x06, "INC $00");
  assert.equal(m.regs.x, 0x0f, "LDX #$0f drives the object-shadow copy");
  assert.equal(m.regs.a, 0xab, "A = $34,x (X=0x0f) = 0xab");
  assert.equal(m.ram[0x07ef], 0x00, "STA $07e0,x (X=0x0f)");
  assert.equal(m.ram[0x07df], 0x00, "STA $07d0,x (X=0x0f)");
  assert.equal(m.pc, 0x3956, "JMP $3956 (fall path into loc_3956)");
  assert.deepEqual(m.calls, [0x39ea, 0x39ea, 0x382d, 0x3956], "two trackball readers, loc_382d, then loc_3956");
  assert.equal(
    m.cycles,
    3 + 2 + 3 + 2 + 3 + 2 + 3 + 2 +          // 3871..3879 (PHA..BEQ nt)
      2 + 4 + 2 + 4 +                        // 387b..3882 coin latch
      4 + 3 +                                // 3885 BIT, 3888 BVS taken
      5 + 5 + 3 +                            // 388d INC, 388f INC, 3891 BNE taken
      3 + 2 + 2 +                            // 38a4 LDA, 38a6 CMP, 38a8 BCS fall
      3 + 2 + 2 +                            // 38aa LDA, 38ac CMP, 38ae BCS fall
      2 + 3 +                                // 38b0 CMP, 38b2 BCC taken
      3 + 4 + 2 + 3 +                        // 38b8 LDX, 38ba LDA, 38bd CPX, 38bf BNE taken
      4 + 6 + 4 + 3 + 2 + 2 + 3 + 3 + 4 +    // 38c5..38d6 (LDY,JSR,STY,PHA,TYA,CLC,ADC,STA,PLA)
      4 + 6 + 4 + 2 + 6 + 2 + 3 + 3 + 4 +    // 38d6..38e8 (LDY,JSR,STY,TYA,JSR,CLC,ADC,STA,LDA$c2)
      2 + 2 + 4 +                            // 38ea BMI nt, 38ec CMP, 38ee BCC taken (+1 page-cross)
      2 + 4 + 5 + 4 + 2 + 2 + 2 + 4 + 3 +    // 3905..3916 (LDX,LDA,STA,LDA,LDY,CPX,BEQ nt,LDY,BPL taken)
      5 + 2 + 2 + 3 + 4 + 2 + 2 +            // 391b..3928 (STA,TYA,AND,STA,LDA$0c00,AND,BNE nt)
      4 + 3,                                 // 392a LDA $34,x, 392c JMP $3956
    "211 T",
  );
});

test("loc_3871 MUTATION: JMP $396d mischarged 4T not 3T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.ram[0x00d2] = 0x00;
  m.ram[0x0c00] = 0x00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x396d ? 4 : c); // the JMP step lands at 0x396d
  loc_3871(m);
  assert.notEqual(m.cycles, 30, "a mischarged JMP cycle blows the golden T-state total");
});
