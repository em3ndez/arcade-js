// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_3476 (ROM 0x3476-0x34d9): the BC=0x00ff / D=0 entry into
// the shared object-mover tail at 0x3490. loc_3476 always presets B=0x00, so the
// `bit 0,b` at 0x34a3 is always Z and the 0x34a7-0x34cf sprite branch is DEAD
// from this entry -- the only two reachable exits are:
//   Path A -- counter still running: (0x808b) dec != 0 -> `jr nz` at 0x3497 jumps
//             straight to 0x34d2 (position-only update).
//   Path B -- counter expires: (0x808b) dec == 0 -> reload from 0x8091, publish D
//             to 0x8092, then `bit 0,b` (B=0) Z-set -> `jr z` at 0x34a5 to 0x34d2.
// Both converge at 0x34d2, which adds C (0xff = -1) to the X position byte 0x8086.
// The test asserts the exact T-state total, the instruction-boundary step
// sequence, the final A + carry, the counter/direction/position bytes, and the
// ret, on each path. It then re-runs a mutant whose `add a,c` at 0x34d5 is swapped
// to `add a,b` (a cycle-identical register slip) and proves the value assertions
// reject it.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs, F_C } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_3476 } from "../loc_3476.js";

// Leaf-routine machine double: exactly the surface loc_3476 touches (regs, mem,
// step, ret). step records its target + charges cycles; ret records the return +
// charges cycles. The routine has no `call` and no tail-jump-out (it ends `ret`).
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x3476,
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
  for (const [addr, val] of Object.entries(seed)) m.mem.write8(Number(addr), val);
  return m;
}

function assertPath(m, exp) {
  assert.deepEqual(m.steps, exp.steps, "step targets");
  assert.equal(m.returned, true, "ret");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, 0x34d9, "final PC (ret opcode)");
  assert.equal(m.regs.a, exp.a, "A register");
  assert.equal((m.regs.f & F_C) !== 0, exp.cSet, "carry from add a,c");
  assert.equal(m.mem.read8(0x808b), exp.counter, "0x808b counter");
  assert.equal(m.mem.read8(0x8092), exp.dir, "0x8092 direction index");
  assert.equal(m.mem.read8(0x8086), exp.posX, "0x8086 X position");
}

// Path A -- counter still running: 0x808b = 5 -> dec to 4 (nonzero), jr nz at
// 0x3497 taken -> 0x34d2. Position 0x8086: 0x20 + 0xff = 0x1f (carry out). The
// reload/direction path is NOT reached, so 0x8092 stays untouched.
const PATH_A = {
  steps: [0x3479, 0x347b, 0x3490, 0x3493, 0x3494, 0x3497, 0x34d2, 0x34d5, 0x34d6, 0x34d9],
  cycles: 10 + 7 + 12 + 13 + 4 + 13 + 12 + 13 + 4 + 13 + 10, // 111 (incl. final ret)
  a: 0x1f,
  cSet: true,
  counter: 0x04,
  dir: 0x00, // untouched (seeded 0)
  posX: 0x1f,
};

// Path B -- counter expires: 0x808b = 1 -> dec to 0, jr nz NOT taken; reload
// 0x808b from 0x8091 (0x0a), publish D=0 to 0x8092, bit 0,b (B=0) Z-set -> jr z
// taken -> 0x34d2. Same position math as Path A.
const PATH_B = {
  steps: [
    0x3479, 0x347b, 0x3490, 0x3493, 0x3494, 0x3497, 0x3499, 0x349c, 0x349f,
    0x34a0, 0x34a3, 0x34a5, 0x34d2, 0x34d5, 0x34d6, 0x34d9,
  ],
  cycles: 10 + 7 + 12 + 13 + 4 + 13 + 7 + 13 + 13 + 4 + 13 + 8 + 12 + 13 + 4 + 13 + 10, // 169
  a: 0x1f,
  cSet: true,
  counter: 0x0a, // reloaded from 0x8091
  dir: 0x00, // D published
  posX: 0x1f,
};

test("path A: counter still running -> jr nz to 0x34d2, position only", () => {
  const m = makeMachine({ 0x808b: 0x05, 0x8086: 0x20, 0x8092: 0x77 });
  loc_3476(m);
  // 0x8092 must be UNTOUCHED on this path (the reload/publish block is skipped).
  assert.equal(m.mem.read8(0x8092), 0x77, "0x8092 untouched when counter still running");
  const expA = { ...PATH_A, dir: 0x77 };
  assertPath(m, expA);
});

