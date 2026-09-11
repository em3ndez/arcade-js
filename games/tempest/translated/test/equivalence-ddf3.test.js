// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ddf3 (ROM 0xddf3) -- ldy #$ff then always-taken bne to loc_ddff (tail-call).
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ddf3 } from "../loc_ddf3.js";

test("loc_ddf3: Y<-0xff, bne always taken -> tail-calls loc_ddff, 5 T", () => {
  const calls = [];
  const regs = new Regs();
  const m = { regs, cycles: 0, pc: 0,
    step(n, c) { this.pc = n; this.cycles += c; },
    call(a) { calls.push(a); return undefined; } };
  loc_ddf3(m);
  assert.equal(regs.y, 0xff, "Y = 0xff");
  assert.deepEqual(calls, [0xddff], "always-taken bne tail-calls loc_ddff");
  assert.equal(m.cycles, 5, "2 (ldy #) + 3 (bne taken, same page)");
});
