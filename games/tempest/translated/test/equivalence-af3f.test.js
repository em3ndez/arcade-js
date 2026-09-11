// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_af3f (ROM 0xaf3f-0xaf6e) -- draw one score slot: if $0600,x==0 rts; else
// render the clamped count at a per-slot position ($af6f table) via a chain of jsrs. Author-derived harness.
// Run: node --test games/tempest/translated/test/equivalence-af3f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_af3f } from "../loc_af3f.js";

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

test("loc_af3f: $0600,x == 0 -> immediate rts (BEQ to $af6e); 13 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // rts -> pulled + 1 = 0x1234
  m.regs.x = 0x00;
  m.ram[0x0600] = 0x00; // slot count zero
  loc_af3f(m);
  assert.equal(m.regs.fZ, true, "count 0 -> Z set");
  assert.equal(m.pc, 0x1234, "BEQ to the rts -> returns to pushed + 1");
  assert.deepEqual(m.calls, [], "no jsr chain on the empty-slot path");
  assert.equal(m.cycles, 4 + 3 + 6, "lda abs,x (4) + beq taken (3) + rts (6)");
});

test("loc_af3f: nonzero count draws the slot then rts; full jsr chain, 84 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // rts -> 0x2001
  m.regs.x = 0x00;
  m.ram[0x0600] = 0x07; // slot-0 count = 7
  m.ram[0xaf6f] = 0xc0; // ROM $af6f table[0] (per-slot X position)
  m.ram[0xaf70] = 0xb0; // table[1]
  loc_af3f(m);
  assert.equal(m.ram[0x2e], 0x00, "stx $2e saved the slot index");
  assert.equal(m.regs.x, 0x00, "ldx $2e restored the slot index before jsr $aa9e");
  assert.equal(m.regs.a, 0x10, "lda #$10 is the last value loaded into A");
  assert.equal(m.pc, 0x2001, "rts returns to pushed + 1 (pha/pla balanced across the chain)");
  assert.deepEqual(m.calls, [0xb0d1, 0xab0d, 0xdf75, 0xaf71, 0xb56a, 0xab98, 0xaa9e],
    "the seven jsr targets in order");
  assert.equal(m.cycles,
    4 + 2 + 3 + 3 + 2 + 6 + 6 + 2 + 3 + 4 + 6 + 4 + 6 + 2 + 6 + 2 + 2 + 6 + 3 + 6 + 6, "84 T");
});

test("loc_af3f: slot index 1 reads table[1] for the position (ldx $af6f,y)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000);
  m.regs.x = 0x01;
  m.ram[0x0601] = 0x09; // $0600,x with x=1
  m.ram[0xaf6f] = 0xc0;
  m.ram[0xaf70] = 0xb0;
  loc_af3f(m);
  assert.equal(m.ram[0x2e], 0x01, "slot index 1 saved to $2e");
  assert.equal(m.pc, 0x3001, "returns to pushed + 1");
  assert.deepEqual(m.calls, [0xb0d1, 0xab0d, 0xdf75, 0xaf71, 0xb56a, 0xab98, 0xaa9e]);
});
