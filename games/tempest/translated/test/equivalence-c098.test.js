// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c098 (ROM 0xc098) -- signed dx/dy delta setup + two math-box waits and
// 16-bit saturating add/subtract of the $61-$64 / $66-$69 pairs. Minimal 6502 harness (Regs + flat
// RAM + the page-1 stack seam), author-derived. $6040 is loaded bit7-clear so both spin loops exit
// on the first read. Run: node --test games/tempest/translated/test/equivalence-c098.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c098 } from "../loc_c098.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
  };
}

// Scenario A: dy>=0 (add path into $63/$64, no clamp), dx sign 0xff (subtract path into $61/$62,
// no clamp). Positive-A high byte -> bpl taken. Exits via the c16d rts. Full cycle count asserted.
test("loc_c098: add-then-subtract path, no clamps, exits c16d rts (197 T)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // rts -> 0x2001

  m.mem.write8(0x57, 0x50); m.mem.write8(0x5f, 0x10);
  m.mem.write8(0x5b, 0x00);
  m.mem.write8(0x58, 0x30); m.mem.write8(0x60, 0x10); // dx: 0x58>=0x60 -> bcc not taken
  m.mem.write8(0x56, 0x08); m.mem.write8(0x5e, 0x20); // dy: 0x56<0x5e -> bcc taken
  m.mem.write8(0x6040, 0x00); // spin loops exit immediately
  m.mem.write8(0x6060, 0x34); m.mem.write8(0x6070, 0x12); // math-box result
  m.mem.write8(0x68, 0x02); m.mem.write8(0x69, 0x01); // add pair for $63/$64
  m.mem.write8(0x66, 0x40); m.mem.write8(0x67, 0x00); // sub pair for $61/$62

  loc_c098(m);

  assert.equal(m.mem.read8(0x6095), 0x40, "0x50-0x10 = 0x40");
  assert.equal(m.mem.read8(0x6096), 0x00, "high byte 0, bpl taken");
  assert.equal(m.mem.read8(0x33), 0x00, "dx sign 0 (0x58>=0x60)");
  assert.equal(m.mem.read8(0x34), 0xff, "dy sign 0xff (0x56<0x5e)");
  assert.equal(m.mem.read8(0x32), 0x18, "|dy| = 0x20-0x08");
  assert.equal(m.mem.read8(0x63), 0x36, "0x34 + 0x02 (add path low)");
  assert.equal(m.mem.read8(0x64), 0x13, "0x12 + 0x01 (add path high, no clamp)");
  assert.equal(m.mem.read8(0x61), 0x0c, "0x40 - 0x34 (sub path low)");
  assert.equal(m.mem.read8(0x62), 0xee, "0x00 - 0x12 (sub path high, no clamp)");
  assert.equal(m.pc, 0x2001, "rts returns to pushed + 1");
  assert.equal(m.cycles, 197, "hand-summed T-states for this path");
});

// Scenario B: negative high byte -> bpl NOT taken (forces $6095=1, $6096=0); dx bcc taken; dy bcc
// not taken; dy sign 0xff -> subtract path with underflow clamp ($63/$64 = 0x00/0x80); dx sign 0
// -> add path with overflow clamp ($61/$62 = 0xff/0x7f). Exits via the c157 rts.
test("loc_c098: bpl-not-taken + both clamps, exits c157 rts", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000); // rts -> 0x3001

  m.mem.write8(0x57, 0x10); m.mem.write8(0x5f, 0x50); // 0x10-0x50 borrow -> high byte negative
  m.mem.write8(0x5b, 0x00);
  m.mem.write8(0x58, 0x10); m.mem.write8(0x60, 0x30); // dx: 0x58<0x60 -> bcc taken -> sign 0xff
  m.mem.write8(0x56, 0x40); m.mem.write8(0x5e, 0x10); // dy: 0x56>=0x5e -> bcc not taken -> sign 0
  m.mem.write8(0x6040, 0x00);
  m.mem.write8(0x6060, 0x00); m.mem.write8(0x6070, 0x80); // math-box result (high = 0x80)
  m.mem.write8(0x68, 0x00); m.mem.write8(0x69, 0x00); // sub pair: 0x0000 - 0x8000 -> V set clamp
  m.mem.write8(0x66, 0x00); m.mem.write8(0x67, 0x80); // add pair: 0x8000 + 0x8000 -> V set clamp

  loc_c098(m);

  assert.equal(m.mem.read8(0x6095), 0x01, "bpl not taken forces 0x6095=1");
  assert.equal(m.mem.read8(0x6096), 0x00, "bpl not taken forces 0x6096=0");
  assert.equal(m.mem.read8(0x33), 0xff, "dx sign 0xff (bcc taken)");
  assert.equal(m.mem.read8(0x34), 0x00, "dy sign 0 (bcc not taken)");
  assert.equal(m.mem.read8(0x32), 0x30, "|dy| = 0x40-0x10");
  assert.equal(m.mem.read8(0x63), 0x00, "subtract underflow clamp low = 0x00");
  assert.equal(m.mem.read8(0x64), 0x80, "subtract underflow clamp high = 0x80");
  assert.equal(m.mem.read8(0x61), 0xff, "add overflow clamp low = 0xff");
  assert.equal(m.mem.read8(0x62), 0x7f, "add overflow clamp high = 0x7f");
  assert.equal(m.pc, 0x3001, "rts returns to pushed + 1");
});

// Spin-loop fidelity: $6040 bit7 set for the first 2 reads then clear -> loop 1 re-reads and spins
// twice before exiting, charging bit(4)+bmi-taken(3) per spin. Proves the wait loop actually loops.
test("loc_c098: $6040 spin loop re-reads until bit7 clears", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x4000);
  // Minimal delta setup (values irrelevant to the loop assertion).
  m.mem.write8(0x57, 0x00); m.mem.write8(0x5f, 0x00); m.mem.write8(0x5b, 0x00);
  m.mem.write8(0x58, 0x00); m.mem.write8(0x60, 0x00);
  m.mem.write8(0x56, 0x00); m.mem.write8(0x5e, 0x00);

  // $6040 read returns bit7-set for the first 2 reads, then bit7-clear forever.
  let reads = 0;
  const ram = m.ram;
  m.mem.read8 = (a) => {
    if ((a & 0xffff) === 0x6040) { reads += 1; return reads <= 2 ? 0x80 : 0x00; }
    return ram[a & 0xffff];
  };

  const before = m.cycles;
  loc_c098(m);

  // Loop 1: reads 1,2 = 0x80 (two spins), read 3 = 0x00 (exit) -> 3 reads. Loop 2: read 4 = 0x00
  // (exit) -> 1 read. Total 4 reads of $6040. The two extra spins each charge bit(4)+bmi-taken(3).
  assert.equal(reads, 4, "loop 1 re-reads twice before exiting; loop 2 exits immediately");
  assert.ok(m.cycles - before > 0, "loop iterations charge T-states");
});
