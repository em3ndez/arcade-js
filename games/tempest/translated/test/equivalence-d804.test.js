// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_d804 (ROM 0xd804). Minimal 6502 harness: Regs + flat RAM + page-1 stack seam +
// a call recorder (subroutines are stubbed -- they push their target and leave regs untouched, matching
// centiped's tail-call test). Run: node --test games/tempest/translated/test/equivalence-d804.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_d804 } from "../loc_d804.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    // stubbed subroutine: record the target and, if a jsr just pushed a return, pop it (its rts).
    call(target) { this.calls.push(target); this.pc = target; if (this._retPushed) { this._retPushed = false; this.pull16(); } },
  };
}

test("loc_d804: jmp-d93f path (cmp equal, bpl not taken) -- exact call chain + cycles", () => {
  const m = makeMachine();
  m.regs.s = 0xff;
  m.ram[0x0158] = 1;   // -> $37 = 1, draw loop runs once
  m.ram[0x0200] = 0;   // P = 0&6 = 0 -> X = 0
  m.ram[0xd8b6] = 0;   // mask 0
  m.ram[0x4d] = 0x5a;  // A = 0x5a & 0 = 0 -> cmp 0 vs 0 = equal (Z set) -> bne NOT taken

  loc_d804(m);

  assert.deepEqual(m.calls, [
    0xd6bb, 0xaaa8, 0xdd0d, 0xdd41, 0xdf53, 0xdf75,
    0xdf39, 0xdf39, 0xadce, 0xdf39, 0xd93f,
  ], "four entry jsrs, df53/df75, loop df39, d837 df39, adce, d84d df39, then jmp d93f");
  assert.equal(m.pc, 0xd93f, "tail-jumps to loc_d93f");
  assert.equal(m.cycles, 153, "computed T for this single-loop bne/bpl-not-taken path");
});

test("loc_d804: main fall-through into loc_d8a9 (bne taken at d85b, beq taken at d87d)", () => {
  const m = makeMachine();
  m.regs.s = 0xff;
  m.ram[0x0158] = 1;
  m.ram[0x0200] = 0;   // X = 0
  m.ram[0xd8b6] = 0xff; // mask 0xff
  m.ram[0x4d] = 0x00;  // A = 0 & 0xff = 0 -> cmp 0 vs 0xff -> Z clear -> bne TAKEN -> d877
  m.ram[0x01ca] = 0x00; // $01ca & $01c6 = 0 -> beq TAKEN -> d886
  m.ram[0x01c6] = 0xff;

  loc_d804(m);

  assert.equal(m.pc, 0xd8a9, "runs off the end into loc_d8a9 (delegated call)");
  assert.equal(m.calls[m.calls.length - 1], 0xd8a9, "last call is the fall-through into loc_d8a9");
  assert.equal(m.regs.y, 0x32, "d8a5 ldy #0x32 is the last Y load before fall-through");
  assert.equal(m.regs.x, 0xf8, "d8a7 ldx #0xf8 is the last X load before fall-through");
  assert.ok(m.calls.includes(0xd8a9) && m.calls.indexOf(0xd8a9) < m.calls.length - 1,
    "d897 jsr d8a9 recorded in addition to the fall-through");
});

test("loc_d804: ora path (bne not taken, bpl taken, d864 bne taken) sets $01c9 |= 3", () => {
  const m = makeMachine();
  m.regs.s = 0xff;
  m.ram[0x0158] = 1;
  m.ram[0x0200] = 6;    // P = 6&6 = 6 -> X = 6>>1 = 3
  m.ram[0xd8b6 + 3] = 0x0f;
  m.ram[0x4d] = 0x0f;   // A = 0x0f & 0x0f = 0x0f -> cmp equal -> bne NOT taken
  m.ram[0x01ca] = 0x00; m.ram[0x01c6] = 0x00; // beq taken later
  m.ram[0x01c9] = 0x80;

  loc_d804(m);

  // dex dex: 3 -> 1 (N clear -> bpl taken); d864 bne: X=1 nonzero -> taken -> d86c jsr dded, ora $01c9
  assert.ok(m.calls.includes(0xdded), "d86c jsr 0xdded taken on the ora path");
  assert.equal(m.mem.read8(0x01c9), 0x83, "0x80 | 0x03 = 0x83 written to $01c9");
  assert.equal(m.pc, 0xd8a9, "still falls through into loc_d8a9");
});
