// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1b8c (ROM 0x1b8c-0x1baa, Pooyan) -- a 0x15a8-dispatch state
 * handler. Runs 0x02c9 (bails via `ret nz` if not-done), 0x075d (BC=0x0819), enqueues two display
 * commands (rst 0x38, DE=0x0600 then E=0x03), runs 0x7960, sets (0x880a)=0x0c and (0x8808)=0x60,
 * then returns.
 *
 * The mock's `call` POPS the pushed return (modelling each callee's `ret`), so a missing push16
 * desyncs SP and fails the balance tooth. The ONLY load-bearing callee effect is 0x02c9's
 * `dec (0x8809)` flag, consumed by `ret nz` at 0x1b8f -- the mock models exactly that (decMem8 on
 * 0x8809). Every other callee runs inert (loc_1b8c reloads what it needs afterward).
 *
 * Path FULL (0x02c9 done): full pcSeq + T=155, ret to the seated caller, (0x880a)/(0x8808) written.
 * Path EARLY (0x02c9 not-done): `ret nz` at 0x1b8f returns immediately.
 * TEETH: mis-charge `ld (0x880a),a` at 0x1ba2 (13 T) as 7 T -> the 155 golden catches it.
 * POSITIVE CONTROL (performed): deleting push16(0x1b8f) makes call(0x02c9) pop CALLER_RET, SP ends
 * off by 2, the final ret lands off CALLER_RET and the SP-baseline assertion throws; restored.
 *
 * Run: node --test games/pooyan/translated/test/loc_1b8c.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1b8c } from "../loc_1b8c.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1b8c, pcSeq: [],
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
    // stays balanced (a missing push16 then desyncs SP and fails the test). The only load-bearing
    // effect is 0x02c9's terminal `dec (0x8809)`, whose Z flag `ret nz` at 0x1b8f consumes.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x02c9) regs.decMem8(mem, 0x8809);
      return undefined;
    },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

const PC_FULL = [
  0x02c9, 0x1b90, 0x1b93, 0x075d, 0x1b99, 0x0038, 0x1b9c, 0x0038, 0x7960,
  0x1ba2, 0x1ba5, 0x1ba7, 0x1baa, CALLER_RET,
];
const GOLDEN_FULL = 155;

function setupFull(m) {
  seatCaller(m);
  m.mem.write8(0x8809, 0x01); // 0x02c9 dec -> 0 -> Z set -> ret nz not taken (continue)
}

test("loc_1b8c Path FULL: 0x02c9 done -> full handler runs, ret to caller", () => {
  const m = makeMachine();
  setupFull(m);

  loc_1b8c(m);

  assert.equal(m.tstates, GOLDEN_FULL, "Path FULL T-state total");
  assert.deepEqual(m.pcSeq, PC_FULL, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret at 0x1baa returns to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
  assert.deepEqual(m.calls, [0x02c9, 0x075d, 0x0038, 0x0038, 0x7960],
    "0x02c9, 0x075d, two rst 0x38 (loc_0038), 0x7960");
  assert.equal(m.mem.read8(0x880a), 0x0c, "(0x880a) = 0x0c");
  assert.equal(m.mem.read8(0x8808), 0x60, "(0x8808) = 0x60");
});

test("loc_1b8c Path EARLY: 0x02c9 reports not-done -> ret nz at 0x1b8f", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8809, 0x05); // 0x02c9 dec -> 0x04 -> Z clear -> ret nz taken

  loc_1b8c(m);

  assert.equal(m.tstates, 17 + 11, "call 0x02c9 (17) + ret nz taken (11)");
  assert.deepEqual(m.pcSeq, [0x02c9, CALLER_RET], "call target then immediate ret");
  assert.equal(m.pc, CALLER_RET, "ret nz to seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.calls, [0x02c9], "only 0x02c9 ran");
  assert.equal(m.mem.read8(0x8809), 0x04, "(0x8809) decremented 0x05 -> 0x04");
  assert.equal(m.mem.read8(0x880a), 0x00, "(0x880a) never written");
});

test("loc_1b8c MUTATION: `ld (0x880a),a` at 0x1ba2 mis-charged 7T (not 13) is caught", () => {
  const m = makeMachine();
  setupFull(m);
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1ba5 ? 7 : cycles);

  loc_1b8c(m);

  assert.equal(m.tstates, GOLDEN_FULL - 6, "mutation loses 6 T (13 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, GOLDEN_FULL, "Path FULL T-state total"),
    /Path FULL T-state total/,
    "the 155-T golden must fail on the mutant",
  );
});
