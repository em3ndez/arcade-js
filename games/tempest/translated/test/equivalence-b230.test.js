// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b230 (ROM 0xb230-0xb2bd) -- the frame builder: a fixed b2be/subsystem/b2fe jsr
// sequence, a conditional $0028-entry adc-sum loop into $011b (gated by bit7 of $05), then latches
// $cec2/$cec3 into $2000/$2001. JSRs are opaque (recorded, not run). Run:
//   node --test games/tempest/translated/test/equivalence-b230.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b230 } from "../loc_b230.js";

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

const JSR_SEQUENCE = [
  0xb2be, 0xb586, 0xb2fe, 0xb2be, 0xb75b, 0xb2fe, 0xb2be, 0xb5ad, 0xb2fe,
  0xb2be, 0xb79a, 0xb2fe, 0xb2be, 0xb498, 0xb2fe, 0xb2be, 0xa8b4, 0xb2fe,
  0xb367, 0xb2be, 0xc5c2, 0xb2fe, 0xb2be, 0xc54d, 0xb2fe,
];

test("loc_b230: bit7 of $05 set -> skips the sum loop; latches $cec2/$cec3, 216 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  m.ram[0x05] = 0x80;   // bit7 set -> bmi taken, loop skipped
  m.ram[0xcec2] = 0xab;
  m.ram[0xcec3] = 0xcd;
  m.ram[0x011b] = 0x5a; // sentinel -- must stay untouched

  loc_b230(m);

  assert.equal(m.ram[0x0114], 0x00, "$0114 cleared");
  assert.equal(m.ram[0x2000], 0xab, "$cec2 latched to $2000");
  assert.equal(m.ram[0x2001], 0xcd, "$cec3 latched to $2001");
  assert.equal(m.ram[0x011b], 0x5a, "$011b untouched when loop is skipped");
  assert.deepEqual(m.calls, JSR_SEQUENCE, "full fixed JSR sequence in order");
  assert.equal(m.pc, 0x1234, "RTS -> pushed + 1");
  assert.equal(m.cycles, 216, "bmi-taken path total");
});

test("loc_b230: bit7 of $05 clear -> runs the 0x28-entry adc loop into $011b, 624 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  m.ram[0x05] = 0x00;   // bmi not taken -> loop runs
  m.ram[0xb6] = 0x00; m.ram[0xb7] = 0x40; // (0xb6) -> 0x4000, all bytes 0 (RAM default)
  m.ram[0xcec2] = 0x11;
  m.ram[0xcec3] = 0x22;

  loc_b230(m);

  // A starts 0xf2, adds 0x28 zero bytes with no carry -> stays 0xf2
  assert.equal(m.ram[0x011b], 0xf2, "$011b = 0xf2 (0xf2 + sum of zeros)");
  assert.equal(m.ram[0x2000], 0x11, "$cec2 latched");
  assert.equal(m.ram[0x2001], 0x22, "$cec3 latched");
  assert.deepEqual(m.calls, JSR_SEQUENCE, "same JSR sequence (loop contains no JSR)");
  assert.equal(m.cycles, 624, "loop-path total: 40 iterations of adc/dey/bpl");
});

test("loc_b230: adc loop actually reads the table -> $011b reflects nonzero data (carry-free)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  m.ram[0x05] = 0x00;
  m.ram[0xb6] = 0x00; m.ram[0xb7] = 0x40; // ptr 0x4000
  m.ram[0x4000 + 0x27] = 0x05; // first byte read (y=0x27); rest 0 -> no carry, sum stays small
  m.ram[0x4000 + 0x00] = 0x02; // last byte read (y=0x00)
  loc_b230(m);
  assert.equal(m.ram[0x011b], 0xf9, "$011b = 0xf2 + 0x05 + 0x02 = 0xf9 (no carry)");
});
