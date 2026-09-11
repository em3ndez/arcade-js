// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c90c (ROM 0xc90c). jsr aba2/c16e (+ca62 when $05<0), clears $49, then for
// X=$3d=$3e..0 writes $0048[x]=$0158 and $0046[x]=0xff, clears $3f/$0115, $3d=$3e, tail-jmp 0x90c4.
// Run: node --test games/tempest/translated/test/equivalence-c90c.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c90c } from "../loc_c90c.js";

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

test("loc_c90c: $05>=0 skips ca62; $3e=2 -> 3-entry slot init; tail-jmp 90c4, 127 T", () => {
  const m = makeMachine();
  m.mem.write8(0x05, 0x00);   // bpl taken -> skip ca62
  m.mem.write8(0x3e, 0x02);
  m.mem.write8(0x0158, 0x77);

  loc_c90c(m);

  assert.deepEqual(m.calls, [0xaba2, 0xc16e, 0x90c4], "aba2, c16e, tail 90c4 (no ca62)");
  assert.equal(m.mem.read8(0x0048), 0x77, "$0048[0] = $0158 (last write wins over 0xff)");
  assert.equal(m.mem.read8(0x0049), 0x77, "$0048[1]");
  assert.equal(m.mem.read8(0x004a), 0x77, "$0048[2]");
  assert.equal(m.mem.read8(0x0046), 0xff, "$0046[0] = 0xff");
  assert.equal(m.mem.read8(0x0047), 0xff, "$0046[1]");
  assert.equal(m.mem.read8(0x49), 0x77, "$49 = $0158: loop X=1 writes $0048+1=$0049, overwriting the c91b clear");
  assert.equal(m.mem.read8(0x3f), 0x00, "$3f cleared");
  assert.equal(m.mem.read8(0x0115), 0x00, "$0115 cleared");
  assert.equal(m.mem.read8(0x3d), 0x02, "$3d = $3e");
  assert.equal(m.pc, 0x90c4, "tail jmp -> 90c4");
  assert.equal(m.cycles, 127, "29 prologue + 80 loop(3 iters) + 18 epilogue");
});

test("loc_c90c: $05<0 -> calls ca62 too; $3e=2; 132 T", () => {
  const m = makeMachine();
  m.mem.write8(0x05, 0x80);   // bpl falls -> jsr ca62
  m.mem.write8(0x3e, 0x02);
  m.mem.write8(0x0158, 0x33);

  loc_c90c(m);

  assert.deepEqual(m.calls, [0xaba2, 0xc16e, 0xca62, 0x90c4], "ca62 called when $05<0");
  assert.equal(m.mem.read8(0x004a), 0x33, "$0048[2] = $0158");
  assert.equal(m.pc, 0x90c4);
  assert.equal(m.cycles, 132, "34 prologue(+ca62) + 80 loop + 18 epilogue");
});
