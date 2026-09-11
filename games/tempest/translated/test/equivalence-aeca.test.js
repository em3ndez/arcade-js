// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_aeca (ROM 0xaeca). Minimal 6502 harness; jsr ab14/dfb1 recorded not run.
// $0156!=0 runs the setup block (cache $58, zero $56/$57); then always the checksum loop sums 17 bytes
// of $d575,y (+0x85, carry clear) into $b5.
// Run: node --test games/tempest/translated/test/equivalence-aeca.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_aeca } from "../loc_aeca.js";

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

test("loc_aeca: $0156!=0 runs setup block then checksum; $d575..=0 -> $b5=0x85; 202 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x7777); // rts -> 0x7778
  m.mem.write8(0x0156, 0x42); // nonzero -> beq not taken -> setup block runs
  // $d575..$d585 stay 0 -> A holds the initial 0x85 through all adds

  loc_aeca(m);

  assert.equal(m.mem.read8(0x58), 0x42, "$0156 cached into $58");
  assert.equal(m.mem.read8(0x56), 0x00, "$56 zeroed");
  assert.equal(m.mem.read8(0x57), 0x00, "$57 zeroed");
  assert.equal(m.mem.read8(0xb5), 0x85, "checksum = 0x85 + sum(0) = 0x85");
  assert.equal(m.pc, 0x7778, "rts");
  assert.deepEqual(m.calls, [0xab14, 0xdfb1], "ab14 (X=0x34) then dfb1");
  assert.equal(m.cycles, 202, "35 setup + 6 + 152 loop (17 iters) + 9 tail");
});

test("loc_aeca: $0156==0 skips setup, no calls; checksum still runs; 174 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);
  m.mem.write8(0x0156, 0x00); // beq taken -> skip setup
  m.mem.write8(0xd575, 0x03); // one nonzero table byte -> A = 0x85 + 3 = 0x88

  loc_aeca(m);

  assert.equal(m.mem.read8(0xb5), 0x88, "checksum = 0x85 + 0x03");
  assert.equal(m.mem.read8(0x58), 0x00, "setup skipped -> $58 untouched");
  assert.deepEqual(m.calls, [], "no jsr on the skip path");
  assert.equal(m.pc, 0x2001, "rts");
  assert.equal(m.cycles, 174, "4 + 3 (beq taken) + 6 + 152 loop + 9 tail");
});
