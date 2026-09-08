// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_231f (ROM 0x231f-0x23d9). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_231f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_231f } from "../loc_231f.js";

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

// Path: $94,X!=0 (BNE $2345, skip the reset block) -> prologue JSR $382d (via $00&2==0) ->
// $9a==1 so $8b==1 -> BEQ $23a2 skips the first loop -> second loop runs X=1..0x0b (11 iters),
// each with $f4==0 (BEQ $23b5) and $100a bit7 set (BPL not taken -> JSR $382d) -> epilogue -> RTS.
// 77 prologue + 11 iters (10 x 59 loop-back + 1 x 58 exit = 648) + 21 epilogue = 746 T.
test("loc_231f: uniform 11-iteration rebuild loop; 12 JSR $382d; 746 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  m.ram[0x0088] = 0x00; // X = 0
  m.ram[0x0094] = 0x01; // $94,X != 0 -> BNE $2345 taken (skip reset block)
  m.ram[0x009c] = 0x00; // read at 2349 -> $74
  m.ram[0x0000] = 0x00; // $00 & 2 == 0 -> BNE $2359 not taken -> TYA/JSR/TAY
  m.ram[0x009a] = 0x01; // -> $8b = 1 -> CMP #$01 == -> BEQ $23a2 taken (skip first loop)
  m.ram[0x00f0] = 0x00; // EOR $f0 leaves #$f8
  m.ram[0x00f4] = 0x00; // LDY $f4 == 0 -> BEQ $23b5 taken every iter
  m.ram[0x100a] = 0x80; // BIT bit7 set -> N set -> BPL not taken -> JSR every iter
  m.ram[0x00fe] = 0x00; // LDA $fe -> $97

  loc_231f(m);

  assert.equal(m.regs.x, 0x00, "X = $88 (reloaded in the epilogue)");
  assert.equal(m.regs.y, 0x00, "Y = 0 (TAY of A=0 in the prologue; second loop never rewrites Y)");
  assert.equal(m.regs.a, 0x00, "A = $fe = 0 (last epilogue load)");
  assert.equal(m.ram[0x0094], 0x0c, "STA $94,X (X=0) = #$0c");
  assert.equal(m.ram[0x0097], 0x00, "STA $97 = $fe");
  assert.equal(m.ram[0x0034], 0x03, "prologue STA $34 = #$03");
  assert.equal(m.ram[0x0035], 0x00, "loop STA $34,X (X>=1) = #$00");
  assert.equal(m.ram[0x0065], 0xf8, "loop STA $64,X (X=1) = #$f8");
  assert.equal(m.ram[0x0075], 0x02, "loop STA $74,X (X=1) = #$02");
  assert.equal(m.ram[0x0045], 0x02, "loop STA $44,X (X=1) = #$02");
  assert.equal(m.ram[0x0055], 0x80, "loop STA $54,X (X=1) = #$80");
  assert.equal(m.regs.fZ, true, "Z set from LDA $fe (0)");
  assert.deepEqual(m.calls, Array(12).fill(0x382d), "1 prologue JSR + 11 loop JSR = 12 calls to loc_382d");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.equal(m.cycles, 746, "746 T for this path");
});

test("loc_231f MUTATION: prologue JSR $382d mischarged 7T not 6T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x0088] = 0x00;
  m.ram[0x0094] = 0x01;
  m.ram[0x009c] = 0x00;
  m.ram[0x0000] = 0x00;
  m.ram[0x009a] = 0x01;
  m.ram[0x00f0] = 0x00;
  m.ram[0x00f4] = 0x00;
  m.ram[0x100a] = 0x80;
  m.ram[0x00fe] = 0x00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2358 ? 7 : c); // the prologue JSR return-addr step
  loc_231f(m);
  assert.notEqual(m.cycles, 746, "a mischarged cycle blows the golden T-state total");
});