test("path B: counter expires -> reload + publish D, jr z (B=0) to 0x34d2", () => {
  const m = makeMachine({ 0x808b: 0x01, 0x8091: 0x0a, 0x8086: 0x20, 0x8092: 0x77 });
  loc_3476(m);
  assertPath(m, PATH_B);
});

test("B=0 forces the jr z at 0x34a5: the sprite byte 0x8084 is never written", () => {
  // The 0x34a7-0x34cf branch (which alone writes 0x8084) is dead from loc_3476,
  // because the entry presets B=0 and `bit 0,b` is therefore always Z.
  const m = makeMachine({ 0x808b: 0x01, 0x8091: 0x0a, 0x8086: 0x20, 0x8084: 0x5a });
  loc_3476(m);
  assert.equal(m.mem.read8(0x8084), 0x5a, "0x8084 untouched (sprite branch unreachable for B=0)");
  assert.ok(!m.steps.includes(0x34a7), "0x34a7 is never stepped to");
});

test("mutation: `add a,b` for `add a,c` at 0x34d5 is caught", () => {
  // Byte-identical to loc_3476 except the position update adds B (0x00) instead
  // of C (0xff). Cycles are UNCHANGED (add a,r is 4T either way), so only the
  // value assertions can reject it: 0x8086 stays 0x20 (and A ends 0x20, no carry)
  // instead of 0x20 + 0xff = 0x1f with carry.
  function loc_3476_mutant(m) {
    const { regs, mem } = m;
    let next = 0x3476;
    for (;;) {
      switch (next) {
        case 0x3476: {
          regs.bc = 0x00ff; m.step(0x3479, 10);
          regs.d = 0x00; m.step(0x347b, 7);
          m.step(0x3490, 12); next = 0x3490; break;
        }
        case 0x3490: {
          regs.a = mem.read8(0x808b); m.step(0x3493, 13);
          regs.a = regs.dec8(regs.a); m.step(0x3494, 4);
          mem.write8(0x808b, regs.a); m.step(0x3497, 13);
          if (regs.fNZ) { m.step(0x34d2, 12); next = 0x34d2; break; }
          m.step(0x3499, 7);
          regs.a = mem.read8(0x8091); m.step(0x349c, 13);
          mem.write8(0x808b, regs.a); m.step(0x349f, 13);
          regs.a = regs.d; m.step(0x34a0, 4);
          mem.write8(0x8092, regs.a); m.step(0x34a3, 13);
          regs.bit(0, regs.b); m.step(0x34a5, 8);
          if (regs.fZ) { m.step(0x34d2, 12); next = 0x34d2; break; }
          m.step(0x34a7, 7);
          regs.a = mem.read8(0x8083); m.step(0x34aa, 13);
          regs.add(regs.b); m.step(0x34ab, 4);
          mem.write8(0x8083, regs.a); m.step(0x34ae, 13);
          regs.add(0x04); m.step(0x34b0, 7);
          regs.and(0x06); m.step(0x34b2, 7);
          if (regs.fNZ) { m.step(0x34b6, 12); next = 0x34b6; break; }
          m.step(0x34b4, 7);
          regs.e = 0x17; m.step(0x34b6, 7);
          next = 0x34b6; break;
        }
        case 0x34d2: {
          regs.a = mem.read8(0x8086); m.step(0x34d5, 13);
          regs.add(regs.b); m.step(0x34d6, 4); // BUG: should be add a,c
          mem.write8(0x8086, regs.a); m.step(0x34d9, 13);
          m.ret(); return;
        }
        default:
          throw new Error("mutant: unexpected block 0x" + next.toString(16));
      }
    }
  }

  const m = makeMachine({ 0x808b: 0x05, 0x8086: 0x20, 0x8092: 0x77 });
  loc_3476_mutant(m);
  // Cycles are identical to the real Path A, so only the value checks reject it.
  assert.equal(m.cycles, PATH_A.cycles, "mutation preserves the cycle total (so cycles cannot catch it)");
  assert.equal(m.mem.read8(0x8086), 0x20, "mutant added B=0, leaving 0x8086 unchanged");
  const expA = { ...PATH_A, dir: 0x77 };
  assert.throws(() => assertPath(m, expA), /A register|carry from add a,c|X position/);
});
