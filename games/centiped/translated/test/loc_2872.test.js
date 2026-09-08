// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2872 (ROM 0x2872-0x28bf). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Straight-line seeder with two down-counting BPL loops, three JSRs, and a fall-through into
// loc_28bf. Run: node --test games/centiped/translated/test/loc_2872.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2872 } from "../loc_2872.js";

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

function setup() {
  const m = makeMachine();
  m.ram[0x00ff] = 0x1a;   // -> $88, $53, $83
  m.ram[0x00c8] = 0x37;   // $100a EOR itself = 0, +C-clear leaves $c8 unchanged
  m.ram[0x100a] = 0x55;   // read twice; EOR with self = 0
  // sentinels bracketing each loop's write window, to prove the loop bounds
  for (let a = 0x00b1; a <= 0x00b9; a++) m.ram[a] = 0xee; // loop writes $b2..$b8
  for (let a = 0x00a7; a <= 0x00ae; a++) m.ram[a] = 0xee; // loop writes $a8..$ad
  return m;
}

test("loc_2872: seeds regs/tables, both BPL loops run, falls into loc_28bf; 210 T", () => {
  const m = setup();
  loc_2872(m);

  // scalar seeds
  assert.equal(m.ram[0x1008], 0x20, "$1008 = 0x20");
  assert.equal(m.ram[0x009b], 0x0c, "$9b = 0x0c");
  assert.equal(m.ram[0x009c], 0x0c, "$9c = 0x0c");
  assert.equal(m.ram[0x0088], 0x1a, "$88 = $ff");
  assert.equal(m.ram[0x0053], 0x1a, "$53 = $ff");
  assert.equal(m.ram[0x0083], 0x1a, "$83 = $ff");
  assert.equal(m.ram[0x009d], 0x02, "$9d = 0x02");
  assert.equal(m.ram[0x009e], 0x02, "$9e = 0x02");
  assert.equal(m.ram[0x100f], 0x03, "$100f = 0x03 (0x00 then 0x03)");
  assert.equal(m.ram[0x00a0], 0xc0, "$a0 = 0xc0");
  assert.equal(m.ram[0x00a2], 0xc0, "$a2 = 0xc0");
  assert.equal(m.ram[0x00a3], 0xc0, "$a3 = 0xc0");
  assert.equal(m.ram[0x00c8], 0x37, "$c8 unchanged: 0 + $c8 with C clear");

  // loop 1 wrote exactly $b2..$b8 = 0, sentinels intact
  assert.equal(m.ram[0x00b1], 0xee, "below loop-1 window untouched");
  for (let a = 0x00b2; a <= 0x00b8; a++) assert.equal(m.ram[a], 0x00, `loop-1 wrote $${a.toString(16)}`);
  assert.equal(m.ram[0x00b9], 0xee, "above loop-1 window untouched");

  // loop 2 wrote exactly $a8..$ad = 0, sentinels intact
  assert.equal(m.ram[0x00a7], 0xee, "below loop-2 window untouched");
  for (let a = 0x00a8; a <= 0x00ad; a++) assert.equal(m.ram[a], 0x00, `loop-2 wrote $${a.toString(16)}`);
  assert.equal(m.ram[0x00ae], 0xee, "above loop-2 window untouched");

  assert.equal(m.regs.x, 0xff, "X = 0xff after the second loop underflows");
  assert.equal(m.regs.a, 0xc0, "A = 0xc0 (last immediate)");
  assert.equal(m.regs.fN, true, "N from A = 0xc0");
  assert.equal(m.cycles, 210, "210 T on the full-loop path");
  assert.equal(m.pc, 0x28bf, "PC at loc_28bf entry (fall-through)");
  assert.deepEqual(m.calls, [0x231f, 0x21c7, 0x20e8, 0x28bf], "3 JSRs then the loc_28bf fall-through");
});

test("loc_2872 MUTATION: JSR $20e8 mischarged 7T not 6T is caught by the T-state total", () => {
  const m = setup();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x28bf ? 7 : c); // only the JSR $20e8 steps to 0x28bf
  loc_2872(m);
  assert.notEqual(m.cycles, 210, "a mischarged cycle blows the golden T-state total");
});
