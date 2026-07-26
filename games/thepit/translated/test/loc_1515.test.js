// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_1515 (ROM 0x1515-0x1657): the tile-under-object
// classifier / collision dispatch. Entered with IX pointing at the object's
// video-RAM cell (0x806e) and D holding the biased screen column (D & 7 = the
// object's sub-tile offset). It reads the tile at (IX+0), special-cases the
// collectible/gate tiles when grid-aligned, and either latches state + stamps the
// cell and tail-jumps to the shared tail 0x1659, or runs the classification
// ladder that defers the frame via 0x1b5b (arming the 0xb5 push state on a
// table mismatch).
//
// The three golden paths below were computed INDEPENDENTLY from the disassembly
// (games/thepit/out/dk.asm) by walking each opcode's length + T-states by hand,
// NOT from the translation under test, so matching them proves the translation
// charges the ROM's exact cycles and lands every m.step on a real instruction
// boundary. loc_1515 is ENTERED at 0x1515, so the first recorded step is 0x1518
// (the target of the 0x1515 `ld a,(ix+0)`), never 0x1515 itself.
//
//   A tile_3a_call : aligned (D&7==0), tile 0x3a -> call 0x467b, bump 0x8081,
//                    stamp the cell 0x70, jp 0x1659.                     200 T
//   B solid_defer  : not aligned, tile 0x2a is "solid" -> the loc_1578
//                    ladder defers via jp z 0x1b5b.                       135 T
//   C push_arm     : aligned, pushable tile 0x71 mismatches table 0x1b78 ->
//                    arm 0x80a2=1 / 0x8069=0xb5 and jp 0x1b5b.           552 T
//
// The mutation re-runs path B's `jr nz 0x1568` with a corrupted 0x1569 target;
// a taken jr is 12 T either way, so the cycle total is UNCHANGED and it is the
// step-target assertion (not the cycle count) that must reject it.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_1515, loc_1515_1568 } from "../loc_1515.js";

