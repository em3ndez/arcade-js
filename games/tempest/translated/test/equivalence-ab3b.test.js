// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ab3b (ROM 0xab3b) -- ($ac)-vector fetch, nibble split calls, buffer-copy loop
// gated by bit7 of $2b, tail-jump to loc_df5f. Minimal 6502 harness.
// Run: node --test games/tempest/translated/test/equivalence-ab3b.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ab3b } from "../loc_ab3b.js";

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

test("loc_ab3b: single-record copy (bit7 exits loop) -> tail-jump 0xdf5f, 157 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;

  m.mem.write8(0x35, 0x00);   // ldy/ldx $35 index = 0
  m.mem.write8(0xac, 0x00);   // ($ac) vector-table pointer = 0x6000
  m.mem.write8(0xad, 0x60);
  m.mem.write8(0x6000, 0x00); // -> $3b/$3c record pointer = 0x7000
  m.mem.write8(0x6001, 0x70);
  m.mem.write8(0xd121, 0x35); // nibble source: hi=3 -> b0d1(y=3), lo=5 -> b0dd(a=5)
  m.mem.write8(0x74, 0x00);   // ($74) dest buffer = 0x5000
  m.mem.write8(0x75, 0x50);
  m.mem.write8(0x7001, 0x80); // (record),y=1: bit7 set -> masked index 0, and loop exits after 1 pass
  m.mem.write8(0x31e4, 0xaa); // pair lo for index 0
  m.mem.write8(0x31e5, 0xbb); // pair hi for index 0

  loc_ab3b(m);

  assert.equal(m.mem.read8(0x72), 0x01, "$72 := 1");
  assert.equal(m.mem.read8(0x73), 0x00, "$73 := 0");
  assert.equal(m.mem.read8(0x3b), 0x00, "$3b := record ptr lo");
  assert.equal(m.mem.read8(0x3c), 0x70, "$3c := record ptr hi");
  assert.equal(m.mem.read8(0x2b), 0x80, "$2b := raw (record),y byte");
  assert.equal(m.mem.read8(0x5000), 0xaa, "dest[0] := $31e4,x (x=0)");
  assert.equal(m.mem.read8(0x5001), 0xbb, "dest[1] := $31e5,x (x=0)");
  assert.equal(m.mem.read8(0x2a), 0x02, "$2a advanced to 2");
  assert.equal(m.regs.y, 0x01, "Y = ($2a=2) - 1 after dey");
  assert.deepEqual(m.calls, [0xdf6a, 0xdf75, 0xb0d1, 0xb0dd, 0xdf5f], "call sequence");
  assert.equal(m.pc, 0xdf5f, "tail-jump to loc_df5f");
  assert.equal(m.cycles, 157, "head 94 + one loop pass 55 + tail 8");
});
