// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_1a02 (ROM 0x1a02-0x1b58): the vertical-movement tile/terrain
// handler (sibling of loc_1704). A graph of basic blocks whose every terminal exit
// is a TAIL-jump to the epilogue 0x1b5b, with two nested score `call`s (0x467b /
// 0x4683). Three representative paths are driven through it --
//   A: climb gate 0x8080 set -> immediate tail 0x1b5b (nothing computed);
//   B: gate clear, column == 0x23 (top rung) with 0x8078 set -> latch 0x807b:=1,
//      tail 0x1b5b (exercises the H = 0x1f-((phase+3)>>3) preamble);
//   C: gate clear, column 0x05 -> derive IX=0x9001, tile 0x80 (diggable band) ->
//      the loc_1adc table check (sla/rl carry, xor-mirrored offset), current-cell
//      table MISMATCH -> arm the 0xf6 event AND do the neighbour lookup -> tail.
// Each asserts the exact T-state total, the tail-jump / call targets, the pushed
// return address(es), the final PC / A / key registers, and the memory bytes
// written. A MUTATION (`ld a,0xb4` -> `ld a,0xb5` at 0x1a09, the default sprite
// code) is then run on Path B: byte-for-byte identical cycles and step sequence
// (ld a,n is 7T either way, control flow unchanged) and identical final A (0xb4 is
// overwritten before exit), so ONLY the mem[0x8069] value assertion can reject it.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_1a02 } from "../loc_1a02.js";

// Leaf-routine machine double: exactly the surface loc_1a02 touches (regs, mem,
// step, call, ret, push16). `step` records its target + charges cycles; `call`
// records a transfer target WITHOUT invoking a real routine -- for a tail-jump
// `return m.call(addr)` models "control transferred there and never came back",
// and for the score `call`s the callee's own effects are irrelevant here (the
// routine reads no value back from them). `push16` records the stacked return.
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; the table reads land in this (zero) ROM
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x1a02,
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
      return undefined; // tail-jump: callee's ret returns to OUR caller; score calls read nothing back
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
  if (exp.steps) assert.deepEqual(m.steps, exp.steps, "step targets");
  assert.deepEqual(m.calls, exp.calls, "call / tail-jump targets");
  assert.deepEqual(m.pushes, exp.pushes ?? [], "pushed return addresses");
  assert.equal(m.returned, exp.returned ?? false, "direct ret?");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, exp.pc, "final PC");
  assert.equal(m.regs.a, exp.a, "A register");
  for (const [reg, val] of Object.entries(exp.regs ?? {})) {
    assert.equal(m.regs[reg], val, `${reg} register`);
  }
  for (const [addr, val] of Object.entries(exp.mem)) {
    assert.equal(m.mem.read8(Number(addr)), val, `mem[0x${Number(addr).toString(16)}]`);
  }
}

// --- Path A: climb gate 0x8080 set -> immediate tail 0x1b5b ----------------------
test("path A: gate 0x8080 set -> immediate tail-jump 0x1b5b (no compute)", () => {
  const m = makeMachine({ 0x8080: 0x01 });
  loc_1a02(m);
  assertPath(m, {
    steps: [0x1a05, 0x1a06, 0x1b5b], // ld a,(0x8080) / and a (NZ) / jp nz tail
    calls: [0x1b5b],
    cycles: 13 + 4 + 10, // => 27
    pc: 0x1b5b,
    a: 0x01,
    mem: {
      0x8069: 0x00, // never written -- bailed before the 0xb4 store at 0x1a0b
    },
  });
});