// Leaf-routine machine double: exactly the surface loc_1515 touches. step records
// its target + charges cycles; call records a tail-jump/returning-call target
// WITHOUT running the real callee (0x467b/0x4683/0x1659/0x1b5b are separate
// units); push16 records the pushed return address. A real AddressSpace backs mem
// so the (ix) video-RAM writes and the 0x806e word round-trip faithfully.
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; table 0x1b78 reads ROM (all 0 here)
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x1515,
    steps: [],
    calls: [],
    pushes: [],
    returned: false,
    ret(cycles = 10) {
      this.cycles += cycles;
      this.returned = true;
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // callee's own ret returns to OUR caller
    },
  };
  m.mem = new AddressSpace(rom, m.io);
  m.regs.sp = 0x8780; // inside work RAM, so push16 lands somewhere real
  m.push16 = (v) => {
    m.regs.sp = (m.regs.sp - 2) & 0xffff;
    m.mem.write8(m.regs.sp, v & 0xff);
    m.mem.write8((m.regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    m.pushes.push(v & 0xffff);
  };
  m.step = (nextAddr, cycles) => {
    m.pc = nextAddr;
    m.cycles += cycles;
    m.steps.push(nextAddr);
  };
  for (const [addr, val] of Object.entries(seed)) m.mem.write8(Number(addr), val);
  return m;
}

// --- Golden step targets, from the disassembly-driven per-opcode walker ---

const A_STEPS = [
  0x1518, 0x151b, 0x151e, 0x151f, 0x1520, 0x1522, 0x1524, 0x1525, 0x1527, 0x1529,
  0x467b, 0x152f, 0x1530, 0x1533, 0x155c, 0x1560, 0x1562, 0x1565, 0x1659,
];

const B_STEPS = [
  0x1518, 0x151b, 0x151e, 0x151f, 0x1520, 0x1522, 0x1568, 0x1569, 0x156b, 0x1570,
  0x1571, 0x1573, 0x1578, 0x157a, 0x1b5b,
];

const C_STEPS = [
  0x1518, 0x151b, 0x151e, 0x151f, 0x1520, 0x1522, 0x1524, 0x1525, 0x1527, 0x1535,
  0x1536, 0x1538, 0x153a, 0x153c, 0x153e, 0x1540, 0x1568, 0x1569, 0x156b, 0x1570,
  0x1571, 0x1573, 0x1578, 0x157a, 0x157d, 0x157f, 0x1582, 0x1584, 0x1587, 0x1589,
  0x158c, 0x158e, 0x1591, 0x1593, 0x1595, 0x1597, 0x15a7, 0x15a9, 0x15ab, 0x15ad,
  0x15af, 0x15b0, 0x15b2, 0x15b4, 0x15b6, 0x15b8, 0x15ba, 0x15bc, 0x15bd, 0x15be,
  0x15c0, 0x15c1, 0x15c2, 0x15c5, 0x15c6, 0x15c7, 0x15ca, 0x15cb, 0x15cd, 0x15ce,
  0x15d0, 0x15d2, 0x15d5, 0x15d8, 0x15da, 0x15dd, 0x15df, 0x15e2, 0x1b5b,
];

test("path A: aligned tile 0x3a -> call 0x467b + stamp 0x70 + jp 0x1659", () => {
  // cell = 0x9000; (ix+0)=mem[0x9000]=0x3a; D=0 (aligned). 0x806e = the cell.
  const m = makeMachine({ 0x9000: 0x3a, 0x8081: 0x00 });
  m.mem.write16(0x806e, 0x9000);
  m.regs.ix = 0x9000;
  m.regs.d = 0x00;

  loc_1515(m);

  assert.deepEqual(m.steps, A_STEPS, "step targets");
  assert.equal(m.cycles, 200, "T-state total");
  assert.deepEqual(m.calls, [0x467b, 0x1659], "ordinary call then tail-jump");
  assert.deepEqual(m.pushes, [0x152c], "call 0x467b pushed its return address");
  assert.equal(m.returned, false, "no early ret (tail-jump)");
  assert.equal(m.pc, 0x1659, "final PC");
  assert.equal(m.regs.a, 0x70, "A = the stamp value");
  assert.equal(m.mem.read8(0x80a5), 0x3a, "tile recorded to 0x80a5");
  assert.equal(m.mem.read8(0x80a7), 0x3a, "tile recorded to 0x80a7");
  assert.equal(m.mem.read8(0x8081), 0x01, "0x8081 counter bumped");
  assert.equal(m.mem.read8(0x9000), 0x70, "cell stamped with 0x70");
});

test("path B: not aligned, solid tile 0x2a -> ladder defers via jp z 0x1b5b", () => {
  // cell = 0x9000; (ix+0)=mem[0x9000]=0x2a (solid); D=5 -> D&7==5 (not aligned).
  const m = makeMachine({ 0x9000: 0x2a });
  m.mem.write16(0x806e, 0x9000);
  m.regs.ix = 0x9000;
  m.regs.d = 0x05;

  loc_1515(m);

  assert.deepEqual(m.steps, B_STEPS, "step targets");
  assert.equal(m.cycles, 135, "T-state total");
  assert.deepEqual(m.calls, [0x1b5b], "deferred to 0x1b5b");
  assert.deepEqual(m.pushes, [], "no ordinary calls on this path");
  assert.equal(m.returned, false, "no early ret");
  assert.equal(m.pc, 0x1b5b, "final PC");
  assert.equal(m.regs.a, 0x2a, "A = the classified tile id");
  assert.equal(m.regs.fZ, true, "cp 0x2a set Z (the branch that deferred)");
  assert.equal(m.mem.read8(0x80a5), 0x2a, "tile recorded to 0x80a5");
  assert.equal(m.mem.read8(0x80a7), 0x2a, "tile recorded to 0x80a7");
});

test("path C: aligned pushable tile 0x71 mismatches table -> arm push + jp 0x1b5b", () => {
  // cell = 0x9000; (ix+0)=mem[0x9000]=0x71 (pushable band 0x71..0x9d); D=0
  // (aligned). Table 0x1b78[0] reads ROM = 0, which != 0x71 -> mismatch, arm.
  const m = makeMachine({ 0x9000: 0x71, 0x80a3: 0x00 });
  m.mem.write16(0x806e, 0x9000);
  m.regs.ix = 0x9000;
  m.regs.d = 0x00;

  loc_1515(m);

  assert.deepEqual(m.steps, C_STEPS, "step targets");
  assert.equal(m.cycles, 552, "T-state total");
  assert.deepEqual(m.calls, [0x1b5b], "deferred to 0x1b5b");
  assert.deepEqual(m.pushes, [], "no ordinary calls on this path");
  assert.equal(m.returned, false, "no early ret");
  assert.equal(m.pc, 0x1b5b, "final PC");
  assert.equal(m.regs.a, 0xb5, "A = the push-handler selector");
  assert.equal(m.mem.read8(0x80a5), 0x71, "tile recorded to 0x80a5");
  assert.equal(m.mem.read8(0x80a7), 0x00, "table 0x1b78[0] (ROM=0) recorded to 0x80a7");
  assert.equal(m.mem.read8(0x80a2), 0x01, "push armed: 0x80a2 = 1");
  assert.equal(m.mem.read8(0x8069), 0xb5, "push armed: 0x8069 = 0xb5");
});

test("mutation: a corrupted jr-nz target (0x1568 -> 0x1569) is caught", () => {
  // Byte-identical to loc_1515's prologue up through the `jr nz 0x1568`, except
  // the taken target is stepped to 0x1569. A taken jr is 12 T either way, so the
  // cycle total is UNCHANGED; only the step-target sequence differs. The mutant
  // still delegates to the real loc_1515_1568, so both paths complete identically.
  function loc_1515_mutant(m) {
    const { regs, mem } = m;
    regs.a = mem.read8(regs.ix);
    m.step(0x1518, 19);
    mem.write8(0x80a5, regs.a);
    m.step(0x151b, 13);
    mem.write8(0x80a7, regs.a);
    m.step(0x151e, 13);
    regs.b = regs.a;
    m.step(0x151f, 4);
    regs.a = regs.d;
    m.step(0x1520, 4);
    regs.and(0x07);
    m.step(0x1522, 7);
    if (regs.fNZ) {
      m.step(0x1569, 12); // BUG: should be 0x1568
      return loc_1515_1568(m);
    }
    m.step(0x1524, 7);
  }

  const mkB = () => {
    const m = makeMachine({ 0x9000: 0x2a });
    m.mem.write16(0x806e, 0x9000);
    m.regs.ix = 0x9000;
    m.regs.d = 0x05;
    return m;
  };

  const real = mkB();
  loc_1515(real);
  const mutant = mkB();
  loc_1515_mutant(mutant);

  // Same cycle total (the jr is taken and costs 12 T regardless of target)...
  assert.equal(mutant.cycles, real.cycles, "mutation preserves the cycle total");
  // ...but the step sequence differs at the corrupted target, so a full-path
  // comparison against the real routine's steps must throw.
  assert.throws(
    () => assert.deepEqual(mutant.steps, real.steps, "step targets"),
    /step targets/,
    "the step-target assertion catches the corrupted jr target",
  );
});
