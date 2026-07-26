// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_3748 (ROM 0x3748-0x37ce): the per-frame object update
// dispatcher. The routine is a graph of basic blocks with FIVE tail-jump exits
// (0x37cf / 0x3a13 / 0x38c8 / 0x3984 / 0x3a4c) and an inline movement/animation
// block. The test drives each dispatch arm plus the full movement path, asserting
// the exact T-state total, the instruction-boundary step sequence, the tail-jump
// target (via `calls`), the final PC, the A register, and every memory byte the
// routine writes. It then re-runs a copy whose `add a,l` is corrupted to
// `add a,h` (an L/H swap on the X advance) and proves the value assertions catch
// it even though the cycle total is unchanged (add a,r is 4T either way).

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_3748 } from "../loc_3748.js";

// Leaf-routine machine double: exactly the surface loc_3748 touches (regs, mem,
// step, call). `step` records its target + charges cycles; `call` records the
// tail-jump target WITHOUT invoking a real routine (each exit is a separate unit),
// so `return m.call(addr)` models "control transferred there and never came back".
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x3748,
    steps: [],
    calls: [],
    returned: false,
    ret(cycles = 10) {
      this.cycles += cycles;
      this.returned = true;
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // callee's own ret returns to OUR caller; nothing to do here
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
  assert.deepEqual(m.calls, exp.calls, "call (tail-jump) targets");
  assert.equal(m.returned, false, "no ret -- every exit is a tail-jump");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, exp.pc, "final PC");
  assert.equal(m.regs.a, exp.a, "A register");
  for (const [addr, val] of Object.entries(exp.mem)) {
    assert.equal(m.mem.read8(Number(addr)), val, `mem[0x${Number(addr).toString(16)}]`);
  }
}

// The six movement bytes, so tail paths can assert they were left untouched.
const MOVE_SEED = { 0x8112: 0x77, 0x810b: 0x77, 0x811c: 0x77, 0x810a: 0x77, 0x811b: 0x77, 0x810d: 0x77, 0x811e: 0x77 };
const UNTOUCHED = { 0x8112: 0x77, 0x810b: 0x77, 0x811c: 0x77, 0x810a: 0x77, 0x811b: 0x77, 0x810d: 0x77, 0x811e: 0x77 };

// --- Path A: (0x807b) != 0 -> tail 0x37cf --------------------------------------
test("path A: alt-phase gate set -> tail-jump 0x37cf", () => {
  const m = makeMachine({ 0x807b: 0x05, ...MOVE_SEED });
  loc_3748(m);
  assertPath(m, {
    steps: [0x374b, 0x374c, 0x37cf],
    calls: [0x37cf],
    cycles: 13 + 4 + 10, // 27
    pc: 0x37cf,
    a: 0x05, // or a leaves A = 0x05
    mem: UNTOUCHED,
  });
});

// --- Path B: phase >= 0x0a -> tail 0x3a13 --------------------------------------
test("path B: high phase -> tail-jump 0x3a13", () => {
  const m = makeMachine({ 0x807b: 0x00, 0x8010: 0x0a, ...MOVE_SEED });
  loc_3748(m);
  assertPath(m, {
    steps: [0x374b, 0x374c, 0x374f, 0x3752, 0x3754, 0x3a13],
    calls: [0x3a13],
    cycles: 13 + 4 + 10 + 13 + 7 + 10, // 57
    pc: 0x3a13,
    a: 0x0a,
    mem: UNTOUCHED,
  });
});

// --- Path C: phase 6 -> tail 0x38c8 --------------------------------------------
test("path C: phase 6 -> tail-jump 0x38c8", () => {
  const m = makeMachine({ 0x807b: 0x00, 0x8010: 0x06, ...MOVE_SEED });
  loc_3748(m);
  assertPath(m, {
    steps: [0x374b, 0x374c, 0x374f, 0x3752, 0x3754, 0x3757, 0x3759, 0x375b, 0x375d, 0x375f, 0x3761, 0x38c8],
    calls: [0x38c8],
    cycles: 13 + 4 + 10 + 13 + 7 + 10 + 7 + 7 + 7 + 7 + 7 + 10, // 102
    pc: 0x38c8,
    a: 0x06,
    mem: UNTOUCHED,
  });
});

