// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_3410 (ROM 0x3410-0x3424): a 32-byte table search via
// cpir over the 0x35fe table, keyed on the byte at (word@0x8089)+1 and offset
// by the row index at 0x808d. The test exercises both the FOUND path (cpir
// terminates on a match, Z set) and the NOT-FOUND path (cpir exhausts the
// 32-byte row, Z clear), asserting the exact T-state total (whose cpir term is
// 21*(n-1)+16, NOT a constant), the instruction-boundary step sequence, the
// final A/HL/BC/DE registers, the Z flag, and the ret. It then re-runs a mutant
// whose table base is 0x34fe (the sibling routine's table — an easy copy-paste
// slip) and proves the assertions reject it.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs, F_Z } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_3410 } from "../loc_3410.js";

// Leaf-routine machine double: exactly the surface loc_3410 touches (regs, mem,
// step, ret). `step` records its target + charges cycles; `ret` records the
// return + charges cycles. ROM (the 0x35fe search table lives there) is seeded
// directly into the backing image since write8 to ROM throws; RAM is seeded
// through write8.
function makeMachine({ ram = {}, rom = {} } = {}) {
  const romImg = new Uint8Array(0x5000); // ROM_END + 1
  for (const [addr, val] of Object.entries(rom)) romImg[Number(addr)] = val & 0xff;
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x3410,
    steps: [],
    returned: false,
    ret(cycles = 10) {
      this.cycles += cycles;
      this.returned = true;
    },
  };
  m.mem = new AddressSpace(romImg, m.io);
  m.step = (nextAddr, cycles) => {
    m.pc = nextAddr;
    m.cycles += cycles;
    m.steps.push(nextAddr);
  };
  for (const [addr, val] of Object.entries(ram)) m.mem.write8(Number(addr), val);
  return m;
}

// The straight-line step sequence is identical on every path (cpir is one
// instruction whatever n is); only the cycle total and register outcome vary.
const STEPS = [0x3413, 0x3414, 0x3416, 0x3419, 0x341a, 0x341b, 0x341e, 0x341f, 0x3422, 0x3424];

// Fixed cost of the nine instructions before cpir, plus the trailing ret.
const PRE = 13 + 4 + 7 + 16 + 6 + 7 + 10 + 11 + 10; // 84
const RET = 10;
const cpirCost = (n) => 21 * (n - 1) + 16;

function assertPath(m, exp) {
  assert.deepEqual(m.steps, STEPS, "step targets");
  assert.equal(m.returned, true, "ret");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, 0x3424, "final PC (ret opcode)");
  assert.equal(m.regs.a, exp.a, "A register (search key, unchanged by cpir)");
  assert.equal(m.regs.hl, exp.hl, "HL = matched addr + 1 / row end");
  assert.equal(m.regs.bc, exp.bc, "BC = 0x20 - n");
  assert.equal(m.regs.d, 0x00, "D zero-extends the index");
  assert.equal(m.regs.e, exp.e, "E = the 0x808d row index");
  assert.equal((m.regs.f & F_Z) !== 0, exp.zSet, "Z flag = match found");
}

// FOUND: index 0x04 -> row base 0x35fe+4 = 0x3602. Key = mem[(0x8100)+1] = 0x42,
// placed at base+3 = 0x3605. cpir hits on the 4th compare: n=4, HL=0x3606,
// BC=0x1c, Z set. Row index 4 (not 0) proves `add hl,de` actually offsets.
function foundMachine() {
  return makeMachine({
    ram: {
      0x808d: 0x04, // row index -> E=4, DE=4
      0x8089: 0x00, // word@0x8089 low  -> 0x8100
      0x808a: 0x81, // word@0x8089 high
      0x8100: 0x77, // (the byte BEFORE +1) -- must NOT be the key, guards `inc hl`
      0x8101: 0x42, // key = byte at (word)+1
    },
    rom: {
      0x3605: 0x42, // match at base+3 (0x3602 + 3)
    },
  });
}

const FOUND = {
  cycles: PRE + cpirCost(4) + RET, // 84 + 79 + 10 = 173
  a: 0x42,
  hl: 0x3606,
  bc: 0x001c,
  e: 0x04,
  zSet: true,
};

// NOT FOUND: same setup, key 0x99 that appears nowhere in the (zeroed) row.
// cpir walks all 32 bytes: n=32, HL = 0x3602 + 32 = 0x3622, BC=0, Z clear.
function missMachine() {
  return makeMachine({
    ram: {
      0x808d: 0x04,
      0x8089: 0x00,
      0x808a: 0x81,
      0x8101: 0x99, // key absent from the row
    },
  });
}

const MISS = {
  cycles: PRE + cpirCost(32) + RET, // 84 + 667 + 10 = 761
  a: 0x99,
  hl: 0x3622,
  bc: 0x0000,
  e: 0x04,
  zSet: false,
};

test("found: cpir terminates on a match -> Z set, HL = matched+1", () => {
  const m = foundMachine();
  loc_3410(m);
  assertPath(m, FOUND);
});

test("not found: cpir exhausts the 32-byte row -> Z clear, BC = 0", () => {
  const m = missMachine();
  loc_3410(m);
  assertPath(m, MISS);
});

test("inc hl is load-bearing: the key is (word@0x8089)+1, not (word@0x8089)", () => {
  // If the routine dropped `inc hl` it would read mem[0x8100]=0x77 as the key.
  // 0x77 is absent from the row, so the FOUND fixture would MISS. Asserting the
  // hit proves the +1 happened.
  const m = foundMachine();
  loc_3410(m);
  assert.equal(m.regs.a, 0x42, "A must be the +1 byte (0x42), not 0x77");
  assert.equal((m.regs.f & F_Z) !== 0, true, "match found only if the +1 byte was used");
});

test("mutation: wrong table base (0x34fe, the sibling's) is caught", () => {
  // Byte-identical to loc_3410 except `ld hl,0x35fe` -> `ld hl,0x34fe`. The row
  // now starts at 0x34fe+4 = 0x3502 (zeroed in the fixture), so the key 0x42 is
  // never found: cpir runs all 32 iterations. Cycle total, HL, BC and Z all
  // shift, so assertPath rejects it on multiple counts.
  function loc_3410_mutant(m) {
    const { regs, mem } = m;
    regs.a = mem.read8(0x808d);
    m.step(0x3413, 13);
    regs.e = regs.a;
    m.step(0x3414, 4);
    regs.d = 0x00;
    m.step(0x3416, 7);
    regs.hl = mem.read16(0x8089);
    m.step(0x3419, 16);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x341a, 6);
    regs.a = mem.read8(regs.hl);
    m.step(0x341b, 7);
    regs.hl = 0x34fe; // BUG: should be 0x35fe
    m.step(0x341e, 10);
    regs.addHl(regs.de);
    m.step(0x341f, 11);
    regs.bc = 0x0020;
    m.step(0x3422, 10);
    const n = regs.cpir(mem);
    m.step(0x3424, 21 * (n - 1) + 16);
    m.ret();
  }

  const m = foundMachine();
  loc_3410_mutant(m);
  assert.throws(() => assertPath(m, FOUND), /T-state total|HL|match found/);
});
