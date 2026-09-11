// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_dbf7 (ROM 0xdbf7-0xdce0) -- per-frame vector emit. Minimal 6502 harness
// (Regs + flat RAM + page-1 stack seam); m.call is stubbed to RECORD the target (no side effects), so
// the assertions check MY translation's control flow / memory writes / cycle budget given stubbed
// subroutines. Whole-machine boot-first state diff vs MAME is the integration check.
// Run: node --test games/tempest/translated/test/equivalence-dbf7.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_dbf7 } from "../loc_dbf7.js";

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
    call(addr) { this.calls.push(addr & 0xffff); },
  };
}

test("loc_dbf7: $2e==0 skips the first block, counter++, empty tables, tail-jmp to loc_df73", () => {
  const m = makeMachine();
  m.regs.s = 0xff;
  // $2e==0 -> beq skips the whole first block; leave $2f low so no 16-bit carry into $2f.
  m.mem.write8(0x2e, 0x00);
  m.mem.write8(0x2f, 0x00);
  // Force all conditional stores off: and-mask results zero.
  m.mem.write8(0x60d8, 0x00); // & 0x78 -> 0 -> beq $dc38 (skip $60c0)
  m.mem.write8(0x4e, 0x00);   // ==0 -> beq $dc47 (skip asl / $60c2)
  m.mem.write8(0x52, 0x00);   // & 0x10 -> 0 -> beq $dc7e (skip the $60e0/$4000 block)
  m.mem.write8(0x50, 0x00);
  // Both table walks stay empty ($7d,x and $78,x all zero, already 0).
  // Sentinels on cells that MUST NOT be written on this path.
  m.mem.write8(0x6095, 0xaa);
  m.mem.write8(0x608d, 0xaa);
  m.mem.write8(0x6096, 0xaa);
  // $78 is BOTH the setFF target (sta $78) AND loop2's table base (lda $78,x, x=4..0).
  // Keep it 0 so loop2 stays empty; the only write to $78 here is #0xff, still caught.
  m.mem.write8(0x78, 0x00);
  m.mem.write8(0x60c0, 0xaa);
  m.mem.write8(0x60c2, 0xaa);
  m.mem.write8(0x60e0, 0xaa);

  loc_dbf7(m);

  // First block skipped entirely.
  assert.equal(m.mem.read8(0x6095), 0xaa, "$6095 untouched (beq skipped first block)");
  assert.equal(m.mem.read8(0x608d), 0xaa, "$608d untouched");
  assert.equal(m.mem.read8(0x6096), 0xaa, "$6096 untouched");
  assert.equal(m.mem.read8(0x78), 0x00, "$78 untouched (no setFF path; stays 0 so loop2 empty)");
  assert.equal(m.mem.read8(0x60c0), 0xaa, "$60c0 untouched (beq $dc38)");
  assert.equal(m.mem.read8(0x60c2), 0xaa, "$60c2 untouched (beq $dc47)");
  assert.equal(m.mem.read8(0x60e0), 0xaa, "$60e0 untouched (beq $dc7e)");
  // Deterministic writes on this path.
  assert.equal(m.mem.read8(0x73), 0x00, "$73 = 0 (stx)");
  assert.equal(m.mem.read8(0x2e), 0x01, "$2e incremented 0 -> 1");
  assert.equal(m.mem.read8(0x2f), 0x00, "$2f unchanged (bne skipped the high inc)");
  assert.equal(m.mem.read8(0x60db), 0x00, "$60db = A (0)");
  assert.equal(m.mem.read8(0x4d), 0x00, "$4d = $60d8 & 0x78 = 0");
  assert.equal(m.mem.read8(0x60c1), 0x00, "$60c1 = X (0)");
  assert.equal(m.mem.read8(0x60c3), 0x00, "$60c3 = X (0)");
  assert.equal(m.mem.read8(0x37), 0xff, "$37 = 0xff after the last dec underflows");
  // Live-out registers at the tail jmp.
  assert.equal(m.regs.a, 0x00, "A = $dfe8[0] = 0");
  assert.equal(m.regs.x, 0x00, "X = $dfe4[0] = 0");
  assert.equal(m.regs.y, 0xc0, "Y = #0xc0");
  // Tail-call target and the recorded subroutine call sequence.
  assert.equal(m.pc, 0xdf73, "tail jmp -> loc_df73");
  assert.deepEqual(
    m.calls,
    [0xdd0d, 0xdd2b, 0xdd27, 0xdf39, 0xdf53, 0xdf75, 0xdf57, 0xdf57, 0xdf57, 0xdf57, 0xdf57, 0xdf75, 0xdf73],
    "no loc_dce6 (first block skipped); df57 x5 in loop2; ends with df75 then tail df73",
  );
  // Cycle budget: 99 (pre-loop1) + 143 (loop1 x12) + 21 + 169 (loop2 x5) + 26.
  assert.equal(m.cycles, 459, "total T-states on the empty-table path");
});

test("loc_dbf7: $2e!=0 runs the first block, cmp!=1 -> bne sets $78=0xff (setFF)", () => {
  const m = makeMachine();
  m.regs.s = 0xff;
  m.mem.write8(0x2e, 0x05); // nonzero -> enter first block
  m.mem.write8(0x2f, 0x07); // becomes A after jsr $dce6 (stub no-op) -> cmp #1 != 0 -> bne taken
  m.mem.write8(0x60d8, 0x00);
  m.mem.write8(0x4e, 0x00);
  m.mem.write8(0x52, 0x00);
  m.mem.write8(0x50, 0x00);

  loc_dbf7(m);

  // First block wrote the seeds from $2e/$2f.
  assert.equal(m.mem.read8(0x6095), 0x05, "$6095 = $2e");
  assert.equal(m.mem.read8(0x608d), 0x05, "$608d = $2e");
  assert.equal(m.mem.read8(0x6096), 0x07, "$6096 = $2f");
  // cmp #1 (A=7) -> bne $dc15 taken -> lda #0xff / sta $78.
  assert.equal(m.mem.read8(0x78), 0xff, "$78 = 0xff via the setFF path");
  // Counter advanced from 5.
  assert.equal(m.mem.read8(0x2e), 0x06, "$2e incremented 5 -> 6");
  // First recorded call is the first-block jsr $dce6.
  assert.equal(m.calls[0], 0xdce6, "first call is loc_dce6 (first block ran)");
  // Still tail-jmps to loc_df73.
  assert.equal(m.pc, 0xdf73, "tail jmp -> loc_df73");
  assert.equal(m.regs.y, 0xc0, "Y = #0xc0 at the tail");
});
