// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ae1c (ROM 0xae1c-0xae4d) -- folds $60ca/$60da nibbles into $29/$011f,
// loads a=0xff (lda #0xff at ae4c) and falls through into loc_ae4e, a separately-registered routine
// (jmp leader from loc_adea). No return is pushed for ae4e: loc_ae1c tail-calls it and ae4e's own
// rts pops the caller's return. jsr targets are opaque (harness records the call). Author-derived 6502 harness.
// Run: node --test games/tempest/translated/test/equivalence-ae1c.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ae1c } from "../loc_ae1c.js";

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

test("loc_ae1c: nibble fold, then tail-call into loc_ae4e; 79 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // caller's return: consumed by loc_ae4e's rts, NOT by ae1c
  m.ram[0x60ca] = 0x5a; // seed for the $29 fold
  m.ram[0x60da] = 0x3c;

  loc_ae1c(m);

  // --- the nibble fold ---
  // $29: 0x5a -> lsr*4 = 0x05 -> ^0x5a = 0x5f; then (0x3c^0x5f)&0xf0 ^ 0x5f = 0x3f
  assert.equal(m.ram[0x29], 0x3f, "$29 final fold value");
  // $011f: tya(0x3c) asl*4 = 0xc0 -> ^ $29(0x3f) = 0xff
  assert.equal(m.ram[0x011f], 0xff, "$011f = high nibble folded with $29");

  // --- fall-through into loc_ae4e (ae4c: lda #0xff -> ae4e is a separate registered routine) ---
  assert.equal(m.regs.a, 0xff, "a = 0xff carried into loc_ae4e (its first store writes $63)");
  assert.equal(m.pc, 0xae4e, "ends at ae4e -- fell through, did NOT inline the ae4e loop");
  assert.deepEqual(m.calls, [0xa8b4, 0xaf26, 0xae4e], "prologue jsrs then tail-call to loc_ae4e");
  // No return pushed for ae4e: stack is back to its entry depth (0xfb after the caller push16).
  assert.equal(m.regs.s, 0xfb, "stack unchanged since entry -- ae4e's rts pops the caller return");

  assert.equal(m.cycles, 79, "ae1c..ae4c inclusive = 79 T (lda #0xff steps PC to ae4e)");
});

test("loc_ae1c: a different seed changes only the fold, not the tail-call", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);
  m.ram[0x60ca] = 0x00;
  m.ram[0x60da] = 0x00;

  loc_ae1c(m);

  // $29: 0 -> lsr*4 = 0 -> ^0 = 0; (0^0)&0xf0 ^ 0 = 0
  assert.equal(m.ram[0x29], 0x00, "zero seed folds to 0");
  assert.equal(m.ram[0x011f], 0x00, "zero seed -> $011f 0");
  assert.equal(m.regs.a, 0xff, "a = 0xff regardless of seed");
  assert.deepEqual(m.calls, [0xa8b4, 0xaf26, 0xae4e], "tail-call target unchanged by seed");
  assert.equal(m.cycles, 79, "all reads are absolute (no page-cross) -> total T seed-independent");
});
