// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for sub_4bff (ROM 0x4bff-0x4c10, The Pit): arm-and-busy-wait a
// vblank delay. It exercises the two shapes of the routine end-to-end --
//   (1) A = 0: the countdown is already 0, the spin falls straight through
//       (jr nz NOT taken on the first pass) and returns; and
//   (2) A = 3: the multi-iteration spin, with a memory double whose read of
//       0x8009 decrements it (standing in for the per-frame NMI that ticks the
//       countdown down), so the jr-nz-taken loop-back is walked three times and
//       the watchdog is kicked on every spin --
// asserting the exact T-state total, the instruction-boundary step trace, the
// LS259 NMI-enable write (0xB000 b0 = 1), the countdown store/decrement at
// 0x8009, and the per-spin watchdog kick (read of 0xB800). It then re-runs a
// mutant whose loop-back target is corrupted (0x4c08 vs 0x4c07) and proves the
// step-target assertion catches it even though the cycle total is unchanged
// (jr nz taken is 12 T to either address).

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { sub_4bff } from "../sub_4bff.js";

// Machine double: the surface sub_4bff touches. step/ret model advancing PC +
// charging cycles and the epilogue return (WITHOUT popping -- there is no further
// translated frame here). The real AddressSpace + Io are used so the 0xB000 write
// drives the actual LS259 latch and the 0xB800 read kicks the real watchdog.
function makeMachine() {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x4bff,
    steps: [],
    returned: false,
    ret(cycles = 10) {
      this.cycles += cycles;
      this.returned = true;
    },
  };
  m.mem = new AddressSpace(rom, m.io);
  m.step = (nextAddr, cycles) => {
    m.pc = nextAddr;
    m.cycles += cycles;
    m.steps.push(nextAddr);
  };
  return m;
}

// Per-instruction T-states, from the disassembly:
//   setup: ld (nn),a 13 + ld a,n 7 + ld (nn),a 13                = 33
//   spin : ld a,(nn) 13 + ld a,(nn) 13 + and a 4                 = 30, then
//          jr nz taken 12 / not taken 7
//   ret  : 10
// A=N drives N taken spins + 1 non-taken:  33 + N*(30+12) + (30+7) + 10 = 80 + 42*N.
const SETUP_STEPS = [0x4c02, 0x4c04, 0x4c07];
const SPIN_TAKEN = [0x4c0a, 0x4c0d, 0x4c0e, 0x4c07];
const SPIN_EXIT = [0x4c0a, 0x4c0d, 0x4c0e, 0x4c10];

// ---- Path 1: A = 0 -> countdown already zero, fall straight through ---------
test("path 1: A=0 arms the countdown, enables the NMI, and returns on the first spin", () => {
  const m = makeMachine();
  m.regs.a = 0x00;
  m.io.watchdog.framesSinceKick = 5; // must be reset by the 0xB800 read in the spin

  sub_4bff(m);

  assert.deepEqual(m.steps, [...SETUP_STEPS, ...SPIN_EXIT], "step targets");
  assert.equal(m.cycles, 80, "T-state total (80 + 42*0)");
  assert.equal(m.returned, true, "reached the ret");
  assert.equal(m.pc, 0x4c10, "final PC = the ret opcode");
  assert.equal(m.mem.read8(0x8009), 0x00, "countdown stored (A=0)");
  assert.equal(m.io.nmiMask, true, "NMI enabled (LS259 b0 = 1)");
  assert.equal(m.io.watchdog.framesSinceKick, 0, "watchdog kicked by the 0xB800 read");
});

// ---- Path 2: A = 3 -> three loop-backs, then exit ---------------------------
// The memory double decrements 0x8009 on each read (the NMI's per-frame tick),
// so the spin walks 3 -> 2 -> 1 -> 0 and the jr-nz-taken back-edge to 0x4c07 is
// taken three times before the read of 0 falls through.
function installNmiTick(m) {
  const origRead = m.mem.read8.bind(m.mem);
  let watchdogReads = 0;
  m.mem.read8 = (addr) => {
    const v = origRead(addr & 0xffff);
    if ((addr & 0xffff) === 0x8009 && v > 0) {
      m.mem.workRam[0x8009 - 0x8000] = v - 1; // NMI ticks the countdown down
    }
    if ((addr & 0xffff) === 0xb800) watchdogReads++;
    return v;
  };
  return () => watchdogReads;
}

test("path 2: A=3 spins three times (watchdog kicked each spin) then returns at 0", () => {
  const m = makeMachine();
  m.regs.a = 0x03;
  const watchdogReads = installNmiTick(m);

  sub_4bff(m);

  const expected = [
    ...SETUP_STEPS,
    ...SPIN_TAKEN, // read 3 -> back-edge
    ...SPIN_TAKEN, // read 2 -> back-edge
    ...SPIN_TAKEN, // read 1 -> back-edge
    ...SPIN_EXIT, // read 0 -> fall through
  ];
  assert.deepEqual(m.steps, expected, "step targets (3 taken back-edges + exit)");
  assert.equal(m.cycles, 80 + 42 * 3, "T-state total (80 + 42*3 = 206)");
  assert.equal(m.cycles, 206, "T-state total (literal)");
  assert.equal(watchdogReads(), 4, "watchdog kicked once per spin (4 spins)");
  assert.equal(m.mem.read8(0x8009), 0x00, "countdown ticked down to 0");
  assert.equal(m.returned, true, "reached the ret");
  assert.equal(m.pc, 0x4c10, "final PC = the ret opcode");
  assert.equal(m.io.nmiMask, true, "NMI enabled (LS259 b0 = 1)");
});

// ---- Mutation: corrupted loop-back target (0x4c08 vs 0x4c07) ----------------
// jr nz taken costs 12 T to EITHER address, so the cycle total is unchanged --
// only the step-target trace can reject the wrong back-edge. This mutates the
// heart of the routine (the spin's back-edge) and the test must catch it.
test("mutation: a corrupted loop-back target (0x4c08) is caught by the step trace", () => {
  function sub_4bff_mutant(m) {
    const { regs, mem } = m;
    mem.write8(0x8009, regs.a);
    m.step(0x4c02, 13);
    regs.a = 0x01;
    m.step(0x4c04, 7);
    mem.write8(0xb000, regs.a, 10);
    m.step(0x4c07, 13);
    do {
      regs.a = mem.read8(0xb800);
      m.step(0x4c0a, 13);
      regs.a = mem.read8(0x8009);
      m.step(0x4c0d, 13);
      regs.and(regs.a);
      m.step(0x4c0e, 4);
      m.step(regs.fNZ ? 0x4c08 : 0x4c10, regs.fNZ ? 12 : 7); // BUG: back-edge should be 0x4c07
    } while (regs.fNZ);
    m.ret();
  }

  const m = makeMachine();
  m.regs.a = 0x03;
  installNmiTick(m);
  sub_4bff_mutant(m);

  // Same cycle total as the correct routine -- cycles cannot catch this.
  assert.equal(m.cycles, 206, "mutation preserves the cycle total");

  const expected = [...SETUP_STEPS, ...SPIN_TAKEN, ...SPIN_TAKEN, ...SPIN_TAKEN, ...SPIN_EXIT];
  assert.throws(
    () => assert.deepEqual(m.steps, expected, "step targets"),
    /step targets/,
    "the step-target assertion must reject the corrupted back-edge",
  );
});
