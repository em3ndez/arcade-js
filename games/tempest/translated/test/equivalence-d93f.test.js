// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_d93f (ROM 0xd93f) -- the RESET entry. Minimal 6502 harness (Regs + flat
// RAM + push/pull/step/call seam with call recording), author-derived. These tests exercise the
// NORMAL-BOOT path ($0c00 bit4 SET): RAM clear ($00-$07 + $20-$2f), hardware register init, the
// power-on delay loop, the three init JSRs, CLI, and the tail JMP $c7a0. The self-test path
// ($0c00 bit4 clear) ends in a hardware-driven non-terminating main loop and is validated by the
// whole-machine boot-first diff vs MAME, not here.
// Run: node --test games/tempest/translated/test/equivalence-d93f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_d93f } from "../loc_d93f.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    // Leaf calls just record + return (the lead runs the real callees in the whole-machine gate).
    call(addr) { this.calls.push(addr); },
  };
}

test("loc_d93f: normal boot -- RAM clear, hw init, delay, 3 JSRs, CLI, JMP $c7a0", () => {
  const m = makeMachine();
  m.mem.write8(0x0c00, 0x10); // self-test DIP OFF -> normal boot (beq $d988 not taken)
  // Dirty a cell in every relevant page to prove the exact clear set {$00-$07, $20-$2f}.
  m.mem.write8(0x0050, 0xaa); // page $00 -> cleared
  m.mem.write8(0x0700, 0xbb); // page $07 -> cleared
  m.mem.write8(0x2000, 0xcc); // page $20 -> cleared
  m.mem.write8(0x2f00, 0xdd); // page $2f -> cleared
  m.mem.write8(0x60c8, 0x55); // a POKEY reg the routine does NOT clear on normal path -> untouched

  loc_d93f(m);

  // Cleared pages
  assert.equal(m.mem.read8(0x0050), 0x00, "page $00 cleared");
  assert.equal(m.mem.read8(0x0700), 0x00, "page $07 cleared");
  assert.equal(m.mem.read8(0x2000), 0x00, "page $20 cleared");
  assert.equal(m.mem.read8(0x2f00), 0x00, "page $2f cleared");
  // Hardware register init: $60cf/$60df = 7, $60e0 = 0, $60c0 array = 0
  assert.equal(m.mem.read8(0x60cf), 0x07, "$60cf = 7 (stx)");
  assert.equal(m.mem.read8(0x60df), 0x07, "$60df = 7 (stx)");
  assert.equal(m.mem.read8(0x60e0), 0x00, "$60e0 cleared");
  assert.equal(m.mem.read8(0x60c0), 0x00, "$60c0 array cleared");
  assert.equal(m.mem.read8(0x60c8), 0x00, "$60c8 cleared by the $60c0,x loop (x reaches 8)");
  // $b4 = 0x10 (lda #$10 ; sta $b4 on the normal path)
  assert.equal(m.mem.read8(0xb4), 0x10, "$b4 = 0x10");
  // Init call sequence then tail JMP $c7a0
  assert.deepEqual(m.calls, [0xde11, 0xabac, 0xc16e, 0xc7a0], "de11, abac, c16e, then tail c7a0");
  assert.equal(m.pc, 0xc7a0, "final PC at the tail JMP target");
  // CLI cleared I; SEI set it earlier but CLI (d9a4) is the last flag op before the tail JMP
  assert.equal(m.regs.fI, false, "CLI cleared the interrupt-disable flag");
  // The power-on delay loop dominates the cycle count: $0100 and $0101 both start 0 (RAM cleared),
  // so each is decremented through a full 256-cycle wrap, 256 times over. Delay-only lower bound
  // (independently derived from CPU timing): 256 outer * (256*(4+6)+255*3+2 inner) + 256*6 + 255*3+2
  //  = 256*3327 + 1536 + 767 = 854015. Assert a floor below it that still fails on a mis-modeled loop.
  assert.ok(m.cycles > 854000, `delay loop modeled (cycles=${m.cycles} > 854000)`);
  assert.ok(m.cycles < 950000, `no runaway (cycles=${m.cycles} < 950000)`);
});

test("loc_d93f: RAM clear touches ONLY pages $00-$07 and $20-$2f", () => {
  const m = makeMachine();
  m.mem.write8(0x0c00, 0x10); // normal boot
  m.mem.write8(0x0800, 0x11); // page $08 -> NOT cleared
  m.mem.write8(0x1f00, 0x22); // page $1f -> NOT cleared
  m.mem.write8(0x3000, 0x33); // page $30 -> NOT cleared

  loc_d93f(m);

  assert.equal(m.mem.read8(0x0800), 0x11, "page $08 NOT cleared (cpx #8 -> ldx #$20 skips it)");
  assert.equal(m.mem.read8(0x1f00), 0x22, "page $1f NOT cleared");
  assert.equal(m.mem.read8(0x3000), 0x33, "page $30 NOT cleared (loop stops at cpx #$30)");
  assert.equal(m.pc, 0xc7a0, "still reaches the tail JMP");
});
