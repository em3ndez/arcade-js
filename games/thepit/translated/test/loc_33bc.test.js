// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for loc_33bc (ROM 0x33bc) — the 32-byte table-row search.
 *
 * The routine builds DE from the byte at 0x808d (D=0), reads a pointer from
 * (0x8089), conditionally steps that pointer back one column (`dec hl`) when
 * ((0x8086)+5)&7 == 0, fetches the byte it points at, then `cpir`s a 0x20-byte
 * row based at 0x34fe+DE looking for that byte. It ends with an unconditional
 * `ret`. cpir leaves Z SET iff the byte was found and HL one past the match.
 *
 * Driven against the REAL Pit AddressSpace + Io (work RAM at 0x808x / the 0x82xx
 * pointer target, ROM table at 0x34fe are all genuine addresses), with the ROM
 * search row seeded directly into the ROM image and a leaf-machine surface
 * (regs, mem, step, ret) that records the T-state total and the step-boundary
 * sequence.
 *
 * It pins, against the disassembly:
 *   - the DE index (0x808d, D=0), the (0x8089) pointer read, the phase test on
 *     0x8086, and the conditional `dec hl`;
 *   - BOTH jr branches — the not-taken path visits 0x33ce (dec hl), the taken
 *     path jumps 0x33cc -> 0x33cf, skipping it;
 *   - cpir's found result: Z set, HL one past the match, BC = 0x20 - n, A = the
 *     search byte; and the not-found result: Z clear, BC = 0, HL = base+0x20;
 *   - the exact T-state totals (dec-hl+found = 249, taken+found = 185,
 *     dec-hl+not-found = 795), including cpir's first-use 21*(n-1)+16 cost;
 *   - every m.step target lands on a real instruction boundary (stepcheck),
 *     ending on the ret opcode 0x33d9.
 *
 * TEETH: a broken twin that DROPS the `dec hl` value change (keeps its step, so
 * the boundary sequence is unchanged) reads the search byte from the wrong,
 * un-stepped pointer — which is NOT in the seeded row — so the search misses.
 * The scenario-A contract check MUST catch it (Z clear, wrong BC/HL/A).
 *
 * Run: node --test games/thepit/translated/test/loc_33bc.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_33bc } from "../loc_33bc.js";

// Leaf-routine machine double: exactly the surface loc_33bc touches. `seed` gets
// the machine to fill the ROM search row (m.rom) and work RAM (m.mem) for the case.
function makeMachine(seed) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1
  const io = new Io();
  const m = {
    regs: new Regs(),
    io,
    cycles: 0,
    pc: 0x33bc,
    steps: [],
    returned: false,
    ret(cycles = 10) {
      this.cycles += cycles;
      this.returned = true;
    },
    call() {
      throw new Error("loc_33bc makes no calls");
    },
  };
  m.mem = new AddressSpace(rom, io);
  m.rom = rom;
  m.step = (nextAddr, cycles) => {
    m.pc = nextAddr;
    m.cycles += cycles;
    m.steps.push(nextAddr);
  };
  seed(m);
  return m;
}

// Fill a 0x20-byte ROM row [base, base+0x20) with `filler`, optionally planting
// `hit` at `off`.
function fillRow(m, base, filler, off, hit) {
  for (let i = 0; i < 0x20; i++) m.rom[base + i] = filler;
  if (off !== undefined) m.rom[base + off] = hit;
}

