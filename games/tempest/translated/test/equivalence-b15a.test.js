// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b15a (ROM 0xb15a-0xb1b3) -- stashes A/X, walks $37 from $014d up to $014e
// in +2 steps, dispatching jsr $df6c/$df4c/$df39 per pass, then jsr $ab17 and tail-jmp $df39. Delegates
// are opaque (the mock records the pushed return == jsraddr+2 and pops to balance S). No abs,x/abs,y
// load exists, so no page-cross edge -- only the abs RMW dec 0x016e (fixed 6). No POKEY/RNG read.
// Run: node --test games/tempest/translated/test/equivalence-b15a.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b15a } from "../loc_b15a.js";

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
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; (this.retAddrs ||= []).push(this.pull16()); } return undefined; },
  };
}

// Single pass: on the first iteration $37 == $014d so the cmp @b17c is equal -> bne NOT taken (path X,
// lda #0x00/clv/bvc). $37 += 2 reaches $014e (>=) -> bcc NOT taken -> exit -> jsr $ab17 -> tail-jmp $df39.
test("one pass, path X ($37 == $014d) -> exit", () => {
  const m = makeMachine(); m.regs.s = 0xfd;
  m.regs.a = 0x34; m.regs.x = 0xaa;
  m.ram[0x014d] = 0x10;             // -> $37 = 0x10
  m.ram[0x014e] = 0x11;             // 0x10 + 2 = 0x12 >= 0x11 -> exit after one pass
  m.ram[0x016e] = 0x05;
  loc_b15a(m);
  assert.deepEqual(m.calls, [0xdf6c, 0xdf4c, 0xdf39, 0xab17, 0xdf39]);
  assert.deepEqual(m.retAddrs, [0xb176, 0xb194, 0xb19b, 0xb1ae], "each jsr pushes jsraddr+2; the tail jmp pushes nothing");
  assert.equal(m.ram[0x57], 0x34, "A stashed to $57");
  assert.equal(m.ram[0x56], 0xaa, "X stashed to $56");
  assert.equal(m.ram[0x016e], 0x04, "dec 0x016e once (prologue)");
  assert.equal(m.ram[0x37], 0x12, "$37 walked to 0x12");
  assert.equal(m.regs.a, 0x3f, "final A = 0x3f (before tail-jmp)");
  assert.equal(m.regs.x, 0xf2, "final X = 0xf2");
  assert.equal(m.regs.y, 0x00, "Y = tay of A=0x00 (path X)");
  assert.equal(m.cycles, 120);
});

// Two passes. Iter1 is path X ($37==$014d). Iter2: $37=0x12 != $014d -> bne taken; ($37>>3)&7 = 2 != 7
// -> bne @b18b taken (path Y2) -> b18f with A=0x02. Then $37 -> 0x14 == $014e -> exit.
test("two passes, iter2 path Y2 (($37>>3)&7 != 7)", () => {
  const m = makeMachine(); m.regs.s = 0xfd;
  m.regs.a = 0x34; m.regs.x = 0xaa;
  m.ram[0x014d] = 0x10;             // $37 starts 0x10
  m.ram[0x014e] = 0x14;             // iter1: 0x12 < 0x14 loop; iter2: 0x14 >= 0x14 exit
  m.ram[0x016e] = 0x05;
  loc_b15a(m);
  assert.deepEqual(m.calls, [0xdf6c, 0xdf4c, 0xdf39, 0xdf6c, 0xdf4c, 0xdf39, 0xab17, 0xdf39]);
  assert.deepEqual(m.retAddrs, [0xb176, 0xb194, 0xb19b, 0xb176, 0xb194, 0xb19b, 0xb1ae]);
  assert.equal(m.ram[0x016e], 0x04, "dec 0x016e only in the prologue, not per pass");
  assert.equal(m.ram[0x37], 0x14, "$37 walked 0x10 -> 0x12 -> 0x14");
  assert.equal(m.regs.y, 0x02, "iter2 Y = ($37>>3)&7 = 0x02");
  assert.equal(m.regs.a, 0x3f);
  assert.equal(m.regs.x, 0xf2);
  assert.equal(m.cycles, 214);
});

// Two passes, iter2 exercises path Y1: (($37>>3)&7) == 7 -> bne @b18b NOT taken -> lda #0x03 -> Y=0x03.
test("two passes, iter2 path Y1 (($37>>3)&7 == 7 -> lda #0x03)", () => {
  const m = makeMachine(); m.regs.s = 0xfd;
  m.regs.a = 0x34; m.regs.x = 0xaa;
  m.ram[0x014d] = 0x36;             // $37 starts 0x36; iter2 $37=0x38 -> (0x38>>3)&7 = 7
  m.ram[0x014e] = 0x3a;             // iter1: 0x38 < 0x3a loop; iter2: 0x3a >= 0x3a exit
  m.ram[0x016e] = 0x05;
  loc_b15a(m);
  assert.deepEqual(m.calls, [0xdf6c, 0xdf4c, 0xdf39, 0xdf6c, 0xdf4c, 0xdf39, 0xab17, 0xdf39]);
  assert.deepEqual(m.retAddrs, [0xb176, 0xb194, 0xb19b, 0xb176, 0xb194, 0xb19b, 0xb1ae]);
  assert.equal(m.ram[0x37], 0x3a, "$37 walked 0x36 -> 0x38 -> 0x3a");
  assert.equal(m.regs.y, 0x03, "iter2 Y = 0x03 (the ==7 override)");
  assert.equal(m.regs.a, 0x3f);
  assert.equal(m.regs.x, 0xf2);
  assert.equal(m.cycles, 215);
});
