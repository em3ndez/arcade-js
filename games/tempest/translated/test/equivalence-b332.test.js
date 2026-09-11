// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b332 (ROM 0xb332). If $cec4 != $2000: store it and rts C set. Else write a
// word from $ce9e[x] via ($74), clear $016e, advance $74/$75 from $ce68[x] (x=8 if $0415!=0 else 2),
// rts C clear. Minimal 6502 harness. Run: node --test games/tempest/translated/test/equivalence-b332.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b332 } from "../loc_b332.js";

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

test("loc_b332: $cec4 != $2000 -> store, rts with carry SET; 22 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // rts -> 0x2001
  m.ram[0xcec4] = 0x55;
  m.ram[0x2000] = 0x66; // not equal
  loc_b332(m);
  assert.equal(m.ram[0x2000], 0x55, "$2000 := $cec4");
  assert.equal(m.regs.fC, true, "carry set on the mismatch/early-return path");
  assert.equal(m.pc, 0x2001, "rts to pushed+1");
  assert.equal(m.cycles, 4 + 4 + 2 + 4 + 2 + 6, "22 T");
});

test("loc_b332: match, $0415 != 0 -> x=8 path, word written via ($74), carry CLEAR; 70 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.ram[0xcec4] = 0x55; m.ram[0x2000] = 0x55; // equal -> beq taken
  m.ram[0x0415] = 0x01; // != 0 -> x = 8
  m.ram[0x74] = 0x00; m.ram[0x75] = 0x06; // ($74) -> 0x0600
  m.ram[0xcea6] = 0x11; // $ce9e,8 -> A -> ($74),0
  m.ram[0xcea7] = 0x22; // $ce9f,8 -> A -> ($74),1
  m.ram[0xce70] = 0xaa; // $ce68,8 -> new $74
  m.ram[0xce71] = 0xbb; // $ce69,8 -> new $75
  loc_b332(m);
  assert.equal(m.ram[0x016e], 0x00, "$016e cleared");
  assert.equal(m.ram[0x0600], 0x11, "($74),0 := $ce9e,x");
  assert.equal(m.ram[0x0601], 0x22, "($74),1 := $ce9f,x");
  assert.equal(m.ram[0x74], 0xaa, "$74 advanced from $ce68,x");
  assert.equal(m.ram[0x75], 0xbb, "$75 advanced from $ce69,x");
  assert.equal(m.regs.fC, false, "carry clear on the success path");
  assert.equal(m.cycles, 4 + 4 + 3 + 4 + 3 + 2 + 4 + 2 + 4 + 6 + 2 + 4 + 6 + 4 + 3 + 4 + 3 + 2 + 6, "70 T");
});

test("loc_b332: match, $0415 == 0 -> x=2 path (clv/bvc), carry CLEAR; 74 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.ram[0xcec4] = 0x12; m.ram[0x2000] = 0x12; // equal
  m.ram[0x0415] = 0x00; // == 0 -> x = 2
  m.ram[0x74] = 0x00; m.ram[0x75] = 0x07; // ($74) -> 0x0700
  m.ram[0xcea0] = 0x31; // $ce9e,2
  m.ram[0xcea1] = 0x32; // $ce9f,2
  m.ram[0xce6a] = 0xcc; // $ce68,2 -> new $74
  m.ram[0xce6b] = 0xdd; // $ce69,2 -> new $75
  loc_b332(m);
  assert.equal(m.ram[0x0700], 0x31, "($74),0 := $ce9e,2");
  assert.equal(m.ram[0x0701], 0x32, "($74),1 := $ce9f,2");
  assert.equal(m.ram[0x74], 0xcc, "$74 advanced");
  assert.equal(m.ram[0x75], 0xdd, "$75 advanced");
  assert.equal(m.regs.fC, false, "carry clear");
  assert.equal(m.cycles, 4 + 4 + 3 + 4 + 2 + 2 + 2 + 3 + 4 + 2 + 4 + 6 + 2 + 4 + 6 + 4 + 3 + 4 + 3 + 2 + 6, "74 T");
});
