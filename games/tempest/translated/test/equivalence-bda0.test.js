// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_bda0 (ROM 0xbda0-0xbfb4). Minimal 6502 harness (Regs + flat RAM +
// page-1 stack seam + call recorder), author-derived. Covers (1) the $5b>=0 && $57<$5f early-out
// RTS path (cycle-exact) and (2) a full main-body pass with one record-loop iteration: external
// JSRs stubbed to no-ops, deltas zeroed so the x5 spread math collapses, giving a hand-computed
// ($74),y record + the JSR/JMP call sequence and the df5f tail-call target.
// Run: node --test games/tempest/translated/test/equivalence-bda0.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_bda0 } from "../loc_bda0.js";

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
    // external routines are stubbed: record the target, leave state untouched.
    call(target) { this.calls.push(target); },
  };
}

test("loc_bda0: $5b>=0 && $57<$5f -> setup writes then RTS (cycle-exact)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> pulled + 1 = 0x1234
  m.regs.a = 0x00;
  m.regs.y = 0x00;

  m.ram[0x03ce] = 0xaa; // -> $56
  m.ram[0x03de] = 0xbb; // -> $58
  m.ram[0x03cf] = 0xcc; // -> $2e (x = y+1 = 1)
  m.ram[0x03df] = 0xdd; // -> $30
  m.ram[0x57] = 0x10;   // -> $2f, and the cmp operand
  m.ram[0x5b] = 0x00;   // positive -> bmi not taken
  m.ram[0x5f] = 0x20;   // $57(0x10) < 0x20 -> bcs not taken -> rts

  loc_bda0(m);

  assert.equal(m.ram[0x36], 0x00, "$36 = A");
  assert.equal(m.ram[0x56], 0xaa, "$56 = $03ce,y");
  assert.equal(m.ram[0x58], 0xbb, "$58 = $03de,y");
  assert.equal(m.ram[0x2f], 0x10, "$2f = $57");
  assert.equal(m.ram[0x2e], 0xcc, "$2e = $03ce,x (x=1)");
  assert.equal(m.ram[0x30], 0xdd, "$30 = $03de,x (x=1)");
  assert.equal(m.ram[0x59], 0x00, "$59 = 0");
  assert.equal(m.ram[0x5a], 0x04, "$5a = 4");
  assert.equal(m.regs.y, 0x00, "Y reloaded from $36");
  assert.deepEqual(m.calls, [], "early-out makes no calls");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.equal(m.cycles, 79, "cycle-exact early-out path");
});

test("loc_bda0: main body, one record-loop iteration -> tail-call $df5f", () => {
  const m = makeMachine();
  m.regs.s = 0xff;
  m.regs.a = 0x00;
  m.regs.y = 0x00;

  // entry table reads (y=0, x=1)
  m.ram[0x03cf] = 0x41; // -> $2e -> $56
  m.ram[0x03df] = 0x42; // -> $30 -> $58
  m.ram[0x57] = 0x12;   // -> $2f -> $57
  m.ram[0x5b] = 0x80;   // negative -> bmi taken -> main body

  m.ram[0xbfb6] = 0x01; // $99 loop count = 1
  m.ram[0xbfc4] = 0x00; // $38 table index = 0
  m.ram[0xbfd3] = 0x01; // == 1 -> $73 = 0xc0 (bne-not-taken branch)
  m.ram[0xbfd2] = 0x00; // packed index byte -> x=0, y=0

  // deltas zeroed so the spread math collapses to 0 ($79 = $89 = 0)
  m.ram[0x61] = 0x10; m.ram[0x6a] = 0x10; // $79 low = 0
  m.ram[0x62] = 0x00; m.ram[0x6b] = 0x00; // $79 high = 0
  m.ram[0x63] = 0x20; m.ram[0x6c] = 0x20; // $89 low = 0
  m.ram[0x64] = 0x00; m.ram[0x6d] = 0x00; // $89 high = 0

  // projection base cells (index 0; not overwritten by the math block)
  m.ram[0x78] = 0x30; // x-component low base
  m.ram[0x80] = 0x00; // x-component high base
  m.ram[0x88] = 0x05; // y-component low base
  m.ram[0x90] = 0x00; // y-component high base

  // record destination pointer $74/$75 -> 0x0500
  m.ram[0x74] = 0x00; m.ram[0x75] = 0x05;

  loc_bda0(m);

  // $56/$57/$58 reloaded from $2e/$2f/$30
  assert.equal(m.ram[0x56], 0x41, "$56 <- $2e");
  assert.equal(m.ram[0x57], 0x12, "$57 <- $2f");
  assert.equal(m.ram[0x58], 0x42, "$58 <- $30");

  assert.equal(m.ram[0x79], 0x00, "$79 delta collapsed to 0");
  assert.equal(m.ram[0x89], 0x00, "$89 delta collapsed to 0");
  assert.equal(m.ram[0x73], 0xc0, "$73 = 0xc0 (table hi byte == 1)");
  assert.equal(m.ram[0x2d], 0x00, "$2d = table lo byte");
  assert.equal(m.ram[0x38], 0x02, "$38 advanced by 2");
  assert.equal(m.ram[0x99], 0x00, "$99 decremented to 0 (loop exits)");
  assert.equal(m.ram[0xa9], 0x04, "$a9 = 4 (one 4-byte record)");

  // the emitted 4-byte record at ($74),y = 0x0500..0x0503
  assert.equal(m.ram[0x0500], 0x35, "rec[0] = $63 = 0x05 + 0x30");
  assert.equal(m.ram[0x0501], 0x00, "rec[1] = $64 & 0x1f");
  assert.equal(m.ram[0x0502], 0x2b, "rec[2] = $61 = 0x30 - 0x05");
  assert.equal(m.ram[0x0503], 0xc0, "rec[3] = ($62 & 0x1f) | $73");

  assert.deepEqual(
    m.calls,
    [0xdf4c, 0xc098, 0xc765, 0xc098, 0xdf6c, 0xdf5f],
    "JSR sequence then the df5f tail-jump",
  );
  assert.equal(m.pc, 0xdf5f, "tail-jump lands at $df5f");
});

test("loc_bda0: $5b<0 forces the main body even when $57<$5f", () => {
  const m = makeMachine();
  m.regs.s = 0xff;
  m.regs.a = 0x00;
  m.regs.y = 0x00;
  m.ram[0x5b] = 0x80; // negative -> bmi taken regardless of the $57/$5f compare
  m.ram[0x57] = 0x00;
  m.ram[0x5f] = 0xff;
  m.ram[0xbfb6] = 0x01; // one loop iteration
  m.ram[0xbfc4] = 0x00;
  m.ram[0xbfd2] = 0x00;
  m.ram[0x74] = 0x00; m.ram[0x75] = 0x05;

  loc_bda0(m);

  assert.equal(m.pc, 0xdf5f, "reached the tail-call, not the early RTS");
  assert.ok(m.calls.length > 0, "main body issued the external calls");
});
