// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9677 (ROM 0x9677) -- RTS-dispatch through the $968f/$9690 pointer table
// indexed by $015e. "pha hi; pha lo; rts" is a COMPUTED JMP: the handler at (hi:lo)+1 is TAIL-CALLED
// (m.step(dest,6); return m.call(dest)); its own rts consumes the caller's pushed return. Handler entry
// A = pointer-low. The harness stubs call() to return a sentinel and records the dispatch target.
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9677 } from "../loc_9677.js";

function makeMachine(handlers = {}) {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    call(a) { this.calls.push(a); return handlers[a]; },
  };
}

test("loc_9677: index 2 -> tail-calls handler at pointer+1 = 0x1235, 24 T", () => {
  const SENTINEL = { handled: 0x1235 };
  const m = makeMachine({ 0x1235: SENTINEL });
  m.mem.write8(0x015e, 0x02);
  m.mem.write8(0x968f + 2, 0x34); // lo byte
  m.mem.write8(0x9690 + 2, 0x12); // hi byte

  const result = loc_9677(m);

  assert.equal(m.regs.x, 0x02, "X = $015e");
  assert.deepEqual(m.calls, [0x1235], "handler at pointer 0x1234 + 1 is the m.call target");
  assert.equal(m.pc, 0x1235, "pc stepped to the dispatched handler");
  assert.equal(result, SENTINEL, "loc_9677 tail-returns the handler's result");
  assert.equal(m.regs.a, 0x34, "handler entry A = pointer-low byte");
  assert.equal(m.regs.fZ, false, "N/Z reflect low byte 0x34");
  assert.equal(m.regs.fN, false, "0x34 is not negative");
  assert.equal(m.cycles, 24, "4 (ldx abs) + 4 + 3 + 4 + 3 + 6 (rts)");
});

test("loc_9677: index 0 -> handler at $968f/$9690 pointer, carry into hi", () => {
  const SENTINEL = { handled: 0xac00 };
  const m = makeMachine({ 0xac00: SENTINEL });
  m.mem.write8(0x015e, 0x00);
  m.mem.write8(0x968f, 0xff); // lo
  m.mem.write8(0x9690, 0xab); // hi

  const result = loc_9677(m);

  assert.deepEqual(m.calls, [0xac00], "0xabff + 1 = 0xac00 (carry into hi) is the dispatch target");
  assert.equal(m.pc, 0xac00, "pc = 0xac00");
  assert.equal(result, SENTINEL, "handler invoked");
  assert.equal(m.regs.a, 0xff, "handler entry A = pointer-low 0xff");
  assert.equal(m.regs.fN, true, "0xff sets N");
});
