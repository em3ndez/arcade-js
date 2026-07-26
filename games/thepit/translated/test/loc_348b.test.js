// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_348b (ROM 0x348b-0x34d9): the BC=0xff00 / D=0x03 entry
// into the shared object-mover tail at 0x3490. Two things set loc_348b apart from
// its three sibling entries (0x3476/0x347d/0x3484):
//   1. It has NO `jr 0x3490` -- it is the entry directly above the tail and FALLS
//      THROUGH into 0x3490. So the entry is two instructions (steps [0x348e,0x3490])
//      with no 12T jr charge, not three.
//   2. B=0xff, so BOTH bit 0 and bit 7 of B are set. bit0 set -> the sprite branch
//      at 0x34a7-0x34cf is LIVE on the counter-zero frame; bit7 set -> `jr nz,0x34cf`
//      at 0x34cb is TAKEN, so the `xor 0x80` mirror at 0x34cd is SKIPPED and the
//      sprite code is stored UNMIRRORED. (Contrast loc_347d, B=0x01: bit7 clear,
//      so the xor always fires there.)
// C=0x00 means the X-position update at 0x34d2 adds nothing; D=0x03 is the
// direction index published to 0x8092 on the counter-expiry frame.
//
// The test asserts the exact T-state total, the instruction-boundary step
// sequence, the final A + carry, the counter/direction/sprite/position bytes, and
// the ret, on each path. It then re-runs a mutant whose entry `ld d,0x03` is
// slipped to `ld d,0x02` (loc_3484's index) -- a cycle-AND-step-identical value
// slip that ONLY the 0x8092 assertion can reject, proving that assertion has teeth
// and pinning loc_348b's identity D=3.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs, F_C } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_348b } from "../loc_348b.js";

// Leaf-routine machine double: exactly the surface loc_348b touches (regs, mem,
// step, ret). step records its target + charges cycles; ret records the return +
// charges cycles. The routine has no `call` and no tail-jump-out (it ends `ret`).
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x348b,
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
  assert.equal(m.mem.read8(0x8084), exp.sprite, "0x8084 sprite code");
  assert.equal(m.mem.read8(0x8083), exp.accum, "0x8083 (0x8083)+B accumulator");
  assert.equal(m.mem.read8(0x8086), exp.posX, "0x8086 X position");
}

// Path A -- counter still running: 0x808b = 5 -> dec to 4 (nonzero), jr nz at
// 0x3497 taken -> 0x34d2. C=0x00 so the position 0x8086 is UNCHANGED (0x20). The
// reload/direction/sprite block is NOT reached, so 0x8092/0x8084/0x8083 stay put.
const PATH_A = {
  steps: [0x348e, 0x3490, 0x3493, 0x3494, 0x3497, 0x34d2, 0x34d5, 0x34d6, 0x34d9],
  cycles: 10 + 7 + 13 + 4 + 13 + 12 + 13 + 4 + 13 + 10, // 99 (incl. final ret; no jr in the entry)
  a: 0x20,
  cSet: false,
  counter: 0x04,
  dir: 0x00, // untouched (seeded 0)
  sprite: 0x00, // untouched (seeded 0)
  accum: 0x00, // untouched (seeded 0)
  posX: 0x20, // C=0 -> unchanged
};

// Path B -- counter expires, sprite branch LIVE, NO mirror: 0x808b = 1 -> dec to
// 0, jr nz NOT taken; reload 0x808b from 0x8091 (0x0a), publish D=0x03 to 0x8092,
// bit 0,b (B=0xff) Z-clear -> jr z NOT taken -> sprite recompute. (0x8083)=0x00 +
// B(0xff) = 0xff -> +4 = 0x03 -> &0x06 = 0x02 -> selector 2 -> E=0x14. bit 7,b
// (B=0xff) Z-clear -> jr nz TAKEN -> xor 0x80 SKIPPED -> store 0x14 to 0x8084.
// C=0x00 -> position 0x8086 unchanged.
const PATH_B = {
  steps: [
    0x348e, 0x3490, 0x3493, 0x3494, 0x3497, 0x3499, 0x349c, 0x349f, 0x34a0,
    0x34a3, 0x34a5, 0x34a7, 0x34aa, 0x34ab, 0x34ae, 0x34b0, 0x34b2, 0x34b6,
    0x34b8, 0x34ba, 0x34bc, 0x34be, 0x34c2, 0x34c4, 0x34c8, 0x34c9, 0x34cb,
    0x34cf, 0x34d2, 0x34d5, 0x34d6, 0x34d9,
  ],
  cycles:
    10 + 7 + // entry (no jr)
    13 + 4 + 13 + 7 + 13 + 13 + 4 + 13 + 8 + 7 + 13 + 4 + 13 + 7 + 7 + 12 + // 0x3490 block
    7 + 7 + 7 + // 0x34b6 block
    7 + 12 + // 0x34bc block
    7 + 12 + // 0x34c2 block
    4 + 8 + 12 + // 0x34c8 block
    13 + // 0x34cf block
    13 + 4 + 13 + 10, // 0x34d2 block + ret
  a: 0x20,
  cSet: false,
  counter: 0x0a, // reloaded from 0x8091
  dir: 0x03, // D=0x03 published
  sprite: 0x14, // selector 2 code, NOT mirrored (B bit7 set)
  accum: 0xff, // (0x8083)=0x00 + B=0xff
  posX: 0x20, // C=0 -> unchanged
};