// --- Path D: phase 9 -> tail 0x3984 (falls past every cp) ----------------------
test("path D: phase 9 -> tail-jump 0x3984", () => {
  const m = makeMachine({ 0x807b: 0x00, 0x8010: 0x09, ...MOVE_SEED });
  loc_3748(m);
  assertPath(m, {
    steps: [0x374b, 0x374c, 0x374f, 0x3752, 0x3754, 0x3757, 0x3759, 0x375b, 0x375d, 0x375f, 0x3761, 0x3764, 0x3984],
    calls: [0x3984],
    cycles: 13 + 4 + 10 + 13 + 7 + 10 + 7 + 7 + 7 + 7 + 7 + 10 + 10, // 112
    pc: 0x3984,
    a: 0x09,
    mem: UNTOUCHED,
  });
});

// --- Path E: phase 0 -> full movement: timer underflows (reload + toggle) and
//     BOTH the X and Y advances fire, then tail 0x3a4c. This is the rich path.
// Seed: step vector L=0x05 / H=0x02, timer 0x8112=1 (dec->0), tile 0x810b=0x2e
// (so it toggles to 0xaf), X=0x20 (>= 0x11, advances), Y=0x08 (< 0x17, advances).
const PATH_E_STEPS = [
  0x374b, 0x374c, 0x374f, 0x3752, 0x3754, 0x3757, 0x3759, // entry -> jr c 0x377e
  0x377e,
  0x3781, 0x3782, 0x3785, 0x3786, 0x3789, 0x378a, 0x378d, 0x378f, 0x3791, 0x3794, 0x3797, 0x3798, 0x379a, 0x379b, 0x379d, 0x379f,
  0x37a2, 0x37a4, 0x37a7,
  0x37aa, 0x37ac, 0x37ae, 0x37b1, 0x37b3, 0x37b5, 0x37b6, 0x37b9, 0x37bb, 0x37be, 0x37c1, 0x37c3, 0x37c5, 0x37c6, 0x37c9, 0x37cc,
  0x3a4c,
];
const PATH_E_CYCLES =
  /* entry  */ 13 + 4 + 10 + 13 + 7 + 10 + 7 + 12 + // 76
  /* 377e   */ 13 + 4 + 13 + 4 + 13 + 4 + 13 + 7 + 7 + 13 + 13 + 4 + 7 + 4 + 7 + 7 + // 133
  /* 379f   */ 13 + 7 + 13 + // 33
  /* 37a7   */ 13 + 7 + 7 + 13 + 7 + 7 + 4 + 13 + 7 + 13 + 13 + 7 + 7 + 4 + 13 + 13 + // 148
  /* 37cc   */ 10; // = 400

function pathEMachine() {
  return makeMachine({
    0x807b: 0x00, 0x8010: 0x00,
    0x810e: 0x05, 0x810f: 0x02, // step vector: L=0x05, H=0x02
    0x8112: 0x01,               // timer -> dec to 0 -> reload+toggle
    0x810b: 0x2e,               // tile 0x2e -> toggles to 0xaf
    0x810a: 0x20,               // X (>= 0x11 so it advances)
    0x810d: 0x08,               // Y (< 0x17 so it advances)
  });
}

test("path E: phase 0, timer underflow + tile toggle + X/Y advance -> tail 0x3a4c", () => {
  const m = pathEMachine();
  loc_3748(m);
  assertPath(m, {
    steps: PATH_E_STEPS,
    calls: [0x3a4c],
    cycles: PATH_E_CYCLES,
    pc: 0x3a4c,
    a: 0x0a, // last write is 0x811e = advanced Y = 0x08 + H(0x02)
    mem: {
      0x8112: 0x08,   // counter reloaded
      0x810b: 0xaf,   // tile toggled 0x2e -> 0xaf
      0x811c: 0xae,   // 0xaf ^ 0x01
      0x810a: 0x25,   // X: 0x20 + L(0x05)
      0x811b: 0x35,   // X + 0x10
      0x810d: 0x0a,   // Y: 0x08 + H(0x02)
      0x811e: 0x0a,   // Y mirror
    },
  });
  // HL held the step vector for the two advances.
  assert.equal(m.regs.l, 0x05, "L = step low");
  assert.equal(m.regs.h, 0x02, "H = step high");
  assert.equal(m.regs.b, 0x2e, "B = the pre-toggle tile read at 0x3797");
});

