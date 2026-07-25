// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated sub_4673 (ROM 0x4673, The Pit) -- the "+1 point"
 * score entry.
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags, a
 * flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine) exercises
 * the routine in isolation without a ROM image. sub_4673 is straight-line (no
 * conditional branches), so there is a single path; the test pins its exact T-state
 * total, the instruction-boundary step sequence, the two m.call targets (the sfx
 * trigger 0x4c83 and the shared-scorer tail-jump 0x4689), the pushed CALL return
 * address, the BC increment, and the final PC -- then re-runs a mutant whose BC
 * increment is corrupted (+0x10 instead of +1) and proves the value assertion, not
 * the cycle count, catches it.
 *
 * Run: node --test games/thepit/translated/test/sub_4673.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { sub_4673 } from "../sub_4673.js";

// Minimal machine matching the surface sub_4673 uses: regs, mem, step, call, ret,
// push16/pop16. `calls` records every m.call target in order; `tstates` accumulates
// charged cycles; `pc` tracks the last step target. `call` is a stub: it records the
// target WITHOUT invoking a real routine (sub_4c83 / sub_4689 are separate units),
// so `m.call(0x4689)` models "control transferred and never came back".
function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => {
      ram[a & 0xffff] = v & 0xff;
      ram[(a + 1) & 0xffff] = (v >> 8) & 0xff;
    },
  };
  return {
    regs,
    mem,
    ram,
    calls: [],
    tstates: 0,
    pc: 0x4673,
    step(nextAddr, cycles) {
      this.pc = nextAddr;
      this.tstates += cycles;
    },
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
    ret(cycles = 10) {
      this.step(this.pop16(), cycles);
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // callees are stubbed in this isolated draft harness
    },
  };
}

// Seat a caller return address so the routine's own CALL push sits just below it,
// exactly as it would after a real `call sub_4673`.
const CALLER_RET = 0xabcd;
function seatCaller(m) {
  m.regs.sp = 0x8780; // inside work RAM (0x8000-0x87FF)
  m.push16(CALLER_RET);
}

// The single golden path. call 0x4c83 (17) + ld bc,nn (10) + jr (12) = 39 T.
const GOLDEN = {
  steps: [0x4c83, 0x4679, 0x4689], // m.step targets, in order
  calls: [0x4c83, 0x4689],         // the sfx call, then the tail-jump into the scorer
  tstates: 17 + 10 + 12,           // 39
  pc: 0x4689,                      // last step target -- the tail-jump entry
  bc: 0x0001,                      // the +1 score increment
};

test("golden path: sfx cue, BC=+1, tail-jump into the shared scorer", () => {
  const m = makeMachine();
  seatCaller(m);
  const spAfterCaller = m.regs.sp; // where the routine's CALL push will land below

  const steps = [];
  const origStep = m.step.bind(m);
  m.step = (addr, cyc) => { steps.push(addr); origStep(addr, cyc); };

  sub_4673(m);

  assert.deepEqual(steps, GOLDEN.steps, "step targets / instruction boundaries");
  assert.deepEqual(m.calls, GOLDEN.calls, "m.call targets (sfx + tail-jump)");
  assert.equal(m.tstates, GOLDEN.tstates, "T-state total");
  assert.equal(m.pc, GOLDEN.pc, "final PC = tail-jump entry 0x4689");
  assert.equal(m.regs.bc, GOLDEN.bc, "BC score increment = 1");
  assert.equal(m.regs.b, 0x00, "B high increment byte");
  assert.equal(m.regs.c, 0x01, "C low increment byte");

  // The CALL pushed its literal return address 0x4676 just below the caller frame;
  // the stubbed callee never popped it, so it still sits at the current SP.
  assert.equal(m.regs.sp, (spAfterCaller - 2) & 0xffff, "SP moved down by one CALL push");
  assert.equal(m.mem.read16(m.regs.sp), 0x4676, "pushed CALL return address = 0x4676");
});

test("mutation: a corrupted BC increment (+0x10 instead of +1) is caught", () => {
  // Byte-identical to sub_4673 except `ld bc,0x0001` becomes `ld bc,0x0010` -- the
  // increment that would turn the +1 entry into the +0x10 sibling's amount. `ld bc,nn`
  // is 10 T either way, so the CYCLE total is unchanged; only the BC-value assertion
  // can reject it.
  function sub_4673_mutant(m) {
    const { regs } = m;
    m.push16(0x4676); m.step(0x4c83, 17); m.call(0x4c83);
    regs.bc = 0x0010; // BUG: should be 0x0001
    m.step(0x4679, 10);
    m.step(0x4689, 12);
    return m.call(0x4689);
  }

  const m = makeMachine();
  seatCaller(m);
  sub_4673_mutant(m);

  // Cycles and control flow are identical to the golden path, proving neither the
  // T-state total nor the call/step targets can catch this -- only the BC value.
  assert.equal(m.tstates, GOLDEN.tstates, "mutation preserves the cycle total");
  assert.deepEqual(m.calls, GOLDEN.calls, "mutation preserves the call targets");
  assert.throws(
    () => assert.equal(m.regs.bc, GOLDEN.bc, "BC score increment = 1"),
    /BC score increment/,
    "the BC-value assertion must reject the corrupted increment",
  );
});