// --- Path B: gate clear, column 0x23 (top rung), 0x8078 set -> latch 0x807b -------
const PATH_B_STEPS = [
  0x1a05, 0x1a06, 0x1a09, // gate clear: jp nz NOT taken
  0x1a0b, 0x1a0e, 0x1a11, 0x1a13, 0x1a15, 0x1a17, 0x1a19, 0x1a1b, 0x1a1d, 0x1a20, 0x1a21, // preamble H math
  0x1a24, 0x1a26, // cp 0x23 (== top rung) / jr nz NOT taken
  0x1a28, 0x1a2b, 0x1a2c, // ld a,(0x8078) / and a (NZ) / jp z NOT taken
  0x1a2f, 0x1a31, 0x1a34, 0x1b5b, // ld a,0x01 / latch 0x807b / jp tail
];
test("path B: column == 0x23 with 0x8078 set -> latch 0x807b:=1 -> tail 0x1b5b", () => {
  const m = makeMachine({
    0x8080: 0x00, // gate clear
    0x8068: 0x10, // animation phase -> H = 0x1f - ((0x10+3)>>3) = 0x1f - 2 = 0x1d
    0x806b: 0x23, // column == top rung
    0x8078: 0x05, // non-zero -> jp z NOT taken
  });
  loc_1a02(m);
  assertPath(m, {
    steps: PATH_B_STEPS,
    calls: [0x1b5b],
    cycles:
      /* gate  */ 13 + 4 + 10 + // 27
      /* H math*/ 7 + 13 + 13 + 7 + 8 + 8 + 8 + 8 + 7 + 13 + 4 + 13 + // 109
      /* cp23  */ 7 + 7 + // 14
      /* 8078  */ 13 + 4 + 10 + // 27
      /* latch */ 7 + 13 + 10, // 30  => 207
    pc: 0x1b5b,
    a: 0x01,
    regs: { h: 0x1d },
    mem: {
      0x8069: 0xb4, // default sprite code stored at 0x1a0b, untouched on this path
      0x8073: 0x1d, // H = 0x1f - ((phase+3)>>3)
      0x807b: 0x01, // top-rung flag latched
    },
  });
});

// --- Path C: gate clear, column 0x05 -> IX=0x9001, tile 0x80 -> loc_1adc table
//     mismatch -> arm 0xf6 event + neighbour lookup -> tail 0x1b5b. ----------------
test("path C: diggable tile 0x80, table mismatch -> arm 0xf6 + neighbour lookup -> tail", () => {
  // phase 0xFC -> H = 0x1f - ((0xFF)>>3) = 0x1f - 0x1f = 0x00, so IX = 0x9000 + (E>>3).
  // E = column(0x05) - d(0) + 5 = 0x0A; E>>3 = 1 -> IX = 0x9001; neighbour = (ix-1) = 0x9000.
  const m = makeMachine({
    0x8080: 0x00, // gate clear
    0x8068: 0xfc, // phase -> H = 0x00
    0x806b: 0x05, // column (< 0x53 -> clears 0x80e7; != 0x23)
    0x80a3: 0x99, // reaction param source
    0x9001: 0x80, // tile under actor (diggable band, < 0x95)
    0x9000: 0x85, // neighbour tile (in [0x71,0x9e) -> second lookup runs)
  });
  m.regs.d = 0x00; // move delta
  loc_1a02(m);
  // The path is pinned by the cycle total, the exact write set, and the derived
  // registers; assert the block-entry step targets appeared to confirm the route.
  assert.equal(m.steps.length, 120, "instruction count");
  assert.equal(m.steps.at(-1), 0x1b5b, "final step is the tail-jump");
  for (const blk of [0x1a37, 0x1a43, 0x1ab4, 0x1adc]) {
    assert.ok(m.steps.includes(blk), `entered block 0x${blk.toString(16)}`);
  }
  assertPath(m, {
    calls: [0x1b5b],
    cycles: 155 + 47 + 267 + 88 + 434, // entry + 1a37 + 1a43 + 1ab4 + 1adc => 991
    pc: 0x1b5b,
    a: 0x00, // last read = table byte from zero ROM
    regs: {
      d: 0x80, // tile code kept in D at 0x1ae4
      e: 0x0a, // sub-cell accumulator
      b: 0x00, // sla/rl produced no bit-8 carry (row index small)
      c: 0xa3, // second index low byte = (row*8) | ((E+1)&7)
      hl: 0x2323, // 0x2280 + 0xa3 (neighbour table entry)
      ix: 0x9001, // derived actor cell pointer
    },
    mem: {
      0x8073: 0x00, // H
      0x80e7: 0x00, // cleared (column < 0x53)
      0x8071: 0x01, // E >> 3 (cell column)
      0x806e: 0x01, 0x806f: 0x90, // actor cell pointer = 0x9001
      0x80a5: 0x80, // saved tile
      0x80a7: 0x00, // OVERWRITTEN by the current-cell table read (zero ROM)
      0x80a4: 0x99, // copied from 0x80a3
      0x80a2: 0x04, // reaction param
      0x8069: 0xf6, // 0xf6 event armed (overwrites the 0xb4 default)
      0x80a6: 0x85, // neighbour tile recorded
      0x80a8: 0x00, // neighbour table read (pre-cleared then re-read = zero ROM)
    },
  });
});

