// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_341b (ROM 0x341b-0x346c). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_341b.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_341b } from "../loc_341b.js";

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

// PATH 1: ($d3 & 3) == 0 -> BEQ $343c; odd $d4 after INC -> LSR sets C -> BCS $346c (no loops). 32 T.
test("loc_341b PATH 1: Y==0 skips the arith block, odd frame exits before the loops; 32 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> pulled + 1 = 0x1234
  m.ram[0x00d3] = 0x00; // $d3 & 3 = 0 -> Y = 0 -> BEQ taken
  m.ram[0x00d4] = 0x00; // INC $d4 -> 0x01; LSR A -> C = 1 -> BCS to RTS

  loc_341b(m);

  assert.equal(m.regs.a, 0x00, "A = 0 (STA $c9 stored the LDA #$00... path skipped it; A from LSR of 0x01)");
  assert.equal(m.regs.x, 0x00, "X untouched on this path");
  assert.equal(m.regs.y, 0x00, "Y = $d3 & 3 = 0");
  assert.equal(m.ram[0x00c9], 0x00, "STA $c9 wrote A = 0");
  assert.equal(m.ram[0x00d4], 0x01, "INC $d4: 0x00 -> 0x01");
  assert.equal(m.regs.fC, true, "C set by LSR of odd $d4 (=0x01)");
  assert.equal(m.regs.fZ, true, "Z set: LSR of 0x01 -> A = 0");
  assert.equal(m.regs.fN, false, "N clear");
  assert.equal(m.cycles, 3 + 2 + 2 + 3 + 3 + 5 + 3 + 2 + 3 + 6, "32 T");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(
    m.pcSeq,
    [0x341d, 0x341f, 0x3420, 0x343c, 0x343e, 0x3440, 0x3442, 0x3443, 0x346c, 0x1234],
    "step sequence: LDA/AND/TAY/BEQ->343c/STA/INC/LDA/LSR/BCS->346c/RTS",
  );
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

// PATH 2: ($d3 & 3) != 0 -> arith block; even parity NO (0x02 -> LSR C=0) enters loops; a $c5..$c7 byte
// >= $10 gets -$10 with INY, so Y != 0 -> TYA/BNE exits before pass 2. 126 T.
test("loc_341b PATH 2: arith block + loop pass-1 wrap (Y!=0) exits via BNE; 126 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // -> 0x2001
  m.ram[0x00d3] = 0x01; // Y = 1 (nonzero)
  m.ram[0x00c9] = 0x00;
  m.ram[0x00cb] = 0x02;
  m.ram[0x00c8] = 0x10;
  m.ram[0x00d4] = 0x01; // INC -> 0x02, LSR C=0 -> enters loops
  m.ram[0x00c7] = 0x20; // >= 0x10 and != 0 -> -0x10, INY
  m.ram[0x00c6] = 0x00; // BEQ skip
  m.ram[0x00c5] = 0x05; // < 0x10 -> BCC skip

  loc_341b(m);

  assert.equal(m.ram[0x00cb], 0x01, "STA $cb wrote the carry-chained ADC result");
  assert.equal(m.ram[0x00c8], 0x12, "INC $c8 twice (CPY #2 with Y=1 -> C clear): 0x10 -> 0x12");
  assert.equal(m.ram[0x00c9], 0x00, "STA $c9 wrote A = 0 (the LDA #$00 fall-through)");
  assert.equal(m.ram[0x00d4], 0x02, "INC $d4: 0x01 -> 0x02");
  assert.equal(m.ram[0x00c7], 0x10, "loop pass-1: 0x20 - 0x10 = 0x10");
  assert.equal(m.ram[0x00c6], 0x00, "c6 untouched (was 0)");
  assert.equal(m.ram[0x00c5], 0x05, "c5 untouched (< 0x10)");
  assert.equal(m.regs.y, 0x01, "Y counted one pass-1 adjustment");
  assert.equal(m.regs.x, 0xff, "X = 0xff after DEX past 0 (BPL not taken)");
  assert.equal(m.regs.a, 0x01, "A = Y after TYA");
  assert.equal(m.cycles, 126, "126 T");
  assert.equal(m.pc, 0x2001, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

// PATH 3: Y==0 (BEQ) but even frame enters loops; pass-1 makes NO adjustment (Y stays 0) so pass-2 runs and
// a nonzero byte goes negative after -$11 -> BMI early-out to RTS. Exercises loop 0x345e.
test("loc_341b PATH 3: no pass-1 adjustment -> pass-2 (0x345e) runs, BMI early-out; 109 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000); // -> 0x3001
  m.ram[0x00d3] = 0x00; // Y = 0 -> BEQ $343c
  m.ram[0x00d4] = 0x01; // INC -> 0x02, LSR C=0 -> enters loops
  m.ram[0x00c7] = 0x00; // pass-1: BEQ skip; pass-2: BEQ skip
  m.ram[0x00c6] = 0x05; // pass-1: BCC skip (no INY); pass-2: -0x11 -> 0xf4 (N set) -> BMI exit
  m.ram[0x00c5] = 0x00; // pass-1: BEQ skip

  loc_341b(m);

  assert.equal(m.regs.y, 0x00, "no pass-1 adjustment: Y stayed 0 -> BNE not taken -> loop 0x345e runs");
  assert.equal(m.ram[0x00c6], 0xf4, "pass-2: 0x05 - 0x11 = 0xf4 (negative) -> BMI to RTS");
  assert.equal(m.ram[0x00c9], 0x00, "STA $c9 wrote A = 0");
  assert.equal(m.regs.fN, true, "N set by the 0xf4 result that tripped BMI");
  assert.equal(m.cycles, 109, "109 T");
  assert.equal(m.pc, 0x3001, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

// MUTATION: mischarge the BCS-taken step to 0x346c (3 T -> 4 T) on PATH 1; the golden T-state total goes red.
test("loc_341b MUTATION: a mischarged branch-taken cycle blows the 32 T total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x00d3] = 0x00;
  m.ram[0x00d4] = 0x00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x346c ? 4 : c); // BCS $346c taken lands at 0x346c
  loc_341b(m);
  assert.notEqual(m.cycles, 32, "a mischarged branch-taken cycle blows the golden T-state total");
});
