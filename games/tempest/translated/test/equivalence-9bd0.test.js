// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9bd0 (ROM 0x9bd0-0x9bdc) -- inc $010b, read 0xa0f7,y table, store $0298,x, rts.
// Run: node --test games/tempest/translated/test/equivalence-9bd0.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9bd0 } from "../loc_9bd0.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = { read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; } };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(n, c) { this.pc = n; this.cycles += c; },
    call(t) { this.calls.push(t); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
  };
}

test("loc_9bd0: in-page -- inc cursor, index table, store $0298,x, rts", () => {
  const m = makeMachine(); m.push16(0x2000);
  m.mem.write8(0x010b, 0x04); m.regs.x = 0x03;
  m.mem.write8((0xa0f7 + 0x05) & 0xffff, 0x42); // index after inc = 0x05, ea 0xa0fc (page 0xa0)
  loc_9bd0(m);
  assert.equal(m.mem.read8(0x010b), 0x05, "cursor incremented");
  assert.equal(m.regs.y, 0x05, "Y = cursor");
  assert.equal(m.regs.a, 0x42, "A = table[0xa0f7 + Y]");
  assert.equal(m.mem.read8(0x029b), 0x42, "stored to $0298,x (x=3)");
  assert.equal(m.regs.fZ, false); assert.equal(m.regs.fN, false);
  assert.deepEqual(m.calls, [], "no cross-routine call");
  assert.equal(m.pc, 0x2001, "rts -> pushed return + 1");
  assert.equal(m.cycles, 6 + 4 + 4 + 5 + 6, "inc6 + ldy4 + lda(in-page)4 + sta5 + rts6 = 25");
});

test("loc_9bd0: page cross on lda 0xa0f7,y adds 1 cycle", () => {
  const m = makeMachine(); m.push16(0x2000);
  m.mem.write8(0x010b, 0x0f); m.regs.x = 0x00; // inc -> 0x10, ea 0xa0f7+0x10 = 0xa107 (page 0xa1, cross)
  m.mem.write8((0xa0f7 + 0x10) & 0xffff, 0x7f);
  loc_9bd0(m);
  assert.equal(m.regs.y, 0x10);
  assert.equal(m.regs.a, 0x7f);
  assert.equal(m.mem.read8(0x0298), 0x7f, "stored to $0298,x (x=0)");
  assert.equal(m.cycles, 6 + 4 + 5 + 5 + 6, "lda cross -> 5; total 26");
});

test("loc_9bd0: inc wraps 0xff->0x00, Y load sets Z; table[0xa0f7] read", () => {
  const m = makeMachine(); m.push16(0x2000);
  m.mem.write8(0x010b, 0xff); m.regs.x = 0x01;
  m.mem.write8(0xa0f7, 0x00);
  loc_9bd0(m);
  assert.equal(m.mem.read8(0x010b), 0x00, "cursor wrapped");
  assert.equal(m.regs.y, 0x00);
  assert.equal(m.regs.fZ, true, "ldy 0 sets Z");
  assert.equal(m.regs.a, 0x00, "A = table[0xa0f7]");
  assert.equal(m.mem.read8(0x0299), 0x00, "stored to $0298,x (x=1)");
});
