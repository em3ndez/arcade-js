// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_384a (ROM 0x384a-0x38c5): the per-frame actor
// animator/mover, a sibling of loc_3748's movement block. The routine is a graph
// of basic blocks with THREE tail-jump exits (all 0x3a4c), one nested `call
// 0x1b5b`, and one conditional `ret nz`. The test drives four representative
// paths -- the not-a-4th-tick early tail-out, the timer-underflow tile toggle +
// X advance, the Y==0 `ret nz`, and the Y==0x17 call+Y-decrement path -- asserting
// the exact T-state total, the instruction-boundary step sequence, the tail-jump
// / call targets, the pushed return address, the final PC/A, and every memory byte
// written. It then re-runs a copy whose `add a,0x10` (X mirror) is corrupted to
// `add a,0x20` and proves the value assertions catch it even though the cycle
// total is unchanged (add a,n is 7T either way).

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_384a } from "../loc_384a.js";

// Leaf-routine machine double: exactly the surface loc_384a touches (regs, mem,
// step, call, ret, push16). `step` records its target + charges cycles; `call`
// records a transfer target WITHOUT invoking a real routine (each exit / nested
// call is a separate unit) -- for a tail-jump `return m.call(addr)` models
// "control transferred there and never came back", and for the `call 0x1b5b`
// the immediately-following reload of A makes loc_1b5b's effects irrelevant here.
// `push16` records the return address the CALL stacks. `ret` charges its cycles
// and marks the direct return.
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x384a,
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
      return undefined; // callee's own ret returns to OUR caller (tail) / A is reloaded next (0x1b5b)
    },
    push16(value) {
      this.pushes.push(value);
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
  assert.deepEqual(m.calls, exp.calls, "call / tail-jump targets");
  assert.deepEqual(m.pushes, exp.pushes ?? [], "pushed return addresses");
  assert.equal(m.returned, exp.returned ?? false, "direct ret?");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, exp.pc, "final PC");
  assert.equal(m.regs.a, exp.a, "A register");
  for (const [addr, val] of Object.entries(exp.mem)) {
    assert.equal(m.mem.read8(Number(addr)), val, `mem[0x${Number(addr).toString(16)}]`);
  }
}

// The actor bytes, so paths can assert the ones they leave untouched.
const CTX = { 0x8112: 0x77, 0x810b: 0x77, 0x811c: 0x77, 0x810a: 0x77, 0x811b: 0x77, 0x810d: 0x77, 0x811e: 0x77, 0x807c: 0x77 };

// --- Path A: timer decremented, still non-zero, (timer & 3) != 0 -> tail 0x3a4c -
test("path A: not a 4th tick -> early tail-jump 0x3a4c", () => {
  const m = makeMachine({ ...CTX, 0x8112: 0x04 }); // dec -> 0x03; 0x03 & 3 = 3 (nz)
  loc_384a(m);
  assertPath(m, {
    steps: [0x384d, 0x384e, 0x3851, 0x386b, 0x386e, 0x3870, 0x3a4c],
    calls: [0x3a4c],
    cycles: 13 + 4 + 13 + 12 + 13 + 7 + 10, // 72
    pc: 0x3a4c,
    a: 0x03, // and 0x03 of 0x03
    mem: { 0x8112: 0x03, 0x810b: 0x77, 0x810a: 0x77, 0x810d: 0x77 }, // only the timer changed
  });
});