// -- Scenario A: dec-hl branch (jr NOT taken), byte FOUND --------------------
// (0x8086)=0x03 -> (3+5)&7 = 0 -> jr not taken -> dec hl. DE = (0x808d)=0x20, so
// row base = 0x34fe+0x20 = 0x351e. Pointer (0x8089)=0x8201 -> dec -> 0x8200,
// holding 0x42; the row carries 0x42 at offset 5 (0x3523).
function seedA(m) {
  fillRow(m, 0x351e, 0xaa, 5, 0x42);
  m.mem.write8(0x808d, 0x20);
  m.mem.write8(0x8086, 0x03);
  m.mem.write8(0x8089, 0x01); // pointer lo
  m.mem.write8(0x808a, 0x82); // pointer hi -> HL = 0x8201
  m.mem.write8(0x8200, 0x42); // byte at the STEPPED pointer (correct read)
  m.mem.write8(0x8201, 0x55); // byte at the un-stepped pointer (0x55 is NOT in the row)
}

const SEQ_A = [
  0x33bf, 0x33c0, 0x33c2, 0x33c5, 0x33c8, 0x33ca, 0x33cc,
  0x33ce, 0x33cf, 0x33d0, 0x33d3, 0x33d4, 0x33d7, 0x33d9,
];

function checkContractA(m) {
  assert.equal(m.regs.a, 0x42, "A = the fetched search byte (0x42)");
  assert.equal(m.regs.de, 0x0020, "DE = (0x808d) with D=0");
  assert.equal(m.regs.hl, 0x3524, "HL = one past the match (0x3523+1)");
  assert.equal(m.regs.bc, 0x001a, "BC = 0x20 - 6 iterations");
  assert.equal(m.regs.fZ, true, "Z SET -- cpir found the byte");
  assert.equal(m.cycles, 249, "T-state total (dec-hl + found, cpir n=6)");
  assert.equal(m.returned, true, "routine returns via ret");
  assert.equal(m.pc, 0x33d9, "final step target is the ret opcode");
  assert.deepEqual(m.steps, SEQ_A, "step boundaries incl. dec hl at 0x33ce");
}

test("loc_33bc: dec-hl branch, byte found (Z set, cpir n=6, 249 T)", () => {
  const m = makeMachine(seedA);
  loc_33bc(m);
  checkContractA(m);
  console.log("  loc_33bc A: 249 T, dec hl taken, cpir found @0x3523 -> HL=0x3524, BC=0x1a, Z=1");
});

// -- Scenario B: jr TAKEN branch (no dec hl), byte FOUND ---------------------
// (0x8086)=0x00 -> (0+5)&7 = 5 != 0 -> jr taken (0x33cc -> 0x33cf, skip dec hl).
// DE=(0x808d)=0x00 -> row base = 0x34fe. Pointer (0x8089)=0x8300 (not stepped),
// holding 0x37; row carries 0x37 at offset 2 (0x3500).
function seedB(m) {
  fillRow(m, 0x34fe, 0xaa, 2, 0x37);
  m.mem.write8(0x808d, 0x00);
  m.mem.write8(0x8086, 0x00);
  m.mem.write8(0x8089, 0x00);
  m.mem.write8(0x808a, 0x83); // HL = 0x8300
  m.mem.write8(0x8300, 0x37);
}

const SEQ_B = [
  0x33bf, 0x33c0, 0x33c2, 0x33c5, 0x33c8, 0x33ca, 0x33cc,
  0x33cf, 0x33d0, 0x33d3, 0x33d4, 0x33d7, 0x33d9,
];

test("loc_33bc: jr-taken branch skips dec hl, byte found (185 T)", () => {
  const m = makeMachine(seedB);
  loc_33bc(m);
  assert.equal(m.regs.a, 0x37, "A = fetched byte 0x37");
  assert.equal(m.regs.de, 0x0000, "DE = 0 (0x808d=0)");
  assert.equal(m.regs.hl, 0x3501, "HL = one past the match (0x3500+1)");
  assert.equal(m.regs.bc, 0x001d, "BC = 0x20 - 3 iterations");
  assert.equal(m.regs.fZ, true, "Z SET -- found");
  assert.equal(m.cycles, 185, "T-state total (jr taken + found, cpir n=3)");
  assert.equal(m.returned, true, "returns via ret");
  assert.deepEqual(m.steps, SEQ_B, "step boundaries jump 0x33cc -> 0x33cf (no 0x33ce)");
  console.log("  loc_33bc B: 185 T, jr taken (no dec hl), cpir found @0x3500 -> HL=0x3501, BC=0x1d");
});

