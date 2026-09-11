// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c7bd (ROM 0xc7bd). Either an early rts, or an RTS trampoline that dispatches to
// ($c7da/$c7db[$00] + 1). Minimal 6502 harness with recorded calls[]. Run:
// node --test games/tempest/translated/test/equivalence-c7bd.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c7bd } from "../loc_c7bd.js";

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

test("loc_c7bd: ($0d00 & $83)==$82 -> plain rts, no dispatch, no $4e change, 17 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x4000); // rts -> 0x4001
  m.ram[0x0d00] = 0x82;   // & 0x83 = 0x82 == 0x82 -> beq taken
  m.ram[0x4e] = 0x01;

  loc_c7bd(m);

  assert.equal(m.ram[0x4e], 0x01, "$4e untouched on the early-return path");
  assert.deepEqual(m.calls, [], "no jsr a7d2");
  assert.equal(m.pc, 0x4001, "plain rts to pushed+1");
  assert.equal(m.cycles, 17, "4+2+2+3+6");
});

test("loc_c7bd: mismatch -> jsr a7d2, set bit7 $4e, rts trampolines by DISPATCHING table16+1 via m.call, 47 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x4000); // original return (stays below the pushed dispatch addr)
  m.ram[0x0d00] = 0x00;   // & 0x83 = 0x00 != 0x82 -> beq not taken
  m.ram[0x00] = 0x07;     // x index -> reads table at $c7da+7 / $c7db+7
  m.ram[0x4e] = 0x01;     // | 0x80 -> 0x81
  // Seed the dispatch table so a known target results. The routine reads
  // $c7da,x (lo) and $c7db,x (hi) with x=7; the table holds target-1.
  m.ram[0xc7da + 0x07] = 0x34;   // dispatch lo (target-1 lo)
  m.ram[0xc7db + 0x07] = 0x12;   // dispatch hi (target-1 hi)
  const expectedTarget = (((m.ram[0xc7db + 0x07] << 8) | m.ram[0xc7da + 0x07]) + 1) & 0xffff; // 0x1235

  loc_c7bd(m);

  assert.equal(m.ram[0x4e], 0x81, "bit7 set into $4e");
  // TEETH: the RTS trampoline must DISPATCH the computed target via m.call,
  // not merely land pc there. calls[] records every m.call in order.
  assert.deepEqual(m.calls, [0xa7d2, expectedTarget],
    "jsr a7d2 then the computed dispatch target is m.call'd");
  assert.equal(m.calls[m.calls.length - 1], expectedTarget,
    "final dispatch is to table16+1 (0x1235) via m.call");
  assert.equal(m.pc, expectedTarget, "pc also advanced to the dispatch target");
  // The original underlying return (0x4000) must remain on the stack, unconsumed
  // by the trampoline -- only the pushed table word was pulled for dispatch.
  assert.equal(m.regs.s, 0xfb, "stack unwound to the pushed table word only");
  assert.equal(m.cycles, 47, "dispatch path total unchanged (step t,6)");
});
