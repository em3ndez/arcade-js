// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_abac (ROM 0xabac). Minimal 6502 harness; jsr ac20/ac36 recorded not run.
// Main path: $071b|$071c|$071d != 0 (skip ac36); $01c9=0x03 keeps X=0x17 for both fill loops; the
// $071e/$071f latch runs; $01c9 bits 0-1 cleared at the end.
// Run: node --test games/tempest/translated/test/equivalence-abac.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_abac } from "../loc_abac.js";

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

test("loc_abac: ora nonzero (skip ac36), $01c9=0x03 -> both loops X=0x17, latch runs; 714 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x8888); // rts -> 0x8889
  m.mem.write8(0x01c9, 0x03);
  m.mem.write8(0x071b, 0x01); // ora chain nonzero -> bne taken -> ac36 skipped
  m.mem.write8(0xac08, 0x11); // low end of the copy source block
  m.mem.write8(0xac1f, 0x22); // high end ($ac08 + 0x17)
  m.mem.write8(0x0a, 0x37);   // $0a & 0xf8 = 0x30 -> $071e
  m.mem.write8(0x016a, 0x06); // $016a & 3 = 0x02 -> $071f

  loc_abac(m);

  assert.equal(m.mem.read8(0x0100), 0x08, "constant 8 stored to $0100");
  assert.equal(m.mem.read8(0x0606), 0x11, "$ac08 copied to $0606 (loop bottom)");
  assert.equal(m.mem.read8(0x061d), 0x22, "$ac1f copied to $061d (loop top)");
  assert.equal(m.mem.read8(0x0706), 0x01, "$0706 filled with 1");
  assert.equal(m.mem.read8(0x071d), 0x01, "$071d filled with 1 (loop top)");
  assert.equal(m.mem.read8(0x071e), 0x30, "$0a & 0xf8 latched to $071e");
  assert.equal(m.mem.read8(0x071f), 0x02, "$016a & 3 latched to $071f");
  assert.equal(m.mem.read8(0x01c9), 0x00, "$01c9 bits 0-1 cleared (0x03 & 0xfc)");
  assert.equal(m.pc, 0x8889, "rts");
  assert.deepEqual(m.calls, [0xac20], "only ac20 called (ac36 skipped)");
  assert.equal(m.cycles, 714, "38 pre + 335 loop1 + 11 mid + 287 loop2 + 43 tail");
});

test("loc_abac: $01c9 bit0=0 shortens copy loop to X=0x0e", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  m.mem.write8(0x01c9, 0x00); // bit0 clear -> X=0x0e for loop1; ora==0 -> ac36 called
  m.mem.write8(0xac08, 0xaa); // copied (index 0 <= 0x0e)
  m.mem.write8(0x0616, 0xff); // $0606 + 0x10, beyond X=0x0e reach -> must stay untouched

  loc_abac(m);

  assert.equal(m.mem.read8(0x0606), 0xaa, "index 0 still copied");
  assert.equal(m.mem.read8(0x0616), 0xff, "index 0x10 not reached with X=0x0e");
  assert.deepEqual(m.calls, [0xac20, 0xac36], "ora chain 0 -> ac36 called");
});