// --- Path D: on-boundary collectible tile 0x3a -> call 0x467b (+10), consume via
//     loc_1aa8 (ix reload + blank cell), then loc_1b45 column-fold + sprite select
//     -> loc_1b58 -> tail. Exercises the CALL push and the epilogue-prep blocks. ---
test("path D: on-boundary tile 0x3a -> call 0x467b, consume, loc_1b45 fold -> tail", () => {
  // phase 0xFC -> H = 0x00; E = column(0x03) - d(0) + 5 = 0x08, so (E&7)==0 (on a
  // cell boundary -> the 0x3a collectible arm) and E>>3 = 1 -> IX = 0x9001.
  const m = makeMachine({
    0x8080: 0x00, // gate clear
    0x8068: 0xfc, // phase -> H = 0x00
    0x806b: 0x03, // column (< 0x53, != 0x23); folded by 0x806d below
    0x806d: 0x03, // per-step delta -> new column 0x03-0x03 = 0x00 (bit1 clear -> keep 0xb4)
    0x8081: 0x10, // 0x3a counter
    0x9001: 0x3a, // tile under actor = collectible
  });
  m.regs.d = 0x00; // move delta into the E accumulator
  loc_1a02(m);
  assert.equal(m.steps.length, 74, "instruction count");
  assert.equal(m.steps.at(-1), 0x1b5b, "final step is the tail-jump");
  for (const blk of [0x1a43, 0x467b, 0x1aa8, 0x1b45, 0x1b58]) {
    assert.ok(m.steps.includes(blk), `entered/called 0x${blk.toString(16)}`);
  }
  assertPath(m, {
    calls: [0x467b, 0x1b5b], // nested +10 score call, then the tail-jump
    pushes: [0x1a86], // the call 0x467b stacks its return address
    cycles: 155 + 47 + 339 + 56 + 73 + 13, // entry + 1a37 + 1a43(0x3a arm) + 1aa8 + 1b45 + 1b58 => 683
    pc: 0x1b5b,
    a: 0xb4, // sprite code kept (folded column bit1 clear -> jr z at 0x1b54 taken)
    regs: {
      d: 0x03, // = per-step delta loaded at 0x1b48
      e: 0x08, // sub-cell accumulator
      ix: 0x9001, // derived actor cell pointer
    },
    mem: {
      0x8073: 0x00, // H
      0x80e7: 0x00, // cleared (column < 0x53)
      0x8071: 0x01, // E >> 3
      0x80a5: 0x3a, 0x80a7: 0x3a, // saved tile
      0x8081: 0x11, // 0x3a counter bumped
      0x9001: 0x70, // consumed cell blanked to 0x70
      0x806b: 0x00, // column folded by the delta (0x03 - 0x03)
      0x8069: 0xb4, // sprite code stored at loc_1b58
    },
  });
});

// --- Path E: diggable-guard tile 0xc5 -> loc_1ad5 (`bit 2,e`) with bit2 of E
//     CLEAR, so the `jr nz,0x1adc` at 0x1ad7 is NOT taken and control falls
//     through 0x1ad9 (`jp 0x1b5b`). This is the ONLY route through the 0x1ad5
//     block -- Paths A-D never enter it, which is why the mis-charge shipped. A
//     Z80 `jr cc` NOT taken is 7 T (NOT the `jp cc` 10), so the exact cycle total
//     pins the 0x1ad9 fall-through at 7 and a regression to 10 is rejected. ------
test("path E: tile 0xc5 -> loc_1ad5, bit2 of E clear -> not-taken jr (7T) -> tail 0x1b5b", () => {
  // Same derivation as Path C: phase 0xFC -> H=0x00; column 0x05, d=0 ->
  // E = 0x0A (E&7 = 2 != 0 -> classify at 0x1ab4; bit2 of 0x0A is CLEAR). IX =
  // 0x9001; tile 0xc5 hits the `jr z,0x1ad5` guard at 0x1ac6.
  const m = makeMachine({
    0x8080: 0x00, // gate clear
    0x8068: 0xfc, // phase -> H = 0x00
    0x806b: 0x05, // column (< 0x53 -> clears 0x80e7; != 0x23)
    0x9001: 0xc5, // tile under actor -> the `cp 0xc5` / `jr z,0x1ad5` guard
  });
  m.regs.d = 0x00; // move delta
  loc_1a02(m);
  assert.ok(m.steps.includes(0x1ad5), "entered the 0x1ad5 guard block");
  assert.ok(m.steps.includes(0x1ad9), "took the NOT-taken jr -> 0x1ad9 fall-through");
  assert.equal(m.steps.at(-1), 0x1b5b, "final step is the tail-jump");
  assertPath(m, {
    calls: [0x1b5b],
    cycles: 155 + 47 + 267 + 74 + 25, // entry + 1a37 + 1a43 + 1ab4 + 1ad5 => 568
    // (the 1ad5 block is bit(8) + jr-not-taken(7) + jp tail(10) = 25; a regression
    //  of the not-taken jr to 10 would make this 571 and fail here)
    pc: 0x1b5b,
    a: 0xc5, // tile code kept in A (`cp 0xc5` left it), never overwritten before exit
    regs: {
      e: 0x0a, // sub-cell accumulator (bit2 clear -> jr nz not taken)
      b: 0xc5, // tile kept in B at 0x1a79
      ix: 0x9001, // derived actor cell pointer
    },
    mem: {
      0x8069: 0xb4, // default sprite code; never re-armed (bailed at the guard)
      0x8073: 0x00, // H
      0x80e7: 0x00, // cleared (column < 0x53)
      0x8071: 0x01, // E >> 3 (cell column)
      0x806e: 0x01, 0x806f: 0x90, // actor cell pointer = 0x9001
      0x80a5: 0xc5, 0x80a7: 0xc5, // saved tile
      0x80a8: 0x00, // pre-cleared at 0x1a6c, never re-written on this path
    },
  });
});