// --- Path B: timer underflow -> reload 8 + toggle tile 0x2e->0xaf, 4th tick,
//     Y>=0x17 and X<0x24 -> advance X (loc_38bc), tail 0x3a4c. -------------------
const PATH_B_STEPS = [
  0x384d, 0x384e, 0x3851, 0x3853, 0x3855, 0x3858, 0x385b, 0x385c, 0x385e, 0x385f, 0x3861, 0x3863, // entry (jr nz not taken -> ld a,0xaf)
  0x3866, 0x3868, 0x386b, // loc_3863
  0x386e, 0x3870, 0x3873, 0x3876, 0x3878, 0x387a, 0x387d, 0x387f, 0x38bc, // loc_386b -> jr c 0x38bc
  0x38bd, 0x38c0, 0x38c2, 0x38c5, 0x3a4c, // loc_38bc -> tail
];
test("path B: timer underflow, tile toggle 0x2e->0xaf, X advance -> tail 0x3a4c", () => {
  const m = makeMachine({ ...CTX, 0x8112: 0x01, 0x810b: 0x2e, 0x810d: 0x20, 0x810a: 0x10 });
  loc_384a(m);
  assertPath(m, {
    steps: PATH_B_STEPS,
    calls: [0x3a4c],
    cycles:
      /* entry */ 13 + 4 + 13 + 7 + 7 + 13 + 13 + 4 + 7 + 4 + 7 + 7 + // 99 (12 instrs incl. ld a,0xaf)
      /* 3863  */ 13 + 7 + 13 + // 33
      /* 386b  */ 13 + 7 + 10 + 13 + 7 + 7 + 13 + 7 + 12 + // 89
      /* 38bc  */ 4 + 13 + 7 + 13 + 10, // 47  => 268
    pc: 0x3a4c,
    a: 0x21, // X 0x10 -> inc 0x11 -> +0x10 = 0x21
    mem: {
      0x8112: 0x08, // reloaded
      0x810b: 0xaf, // toggled 0x2e -> 0xaf
      0x811c: 0xae, // 0xaf ^ 0x01
      0x810a: 0x11, // X + 1
      0x811b: 0x21, // (X+1) + 0x10
      0x810d: 0x20, // Y untouched on this path
    },
  });
});

// --- Path C: timer underflow (tile toggles the OTHER way 0xaf->0x2e), 4th tick,
//     Y < 0x17 -> loc_389a with Y==0, (0x807c) != 0 -> `ret nz` directly. --------
test("path C: Y==0 and 0x807c busy -> ret nz (direct return, no tail)", () => {
  const m = makeMachine({ ...CTX, 0x8112: 0x01, 0x810b: 0xaf, 0x810d: 0x00, 0x807c: 0x05 });
  loc_384a(m);
  assertPath(m, {
    steps: [
      0x384d, 0x384e, 0x3851, 0x3853, 0x3855, 0x3858, 0x385b, 0x385c, 0x385e, 0x385f, // entry -> jr nz 0x3863
      0x3863, 0x3866, 0x3868, // loc_3863 (A stayed 0x2e)
      0x386b, 0x386e, 0x3870, 0x3873, 0x3876, 0x3878, // loc_386b -> jr c 0x389a
      0x389a, 0x389b, 0x389d, 0x38a0, 0x38a1, // loc_389a -> ret nz taken
    ],
    calls: [], // no tail-jump: a direct ret
    returned: true,
    cycles:
      /* entry */ 13 + 4 + 13 + 7 + 7 + 13 + 13 + 4 + 7 + 4 + 12 + // 97 (jr nz 385f TAKEN, no ld a,0xaf)
      /* 3863  */ 13 + 7 + 13 + // 33
      /* 386b  */ 13 + 7 + 10 + 13 + 7 + 12 + // 62
      /* 389a  */ 4 + 7 + 13 + 4 + 11, // 39  => 231
    pc: 0x38a1, // last step target; the test double's ret does not move PC
    a: 0x05, // ld a,(0x807c); and a leaves A
    mem: {
      0x810b: 0x2e, // toggled 0xaf -> 0x2e
      0x811c: 0x2f, // 0x2e ^ 0x01
      0x8112: 0x08, // reloaded
      0x807c: 0x05, // unchanged -- the ret nz path writes nothing
      0x810d: 0x00, // Y untouched
    },
  });
});