test("path A: counter still running -> jr nz to 0x34d2, no position change (C=0)", () => {
  const m = makeMachine({ 0x808b: 0x05, 0x8086: 0x20, 0x8092: 0x77, 0x8084: 0x5a, 0x8083: 0x33 });
  loc_348b(m);
  // The reload/publish/sprite block is skipped, so these three stay as seeded.
  assert.equal(m.mem.read8(0x8092), 0x77, "0x8092 untouched when counter still running");
  assert.equal(m.mem.read8(0x8084), 0x5a, "0x8084 untouched when counter still running");
  assert.equal(m.mem.read8(0x8083), 0x33, "0x8083 untouched when counter still running");
  const expA = { ...PATH_A, dir: 0x77, sprite: 0x5a, accum: 0x33 };
  assertPath(m, expA);
});

test("path B: counter expires -> reload + publish D=0x03 + UNMIRRORED sprite 0x14", () => {
  const m = makeMachine({ 0x808b: 0x01, 0x8091: 0x0a, 0x8086: 0x20, 0x8092: 0x77, 0x8084: 0x5a, 0x8083: 0x00 });
  loc_348b(m);
  assertPath(m, PATH_B);
});

test("loc_348b-specific: B bit7 set suppresses the mirror (sprite bit 7 stays clear)", () => {
  // The distinguishing behaviour vs loc_347d (B=0x01, xor fires): here B=0xff, so
  // `jr nz,0x34cf` at 0x34cb is taken and `xor 0x80` never runs -- bit 7 of 0x8084
  // is 0, not 1.
  const m = makeMachine({ 0x808b: 0x01, 0x8091: 0x0a, 0x8086: 0x20, 0x8083: 0x00 });
  loc_348b(m);
  assert.equal(m.mem.read8(0x8084) & 0x80, 0x00, "sprite bit 7 clear -> no mirror applied");
  assert.equal(m.mem.read8(0x8084), 0x14, "sprite code stored unmirrored");
  assert.ok(!m.steps.includes(0x34cd), "0x34cd (xor 0x80) is never stepped to");
});

test("selector picks 0x16 for (0x8083)=0x03 (selector 6) and stays unmirrored", () => {
  // (0x8083)=0x03 + B=0xff = 0x02 -> +4 = 0x06 -> &0x06 = 0x06 -> selector 6 -> E=0x16.
  const m = makeMachine({ 0x808b: 0x01, 0x8091: 0x0a, 0x8086: 0x20, 0x8083: 0x03 });
  loc_348b(m);
  assert.equal(m.mem.read8(0x8084), 0x16, "selector 6 -> sprite 0x16 (unmirrored)");
  assert.equal(m.mem.read8(0x8083), 0x02, "0x8083 updated to (0x03 + 0xff) & 0xff = 0x02");
});

test("mutation: entry `ld d,0x02` (loc_3484's index) for `ld d,0x03` is caught", () => {
  // Byte-identical to loc_348b except the entry direction preset D is slipped from
  // 0x03 to 0x02 (a copy-paste from sibling loc_3484). Cycles AND steps are
  // UNCHANGED (ld d,n is 7T either way, same instruction boundary), so ONLY the
  // 0x8092 value assertion can reject it: 0x8092 ends 0x02 instead of the published
  // 0x03. This pins loc_348b's identity direction index.
  function loc_348b_mutant(m) {
    const { regs, mem } = m;
    let next = 0x348b;
    for (;;) {
      switch (next) {
        case 0x348b: {
          regs.bc = 0xff00; m.step(0x348e, 10);
          regs.d = 0x02; m.step(0x3490, 7); // BUG: should be ld d,0x03
          next = 0x3490; break;
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
          regs.xor(0x80); m.step(0x34cf, 7);
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

  const m = makeMachine({ 0x808b: 0x01, 0x8091: 0x0a, 0x8086: 0x20, 0x8092: 0x77, 0x8084: 0x5a, 0x8083: 0x00 });
  loc_348b_mutant(m);
  // Cycles and steps are identical to the real Path B, so only the value check rejects it.
  assert.equal(m.cycles, PATH_B.cycles, "mutation preserves the cycle total (so cycles cannot catch it)");
  assert.deepEqual(m.steps, PATH_B.steps, "mutation preserves the step sequence (so steps cannot catch it)");
  assert.equal(m.mem.read8(0x8092), 0x02, "mutant published D=0x02, not 0x03");
  assert.throws(() => assertPath(m, PATH_B), /direction index/);
});
