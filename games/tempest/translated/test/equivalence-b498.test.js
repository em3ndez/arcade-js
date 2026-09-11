// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b498 (ROM 0xb498-0xb569) -- vector display-list builder. Minimal 6502 harness
// (Regs + flat RAM + the page-1 stack seam + a call recorder); author-derived. External JSRs ($df4c,
// $c765, $df5f) and the tail JMP $df6a are opaque here (recorded, not run). The $37 index walks 0x3f->neg;
// entries in $0243,x that are 0 skip the per-object body. Run: node --test games/tempest/translated/test/equivalence-b498.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b498 } from "../loc_b498.js";

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

// Cost of one loop pass that finds $0243,x == 0 (bne not taken -> jmp $b549 -> dec $37 -> jmp $b4b0):
//   ldx $37(3) + lda $0243,x(4) + bne fall(2) + jmp $b549(3) + dec $37(5) + bmi fall(2) + jmp $b4b0(3)
const EMPTY_PASS = 3 + 4 + 2 + 3 + 5 + 2 + 3; // 22
// Final pass where dec $37 goes negative: bmi taken(3) exits, no jmp $b4b0.
const EMPTY_EXIT = 3 + 4 + 2 + 3 + 5 + 3;      // 20
// Preamble b498..b4ae.
const PREAMBLE = 2 + 3 + 2 + 6 + 2 + 6 + 2 + 3 + 2 + 3 + 2; // 33

test("loc_b498: all $0243,x == 0 -> body never runs, $37 walks 0x3f->neg, Y stays 0 so tail skips $df5f", () => {
  const m = makeMachine();
  m.regs.s = 0xff;
  m.mem.write8(0x74, 0x00); m.mem.write8(0x75, 0x04); // ($74) -> 0x0400
  m.mem.write8(0xb5, 0x00); // $b5 == 0 -> tail beq $b565 taken

  loc_b498(m);

  // preamble side effects
  assert.equal(m.mem.read8(0x9e), 0x0c, "$9e = 0x0c");
  assert.equal(m.mem.read8(0x56), 0x12, "$56 seeded 0x12");
  // $37 decremented to 0xff (the negative that ends the loop)
  assert.equal(m.mem.read8(0x37), 0xff, "$37 walked 0x3f down through 0 -> 0xff");
  // nothing written into the display list (Y untouched, body skipped)
  assert.equal(m.mem.read8(0x0400), 0x00, "no object bytes emitted");
  assert.equal(m.pc, 0xdf6a, "tail JMP $df6a");
  assert.deepEqual(m.calls, [0xdf4c, 0xc765, 0xdf6a], "two preamble JSRs then the tail jump; no $df5f flush");
  // 64 loop passes: 63 empty (read $37 = 0x3f..0x01) + 1 exit (read 0x00), then tail (16 T).
  const TAIL = 2 + 3 + 3 + 3 + 2 + 3; // tya + beq taken + lda $b5 + beq taken + lda #1 + jmp
  assert.equal(m.cycles, PREAMBLE + 63 * EMPTY_PASS + EMPTY_EXIT + TAIL, "golden T-state total");
  assert.equal(m.cycles, 1455, "= 33 + 63*22 + 20 + 16");
});

test("loc_b498: one active object at x=0x3f emits a 14-byte record at ($74),y then loops out", () => {
  const m = makeMachine();
  m.regs.s = 0xff;
  m.mem.write8(0x74, 0x00); m.mem.write8(0x75, 0x04); // ($74) -> 0x0400
  m.mem.write8(0x0282, 0x10); // $0243 + 0x3f -> A = 0x10 (< 0x50, so no dec $37 at b4be)
  m.mem.write8(0x0242, 0x00); // $0203 + 0x3f -> tax = 0
  m.mem.write8(0x038a, 0x30); // $038a,0
  m.mem.write8(0x037a, 0x05); // $037a,0
  m.mem.write8(0x036a, 0x40); // $036a,0
  m.mem.write8(0x035a, 0x07); // $035a,0
  m.mem.write8(0x68, 0x10);   // low subtrahend
  m.mem.write8(0x69, 0x02);   // high subtrahend
  m.mem.write8(0xb5, 0x00);   // tail beq $b565 taken

  loc_b498(m);

  // scratch cells computed in the body
  assert.equal(m.mem.read8(0x63), 0x20, "$63 = $038a - $68 = 0x30-0x10");
  assert.equal(m.mem.read8(0x64), 0x03, "$64 = $037a - $69 - !C = 0x05-0x02");
  assert.equal(m.mem.read8(0x61), 0x40, "$61 = $036a,x");
  assert.equal(m.mem.read8(0x62), 0x07, "$62 = $035a,x");

  // the 14-byte display record at 0x0400..0x040d
  assert.deepEqual(Array.from(m.ram.subarray(0x0400, 0x040e)), [
    0x10, // A & 0x3f
    0x71, // ((A rol*3) & 3) + 1) | 0x70
    0x20, // $63
    0x03, // $64 & 0x1f
    0x40, // $61
    0x07, // $62 & 0x1f
    0x00, 0x00, 0x00, // three zero bytes
    0xa0, // marker
    0xe0, // -$63  (0x00 - 0x20)
    0x1c, // (-$64) & 0x1f, borrow-in from the low negate
    0xc0, // -$61
    0x18, // (-$62) & 0x1f
  ], "emitted display-list record");

  assert.equal(m.pc, 0xdf6a, "tail JMP $df6a");
  assert.deepEqual(m.calls, [0xdf4c, 0xc765, 0xdf5f, 0xdf6a], "Y != 0 at tail -> $df5f flush before the jump");
  const BODY = 258; // one full per-object pass through b4b0..b54d (bcc taken at b4bc and b53d)
  const TAIL = 2 + 2 + 2 + 6 + 3 + 3 + 2 + 3; // tya + beq fall + dey + jsr + lda $b5 + beq taken + lda #1 + jmp
  assert.equal(m.cycles, PREAMBLE + BODY + 62 * EMPTY_PASS + EMPTY_EXIT + TAIL, "golden T-state total");
  assert.equal(m.cycles, 1698, "= 33 + 258 + 62*22 + 20 + 23");
});

test("loc_b498 MUTATION: a body that mis-emits the marker byte ($a0) is caught", () => {
  const m = makeMachine();
  m.regs.s = 0xff;
  m.mem.write8(0x74, 0x00); m.mem.write8(0x75, 0x04);
  m.mem.write8(0x0282, 0x10);
  m.mem.write8(0x0242, 0x00);
  m.mem.write8(0xb5, 0x00);
  loc_b498(m);
  // The 0xa0 marker at offset 9 is a fixed literal in the routine; assert it is present so a
  // mutation dropping it would fail.
  assert.equal(m.mem.read8(0x0409), 0xa0, "the $a0 marker literal is emitted");
});
