// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated sub_48e5 (ROM 0x48e5, The Pit).
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags,
 * a flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine) so the
 * routine runs in isolation without a ROM image. The four callees (0x3dae, 0x3dc9,
 * 0x3dea and the 0x3e01 tail-jump) are STUBBED -- recorded, not executed -- so the
 * measured T-state total is sub_48e5's OWN 155 T and nothing downstream.
 *
 * Asserts the T-state total, every memory write, IX/A, the call order, the final
 * PC (the tail-jump target), and the stack delta (three CALL pushes, no pop),
 * plus a deliberate mutation the T-state assertion must catch.
 *
 * Run: node --test games/thepit/translated/test/sub_48e5.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { sub_48e5 } from "../sub_48e5.js";

// Minimal machine matching the surface sub_48e5 uses: regs, mem, step, call,
// push16/pop16. `calls` records every m.call target in order; `tstates`
// accumulates the charged cycles; `pc` tracks the last step target. Callees are
// stubbed (recorded, not invoked) to isolate sub_48e5.
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
    pc: 0x48e5,
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
      return undefined; // callees stubbed in this isolated draft harness
    },
  };
}

const SP_BASE = 0x8780; // inside work RAM (0x8000-0x87FF)

// All golden assertions in one function so the mutation test can prove they fire.
// The T-state total is asserted FIRST, so a cycle mutation trips this line.
function assertGolden(m) {
  assert.equal(m.tstates, 155, "own T-state total (7+13+7+13+17+17+7+13+7+13+14+17+10)");
  assert.deepEqual(
    m.calls,
    [0x3dae, 0x3dc9, 0x3dea, 0x3e01],
    "call order: 0x3dae, 0x3dc9, 0x3dea, then the 0x3e01 tail-jump",
  );
  assert.equal(m.pc, 0x3e01, "PC ends at the tail-jump target 0x3e01");
  assert.equal(m.mem.read8(0x8058), 0x01, "(0x8058) = 0x01 -- column coordinate");
  assert.equal(m.mem.read8(0x8059), 0x0c, "(0x8059) = 0x0c -- row coordinate");
  assert.equal(m.mem.read8(0x8057), 0x06, "(0x8057) = 0x06 -- fill byte");
  assert.equal(m.mem.read8(0x8055), 0x09, "(0x8055) = 0x09 -- row count");
  assert.equal(m.regs.ix, 0x49a5, "IX = 0x49a5 -- source pointer");
  assert.equal(m.regs.a, 0x09, "A = 0x09 -- last `ld a,0x09` (stubbed callees leave it)");
  // Three real CALLs each push a 2-byte return address; the tail `jp` pushes
  // nothing and no `ret` runs in the stubbed harness -> SP drops by exactly 6.
  assert.equal(m.regs.sp, (SP_BASE - 6) & 0xffff, "SP -= 6: three CALL pushes, no pop");
  assert.equal(m.mem.read16(SP_BASE - 6), 0x4906, "topmost push = 0x3dea's return addr 0x4906");
}

function run(m) {
  m.regs.sp = SP_BASE;
  sub_48e5(m);
}

test("sub_48e5: straight-line column setup, tail-jumps to 0x3e01", () => {
  const m = makeMachine();
  run(m);
  assertGolden(m);
});

// -- MUTATION: the T-state total must have teeth ----------------------------------
// Mistranslate `ld ix,0x49a5` (DD 21, 14 T) as the un-prefixed `ld hl,nn` timing
// (10 T) -- the classic "forgot the DD prefix adds 4 T" copy error. Same result
// value, wrong cycle budget. Confirm the golden T-state assertion catches it.
test("sub_48e5 MUTATION: `ld ix,nn` mis-charged 10T (not 14T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) =>
    realStep(nextAddr, nextAddr === 0x4903 ? 10 : cycles); // the ld ix,nn step

  run(m);

  assert.equal(m.tstates, 151, "mutation loses exactly 4 T (14 -> 10)");
  assert.throws(
    () => assertGolden(m),
    /own T-state total/,
    "the golden T-state assertion must fail on the mutant",
  );
});
