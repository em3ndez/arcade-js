// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b20d (ROM 0xb20d). RTS trampoline: two PHAs push a target-1 word from the
// $b218 table selected by $01, then RTS dispatches to (word)+1. The corrected routine tail-calls the
// computed handler (m.call), matching the correct siblings loc_b5d7/loc_b84e. Minimal 6502 harness.
// Run: node --test games/tempest/translated/test/equivalence-b20d.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b20d } from "../loc_b20d.js";

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
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    call(a) { this.calls.push(a); return undefined; },
  };
}

test("loc_b20d: $01=0 -> pushes $b218/$b219 word, rts DISPATCHES to word+1 via m.call; 23 T", () => {
  const m = makeMachine();
  m.regs.s = 0xff;
  m.ram[0x01] = 0x00;
  m.ram[0xb218] = 0x00; // lo of (target-1)
  m.ram[0xb219] = 0xc0; // hi of (target-1) -> table word 0xc000
  loc_b20d(m);
  assert.deepEqual(m.calls, [0xc001], "computed handler (table word 0xc000 + 1) is m.call'd -- the trampoline actually dispatches");
  assert.equal(m.pc, 0xc001, "pc advances to the dispatched target 0xc000 + 1");
  assert.equal(m.regs.x, 0x00, "X = $01");
  assert.equal(m.regs.s, 0xff, "stack net-empty after the two PHAs + rts pull");
  assert.equal(m.cycles, 3 + 4 + 3 + 4 + 3 + 6, "23 T (no page cross for x=0)");
});

test("loc_b20d: $01=0xe8 selects a later table slot, page-crossed reads, dispatches; 25 T", () => {
  const m = makeMachine();
  m.regs.s = 0xff;
  m.ram[0x01] = 0xe8;
  m.ram[(0xb218 + 0xe8) & 0xffff] = 0x33; // 0xb300 lo
  m.ram[(0xb219 + 0xe8) & 0xffff] = 0x12; // 0xb301 hi -> table word 0x1233
  loc_b20d(m);
  assert.deepEqual(m.calls, [0x1234], "dispatches to 0x1233 + 1");
  assert.equal(m.pc, 0x1234, "pc = 0x1233 + 1");
  assert.equal(m.cycles, 3 + 5 + 3 + 5 + 3 + 6, "25 T (both abs,x reads cross a page)");
});

test("loc_b20d MUTATION: swapping the hi/lo push order breaks the dispatch target", () => {
  const m = makeMachine();
  m.regs.s = 0xff;
  m.ram[0x01] = 0x00;
  m.ram[0xb218] = 0x00;
  m.ram[0xb219] = 0xc0;
  loc_b20d(m);
  // Faithful order pushes hi first, lo last -> pull16 reads lo,hi -> 0xc000 -> dispatch 0xc001.
  // A swapped push order would yield word 0x00c0 -> dispatch 0x00c1.
  assert.deepEqual(m.calls, [0xc001], "hi-then-lo push order yields the correct dispatch target");
  assert.notDeepEqual(m.calls, [0x00c1], "a hi/lo push swap would dispatch to the wrong target");
});