// --- Path D: 4th tick without underflow (timer 0x05 -> 0x04), Y==0x17 and X>=0x24
//     -> the reset arm (clear 0x8079/0x8068, set 0x807d=1, CALL 0x1b5b), then
//     loc_389a with Y!=0 -> loc_38b2 decrements Y, tail 0x3a4c. ------------------
const PATH_D_STEPS = [
  0x384d, 0x384e, 0x3851, // entry: jr nz taken (still counting)
  0x386b, 0x386e, 0x3870, 0x3873, 0x3876, 0x3878, 0x387a, 0x387d, 0x387f, 0x3881, 0x3884, 0x3886, // 4th tick, both cp fall through
  0x3888, 0x388a, 0x388d, 0x3890, 0x3891, 0x3894, 0x1b5b, 0x389a, // reset arm + call + reload Y
  0x389b, 0x38b2, // loc_389a -> jr nz 0x38b2
  0x38b3, 0x38b6, 0x38b9, 0x3a4c, // loc_38b2 -> tail
];
test("path D: Y==0x17 reset arm calls 0x1b5b, then Y decrement -> tail 0x3a4c", () => {
  const m = makeMachine({ ...CTX, 0x8112: 0x05, 0x810d: 0x17, 0x810a: 0x30, 0x8079: 0x99, 0x8068: 0x99, 0x807d: 0x00 });
  loc_384a(m);
  assertPath(m, {
    steps: PATH_D_STEPS,
    calls: [0x1b5b, 0x3a4c], // nested call, then the tail-jump
    pushes: [0x3897], // the CALL stacks its return address
    cycles:
      /* entry */ 13 + 4 + 13 + 12 + // 42
      /* 386b  */ 13 + 7 + 10 + 13 + 7 + 7 + 13 + 7 + 7 + 13 + 7 + 7 + // 111
      /*  reset*/ 7 + 13 + 13 + 4 + 13 + 17 + 13 + // 80
      /* 389a  */ 4 + 12 + // 16
      /* 38b2  */ 4 + 13 + 13 + 10, // 40  => 289
    pc: 0x3a4c,
    a: 0x16, // Y 0x17 -> dec 0x16
    mem: {
      0x8079: 0x00, // cleared
      0x8068: 0x00, // tile cleared
      0x807d: 0x01, // inc a of 0x00
      0x810d: 0x16, // Y decremented
      0x811e: 0x16, // Y mirror
      0x8112: 0x04, // counted down, NOT reloaded
    },
  });
});

