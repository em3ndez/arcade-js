// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_3dae (ROM 0x3dae-0x3dc8): converts the row byte at 0x8059
// into a tilemap offset HL = 32*row + col (col = byte at 0x8058) via three
// `srl h`/`rra` pairs (a *32 shift), and stores HL at 0x805a. The test pins the
// exact T-state total (125), the instruction-boundary step sequence, the final
// A/B/C/HL registers, the little-endian word written at 0x805a, the exit carry,
// and the ret — over two vectors (one with bit 7 set, which distinguishes the
// logical `srl` from an arithmetic `sra`). It then re-runs a mutant that swaps
// `srl h` for `sra h` and proves the assertions reject it.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs, F_C } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_3dae } from "../loc_3dae.js";

// Leaf-routine machine double: exactly the surface loc_3dae touches (regs, mem,
// step, ret). This routine touches only work RAM (0x8058-0x805b), so no ROM
// seeding is needed; `step` records its target + charges cycles, `ret` records
// the return + charges cycles.
function makeMachine({ ram = {} } = {}) {
  const romImg = new Uint8Array(0x5000); // ROM_END + 1
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x3dae,
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

// One straight-line path; the step sequence is identical for every input.
const STEPS = [
  0x3db1, 0x3db2, 0x3db4, 0x3db6, 0x3db7, 0x3db9, 0x3dba, 0x3dbc,
  0x3dbd, 0x3dbe, 0x3dc1, 0x3dc2, 0x3dc4, 0x3dc5, 0x3dc8,
];

// 13+4+7 + 3*(8+4) + 4 + 13+4+7 + 11 + 16 + ret 10 = 125
const CYCLES = 13 + 4 + 7 + (8 + 4) * 3 + 4 + 13 + 4 + 7 + 11 + 16 + 10;

function assertPath(m, exp) {
  assert.deepEqual(m.steps, STEPS, "step targets");
  assert.equal(m.returned, true, "ret");
  assert.equal(m.cycles, CYCLES, "T-state total");
  assert.equal(m.pc, 0x3dc8, "final PC (ret opcode)");
  assert.equal(m.regs.hl, exp.hl, "HL = 32*row + col");
  assert.equal(m.regs.a, exp.a, "A = column byte (last loaded)");
  assert.equal(m.regs.b, 0x00, "B zero-extends the column");
  assert.equal(m.regs.c, exp.c, "C = column byte");
  assert.equal(m.mem.read8(0x805a), exp.hl & 0xff, "0x805a = offset low byte");
  assert.equal(m.mem.read8(0x805b), (exp.hl >> 8) & 0xff, "0x805b = offset high byte");
  assert.equal((m.regs.f & F_C) !== 0, exp.cSet, "carry from add hl,bc");
}

// Vector A: row=0x0a (10), col=0x03 -> HL = 32*10 + 3 = 323 = 0x0143, C clear.
test("row 0x0a, col 0x03 -> HL = 0x0143 stored at 0x805a", () => {
  const m = makeMachine({ ram: { 0x8059: 0x0a, 0x8058: 0x03 } });
  loc_3dae(m);
  assertPath(m, { hl: 0x0143, a: 0x03, c: 0x03, cSet: false });
});

// Vector B: row=0x80 (bit 7 set), col=0x05 -> HL = 32*128 + 5 = 0x1005, C clear.
// bit 7 set is what makes `srl` (logical) vs `sra` (sign-extending) observable.
test("row 0x80, col 0x05 -> HL = 0x1005 (bit-7 vector distinguishes srl/sra)", () => {
  const m = makeMachine({ ram: { 0x8059: 0x80, 0x8058: 0x05 } });
  loc_3dae(m);
  assertPath(m, { hl: 0x1005, a: 0x05, c: 0x05, cSet: false });
});

test("mutation: srl h -> sra h (sign-extending shift) is caught", () => {
  // Byte-identical to loc_3dae except the three `srl h` become `sra h`, which
  // preserves h's bit 7. For row=0x80 the correct HL is 0x1005 (h shifts down to
  // 0x10); sra keeps the top bit, driving h to 0xF0 -> HL = 0xF005. HL and the
  // high byte written at 0x805b both diverge, so assertPath rejects it.
  function loc_3dae_mutant(m) {
    const { regs, mem } = m;
    regs.a = mem.read8(0x8059);
    m.step(0x3db1, 13);
    regs.h = regs.a;
    m.step(0x3db2, 4);
    regs.a = 0x00;
    m.step(0x3db4, 7);
    regs.h = regs.sra(regs.h); // BUG: should be srl
    m.step(0x3db6, 8);
    regs.rra();
    m.step(0x3db7, 4);
    regs.h = regs.sra(regs.h); // BUG
    m.step(0x3db9, 8);
    regs.rra();
    m.step(0x3dba, 4);
    regs.h = regs.sra(regs.h); // BUG
    m.step(0x3dbc, 8);
    regs.rra();
    m.step(0x3dbd, 4);
    regs.l = regs.a;
    m.step(0x3dbe, 4);
    regs.a = mem.read8(0x8058);
    m.step(0x3dc1, 13);
    regs.c = regs.a;
    m.step(0x3dc2, 4);
    regs.b = 0x00;
    m.step(0x3dc4, 7);
    regs.addHl(regs.bc);
    m.step(0x3dc5, 11);
    mem.write16(0x805a, regs.hl);
    m.step(0x3dc8, 16);
    m.ret();
  }

  const m = makeMachine({ ram: { 0x8059: 0x80, 0x8058: 0x05 } });
  loc_3dae_mutant(m);
  assert.throws(() => assertPath(m, { hl: 0x1005, a: 0x05, c: 0x05, cSet: false }), /HL|high byte/);
});