// --- Path F: phase 3 -> loc_3767 one-shot spawn (0x8079 == 0), then the movement
//     block where the timer does NOT underflow and the 4th-tick gate is closed,
//     so no advance. Verifies the spawn writes and the counting/non-4th arms.
// Seed: 0x8079=0 (unspawned), timer 0x8112=2 (dec->1, keeps counting; 1 & 3 != 0).
function pathFMachine() {
  return makeMachine({
    0x807b: 0x00, 0x8010: 0x03,
    0x8079: 0x00, // unspawned -> take the seeding arm
    0x8112: 0x02, // dec -> 1 (nz): jr nz taken; then 1 & 3 = 1 (nz): no advance
  });
}

test("path F: phase 3 spawn seeds the object, no advance -> tail 0x3a4c", () => {
  const m = pathFMachine();
  loc_3748(m);
  assertPath(m, {
    steps: [
      0x374b, 0x374c, 0x374f, 0x3752, 0x3754, 0x3757, 0x3759, 0x375b, 0x375d, // entry -> jr c 0x3767
      0x3767,
      0x376a, 0x376b, 0x376d, 0x376f, 0x3772, 0x3773, 0x3776, 0x3779, 0x377b, // spawn block
      0x377e,
      0x3781, 0x3782, 0x3785, 0x3786, 0x3789, 0x378a, 0x378d, // 377e -> jr nz 0x37a7 (still counting)
      0x37a7,
      0x37aa, 0x37ac, // and 0x03 != 0 -> jr nz 0x37cc
      0x37cc,
      0x3a4c,
    ],
    calls: [0x3a4c],
    cycles:
      /* entry */ 13 + 4 + 10 + 13 + 7 + 10 + 7 + 7 + 7 + 12 + // 90
      /* 3767  */ 13 + 4 + 7 + 7 + 13 + 4 + 13 + 13 + 7 + 13 + // 94
      /* 377e  */ 13 + 4 + 13 + 4 + 13 + 4 + 13 + 12 + // 76
      /* 37a7  */ 13 + 7 + 12 + // 32
      /* 37cc  */ 10, // = 302
    pc: 0x3a4c,
    a: 0x01, // (0x8112) after dec = 1, and 0x03 = 1
    mem: {
      0x810f: 0x00, // step high seeded
      0x810e: 0xff, // step low seeded (dec of 0x00)
      0x8079: 0xff, // marked spawned
      0x8068: 0x2d, // initial tile
      0x8112: 0x01, // counted down, not reloaded
    },
  });
});

