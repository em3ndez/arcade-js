// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ae4e (ROM 0xae4e) -- the do-while over 0x37 (0x15, step -3) that drives a
// chain of draw helpers and seeds $56-$58 from the $0706 table. Subroutine calls are recorded, not run.
// Run: node --test games/tempest/translated/test/equivalence-ae4e.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ae4e } from "../loc_ae4e.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    // A JSR pushes a return address that the (stubbed) subroutine's RTS would pop; model that pop
    // here so the guest stack stays balanced and the closing rts returns to the test's own pushed
    // frame, not a leaked JSR word. A bare tail-jmp/dispatch call (no preceding push16) leaves it be.
    call(target) { this.calls.push(target); if (this._retPushed) { this._retPushed = false; this.pull16(); } }, // record jsr target; do not execute the subroutine
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
  };
}

// 0x37 runs 0x15,0x12,...,0x03,0x00 (8 passes) then -3 (0xfd) exits bpl.
// The $0706 table is read at x = 0x37-at-pass-start; the LAST pass has x = 0, so $56/$57/$58 come
// from $0706/$0707/$0708.
function seedTable(m) {
  m.mem.write8(0x0706, 0xaa);
  m.mem.write8(0x0707, 0xbb);
  m.mem.write8(0x0708, 0xcc);
}

test("loc_ae4e: 8 passes, memory + call chain + rts (input 0x63 = 0x05, cmp never equal -> Y=7 path)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // rts -> 0x1234
  seedTable(m);
  m.regs.a = 0x05;  // -> sta 0x63

  loc_ae4e(m);

  assert.equal(m.mem.read8(0x63), 0x05, "0x63 = input A");
  assert.equal(m.mem.read8(0x2c), 0xd8, "0x28 - 8*0x0a = 0xd8 (binary sbc each pass)");
  assert.equal(m.mem.read8(0x61), 0x09, "0x01 + 8 inc = 0x09");
  assert.equal(m.mem.read8(0x37), 0xfd, "final 0x37 = 0 - 3 = 0xfd (exits bpl)");
  assert.equal(m.mem.read8(0x56), 0xaa, "last pass x=0 -> $0706");
  assert.equal(m.mem.read8(0x57), 0xbb, "last pass x=0 -> $0707");
  assert.equal(m.mem.read8(0x58), 0xcc, "last pass x=0 -> $0708");

  assert.equal(m.pc, 0x1234, "rts returns to pushed + 1");
  assert.equal(m.regs.x, 0x00, "X = ldx 0x37 (=0) on last pass");
  assert.equal(m.regs.y, 0x03, "Y = ldy #0x03 (last live-out before rts)");
  assert.equal(m.regs.a, 0x56, "A = lda #0x56 (calls are no-ops in the harness)");

  // 2 calls before the loop (ab14, b0dd), then 9 per pass x 8 = 74 total.
  assert.equal(m.calls.length, 74, "2 + 9*8 recorded jsr targets");
  assert.equal(m.calls[0], 0xab14, "first jsr");
  assert.equal(m.calls[1], 0xb0dd, "second jsr");
  assert.equal(m.calls[2], 0xab0d, "first in-loop jsr");
  assert.equal(m.calls[73], 0xdfb1, "last jsr (dfb1) of last pass");

  // Ground-truth total from the disasm: prologue 32 + 7 passes x 157 (bpl taken) + last pass 156
  // (bpl not taken) + rts 6 = 1293. (jsr=6, abs,x=4 no page cross since 0x0706+0x15=0x071b in-page.)
  assert.equal(m.cycles, 1293, "exact 6502 cycle total across the 8 passes");
});

test("loc_ae4e: input 0x63 = 0x06 exercises the cmp-equal (bne not-taken, Y=0) branch and still completes", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // rts -> 0x2001
  seedTable(m);
  m.regs.a = 0x06;  // equals 0x37 on the pass where 0x37 == 0x06 -> ldy #0x00 path

  loc_ae4e(m);

  assert.equal(m.mem.read8(0x37), 0xfd, "still 8 passes to exit");
  assert.equal(m.calls.length, 74, "call count unchanged by the branch (b0d1 always called)");
  assert.equal(m.pc, 0x2001, "rts returns to pushed + 1");
});
