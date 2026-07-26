// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_347d (ROM 0x347d-0x34d9): the BC=0x0100 / D=1 entry into
// the shared object-mover tail at 0x3490. Unlike its sibling loc_3476 (B=0x00),
// loc_347d presets B=0x01, so bit 0 of B is SET and the `bit 0,b` at 0x34a3 is
// Z-CLEAR -- the 0x34a7-0x34cf sprite-orientation branch is LIVE from this entry.
// Two paths are exercised:
//   Path A -- counter still running: (0x808b) dec != 0 -> `jr nz` at 0x3497 jumps
//             straight to 0x34d2 (position-only update). C=0x00, so 0x8086 is
//             unchanged; the reload/sprite block is not reached.
//   Path B -- counter expires: (0x808b) dec == 0 -> reload from 0x8091, publish
//             D=1 to 0x8092, `bit 0,b` (B=1) Z-CLEAR -> fall through the selector
//             chain, pick E, and (bit7 of B = 0 -> `jr nz` NOT taken) XOR 0x80 the
//             sprite code before storing it to 0x8084. Then 0x34d2 adds C (0x00).
// The test asserts the exact T-state total, the instruction-boundary step
// sequence, A + carry, the counter/direction/position/accumulator bytes AND the
// mirrored sprite code at 0x8084 on each path. It then re-runs a mutant whose
// `xor 0x80` at 0x34cd is neutered to `xor 0x00` (a cycle-identical, same-path
// slip on the live branch) and proves the 0x8084 assertion rejects it.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs, F_C } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_347d } from "../loc_347d.js";

// Leaf-routine machine double: exactly the surface loc_347d touches (regs, mem,
// step, ret). step records its target + charges cycles; ret records the return +
// charges cycles. The routine has no `call` and no tail-jump-out (it ends `ret`).
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x347d,
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
  assert.equal(m.mem.read8(0x8084), exp.sprite, "0x8084 sprite/orientation code");
  assert.equal(m.mem.read8(0x8083), exp.accum, "0x8083 orientation accumulator");
}

// Path A -- counter still running: 0x808b = 5 -> dec to 4 (nonzero), jr nz at
// 0x3497 taken -> 0x34d2. C=0x00, so 0x8086 (0x20) is unchanged (A=0x20, no
// carry). The reload/direction/sprite block is NOT reached, so 0x8092/0x8084/
// 0x8083 stay at their seeded sentinel values.
const PATH_A = {
  steps: [0x3480, 0x3482, 0x3490, 0x3493, 0x3494, 0x3497, 0x34d2, 0x34d5, 0x34d6, 0x34d9],
  cycles: 10 + 7 + 12 + 13 + 4 + 13 + 12 + 13 + 4 + 13 + 10, // 111 (incl. final ret)
  a: 0x20,
  cSet: false,
  counter: 0x04,
  dir: 0x77, // untouched sentinel
  posX: 0x20, // 0x20 + C(0x00)
  sprite: 0x5a, // untouched sentinel
  accum: 0x10, // untouched sentinel
};

// Path B -- counter expires: 0x808b = 1 -> dec to 0, jr nz NOT taken; reload
// 0x808b from 0x8091 (0x0a), publish D=1 to 0x8092, bit 0,b (B=1) Z-CLEAR -> jr z
// NOT taken, run the sprite branch. 0x8083: 0x10 + B(0x01) = 0x11 stored back;
// A = 0x11 + 0x04 = 0x15; and 0x06 -> selector 0x04 -> E=0x15; bit7(B)=0 so
// xor 0x80 -> 0x95 stored to 0x8084. Then 0x34d2 adds C(0x00): 0x8086 stays 0x20.
const PATH_B = {
  steps: [
    0x3480, 0x3482, 0x3490, 0x3493, 0x3494, 0x3497, 0x3499, 0x349c, 0x349f,
    0x34a0, 0x34a3, 0x34a5, 0x34a7, 0x34aa, 0x34ab, 0x34ae, 0x34b0, 0x34b2,
    0x34b6, 0x34b8, 0x34bc, 0x34be, 0x34c0, 0x34c2, 0x34c4, 0x34c8, 0x34c9,
    0x34cb, 0x34cd, 0x34cf, 0x34d2, 0x34d5, 0x34d6, 0x34d9,
  ],
  cycles:
    10 + 7 + 12 + // entry
    13 + 4 + 13 + 7 + 13 + 13 + 4 + 13 + 8 + 7 + // 0x3490 through jr z not taken
    13 + 4 + 13 + 7 + 7 + 12 + // sprite accumulate + and + jr nz taken
    7 + 12 + // 0x34b6: cp 0x02 + jr nz taken
    7 + 7 + 7 + // 0x34bc: cp 0x04 + jr nz not taken + ld e,0x15
    7 + 12 + // 0x34c2: cp 0x06 + jr nz taken
    4 + 8 + 7 + 7 + // 0x34c8: ld a,e + bit 7,b + jr nz not taken + xor 0x80
    13 + // 0x34cf: ld (0x8084),a
    13 + 4 + 13 + 10, // 0x34d2 + ret
  a: 0x20,
  cSet: false,
  counter: 0x0a, // reloaded from 0x8091
  dir: 0x01, // D=1 published
  posX: 0x20, // 0x20 + C(0x00)
  sprite: 0x95, // selector 0x04 -> 0x15, mirrored (xor 0x80) -> 0x95
  accum: 0x11, // 0x10 + B(0x01)
};

