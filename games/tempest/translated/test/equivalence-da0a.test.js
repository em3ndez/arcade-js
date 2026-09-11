// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_da0a (ROM 0xda0a) -- self-test ROM checksum + POKEY random-seed settle.
// Minimal 6502 harness (Regs + flat RAM + the page-1 stack seam + a call stub that records the
// tail-transfer target instead of recursing), author-derived; the whole-machine boot-first state
// diff vs MAME is the integration check. The checksum reads "ROM" from flat RAM (zeros unless seeded),
// and the settle loops naturally terminate because a flat-RAM cell reads back equal (stable) on the
// $60ca/$60da re-read. Run: node --test games/tempest/translated/test/equivalence-da0a.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_da0a } from "../loc_da0a.js";

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
    // record the tail-transfer target rather than executing the (non-terminating) self-test tail.
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_da0a: zero-checksum ROM -> no POKEY error tone; settles $60ca->$7a, $60da->$7b", () => {
  const m = makeMachine();
  // flat "ROM" is all zeros -> every bank checksum XORs to 0. Seed the two POKEY random regs.
  m.mem.write8(0x60ca, 0x11);
  m.mem.write8(0x60da, 0x22);

  loc_da0a(m);

  // ---- memory writes ----
  assert.equal(m.mem.read8(0x3b), 0x00, "$3b low pointer byte seeded 0");
  assert.equal(m.mem.read8(0x7d), 0x00, "bank-0 checksum ($7d) = seed X=0 XOR zeros = 0");
  // da18 `txa` seeds the accumulator with the bank index X before each bank's XOR, so over an
  // all-zero ROM every bank checksum settles to its own index: $7d=0, $7e=1, ... $88=11.
  assert.equal(m.mem.read8(0x7e), 0x01, "bank-1 checksum ($7e) = seed X=1 over zero ROM = 1");
  assert.equal(m.mem.read8(0x88), 0x0b, "last written bank checksum ($88, X=11) = seed 11 over zero ROM");
  assert.equal(m.mem.read8(0x89), 0x00, "$89 is never written (banks span $7d..$88) -> stays 0");
  assert.equal(m.mem.read8(0x60c4), 0x00, "no POKEY error tone written ($7d was 0)");
  assert.equal(m.mem.read8(0x60c5), 0x00, "no POKEY error tone written ($7d was 0)");
  assert.equal(m.mem.read8(0x7a), 0x11, "$60ca random reg settled into $7a");
  assert.equal(m.mem.read8(0x7b), 0x22, "$60da random reg settled into $7b");
  assert.equal(m.mem.read8(0x5000), 0x0b, "watchdog cell = A on the last kick (last bank X=11 accumulator = seed 11 over zero ROM)");

  // ---- register live-outs ----
  assert.equal(m.regs.a, 0x22, "A = last $60da read");
  assert.equal(m.regs.y, 0x00, "Y wrapped to 0 out of every inner checksum loop");
  assert.equal(m.regs.x, 0xff, "X = 0xff after the settle loop's dex underflows past 0");

  // ---- final PC + cycles ----
  assert.equal(m.pc, 0xda62, "control reached $da62 (the jsr $de11 tail)");
  assert.deepEqual(m.calls, [0xda62], "tail-transfers to $da62, not the self-test body");
  assert.ok(m.cycles > 200000 && m.cycles < 300000,
    `full 12-bank ROM checksum ran (~248k T-states), got ${m.cycles}`);
});

test("loc_da0a: nonzero bank-0 checksum -> sounds POKEY error tone ($60c4=0x40,$60c5=0xa4)", () => {
  const m = makeMachine();
  // one nonzero byte in bank 0 ($3000) makes the bank-0 checksum ($7d) = 0x40.
  m.mem.write8(0x3000, 0x40);
  m.mem.write8(0x60ca, 0x00);
  m.mem.write8(0x60da, 0x00);

  loc_da0a(m);

  assert.equal(m.mem.read8(0x7d), 0x40, "bank-0 checksum = 0x40 (single nonzero ROM byte)");
  assert.equal(m.mem.read8(0x60c4), 0x40, "error tone: $60c4 = 0x40");
  assert.equal(m.mem.read8(0x60c5), 0xa4, "error tone: $60c5 = 0xa4");
  assert.equal(m.mem.read8(0x7a), 0x00, "$60ca (0) settled into $7a");
  assert.equal(m.mem.read8(0x7b), 0x00, "$60da (0) settled into $7b");
  assert.equal(m.pc, 0xda62, "control reached $da62");
  assert.deepEqual(m.calls, [0xda62], "tail-transfers to $da62");
});
