// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2cef (ROM 0x2cef-0x2d5b). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2cef.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2cef } from "../loc_2cef.js";

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

// Gated early exit: ($00 & 7) != 0 -> BNE $2d0b taken on the first test, straight to RTS.
test("loc_2cef: frame gate ($00 & 7 != 0) bails to $2d0b; 17 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  m.ram[0x0000] = 0x05; // $00 & 7 = 5 -> BNE $2d0b taken (page cross)

  loc_2cef(m);

  assert.equal(m.regs.a, 0x05, "A = $00 & 7");
  assert.equal(m.regs.y, 0x00, "Y = 0");
  assert.equal(m.regs.fZ, false, "Z clear (nonzero AND)");
  assert.deepEqual(m.pcSeq, [0x2cf1, 0x2cf3, 0x2cf5, 0x2d0b, 0x1234], "gate -> RTS step boundaries");
  assert.deepEqual(m.calls, [], "no callee on the gated path");
  assert.equal(m.cycles, 2 + 3 + 2 + 4 + 6, "17 T (BNE taken +cross)");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
});

// In-range cell path: gates all fall through, $db=5 (=/= 7 -> BNE $2d0c), the ($da),Y cell masks to
// 0x3a in [0x38,0x3f) so it is erased (EOR $ef), $8b is rebuilt by ASL/ROL x3, $5f/$6f/$b2 seeded,
// $da bumped; exits at $2d53 RTS after JSR $2db6.
function setupInRange() {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  m.ram[0x0000] = 0x00; // $00 & 7 = 0 -> first BNE not taken
  m.ram[0x00b7] = 0x00; // $b7 = 0 -> second BNE not taken
  m.ram[0x00db] = 0x05; // $db nonzero (BEQ not taken) and != 7 (BNE $2d0c taken); pointer high
  m.ram[0x00da] = 0x00; // pointer low -> ($da),Y = 0x0500
  m.ram[0x0500] = 0x3a; // cell; & 0x3f = 0x3a in [0x38, 0x3f)
  m.ram[0x00ef] = 0x00; // EOR mask -> stored value stays 0x3f
  return m;
}

test("loc_2cef: in-range cell is erased and the mover state seeded; 138 T; RTS at $2d53", () => {
  const m = setupInRange();

  loc_2cef(m);

  assert.equal(m.ram[0x0500], 0x3f, "cell erased to #$3f ^ $ef");
  assert.equal(m.ram[0x008b], 0x28, "$8b = $da rebuilt through ASL/ROL x3");
  assert.equal(m.ram[0x003f], 0xff, "$3f = #$ff");
  assert.equal(m.ram[0x006f], 0x00, "$6f = A after the ASL chain");
  assert.equal(m.ram[0x005f], 0xb4, "$5f = (($8b & 0x1f) ^ 0x1f) << 3 - 3");
  assert.equal(m.ram[0x00da], 0x01, "$da pointer low bumped");
  assert.equal(m.ram[0x00b2], 0x13, "$b2 = #$13");
  assert.equal(m.regs.a, 0x13, "A = #$13 from the tail");
  assert.equal(m.regs.fC, true, "C set from SBC #$03 (0xb8 - 3)");
  assert.equal(m.regs.fZ, false, "Z clear (A = 0x13)");
  assert.equal(m.regs.fN, false, "N clear (A = 0x13)");
  assert.deepEqual(m.calls, [0x2db6], "the one JSR $2db6 on this path");
  assert.equal(m.cycles, 138, "138 T on the in-range erase path");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
});

test("loc_2cef MUTATION: JSR $2db6 mischarged 5T not 6T is caught by the T-state total", () => {
  const m = setupInRange();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2d27 ? 5 : c); // only the JSR $2db6 step lands at 0x2d27
  loc_2cef(m);
  assert.notEqual(m.cycles, 138, "a mischarged cycle blows the golden T-state total");
});
