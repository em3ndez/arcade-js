// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_21c7 (ROM 0x21c7-0x2201). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_21c7.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_21c7 } from "../loc_21c7.js";

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

// Longest path: $ab,X==0 (BNE fall) -> $fd/$a9,X compare C-set (BCC fall) -> LDY #$01 ->
// $100a bit2 set (BEQ fall) -> TYA/JSR $382d/TAY -> the $71/$61/$41/$a1/$b5 seed block -> RTS.
test("loc_21c7: compare/JSR-remap path stores Y=1, seeds the block; 84 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> pulled + 1 = 0x1234
  m.ram[0x0088] = 0x00; // X = 0
  m.ram[0x00ab] = 0x00; // $ab,X == 0 -> BNE $21db not taken
  m.ram[0x00fd] = 0x00; // (($fd & 0x40) | 0x10) = 0x10
  m.ram[0x00a9] = 0x10; // CMP $a9,X: 0x10 vs 0x10 -> C set -> BCC not taken -> LDY #$01
  m.ram[0x100a] = 0x04; // bit2 set -> BEQ $21e9 not taken -> TYA/JSR/TAY
  m.ram[0x00f0] = 0x00; // EOR $f0 leaves A = 0x60

  loc_21c7(m);

  assert.equal(m.regs.x, 0x00, "X = $88");
  assert.equal(m.regs.y, 0x01, "Y ends 1 (TAY from A=1 after the JSR remap no-op in harness)");
  assert.equal(m.regs.a, 0x00, "A ends 0 (last LDA #$00)");
  assert.equal(m.ram[0x0081], 0x01, "STY $81 = Y = 1");
  assert.equal(m.ram[0x0051], 0x01, "STY $51 = Y = 1");
  assert.equal(m.ram[0x0071], 0x60, "STA $71 = #$60 ^ $f0(0)");
  assert.equal(m.ram[0x0061], 0xff, "STA $61 = #$ff");
  assert.equal(m.ram[0x0041], 0xf8, "STA $41 = #$f8");
  assert.equal(m.ram[0x00a1], 0x60, "STA $a1 = #$60");
  assert.equal(m.ram[0x00b5], 0x00, "STA $b5 = #$00");
  assert.equal(m.regs.fZ, true, "Z set from LDA #$00");
  assert.equal(m.regs.fN, false, "N clear from LDA #$00");
  assert.deepEqual(m.calls, [0x382d], "single JSR to loc_382d");
  assert.equal(m.cycles, 84, "84 T for this path");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
});

test("loc_21c7 MUTATION: JSR $382d mischarged 7T not 6T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x0088] = 0x00;
  m.ram[0x00ab] = 0x00;
  m.ram[0x00fd] = 0x00;
  m.ram[0x00a9] = 0x10;
  m.ram[0x100a] = 0x04;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x21e8 ? 7 : c); // the JSR return-addr step
  loc_21c7(m);
  assert.notEqual(m.cycles, 84, "a mischarged cycle blows the golden T-state total");
});
