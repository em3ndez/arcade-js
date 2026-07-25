// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_4632 (ROM 0x4632, The Pit).
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags,
 * a flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine) so the
 * routine runs in isolation without a ROM image. Asserts T-state totals for both
 * branch paths, the field copy (5 bytes, stride 3), the destination-base selection
 * gated on (0x8002), register/PC/control-flow effects, plus a deliberate mutation
 * the T-state assertion must catch.
 *
 * Run: node --test games/thepit/translated/test/loc_4632.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_4632 } from "../loc_4632.js";

// Minimal machine matching the surface loc_4632 uses: regs, mem, step, ret,
// push16/pop16. `calls` records every m.call target in order; `tstates`
// accumulates the charged cycles; `pc` tracks the last step target.
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
    pc: 0x4632,
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
      return undefined; // callees stubbed -- loc_4632 makes none anyway
    },
  };
}

// Simulate the caller's CALL: seat a return address on the stack so the routine's
// `ret` pops a known value.
const CALLER_RET = 0xabcd;
function seatCaller(m) {
  m.regs.sp = 0x8780; // inside work RAM (0x8000-0x87FF)
  m.push16(CALLER_RET);
}

// Distinct source bytes at 0x8028 + k, k in {0,3,6,9,0xC}.
function seedSource(m) {
  m.mem.write8(0x8028, 0x11);
  m.mem.write8(0x802b, 0x22);
  m.mem.write8(0x802e, 0x33);
  m.mem.write8(0x8031, 0x44);
  m.mem.write8(0x8034, 0x55);
}

// -- Path Z: (0x8002)==1 -> dec a == 0 -> jr z taken -> dest stays 0x8029 ---------
function assertPathZGolden(m) {
  assert.equal(m.tstates, 257, "Path Z T-state total (jr z taken, no inc ix)");
  assert.equal(m.regs.iy, 0x8028, "iy = source base 0x8028");
  assert.equal(m.regs.ix, 0x8029, "ix = dest 0x8029 (unbumped when (0x8002)==1)");
  assert.deepEqual(m.calls, [], "no calls -- straight copy then ret");
  assert.equal(m.pc, CALLER_RET, "ret popped the caller's return address");
  // 5 fields copied stride 3, (0x8028+k) -> (0x8029+k)
  assert.equal(m.mem.read8(0x8029), 0x11, "field 0: 0x8028 -> 0x8029");
  assert.equal(m.mem.read8(0x802c), 0x22, "field 1: 0x802B -> 0x802C");
  assert.equal(m.mem.read8(0x802f), 0x33, "field 2: 0x802E -> 0x802F");
  assert.equal(m.mem.read8(0x8032), 0x44, "field 3: 0x8031 -> 0x8032");
  assert.equal(m.mem.read8(0x8035), 0x55, "field 4: 0x8034 -> 0x8035");
  assert.equal(m.regs.a, 0x55, "A holds the last field read (mem[0x8034])");
}

function runPathZ(m) {
  seatCaller(m);
  seedSource(m);
  m.mem.write8(0x8002, 0x01); // dec a -> 0 -> Z set -> dest stays 0x8029
  loc_4632(m);
}

test("loc_4632 Path Z: (0x8002)==1 -> dest 0x8029, 5-field stride-3 copy", () => {
  const m = makeMachine();
  runPathZ(m);
  assertPathZGolden(m);
});

// -- Path NZ: (0x8002)!=1 -> jr z NOT taken -> inc ix -> dest 0x802A --------------
function assertPathNZGolden(m) {
  assert.equal(m.tstates, 274, "Path NZ T-state total (jr z not taken + inc ix)");
  assert.equal(m.regs.ix, 0x802a, "ix bumped to dest 0x802A");
  assert.equal(m.regs.iy, 0x8028, "iy still source base 0x8028");
  assert.equal(m.pc, CALLER_RET, "ret popped the caller's return address");
  // copy lands one byte further along than Path Z
  assert.equal(m.mem.read8(0x802a), 0x11, "field 0: 0x8028 -> 0x802A");
  assert.equal(m.mem.read8(0x802d), 0x22, "field 1: 0x802B -> 0x802D");
  assert.equal(m.mem.read8(0x8030), 0x33, "field 2: 0x802E -> 0x8030");
  assert.equal(m.mem.read8(0x8033), 0x44, "field 3: 0x8031 -> 0x8033");
  assert.equal(m.mem.read8(0x8036), 0x55, "field 4: 0x8034 -> 0x8036");
  // the Path-Z destination cells must be untouched on this path
  assert.equal(m.mem.read8(0x8029), 0x00, "0x8029 NOT written on the NZ path");
}

function runPathNZ(m) {
  seatCaller(m);
  seedSource(m);
  m.mem.write8(0x8002, 0x02); // dec a -> 1 -> Z clear -> inc ix -> dest 0x802A
  loc_4632(m);
}

test("loc_4632 Path NZ: (0x8002)!=1 -> inc ix, dest 0x802A", () => {
  const m = makeMachine();
  runPathNZ(m);
  assertPathNZGolden(m);
});

// -- MUTATION: the T-state total must have teeth ----------------------------------
// Mis-charge `inc ix` (DD 23, 10 T) as if it were plain `inc hl` (0x23, 6 T) -- a
// very plausible copy error, since the two share the base opcode byte. Run Path NZ
// (the only path that executes inc ix) with that one instruction mis-charged and
// confirm the golden T-state assertion catches it.
test("loc_4632 MUTATION: `inc ix` mis-charged 6T (not 10T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) =>
    realStep(nextAddr, nextAddr === 0x4642 ? 6 : cycles); // the inc ix step

  runPathNZ(m);

  assert.equal(m.tstates, 270, "mutation loses exactly 4 T (10 -> 6)");
  assert.throws(
    () => assertPathNZGolden(m),
    /Path NZ T-state total/,
    "the golden T-state assertion must fail on the mutant",
  );
});
