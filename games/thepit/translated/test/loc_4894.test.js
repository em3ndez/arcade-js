// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_4894 (ROM 0x4894, The Pit).
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags,
 * a flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine) so the
 * routine runs in isolation without a ROM image. The five callees (0x3dae, 0x3dc9,
 * 0x3dea, 0x3ddb and the 0x3e01 tail-jump) are STUBBED -- recorded, not executed
 * -- so the measured T-state total is loc_4894's OWN 206 T and nothing downstream.
 * The stub also SNAPSHOTS IX and (0x8055) at each call, which pins the two-copy
 * sequence: 0x3dea sees IX=0x8000 / count=1, and 0x3ddb sees IX=0x496d / count=8
 * (0x8055 is written twice, so this proves the ORDER of those writes, not just
 * their final value).
 *
 * Asserts the T-state total, every memory write, final IX/A, the call order + the
 * per-call (IX, count) snapshots, the final PC (the tail-jump target), and the
 * stack delta (four CALL pushes, no pop), plus a deliberate mutation the T-state
 * assertion must catch.
 *
 * Run: node --test games/thepit/translated/test/loc_4894.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_4894 } from "../loc_4894.js";

// Minimal machine matching the surface loc_4894 uses: regs, mem, step, call,
// push16/pop16. `calls` records every m.call target in order; `snaps` records the
// IX + (0x8055) live at each call; `tstates` accumulates charged cycles; `pc`
// tracks the last step target. Callees are stubbed (recorded, not invoked).
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
    snaps: [],
    tstates: 0,
    pc: 0x4894,
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
      this.snaps.push({ addr, ix: regs.ix, count: mem.read8(0x8055) });
      return undefined; // callees stubbed in this isolated draft harness
    },
  };
}

const SP_BASE = 0x8780; // inside work RAM (0x8000-0x87FF)

// All golden assertions in one function so the mutation test can prove they fire.
// The T-state total is asserted FIRST, so a cycle mutation trips this line.
function assertGolden(m) {
  assert.equal(
    m.tstates,
    206,
    "own T-state total (7+13+7+13+17+17+7+13+7+13+14+17+7+13+14+17+10)",
  );
  assert.deepEqual(
    m.calls,
    [0x3dae, 0x3dc9, 0x3dea, 0x3ddb, 0x3e01],
    "call order: 0x3dae, 0x3dc9, 0x3dea, 0x3ddb, then the 0x3e01 tail-jump",
  );
  // The two copies must see the state as it stood at THEIR call, not the final
  // values -- 0x8055 and IX are each written twice.
  assert.deepEqual(
    m.snaps,
    [
      { addr: 0x3dae, ix: 0xffff, count: 0x00 }, // pre-copy: IX untouched, 0x8055 still 0
      { addr: 0x3dc9, ix: 0xffff, count: 0x00 },
      { addr: 0x3dea, ix: 0x8000, count: 0x01 }, // 1-cell copy from 0x8000
      { addr: 0x3ddb, ix: 0x496d, count: 0x08 }, // 8-cell strip from 0x496d
      { addr: 0x3e01, ix: 0x496d, count: 0x08 }, // tail: 8 colour cells
    ],
    "per-call (IX,count) snapshots pin the twice-written 0x8055 / IX sequence",
  );
  assert.equal(m.pc, 0x3e01, "PC ends at the tail-jump target 0x3e01");
  assert.equal(m.mem.read8(0x8058), 0x06, "(0x8058) = 0x06 -- column coordinate");
  assert.equal(m.mem.read8(0x8059), 0x0a, "(0x8059) = 0x0a -- row coordinate");
  assert.equal(m.mem.read8(0x8057), 0x96, "(0x8057) = 0x96 -- colour fill byte");
  assert.equal(m.mem.read8(0x8055), 0x08, "(0x8055) = 0x08 -- FINAL row count (0x01 then 0x08)");
  assert.equal(m.regs.ix, 0x496d, "IX = 0x496d -- FINAL source pointer (0x8000 then 0x496d)");
  assert.equal(m.regs.a, 0x08, "A = 0x08 -- last `ld a,0x08` (stubbed callees leave it)");
  // Four real CALLs each push a 2-byte return address; the tail `jp` pushes
  // nothing and no `ret` runs in the stubbed harness -> SP drops by exactly 8.
  assert.equal(m.regs.sp, (SP_BASE - 8) & 0xffff, "SP -= 8: four CALL pushes, no pop");
  assert.equal(m.mem.read16(SP_BASE - 8), 0x48c1, "topmost push = 0x3ddb's return addr 0x48c1");
}

function run(m) {
  m.regs.sp = SP_BASE;
  loc_4894(m);
}

test("loc_4894: straight-line labelled-column setup, tail-jumps to 0x3e01", () => {
  const m = makeMachine();
  run(m);
  assertGolden(m);
});

// -- MUTATION: the T-state total must have teeth ----------------------------------
// Mistranslate the SECOND `ld ix,0x496d` (DD 21, 14 T) as the un-prefixed `ld hl,nn`
// timing (10 T) -- the classic "forgot the DD prefix adds 4 T" copy error. Same
// result value, wrong cycle budget. Confirm the golden T-state assertion catches it.
test("loc_4894 MUTATION: `ld ix,nn` mis-charged 10T (not 14T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) =>
    realStep(nextAddr, nextAddr === 0x48be ? 10 : cycles); // the 2nd ld ix,nn step

  run(m);

  assert.equal(m.tstates, 202, "mutation loses exactly 4 T (14 -> 10)");
  assert.throws(
    () => assertGolden(m),
    /own T-state total/,
    "the golden T-state assertion must fail on the mutant",
  );
});
