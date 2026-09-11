// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_90c4 (ROM 0x90c4-0x91b4). Minimal 6502 harness (Regs + flat RAM + page-1 stack
// seam); JSRs opaque (recorded, return balanced). Exercises the 0x91fe scan loop, the $071d y-adjust
// block, the decimal $04 countdown, and the $0200/$3d reseed block. Whole-machine diff vs MAME is the check.
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_90c4 } from "../loc_90c4.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [], _retPushed: false,
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

// Shared bottom half (0x90ff onward) inputs, common to both paths below: $05 negative -> the 0x9129 setup
// block runs (0x0605 = 0x14) so the decimal countdown is skipped, then $4e = 0 routes BEQ 0x91ae (no reseed).
function seedBottom(m) {
  m.ram[0x05] = 0x80; // negative: BPL not taken at 0x9101 AND 0x9127 (runs 0x9129 block)
  m.ram[0x3f] = 0x00; // X = 0 -> BEQ 0x9111 (skip JSR 0x92b2)
  m.ram[0x4e] = 0x00; // AND 0x4e == 0 -> BEQ 0x91ae (skip reseed)
}

test("loc_90c4: scan exits first compare, top branches skip; reinit + 0x9129 block; 189 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x4000);
  m.ram[0x0126] = 0xff;       // A large -> first CMP 0x91fe,x (=0) carry set -> BCC not taken (1 iteration)
  m.ram[0x016a] = 0x00;       // AND 0x04 == 0 -> BEQ 0x90ea (skip y-adjust)
  m.ram[0x09] = 0x00;         // AND 0x43 == 0, CMP 0x40 -> BNE 0x90f4 taken (y stays 4)
  seedBottom(m);

  loc_90c4(m);

  assert.equal(m.mem.read8(0x0127), 0x1b, "clamp: X (0x1b) >= $29 -> stored 0x1b");
  assert.equal(m.mem.read8(0x0126), 0x00, "$05 negative cleared $0126");
  assert.equal(m.mem.read8(0x0605), 0x13, "$0605 = 0x14 (0x9129 block) then DEC -> 0x13");
  assert.equal(m.mem.read8(0x04), 0x10, "$04 = 0x10 (lda #0x10 after 0x9129 block)");
  assert.equal(m.mem.read8(0x00), 0x16, "$00 = 0x16 from the 0x9129 block");
  assert.equal(m.mem.read8(0x0111), 0xff, "$0111 = 0xff from the 0x9129 block");
  assert.equal(m.mem.read8(0x4e), 0x00, "$4e stays 0");
  assert.deepEqual(m.calls, [0xc196, 0x92ad, 0xb0ab], "0x9129-block JSR then 0x9146, 0x9169");
  assert.equal(m.pc, 0x4001, "RTS -> pushed + 1");
  assert.equal(m.cycles, 189, "49 (scan+clamp, 1 iter, page-crossing CMP) + 140 (reinit, 0x9129 block, countdown skipped)");
});

test("loc_90c4: scan loops twice, y-adjust runs, $29 clamp raises X; same bottom; 222 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x4100);
  m.ram[0x0126] = 0x10;                 // A = 0x10
  m.ram[0x91fe + 0x1b] = 0x20;          // CMP (x=0x1b): 0x10 < 0x20 -> BCC taken (loop)
  m.ram[0x91fe + 0x1a] = 0x05;          // CMP (x=0x1a): 0x10 >= 0x05 -> exit, X = 0x1a
  m.ram[0x016a] = 0x04;                 // AND 0x04 != 0 -> BEQ not taken (y-adjust runs)
  m.ram[0x071d] = 0x60;                 // >=0x30 (iny), >=0x50 (iny), <0x70 (stop) -> Y = 6
  m.ram[0x09] = 0x40;                   // AND 0x43 == 0x40, CMP 0x40 equal -> BNE not taken -> ldy #0x1b
  seedBottom(m);

  loc_90c4(m);

  assert.equal(m.mem.read8(0x29), 0x1b, "$29 = Y = 0x1b (from ldy #0x1b)");
  assert.equal(m.mem.read8(0x0127), 0x1b, "X (0x1a) < $29 -> ldx $29 -> stored 0x1b");
  assert.equal(m.mem.read8(0x0126), 0x00, "$05 negative cleared $0126");
  assert.equal(m.mem.read8(0x0605), 0x13, "0x14 then DEC -> 0x13");
  assert.equal(m.mem.read8(0x04), 0x10, "$04 = 0x10");
  assert.deepEqual(m.calls, [0xc196, 0x92ad, 0xb0ab], "same bottom-half call sequence");
  assert.equal(m.pc, 0x4101, "RTS -> pushed + 1");
  assert.equal(m.cycles, 222, "82 (2-iter scan + y-adjust + clamp) + 140 (shared bottom)");
});
