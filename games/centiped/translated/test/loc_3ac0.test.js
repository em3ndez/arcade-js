// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_3ac0 (ROM 0x3ac0-0x3b04). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_3ac0.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_3ac0 } from "../loc_3ac0.js";

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

// Long path: $00&3=0 (BNE not taken), $f9=5 positive (BMI not taken), $fa=4 -> LSR clears C (BCC 3ade
// taken). SEI region scans $0178,X from X=5 with A=0: $017d/$017c match (Z) so BNE falls through and DEX;
// at X=3 $017b=0x99 mismatches -> BNE 3aee taken -> store $1603 + INC $fa + RTS.
test("loc_3ac0: SEI scan finds a mismatch at X=3 -> 0x3aee tail; 110 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x0b00); // RTS -> 0x0b01
  m.ram[0x0000] = 0x00; // $00 & 3 == 0
  m.ram[0x00f9] = 0x05; // X seed, positive
  m.ram[0x00fa] = 0x04; // LSR -> 0x02, C = 0
  m.ram[0x017d] = 0x00; // X=5 matches A=0
  m.ram[0x017c] = 0x00; // X=4 matches A=0
  m.ram[0x017b] = 0x99; // X=3 mismatch -> exit to 3aee

  loc_3ac0(m);

  const pre = 3 + 2 + 2 + 4 + 3 + 2 + 5 + 3 + 2;     // 26 (3ac0..3ade SEI)
  const iterMatch = 6 + 4 + 2 + 2 + 3;               // 17 (JSR/CMP/BNE-fall/DEX/BPL-taken)
  const iterExit = 6 + 4 + 3;                        // 13 (JSR/CMP/BNE-taken)
  const tail = 2 + 3 + 2 + 4 + 4 + 5 + 2 + 4 + 5 + 6; // 37 (3aee..RTS)
  assert.equal(m.cycles, pre + iterMatch + iterMatch + iterExit + tail, "110 T");

  assert.equal(m.ram[0x00fa], 0x03, "LSR $fa (0x04->0x02) then INC $fa -> 0x03");
  assert.equal(m.ram[0x00f9], 0x03, "STX $f9 stored the mismatch index X=3");
  assert.equal(m.ram[0x1603], 0x99, "STA $1600,X wrote $017b's value at X=3");
  assert.equal(m.ram[0x1680], 0x0e, "last STA $1680 = 0x0e");
  assert.equal(m.regs.a, 0x0e, "A = LDA #$0e");
  assert.equal(m.regs.x, 0x03, "X = mismatch index");
  assert.equal(m.regs.y, 0x00, "Y untouched");
  assert.equal(m.regs.fC, false, "last CMP (0 vs 0x99) clears C");
  assert.equal(m.regs.fZ, false, "INC $fa -> 0x03 nonzero");
  assert.equal(m.regs.fN, false, "0x03 bit7 clear");
  assert.deepEqual(m.calls, [0x3aa7, 0x3aa7, 0x3aa7], "JSR 3aa7 once per scan pass (X=5,4,3)");
  assert.equal(m.pc, 0x0b01, "RTS returns to pushed + 1");
});

test("loc_3ac0: $00&3 != 0 -> BNE 3ac4 taken -> 3add RTS; 14 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x0c00); // RTS -> 0x0c01
  m.ram[0x0000] = 0x01; // & 3 = 1 -> BNE taken

  loc_3ac0(m);

  assert.equal(m.cycles, 3 + 2 + 3 + 6, "14 T (LDA/AND/BNE-taken/RTS)");
  assert.equal(m.regs.a, 0x01, "A = $00 & 3");
  assert.deepEqual(m.calls, [], "short path makes no call");
  assert.equal(m.pc, 0x0c01, "RTS returns to pushed + 1");
});

test("loc_3ac0 MUTATION: mischarging the 0x3ac2 LDA $00 step blows the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x0c00);
  m.ram[0x0000] = 0x01;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3ac2 ? 4 : c); // the LDA $00 step lands at 0x3ac2
  loc_3ac0(m);
  assert.notEqual(m.cycles, 14, "a mischarged cycle blows the golden T-state total");
});
