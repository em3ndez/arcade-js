// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_23da (ROM 0x23da-0x24f7). Minimal 6502 harness (Regs + flat RAM + the page-1
// stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration check.
// Run: node --test games/centiped/translated/test/loc_23da.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_23da } from "../loc_23da.js";

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

// $87 == 0 -> the guard RTS at 0x23de.
test("loc_23da: $87 == 0 returns immediately; 11 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  m.ram[0x0087] = 0x00;

  loc_23da(m);

  assert.deepEqual(m.calls, [], "no subroutine on the guard path");
  assert.equal(m.cycles, 3 + 2 + 6, "11 T");
  assert.deepEqual(m.pcSeq, [0x23dc, 0x23de, 0x1234], "LDA/BNE-nt/RTS");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
});

// $87 != 0, $db != 0 -> BNE $23de RTS.
test("loc_23da: busy $db short-circuits to RTS; 18 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x0087] = 0x05;
  m.ram[0x00db] = 0x01;

  loc_23da(m);

  assert.deepEqual(m.calls, [], "no subroutine");
  assert.equal(m.cycles, 3 + 3 + 3 + 3 + 6, "18 T");
  assert.deepEqual(m.pcSeq, [0x23dc, 0x23df, 0x23e1, 0x23de, 0x1234], "sequence");
  assert.equal(m.pc, 0x1234, "RTS");
});

// $87==1, $db==0, DEC->0, $d6 != 0 -> clear ($91),Y + $d6, JMP $2932.
test("loc_23da: nonzero $d6 clears the ($91),Y cell and $d6, then JMP $2932; 47 T", () => {
  const m = makeMachine();
  m.ram[0x0087] = 0x01;   // DEC -> 0 to fall past the guards
  m.ram[0x00db] = 0x00;
  m.ram[0x00d6] = 0x80;   // nonzero -> BEQ not taken
  m.ram[0x0091] = 0x00;
  m.ram[0x0092] = 0x40;   // ($91) = 0x4000
  m.ram[0x4000] = 0x99;   // will be overwritten with 0

  loc_23da(m);

  assert.equal(m.ram[0x4000], 0x00, "STA ($91),Y wrote A(=0)");
  assert.equal(m.ram[0x00d6], 0x00, "STA $d6 wrote 0");
  assert.deepEqual(m.calls, [0x37d5, 0x2932], "JSR $37d5 then JMP $2932");
  assert.equal(m.cycles, 3 + 3 + 3 + 2 + 5 + 2 + 3 + 2 + 2 + 6 + 2 + 2 + 6 + 3 + 3, "47 T");
  assert.deepEqual(
    m.pcSeq,
    [0x23dc, 0x23df, 0x23e1, 0x23e3, 0x23e5, 0x23e7, 0x23e9, 0x23eb, 0x23ed,
      0x23f0, 0x23f2, 0x23f3, 0x23f5, 0x23f7, 0x2932],
    "sequence",
  );
  assert.equal(m.pc, 0x2932, "JMP $2932 target");
});

// Deep respawn path all the way through block 0x24da, falling into loc_24f8.
test("loc_23da: respawn chain runs through $24da and falls into loc_24f8; 177 T; 5 calls", () => {
  const m = makeMachine();
  m.ram[0x0087] = 0x01;   // DEC -> 0 (fall past guards)
  m.ram[0x00db] = 0x00;
  m.ram[0x00d6] = 0x00;   // BEQ $23fa
  m.ram[0x0043] = 0x01;   // $43 & 0xaf != 0 -> BNE $2403
  m.ram[0x0086] = 0x00;   // BPL $241b
  m.ram[0x00a5] = 0x01;   // $a5|$a6 != 0 -> BNE $2467
  m.ram[0x0089] = 0x03;   // DEX -> 2 != 0 -> BNE $246f
  m.ram[0x0088] = 0x00;   // X = 0
  m.ram[0x00a4] = 0x01;   // $a4,X != 0 -> BNE $2499; also LDA $a1,X(X=3) source
  m.ram[0x00a7] = 0x05;   // $a4,X with X=3 != 0 -> BEQ $24f8 not taken
  m.ram[0x00ee] = 0xff;   // AND $ee
  // $ad, $c5 default 0 -> the $24c9..$24d1 sub-branch and the $c2,X read take defaults

  loc_23da(m);

  assert.equal(m.pc, 0x24f8, "falls into loc_24f8");
  assert.deepEqual(m.calls, [0x2932, 0x31d5, 0x37d5, 0x3836, 0x24f8], "call sequence + fall-through");
  assert.equal(m.ram[0x0088], 0x03, "STX $88 = EOR-swapped index");
  assert.equal(m.ram[0x00ee], 0x83, "$ee = (0x80 & $ee) | $88");
  assert.equal(m.ram[0x00c5], 0x40, "$c2,X |= 0x40 (X=3)");
  assert.equal(m.ram[0x00a0], 0x01, "$a0 = $a1,X");
  assert.equal(m.ram[0x0087], 0xa0, "$87 := 0xa0");
  assert.equal(m.ram[0x0043], 0xf9, "$43 := 0xf9");
  assert.equal(m.ram[0x0042], 0xf9, "$42 := 0xf9");
  assert.equal(m.ram[0x00d6], 0xf9, "$d6 := 0xf9");
  assert.equal(m.cycles, 177, "full-path T-state total");
});

test("loc_23da MUTATION: the entry LDA $87 mischarged 2T not 3T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x0087] = 0x00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x23dc ? 2 : c); // the LDA $87 step lands at 0x23dc
  loc_23da(m);
  assert.notEqual(m.cycles, 11, "a mischarged cycle blows the golden T-state total");
});
