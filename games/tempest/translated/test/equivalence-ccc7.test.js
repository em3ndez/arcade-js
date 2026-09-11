// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ccc7 (ROM 0xccc7) -- sound-channel registration scan over $cb01,y for 16 slots.
// Minimal 6502 harness (Regs + flat RAM + page-1 stack seam), author-derived; the whole-machine boot-first
// state diff vs MAME is the integration check. Run: node --test .../equivalence-ccc7.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ccc7 } from "../loc_ccc7.js";

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

test("loc_ccc7: all-zero table -> 16 empty passes, X/Y restored, no stores; 245 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1500);            // rts -> 0x1501
  m.regs.a = 0x10;            // sound id -> Y = 0x10 (reads $cb11..$cb02, all in page cb, all 0)
  m.regs.x = 0x22;
  m.regs.y = 0x33;

  loc_ccc7(m);

  assert.equal(m.mem.read8(0x31), 0x22, "stx $31 saved X");
  assert.equal(m.mem.read8(0x32), 0x33, "sty $32 saved Y");
  assert.equal(m.mem.read8(0xbf), 0x00, "no slot claimed -> $bf untouched");
  assert.equal(m.regs.x, 0x22, "X restored from $31");
  assert.equal(m.regs.y, 0x33, "Y restored from $32");
  assert.equal(m.pc, 0x1501, "rts -> pushed+1");
  assert.equal(m.cycles, 245, "setup + 15*taken-loops + final not-taken + restore + rts");
});

test("loc_ccc7: first nonzero table byte claims slot X=0x0f, writes $c0/$e0/$f0,x + $bf; 266 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1600);            // rts -> 0x1601
  m.regs.a = 0x10;            // Y = 0x10 -> first read $cb11
  m.regs.x = 0x05;
  m.regs.y = 0x06;
  m.mem.write8(0xcb11, 0x77);  // nonzero on the first (x=0x0f) pass

  loc_ccc7(m);

  assert.equal(m.mem.read8(0xcf), 0x77, "sta $c0,x (x=0x0f) stored the table byte");
  assert.equal(m.mem.read8(0xef), 0x01, "sta $e0,x = 1");
  assert.equal(m.mem.read8(0xff), 0x01, "sta $f0,x = 1");
  assert.equal(m.mem.read8(0xbf), 0xff, "$bf ends 0xff (stx x then overwritten by #$ff)");
  assert.equal(m.regs.x, 0x05, "X restored from $31");
  assert.equal(m.regs.y, 0x06, "Y restored from $32");
  assert.equal(m.pc, 0x1601, "rts -> pushed+1");
  assert.deepEqual(m.calls, [], "no subroutine call");
  assert.equal(m.cycles, 266, "one store pass (35) + 14 taken skips (196) + final (13) + setup/restore (22)");
});