// -- Scenario C: dec-hl branch, byte NOT FOUND (cpir exhausts BC) ------------
function seedC(m) {
  fillRow(m, 0x351e, 0xaa); // no 0x42 planted anywhere in the row
  m.mem.write8(0x808d, 0x20);
  m.mem.write8(0x8086, 0x03);
  m.mem.write8(0x8089, 0x01);
  m.mem.write8(0x808a, 0x82);
  m.mem.write8(0x8200, 0x42); // searched byte, absent from the row
}

test("loc_33bc: byte not found -> Z clear, BC=0, HL=base+0x20 (795 T)", () => {
  const m = makeMachine(seedC);
  loc_33bc(m);
  assert.equal(m.regs.fZ, false, "Z CLEAR -- cpir exhausted without a match");
  assert.equal(m.regs.bc, 0x0000, "BC = 0 (all 0x20 scanned)");
  assert.equal(m.regs.hl, 0x353e, "HL = 0x351e + 0x20 (walked the whole row)");
  assert.equal(m.regs.a, 0x42, "A unchanged by cpir");
  assert.equal(m.cycles, 795, "T-state total (dec-hl + miss, cpir n=32)");
  assert.equal(m.returned, true, "routine still returns via the unconditional ret");
  console.log("  loc_33bc C: 795 T, cpir miss -> Z=0, BC=0, HL=0x353e");
});

// -- TEETH -------------------------------------------------------------------
// A faithful copy EXCEPT it DROPS the `dec hl` value change (keeps its m.step, so
// the boundary sequence is identical). Under scenario A it reads the search byte
// from the un-stepped pointer 0x8201 (=0x55, absent from the row) instead of
// 0x8200 (=0x42), so cpir misses. The scenario-A contract check must catch it.
function brokenSub33bc(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x808d);
  m.step(0x33bf, 13);
  regs.e = regs.a;
  m.step(0x33c0, 4);
  regs.d = 0x00;
  m.step(0x33c2, 7);
  regs.hl = mem.read16(0x8089);
  m.step(0x33c5, 16);
  regs.a = mem.read8(0x8086);
  m.step(0x33c8, 13);
  regs.add(0x05);
  m.step(0x33ca, 7);
  regs.and(0x07);
  m.step(0x33cc, 7);
  if (regs.fNZ) {
    m.step(0x33cf, 12);
  } else {
    m.step(0x33ce, 7);
    // BUG: `dec hl` value change dropped -- pointer not stepped back a column.
    m.step(0x33cf, 6);
  }
  regs.a = mem.read8(regs.hl);
  m.step(0x33d0, 7);
  regs.hl = 0x34fe;
  m.step(0x33d3, 10);
  regs.addHl(regs.de);
  m.step(0x33d4, 11);
  regs.bc = 0x0020;
  m.step(0x33d7, 10);
  const n = regs.cpir(mem);
  m.step(0x33d9, 21 * (n - 1) + 16);
  m.ret();
}

test("TEETH: the dec-hl-dropping twin is CAUGHT by the scenario-A contract", () => {
  const m = makeMachine(seedA);
  brokenSub33bc(m);
  assert.throws(
    () => checkContractA(m),
    /A = the fetched search byte|Z SET|one past the match|0x20 - 6/,
    "the contract check FAILED to catch a dropped dec hl -- it has no teeth",
  );
  // and concretely: the un-stepped read searched for 0x55, which misses the row.
  assert.equal(m.regs.a, 0x55, "broken twin reads the un-stepped pointer (0x55)");
  assert.equal(m.regs.fZ, false, "broken twin's cpir MISSES -> Z clear");
});