// --- Mutation: `ld a,0xb4` (0x1a09, default sprite code) -> `ld a,0xb5`.
//     Path B stays entirely inside the entry block (0x1a02), so a mutant that
//     reproduces only that block fully models it. Cycles + steps + final A are
//     identical (0xb4/0xb5 is overwritten before exit); ONLY the mem[0x8069]
//     value assertion can reject it. --------------------------------------------
test("mutation: `ld a,0xb5` for `ld a,0xb4` (default sprite code) is caught (cycles unchanged)", () => {
  function loc_1a02_mutant(m) {
    const { regs, mem } = m;
    let next = 0x1a02;
    for (;;) {
      switch (next) {
        case 0x1a02: {
          regs.a = mem.read8(0x8080); m.step(0x1a05, 13);
          regs.and(regs.a); m.step(0x1a06, 4);
          if (regs.fNZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); }
          m.step(0x1a09, 10);
          regs.a = 0xb5; m.step(0x1a0b, 7); // BUG: should be ld a,0xb4
          mem.write8(0x8069, regs.a); m.step(0x1a0e, 13);
          regs.a = mem.read8(0x8068); m.step(0x1a11, 13);
          regs.add(0x03); m.step(0x1a13, 7);
          regs.a = regs.srl(regs.a); m.step(0x1a15, 8);
          regs.a = regs.srl(regs.a); m.step(0x1a17, 8);
          regs.a = regs.srl(regs.a); m.step(0x1a19, 8);
          regs.neg(); m.step(0x1a1b, 8);
          regs.add(0x1f); m.step(0x1a1d, 7);
          mem.write8(0x8073, regs.a); m.step(0x1a20, 13);
          regs.h = regs.a; m.step(0x1a21, 4);
          regs.a = mem.read8(0x806b); m.step(0x1a24, 13);
          regs.cp(0x23); m.step(0x1a26, 7);
          if (regs.fNZ) { m.step(0x1a37, 12); next = 0x1a37; break; }
          m.step(0x1a28, 7);
          regs.a = mem.read8(0x8078); m.step(0x1a2b, 13);
          regs.and(regs.a); m.step(0x1a2c, 4);
          if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); }
          m.step(0x1a2f, 10);
          regs.a = 0x01; m.step(0x1a31, 7);
          mem.write8(0x807b, regs.a); m.step(0x1a34, 13);
          m.step(0x1b5b, 10); return m.call(0x1b5b);
        }
        default:
          throw new Error("mutant: bad block 0x" + next.toString(16));
      }
    }
  }

  const m = makeMachine({ 0x8080: 0x00, 0x8068: 0x10, 0x806b: 0x23, 0x8078: 0x05 });
  loc_1a02_mutant(m);
  // Cycles + control flow + final A are identical to real Path B; only the value differs.
  assert.equal(m.cycles, 207, "mutation preserves the cycle total (so cycles cannot catch it)");
  assert.deepEqual(m.steps, PATH_B_STEPS, "mutation preserves the step sequence (control flow unchanged)");
  assert.equal(m.regs.a, 0x01, "final A is identical (0xb5 overwritten before exit)");
  assert.equal(m.mem.read8(0x8069), 0xb5, "mutant stores 0xb5, not 0xb4");
  assert.throws(
    () =>
      assertPath(m, {
        steps: PATH_B_STEPS,
        calls: [0x1b5b],
        cycles: 207,
        pc: 0x1b5b,
        a: 0x01,
        regs: { h: 0x1d },
        mem: { 0x8069: 0xb4 }, // the real value; the mutant wrote 0xb5
      }),
    /mem\[0x8069\]/,
  );
});
