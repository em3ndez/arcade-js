// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_48c4 (ROM 0x48c4, The Pit).
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags,
 * a flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine) so the
 * routine runs in isolation without a ROM image. The three callees (0x3dae, 0x3dc9
 * and the 0x3e01 tail-jump) are STUBBED -- recorded, not executed -- so the
 * measured T-state total is loc_48c4's OWN 141 T and nothing downstream.
 *
 * Asserts the T-state total, every memory write, A and the `and 0xf7` exit flags,
 * that IX is left UNTOUCHED (this routine loads no IX, unlike its siblings), the
 * call order, the final PC (the tail-jump target), and the stack delta (two CALL
 * pushes, no pop), plus a deliberate mutation the T-state assertion must catch.
 *
 * Run: node --test games/thepit/translated/test/loc_48c4.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_48c4 } from "../loc_48c4.js";

// Minimal machine matching the surface loc_48c4 uses: regs, mem, step, call,
// push16/pop16. `calls` records every m.call target in order; `tstates`
// accumulates the charged cycles; `pc` tracks the last step target. Callees are
// stubbed (recorded, not invoked) to isolate loc_48c4.
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
    pc: 0x48c4,
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
const IX_SENTINEL = 0x1234; // arbitrary; the routine must not touch IX

// All golden assertions in one function so the mutation test can prove they fire.
// The T-state total is asserted FIRST, so a cycle mutation trips this line.
function assertGolden(m) {
  assert.equal(m.tstates, 141, "own T-state total (7+13+13+4+7+13+7+13+7+13+17+17+10)");
  assert.deepEqual(
    m.calls,
    [0x3dae, 0x3dc9, 0x3e01],
    "call order: 0x3dae, 0x3dc9, then the 0x3e01 tail-jump",
  );
  assert.equal(m.pc, 0x3e01, "PC ends at the tail-jump target 0x3e01");
  assert.equal(m.mem.read8(0x8055), 0x09, "(0x8055) = 0x09 -- row count");
  // 0x8057 starts at 0x0a; inc -> 0x0b; and 0xf7 clears bit 3 -> 0x03.
  assert.equal(m.mem.read8(0x8057), 0x03, "(0x8057) = (0x0a+1) & 0xf7 = 0x03 -- bumped+masked colour");
  assert.equal(m.mem.read8(0x8058), 0x06, "(0x8058) = 0x06 -- column coordinate");
  assert.equal(m.mem.read8(0x8059), 0x0a, "(0x8059) = 0x0a -- row coordinate");
  // Exit flags are the `and 0xf7` result on 0x03: S=0 Z=0, H=1 (AND sets H),
  // PV=even parity of 0x03 (2 bits) => set, N=0 C=0  ->  F = 0x14.
  assert.equal(m.regs.f, 0x14, "F = 0x14 -- flags left by `and 0xf7` (H set, PV even, C/N/Z clear)");
  assert.equal(m.regs.a, 0x0a, "A = 0x0a -- last `ld a,0x0a` (stubbed callees leave it)");
  assert.equal(m.regs.ix, IX_SENTINEL, "IX untouched -- loc_48c4 loads no IX");
  // Two real CALLs each push a 2-byte return address; the tail `jp` pushes
  // nothing and no `ret` runs in the stubbed harness -> SP drops by exactly 4.
  assert.equal(m.regs.sp, (SP_BASE - 4) & 0xffff, "SP -= 4: two CALL pushes, no pop");
  assert.equal(m.mem.read16(SP_BASE - 4), 0x48e2, "topmost push = 0x3dc9's return addr 0x48e2");
}

function run(m) {
  m.regs.sp = SP_BASE;
  m.regs.ix = IX_SENTINEL;
  m.mem.write8(0x8057, 0x0a); // seed the colour counter so inc+mask is observable
  loc_48c4(m);
}

test("loc_48c4: straight-line recolour column, tail-jumps to 0x3e01", () => {
  const m = makeMachine();
  run(m);
  assertGolden(m);
});

// -- MUTATION: the T-state total must have teeth ----------------------------------
// Mistranslate `and 0xf7` (immediate `and n`, E6 F7, 7 T) with the register-operand
// timing `and r` (4 T) -- the classic "immediate-vs-register cycle" copy error. Same
// result value, wrong cycle budget. Confirm the golden T-state assertion catches it.
test("loc_48c4 MUTATION: `and n` mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) =>
    realStep(nextAddr, nextAddr === 0x48cf ? 4 : cycles); // the `and 0xf7` step

  run(m);

  assert.equal(m.tstates, 138, "mutation loses exactly 3 T (7 -> 4)");
  assert.throws(
    () => assertGolden(m),
    /own T-state total/,
    "the golden T-state assertion must fail on the mutant",
  );
});