test("path A: counter still running -> jr nz to 0x34d2, position only (C=0)", () => {
  const m = makeMachine({ 0x808b: 0x05, 0x8086: 0x20, 0x8092: 0x77, 0x8084: 0x5a, 0x8083: 0x10 });
  loc_347d(m);
  assertPath(m, PATH_A);
  assert.ok(!m.steps.includes(0x34a7), "sprite branch not reached while counter runs");
});

test("path B: counter expires -> B=1 keeps the sprite branch LIVE, writes 0x8084=0x95", () => {
  const m = makeMachine({ 0x808b: 0x01, 0x8091: 0x0a, 0x8086: 0x20, 0x8092: 0x77, 0x8084: 0x5a, 0x8083: 0x10 });
  loc_347d(m);
  assertPath(m, PATH_B);
  // The distinguishing fact vs loc_3476: the 0x34a7-0x34cf branch DID run here.
  assert.ok(m.steps.includes(0x34a7), "0x34a7 IS stepped (sprite branch live for B=1)");
  assert.ok(m.steps.includes(0x34cd), "0x34cd xor IS stepped (bit7 of B = 0 -> mirror fires)");
});

test("mutation: `xor 0x00` for `xor 0x80` at 0x34cd is caught by the 0x8084 assertion", () => {
  // Byte-identical to loc_347d except the sprite mirror at 0x34cd XORs 0x00
  // instead of 0x80. Cycles are UNCHANGED (xor n is 7T either way) and the step
  // sequence is IDENTICAL (same path), so only the value assertion on 0x8084 can
  // reject it: it stores 0x15 (unmirrored) instead of 0x95.
  function loc_347d_mutant(m) {
    const { regs, mem } = m;
    let next = 0x347d;
    for (;;) {
      switch (next) {
        case 0x347d: {
          regs.bc = 0x0100; m.step(0x3480, 10);
          regs.d = 0x01; m.step(0x3482, 7);
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
        case 0x34b6: {
          regs.cp(0x02); m.step(0x34b8, 7);
          if (regs.fNZ) { m.step(0x34bc, 12); next = 0x34bc; break; }
          m.step(0x34ba, 7);
          regs.e = 0x14; m.step(0x34bc, 7);
          next = 0x34bc; break;
        }
        case 0x34bc: {
          regs.cp(0x04); m.step(0x34be, 7);
          if (regs.fNZ) { m.step(0x34c2, 12); next = 0x34c2; break; }
          m.step(0x34c0, 7);
          regs.e = 0x15; m.step(0x34c2, 7);
          next = 0x34c2; break;
        }
        case 0x34c2: {
          regs.cp(0x06); m.step(0x34c4, 7);
          if (regs.fNZ) { m.step(0x34c8, 12); next = 0x34c8; break; }
          m.step(0x34c6, 7);
          regs.e = 0x16; m.step(0x34c8, 7);
          next = 0x34c8; break;
        }
        case 0x34c8: {
          regs.a = regs.e; m.step(0x34c9, 4);
          regs.bit(7, regs.b); m.step(0x34cb, 8);
          if (regs.fNZ) { m.step(0x34cf, 12); next = 0x34cf; break; }
          m.step(0x34cd, 7);
          regs.xor(0x00); m.step(0x34cf, 7); // BUG: should be xor 0x80 (mirror)
          next = 0x34cf; break;
        }
        case 0x34cf: {
          mem.write8(0x8084, regs.a); m.step(0x34d2, 13);
          next = 0x34d2; break;
        }
        case 0x34d2: {
          regs.a = mem.read8(0x8086); m.step(0x34d5, 13);
          regs.add(regs.c); m.step(0x34d6, 4);
          mem.write8(0x8086, regs.a); m.step(0x34d9, 13);
          m.ret(); return;
        }
        default:
          throw new Error("mutant: unexpected block 0x" + next.toString(16));
      }
    }
  }

  const m = makeMachine({ 0x808b: 0x01, 0x8091: 0x0a, 0x8086: 0x20, 0x8092: 0x77, 0x8084: 0x5a, 0x8083: 0x10 });
  loc_347d_mutant(m);
  // Cycles and the step sequence are identical to the real Path B, so only the
  // value check on 0x8084 rejects it.
  assert.equal(m.cycles, PATH_B.cycles, "mutation preserves the cycle total (so cycles cannot catch it)");
  assert.deepEqual(m.steps, PATH_B.steps, "mutation preserves the step sequence (so steps cannot catch it)");
  assert.equal(m.mem.read8(0x8084), 0x15, "mutant left the sprite code unmirrored (0x15)");
  assert.throws(() => assertPath(m, PATH_B), /sprite\/orientation code/);
});