// --- Mutation: `add a,0x10` (0x38c0, the X mirror) corrupted to `add a,0x20` -----
test("mutation: `add a,0x20` for `add a,0x10` on the X mirror is caught", () => {
  // Byte-identical to loc_384a except the X mirror at 0x38c0 adds 0x20 instead of
  // 0x10. Cycles are UNCHANGED (add a,n is 7T either way), so only the value
  // assertions can reject it: with X advancing 0x10 -> 0x11, the mirror becomes
  // 0x11 + 0x20 = 0x31 instead of 0x11 + 0x10 = 0x21.
  function loc_384a_mutant(m) {
    const { regs, mem } = m;
    let next = 0x384a;
    for (;;) {
      switch (next) {
        case 0x384a: {
          regs.a = mem.read8(0x8112); m.step(0x384d, 13);
          regs.a = regs.dec8(regs.a); m.step(0x384e, 4);
          mem.write8(0x8112, regs.a); m.step(0x3851, 13);
          if (regs.fNZ) { m.step(0x386b, 12); next = 0x386b; break; }
          m.step(0x3853, 7);
          regs.a = 0x08; m.step(0x3855, 7);
          mem.write8(0x8112, regs.a); m.step(0x3858, 13);
          regs.a = mem.read8(0x810b); m.step(0x385b, 13);
          regs.b = regs.a; m.step(0x385c, 4);
          regs.a = 0x2e; m.step(0x385e, 7);
          regs.cp(regs.b); m.step(0x385f, 4);
          if (regs.fNZ) { m.step(0x3863, 12); next = 0x3863; break; }
          m.step(0x3861, 7);
          regs.a = 0xaf; m.step(0x3863, 7);
          next = 0x3863; break;
        }
        case 0x3863: {
          mem.write8(0x810b, regs.a); m.step(0x3866, 13);
          regs.xor(0x01); m.step(0x3868, 7);
          mem.write8(0x811c, regs.a); m.step(0x386b, 13);
          next = 0x386b; break;
        }
        case 0x386b: {
          regs.a = mem.read8(0x8112); m.step(0x386e, 13);
          regs.and(0x03); m.step(0x3870, 7);
          if (regs.fNZ) { m.step(0x3a4c, 10); return m.call(0x3a4c); }
          m.step(0x3873, 10);
          regs.a = mem.read8(0x810d); m.step(0x3876, 13);
          regs.cp(0x17); m.step(0x3878, 7);
          if (regs.fC) { m.step(0x389a, 12); next = 0x389a; break; }
          m.step(0x387a, 7);
          regs.a = mem.read8(0x810a); m.step(0x387d, 13);
          regs.cp(0x24); m.step(0x387f, 7);
          if (regs.fC) { m.step(0x38bc, 12); next = 0x38bc; break; }
          m.step(0x3881, 7);
          regs.a = mem.read8(0x810d); m.step(0x3884, 13);
          regs.cp(0x17); m.step(0x3886, 7);
          if (regs.fNZ) { m.step(0x389a, 12); next = 0x389a; break; }
          m.step(0x3888, 7);
          regs.a = 0x00; m.step(0x388a, 7);
          mem.write8(0x8079, regs.a); m.step(0x388d, 13);
          mem.write8(0x8068, regs.a); m.step(0x3890, 13);
          regs.a = regs.inc8(regs.a); m.step(0x3891, 4);
          mem.write8(0x807d, regs.a); m.step(0x3894, 13);
          m.push16(0x3897); m.step(0x1b5b, 17); m.call(0x1b5b);
          regs.a = mem.read8(0x810d); m.step(0x389a, 13);
          next = 0x389a; break;
        }
        case 0x389a: {
          regs.and(regs.a); m.step(0x389b, 4);
          if (regs.fNZ) { m.step(0x38b2, 12); next = 0x38b2; break; }
          m.step(0x389d, 7);
          regs.a = mem.read8(0x807c); m.step(0x38a0, 13);
          regs.and(regs.a); m.step(0x38a1, 4);
          if (regs.fNZ) { return m.ret(11); }
          m.step(0x38a2, 5);
          regs.a = 0x78; m.step(0x38a4, 7);
          mem.write8(0x807c, regs.a); m.step(0x38a7, 13);
          regs.a = 0x09; m.step(0x38a9, 7);
          mem.write8(0x810b, regs.a); m.step(0x38ac, 13);
          mem.write8(0x811c, regs.a); m.step(0x38af, 13);
          m.step(0x3a4c, 10); return m.call(0x3a4c);
        }
        case 0x38b2: {
          regs.a = regs.dec8(regs.a); m.step(0x38b3, 4);
          mem.write8(0x810d, regs.a); m.step(0x38b6, 13);
          mem.write8(0x811e, regs.a); m.step(0x38b9, 13);
          m.step(0x3a4c, 10); return m.call(0x3a4c);
        }
        case 0x38bc: {
          regs.a = regs.inc8(regs.a); m.step(0x38bd, 4);
          mem.write8(0x810a, regs.a); m.step(0x38c0, 13);
          regs.add(0x20); m.step(0x38c2, 7); // BUG: should be add a,0x10
          mem.write8(0x811b, regs.a); m.step(0x38c5, 13);
          m.step(0x3a4c, 10); return m.call(0x3a4c);
        }
        default:
          throw new Error("mutant: bad block 0x" + next.toString(16));
      }
    }
  }

  const m = makeMachine({ ...CTX, 0x8112: 0x01, 0x810b: 0x2e, 0x810d: 0x20, 0x810a: 0x10 });
  loc_384a_mutant(m);
  // Cycles are identical to the real Path B, so only the value checks reject it.
  assert.equal(m.cycles, 268, "mutation preserves the cycle total (so cycles cannot catch it)");
  assert.equal(m.mem.read8(0x811b), 0x31, "mutant mirror = X+1 + 0x20, not + 0x10");
  assert.throws(
    () =>
      assertPath(m, {
        steps: PATH_B_STEPS,
        calls: [0x3a4c],
        cycles: 268,
        pc: 0x3a4c,
        a: 0x31,
        mem: { 0x811b: 0x21 },
      }),
    /mem\[0x811b\]/,
  );
});
