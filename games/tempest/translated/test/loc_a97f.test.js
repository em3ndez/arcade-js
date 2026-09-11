// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a97f (ROM 0xa97f-0xa9d6). Minimal 6502 harness (Regs + flat RAM + page-1
// stack seam), author-derived; the whole-machine boot-first diff vs MAME is the integration check.
// loc_a97f has no JSR; it either early-exits via the cross-routine BNE to the bare rts at a9fb, or
// falls through to loc_a9d7 (recorded as a call). The $38=0 setup makes the 6-pass a9a9 loop uniform.
// Run: node --test games/tempest/translated/test/loc_a97f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a97f } from "../loc_a97f.js";

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

test("loc_a97f: main path -- builds the vector list and falls through to loc_a9d7; 258 T", () => {
  const m = makeMachine();
  m.regs.y = 0x00; m.regs.a = 0x00;
  m.ram[0x00] = 0x03;       // $00 != 4 -> a9c5 BNE taken -> reach a9cb (no early exit)
  m.ram[0x3d] = 0x00;       // Y == $3d
  m.ram[0x05] = 0x00;       // bit $05 -> N clear
  m.ram[0xcdde] = 0x00;     // first x index = 0
  m.ram[0xcde0] = 0x02;     // loop x base = 2
  m.ram[0x0048] = 0x00;     // A=0 -> $38=0 (beq at a99f taken, dec skipped)
  m.ram[0x3284] = 0xaa;
  m.ram[0x3286] = 0xbb;
  m.ram[0xcde2] = 0x05;     // final x
  m.ram[0xa97d] = 0x40;     // $3b low

  loc_a97f(m);

  assert.equal(m.ram[0x2b], 0x00, "sty $2b = entry Y");
  assert.equal(m.ram[0x38], 0x00, "$38 stayed 0 (beq skipped the dec)");
  assert.equal(m.ram[0x2f60], 0x70, "a994 store: (A=0|0x70) at $2f60,x(0)");
  assert.equal(m.ram[0x2f62], 0xbb, "first loop store (x=2)");
  assert.equal(m.ram[0x2f6c], 0xbb, "last loop store (x=12)");
  assert.equal(m.ram[0x3b], 0x40, "$3b <- $a97d,y");
  assert.equal(m.ram[0x3c], 0x00, "$3c <- 0");
  assert.equal(m.regs.x, 0x05, "X <- $cde2,y at a9cb");
  assert.equal(m.regs.y, 0x00, "Y <- $2b at a9bf");
  assert.equal(m.regs.a, 0x00, "A <- #0 at a9d3");
  assert.equal(m.pc, 0xa9d7, "falls through to loc_a9d7");
  assert.deepEqual(m.calls, [0xa9d7], "delegates to loc_a9d7");
  assert.equal(m.cycles, 46 + 185 + 27, "prologue 46 + 6-pass loop 185 + epilogue 27 = 258");
});

test("loc_a97f: $00==4 & Y!=$3d -> cross-routine BNE to the bare rts at a9fb; 248 T", () => {
  const m = makeMachine();
  m.regs.y = 0x00; m.regs.a = 0x00; m.regs.s = 0xfd;
  m.push16(0x4321);         // rts -> pulled + 1 = 0x4322
  m.ram[0x00] = 0x04;       // $00 == 4 -> a9c5 BNE not taken
  m.ram[0x3d] = 0x07;       // Y(0) != $3d -> a987 BNE taken; a9c9 BNE taken (early exit)
  m.ram[0x05] = 0x00;
  m.ram[0xcdde] = 0x00;
  m.ram[0xcde0] = 0x02;
  m.ram[0x0048] = 0x00;     // $38 = 0
  m.ram[0x3284] = 0xaa;
  m.ram[0x3286] = 0xbb;

  loc_a97f(m);

  assert.equal(m.pc, 0x4322, "early rts returns to pushed + 1");
  assert.deepEqual(m.calls, [], "no fall-through, no JSR");
  assert.equal(m.ram[0x2f60], 0x70, "vector list still built before the exit");
  assert.equal(m.cycles, 41 + 185 + 22, "prologue 41 (a987 taken) + loop 185 + epilogue 22 = 248");
});
