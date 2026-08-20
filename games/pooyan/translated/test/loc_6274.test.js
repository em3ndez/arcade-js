// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6274 (ROM 0x6274, Pooyan) -- pick the tile row buffer
 * (0x8c90 / 0x8ca8 by I-register parity via `ld a,i`), blank 0x18 tiles (rst 0x10, A=0), run
 * loc_0ef1, then SKIP-RETURN: `pop af` discards the caller's return so `ret` lands one frame up.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`), so a
 * call site that forgot its push16 desyncs the stack and the skip-return lands wrong. Stack is seated
 * with TWO returns: RET_OUTER (grandparent, where the skip-return lands) below RET_INNER (the return
 * the caller's `call` pushed, discarded by `pop af`).
 *
 * Path Z (I==0): keep HL=0x8c90. Path NZ (I!=0): HL=0x8ca8. Both: rst 0x10 + call 0x0ef1 + skip-return.
 * TEETH: mis-charge `rst 0x10` (11 T) as 7 T -> the 90-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_6274.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6274 } from "../loc_6274.js";

const RET_OUTER = 0x1234; // grandparent -- where the skip-return lands
const RET_INNER = 0xabcd; // the return the caller's `call` pushed -- discarded by `pop af`

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6274, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // The callee's `ret` pops the return address the call site pushed -- model that pop so the stack
    // stays balanced (a missing push16 at a call site then desyncs the skip-return). rst 0x10 (fill)
    // and loc_0ef1 leave no register loc_6274 reloads before its own `pop af`.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      return undefined;
    },
  };
}

function seat(m) {
  m.regs.sp = 0x8780;
  m.push16(RET_OUTER);
  m.push16(RET_INNER);
}

const PC_TAIL = [0x6280, 0x6281, 0x0010, 0x0ef1, 0x6286, RET_OUTER];

test("loc_6274 Path Z: I==0 -> keep HL=0x8c90, blank + skip-return", () => {
  const m = makeMachine();
  seat(m);
  m.regs.i = 0x00; // ld a,i -> Z set

  loc_6274(m);

  assert.equal(m.tstates, 90, "Path Z T-state total");
  assert.deepEqual(m.pcSeq, [0x6277, 0x6279, 0x627e, ...PC_TAIL], "step boundaries (jr z taken)");
  assert.equal(m.pc, RET_OUTER, "ret lands on the grandparent (skip-return)");
  assert.deepEqual(m.calls, [0x0010, 0x0ef1], "rst 0x10 then loc_0ef1");
  assert.equal(m.regs.hl, 0x8c90, "HL kept = 0x8c90");
  assert.equal(m.regs.b, 0x18, "B = 0x18 tiles");
  assert.equal(m.regs.af, RET_INNER, "pop af loaded the discarded inner return");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline (every push16 matched a callee ret)");
});

test("loc_6274 Path NZ: I!=0 -> HL=0x8ca8", () => {
  const m = makeMachine();
  seat(m);
  m.regs.i = 0x3f; // ld a,i -> Z clear

  loc_6274(m);

  assert.equal(m.tstates, 95, "Path NZ T-state total (extra jr-not-taken + ld hl)");
  assert.deepEqual(m.pcSeq, [0x6277, 0x6279, 0x627b, 0x627e, ...PC_TAIL], "step boundaries (jr z not taken)");
  assert.equal(m.pc, RET_OUTER, "ret lands on the grandparent");
  assert.equal(m.regs.hl, 0x8ca8, "HL = 0x8ca8");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_6274 MUTATION: `rst 0x10` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0010 ? 7 : cycles);
  seat(m);
  m.regs.i = 0x00;

  loc_6274(m);

  assert.equal(m.tstates, 86, "mutation loses 4 T (11 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 90, "golden"),
    /90/,
    "the 90-T golden must fail on the mutant",
  );
});