// --- Mutation: `add a,l` (0x37b5, X advance) corrupted to `add a,h` -------------
test("mutation: `add a,h` for `add a,l` on the X advance is caught", () => {
  // Byte-identical to loc_3748 except the X advance at 0x37b5 adds H instead of
  // L. Cycles are UNCHANGED (add a,r is 4T either way), so only the value
  // assertions can reject it: with L=0x05, H=0x02 the X becomes 0x20+0x02=0x22
  // (and its +0x10 mirror 0x32), not 0x20+0x05=0x25 / 0x35.
  function loc_3748_mutant(m) {
    const { regs, mem } = m;
    let next = 0x3748;
    for (;;) {
      switch (next) {
        case 0x3748: {
          regs.a = mem.read8(0x807b); m.step(0x374b, 13);
          regs.or(regs.a); m.step(0x374c, 4);
          if (regs.fNZ) { m.step(0x37cf, 10); return m.call(0x37cf); }
          m.step(0x374f, 10);
          regs.a = mem.read8(0x8010); m.step(0x3752, 13);
          regs.cp(0x0a); m.step(0x3754, 7);
          if (regs.fNC) { m.step(0x3a13, 10); return m.call(0x3a13); }
          m.step(0x3757, 10);
          regs.cp(0x03); m.step(0x3759, 7);
          if (regs.fC) { m.step(0x377e, 12); next = 0x377e; break; }
          m.step(0x375b, 7);
          regs.cp(0x06); m.step(0x375d, 7);
          if (regs.fC) { m.step(0x3767, 12); next = 0x3767; break; }
          m.step(0x375f, 7);
          regs.cp(0x09); m.step(0x3761, 7);
          if (regs.fC) { m.step(0x38c8, 10); return m.call(0x38c8); }
          m.step(0x3764, 10);
          m.step(0x3984, 10); return m.call(0x3984);
        }
        case 0x3767: {
          regs.a = mem.read8(0x8079); m.step(0x376a, 13);
          regs.and(regs.a); m.step(0x376b, 4);
          if (regs.fNZ) { m.step(0x377e, 12); next = 0x377e; break; }
          m.step(0x376d, 7);
          regs.a = 0x00; m.step(0x376f, 7);
          mem.write8(0x810f, regs.a); m.step(0x3772, 13);
          regs.a = regs.dec8(regs.a); m.step(0x3773, 4);
          mem.write8(0x810e, regs.a); m.step(0x3776, 13);
          mem.write8(0x8079, regs.a); m.step(0x3779, 13);
          regs.a = 0x2d; m.step(0x377b, 7);
          mem.write8(0x8068, regs.a); m.step(0x377e, 13);
          next = 0x377e; break;
        }
        case 0x377e: {
          regs.a = mem.read8(0x810e); m.step(0x3781, 13);
          regs.l = regs.a; m.step(0x3782, 4);
          regs.a = mem.read8(0x810f); m.step(0x3785, 13);
          regs.h = regs.a; m.step(0x3786, 4);
          regs.a = mem.read8(0x8112); m.step(0x3789, 13);
          regs.a = regs.dec8(regs.a); m.step(0x378a, 4);
          mem.write8(0x8112, regs.a); m.step(0x378d, 13);
          if (regs.fNZ) { m.step(0x37a7, 12); next = 0x37a7; break; }
          m.step(0x378f, 7);
          regs.a = 0x08; m.step(0x3791, 7);
          mem.write8(0x8112, regs.a); m.step(0x3794, 13);
          regs.a = mem.read8(0x810b); m.step(0x3797, 13);
          regs.b = regs.a; m.step(0x3798, 4);
          regs.a = 0x2e; m.step(0x379a, 7);
          regs.cp(regs.b); m.step(0x379b, 4);
          if (regs.fNZ) { m.step(0x379f, 12); next = 0x379f; break; }
          m.step(0x379d, 7);
          regs.a = 0xaf; m.step(0x379f, 7);
          next = 0x379f; break;
        }
        case 0x379f: {
          mem.write8(0x810b, regs.a); m.step(0x37a2, 13);
          regs.xor(0x01); m.step(0x37a4, 7);
          mem.write8(0x811c, regs.a); m.step(0x37a7, 13);
          next = 0x37a7; break;
        }
        case 0x37a7: {
          regs.a = mem.read8(0x8112); m.step(0x37aa, 13);
          regs.and(0x03); m.step(0x37ac, 7);
          if (regs.fNZ) { m.step(0x37cc, 12); next = 0x37cc; break; }
          m.step(0x37ae, 7);
          regs.a = mem.read8(0x810a); m.step(0x37b1, 13);
          regs.cp(0x11); m.step(0x37b3, 7);
          if (regs.fC) { m.step(0x37cc, 12); next = 0x37cc; break; }
          m.step(0x37b5, 7);
          regs.add(regs.h); m.step(0x37b6, 4); // BUG: should be add a,l
          mem.write8(0x810a, regs.a); m.step(0x37b9, 13);
          regs.add(0x10); m.step(0x37bb, 7);
          mem.write8(0x811b, regs.a); m.step(0x37be, 13);
          regs.a = mem.read8(0x810d); m.step(0x37c1, 13);
          regs.cp(0x17); m.step(0x37c3, 7);
          if (regs.fNC) { m.step(0x37cc, 12); next = 0x37cc; break; }
          m.step(0x37c5, 7);
          regs.add(regs.h); m.step(0x37c6, 4);
          mem.write8(0x810d, regs.a); m.step(0x37c9, 13);
          mem.write8(0x811e, regs.a); m.step(0x37cc, 13);
          next = 0x37cc; break;
        }
        case 0x37cc: {
          m.step(0x3a4c, 10); return m.call(0x3a4c);
        }
        default:
          throw new Error("mutant: bad block 0x" + next.toString(16));
      }
    }
  }

  const m = pathEMachine();
  loc_3748_mutant(m);
  // Cycles are identical to the real Path E, so only the value checks reject it.
  assert.equal(m.cycles, PATH_E_CYCLES, "mutation preserves the cycle total (so cycles cannot catch it)");
  assert.equal(m.mem.read8(0x810a), 0x22, "mutant advanced X by H(0x02), not L(0x05)");
  assert.equal(m.mem.read8(0x811b), 0x32, "mutant X mirror follows the wrong advance");
  assert.throws(
    () =>
      assertPath(m, {
        steps: PATH_E_STEPS,
        calls: [0x3a4c],
        cycles: PATH_E_CYCLES,
        pc: 0x3a4c,
        a: 0x0a,
        mem: { 0x810a: 0x25, 0x811b: 0x35 },
      }),
    /mem\[0x810a\]|mem\[0x811b\]/,
  );
});
