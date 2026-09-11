// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_d6bb (ROM 0xd6bb) -- indexes three ROM tables from $0e00/$0d00/$0a,
// writes $0156/$0158/$09/$ac/$ad, jsr $dbe0 (opaque -- harness supplies A), stores A to $016a; rts.
// Minimal author-derived 6502 harness; flat 64K RAM doubles as the ROM tables. The whole-machine
// boot-first state diff vs MAME is the integration check.
// Run: node --test games/tempest/translated/test/equivalence-d6bb.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_d6bb } from "../loc_d6bb.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [], dbe0Ret: 0x77,
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    // Opaque subroutine: record the call, unwind its pushed return, and model dbe0 leaving A.
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } regs.a = this.dbe0Ret; return undefined; },
  };
}

test("loc_d6bb: table lookups + jsr $dbe0 result -> $016a, returns to pushed+1, 93 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // outer RTS -> pulled + 1 = 0x2001

  // Inputs: $0e00 = 0x66 -> and $38 = 0x20 -> >>3 = X1=4; low2 after 3 rols (carry 0) = 1 -> X2=1;
  //          and $06 = 0x06 -> Y = 6.  $0d00 = 0x81 -> eor $02 = 0x83.
  m.ram[0x0e00] = 0x66;
  m.ram[0x0d00] = 0x81;

  // ROM table cells the routine will index.
  m.ram[0xd6fb] = 0xaa; // $d6f7 + 4 -> $0156
  m.ram[0xd700] = 0xbb; // $d6ff + 1 -> $0158
  m.ram[0xd6b9] = 0xc1; // $d6b3 + 6 -> $ac
  m.ram[0xd6ba] = 0xc2; // $d6b4 + 6 -> $ad

  loc_d6bb(m);

  assert.equal(m.ram[0x0a], 0x66, "$0a caches $0e00");
  assert.equal(m.ram[0x0156], 0xaa, "$0156 from $d6f7,x (x=4)");
  assert.equal(m.ram[0x09], 0x83, "$09 = $0d00 eor $02");
  assert.equal(m.ram[0x0158], 0xbb, "$0158 from $d6ff,x (x=1, low2 of rol^3)");
  assert.equal(m.ram[0xac], 0xc1, "$ac from $d6b3,y (y=6)");
  assert.equal(m.ram[0xad], 0xc2, "$ad from $d6b4,y (y=6)");
  assert.deepEqual(m.calls, [0xdbe0], "jsr $dbe0");
  assert.equal(m.ram[0x016a], 0x77, "$016a = A returned by dbe0");
  assert.equal(m.pc, 0x2001, "RTS returns to pushed + 1");
  // 92 base T + 1 page-cross on $d6ff,x (0xd6ff+1 = 0xd700 crosses page).
  assert.equal(m.cycles, 93, "instruction total incl. one abs,x page cross");
});

test("loc_d6bb: X2=0 path (no page cross on $d6ff,x) -> 92 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);

  // $0e00 = 0x10 -> and $38 = 0x10 -> >>3 = X1=2; rol^3 of 0x10 (carry 0) = 0x80, low2 = 0 -> X2=0;
  //          and $06 = 0x00 -> Y = 0.
  m.ram[0x0e00] = 0x10;
  m.ram[0x0d00] = 0x00; // eor $02 -> 0x02
  m.ram[0xd6f9] = 0x11; // $d6f7 + 2
  m.ram[0xd6ff] = 0x22; // $d6ff + 0
  m.ram[0xd6b3] = 0x33; // $d6b3 + 0
  m.ram[0xd6b4] = 0x44; // $d6b4 + 0

  loc_d6bb(m);

  assert.equal(m.ram[0x0156], 0x11, "$0156 from $d6f7,x (x=2)");
  assert.equal(m.ram[0x09], 0x02, "$09 = 0x00 eor 0x02");
  assert.equal(m.ram[0x0158], 0x22, "$0158 from $d6ff,x (x=0)");
  assert.equal(m.ram[0xac], 0x33, "$ac from $d6b3,y (y=0)");
  assert.equal(m.ram[0xad], 0x44, "$ad from $d6b4,y (y=0)");
  assert.equal(m.ram[0x016a], 0x77, "$016a = dbe0 return");
  assert.equal(m.pc, 0x1001, "RTS returns to pushed + 1");
  assert.equal(m.cycles, 92, "no page cross -> base total");
});
