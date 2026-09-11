// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c30d (ROM 0xc30d-0xc36d) -- init/dispatch that seeds $0110/$010f (via opaque
// $c473/$c453), calls $df6a, early-returns unless $0110 && $0113, else runs the 16x $c3ee clear loop and
// falls through into loc_c36e. Opaque-call harness (records calls, pops the pushed return; does not run the
// callee), author-derived. Run: node --test games/tempest/translated/test/equivalence-c30d.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c30d } from "../loc_c30d.js";

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

test("loc_c30d: $0110!=0 -> bne $c339, then $0110!=0 -> early rts at $c347; 32 T, calls df6a", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000); // rts -> 0x3001
  m.ram[0x0110] = 0x05;
  loc_c30d(m);
  assert.equal(m.ram[0x9e], 0x06, "$9e = 6");
  assert.equal(m.regs.x, 0x05, "X = $0110");
  assert.equal(m.pc, 0x3001, "early rts -> pushed+1");
  assert.deepEqual(m.calls, [0xdf6a], "only the $df6a call on this path");
  assert.equal(m.cycles, 32, "golden T-state total for the $0110!=0 early-return path");
});

test("loc_c30d: $0110==0 -> seed block, opaque c473 leaves A=0xf0 -> $0110 nonzero -> rts at $c347; 61 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000);
  m.ram[0x0110] = 0x00;
  loc_c30d(m);
  assert.equal(m.ram[0x57], 0xf0, "$57 = 0xf0 from block 2");
  assert.equal(m.ram[0x0110], 0xf0, "$0110 stored with A (opaque c473 preserved 0xf0)");
  assert.equal(m.ram[0x010f], 0xf0, "$010f stored via the beq-not-taken fall path");
  assert.equal(m.pc, 0x3001, "early rts at $c347 (X=$0110 nonzero)");
  assert.deepEqual(m.calls, [0xc473, 0xdf6a], "c473 then df6a; c326 bne skipped block 5");
  assert.equal(m.cycles, 61, "golden T-state total for the seed-then-early-return path");
});

test("loc_c30d: full path -- c473 returns 0 -> loop c3ee x16 + fall-through into loc_c36e", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000);
  m.ram[0x0110] = 0x00;
  m.ram[0x0113] = 0x02; // makes the bne at c34b taken
  const baseCall = m.call.bind(m);
  m.call = (a) => { const r = baseCall(a); if (a === 0xc473) m.regs.a = 0x00; return r; }; // model c473 -> A=0

  loc_c30d(m);

  const expected = [0xc473, 0xc453, 0xc473, 0xdf6a];
  for (let i = 0; i < 16; i++) expected.push(0xc3ee);
  expected.push(0xdf4c, 0xc36e, 0xc36e);
  assert.deepEqual(m.calls, expected, "c473,c453,c473,df6a, 16x c3ee, df4c, c36e (jsr), c36e (fall-through)");
  assert.equal(m.ram[0x0110], 0x00, "$0110 cleared (c473 returned 0)");
  assert.equal(m.ram[0x010f], 0x00, "$010f cleared");
  assert.equal(m.regs.x, 0xff, "loop ran X 0x0f..0x00 then dex -> 0xff (bpl fell through)");
  assert.equal(m.regs.y, 0x0f, "final ldy #0x0f");
  assert.equal(m.regs.a, 0x00, "final A = $010f = 0");
  assert.equal(m.pc, 0xc36e, "fall-through delegates to loc_c36e (PC at its entry)");
});
