// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_28ab (ROM 0x28ab, The Pit) -- the object/tile
 * setup routine for the pointer at 0x806e.
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags, a
 * flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine) so the
 * routine is exercised in isolation without a ROM image. Because every exit is a
 * `ret`, the mock seats a known caller return address on the stack so the final PC
 * proves which `ret` fired. `pcSeq` records every step boundary so a deterministic
 * path can be pinned exactly (stepcheck).
 *
 * It pins, against the disassembly, three concrete paths:
 *   A. D != 0x70, D == 0xc5, E == 0xc1 -> sprite id 0x9d, (0x80a2) != 4 so no Y bias,
 *      counter 0x80bd non-zero -> arms 0x80b1 = 0x08 and returns (419 T). Full pcSeq.
 *   B. D == 0xc5, E == 0x97 -> default sprite id 0x70, (0x80a2) == 4 so Y biased,
 *      counter 0x80bd == 0 -> second-entity commit, neighbour tile 0x97 remapped
 *      through the 0x2dc3 table into (ix-0x01) (797 T). Exercises loc_2934 + the
 *      double write to (ix-0x01) + the ROM-table lookup.
 *   C. D == 0x00 -> loc_28e4 `ret nz` immediately (only 0x80ba written, 144 T).
 *
 * TEETH (required mutation): mis-charge `ld ix,(0x806e)` (DD 2A = 20 T) as the
 * `ld hl,(nn)` timing (16 T) -- a plausible copy error, same logic, wrong cycle
 * budget. Path A is re-run with that one step mis-charged and the golden T-state
 * assertion MUST catch it.
 *
 * Run: node --test games/thepit/translated/test/loc_28ab.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_28ab } from "../loc_28ab.js";

const CALLER_RET = 0xabcd; // seated on the stack; any `ret` pops it into PC

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => {
      ram[a & 0xffff] = v & 0xff;
      ram[(a + 1) & 0xffff] = (v >> 8) & 0xff;
    },
  };
  return {
    regs,
    mem,
    ram,
    calls: [],
    tstates: 0,
    pc: 0x28ab,
    pcSeq: [],
    step(nextAddr, cycles) {
      this.pc = nextAddr;
      this.tstates += cycles;
      this.pcSeq.push(nextAddr);
    },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) {
      this.step(this.pop16(), cycles);
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // no tail-jumps in this routine; present for surface parity
    },
  };
}

// Seat the caller's return address so any `ret` inside the routine pops a known value.
function seatCaller(m) {
  m.regs.sp = 0x8780; // inside work RAM (0x8000-0x87FF)
  m.push16(CALLER_RET);
}

// The full instruction-boundary sequence for Path A, straight off the disassembly.
const EXPECTED_PC_SEQ_A = [
  // entry
  0x28af, 0x28b3, 0x28b5, 0x28b7, 0x28ba, 0x28bd, 0x28bf, 0x28c0,
  0x28e4, // jr nz taken -> loc_28e4
  // loc_28e4
  0x28e6, 0x28e8, 0x28e9, 0x28ea, 0x28ec, 0x28ed, 0x28ef, 0x28f1,
  0x28fa, // jr 0x28fa
  // loc_28fa
  0x28fd, 0x28fe, 0x2901, 0x2904, 0x2906, 0x2909, 0x290c, 0x290e, 0x2911,
  0x2914, // jr nz taken (skip dec a)
  // loc_2914
  0x2916, 0x2918, 0x2919, 0x291c, 0x291f, 0x2921, 0x2924, 0x2927, 0x2928,
  0x292b, 0x292c, 0x292e, 0x2930, 0x2933,
  CALLER_RET, // ret
];

// -- Path A: sprite id 0x9d, no Y bias, counter non-zero -> arm 0x80b1=0x08, ret ---
function setupPathA(m) {
  seatCaller(m);
  m.mem.write16(0x806e, 0x8100); // IX pointer
  m.mem.write8(0x80ff, 0xc1);    // (ix-0x01) = E
  m.mem.write8(0x8100, 0xc5);    // (ix+0x00) = D
  m.mem.write8(0x8094, 0x20);    // X source
  m.mem.write8(0x80a2, 0x00);    // != 4 -> no Y bias (dec a skipped)
  m.mem.write8(0x806b, 0x40);    // Y source
  m.mem.write8(0x80a3, 0x18);    // attribute source
  m.mem.write8(0x80bd, 0x05);    // counter non-zero -> arm-and-return arm
}

function assertPathAGolden(m) {
  const b = (a) => m.mem.read8(a);
  assert.equal(m.tstates, 419, "Path A T-state total");
  assert.equal(m.pc, CALLER_RET, "Path A ends via `ret` (popped caller address)");
  assert.deepEqual(m.calls, [], "Path A makes no calls / tail-jumps");
  // saved pointer + classification products
  assert.equal(m.mem.read16(0x80ba), 0x8100, "(0x80ba) = saved IX");
  assert.equal(b(0x80bf), 0x9d, "sprite id 0x9d -> (0x80bf)");
  assert.equal(b(0x80c0), 0x00, "sub-type L=0 -> (0x80c0)");
  assert.equal(b(0x80b6), 0x1c, "(0x8094)-4 = 0x1c -> (0x80b6)");
  assert.equal(b(0x80b9), 0x33, "((0x806b)+5 & 0xf8) - B(0x0d) = 0x33 -> (0x80b9)");
  assert.equal(b(0x80bc), 0x30, "(0x80a3)<<1 = 0x30 -> (0x80bc)");
  assert.equal(b(0x80bd), 0x06, "counter incremented 0x05 -> 0x06");
  assert.equal(b(0x80b1), 0x08, "arm state (0x80b1) = 0x08");
  // live registers into the ret
  assert.equal(m.regs.a, 0x08, "A = 0x08 at ret");
  assert.equal(m.regs.b, 0x0d, "B = 0x0d (loc_28e4 step count) held to the end");
}

test("loc_28ab Path A: id 0x9d, no bias, counter non-zero -> arm 0x80b1=0x08", () => {
  const m = makeMachine();
  setupPathA(m);
  loc_28ab(m);
  assertPathAGolden(m);
  // stepcheck: every step boundary on this deterministic path, in order.
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ_A, "Path A step boundaries match the disassembly");
});

// -- Path B: commit path -> loc_2934, neighbour tile remapped via the 0x2dc3 table --
test("loc_28ab Path B: counter==0 -> second-entity commit + 0x2dc3 table remap", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write16(0x806e, 0x8100); // IX pointer
  m.mem.write8(0x80ff, 0x97);    // (ix-0x01) = E, in [0x96,0x99] -> table lookup arm
  m.mem.write8(0x8100, 0xc5);    // (ix+0x00) = D = 0xc5 -> loc_28e4, default id 0x70
  m.mem.write8(0x8094, 0x30);    // X source -> 0x2c
  m.mem.write8(0x80a2, 0x04);    // == 4 -> Y bias (dec a runs)
  m.mem.write8(0x806b, 0x50);    // Y source
  m.mem.write8(0x80a3, 0x0a);    // attribute source -> 0x14
  m.mem.write8(0x80bd, 0x00);    // counter zero -> commit path (loc_2934)
  m.mem.write8(0x2dc4, 0x88);    // 0x2dc3 table entry for index (0x97-0x96)=1

  loc_28ab(m);

  const b = (a) => m.mem.read8(a);
  assert.equal(m.tstates, 797, "Path B T-state total");
  assert.equal(m.pc, CALLER_RET, "Path B ends via `ret` (table-remap arm)");
  assert.deepEqual(m.calls, [], "Path B makes no calls / tail-jumps");
  // scratch fill
  assert.equal(b(0x80bf), 0x70, "default sprite id 0x70 -> (0x80bf)");
  assert.equal(b(0x80c0), 0x00, "sub-type L=0 -> (0x80c0)");
  assert.equal(b(0x80b6), 0x2c, "(0x8094)-4 = 0x2c -> (0x80b6)");
  assert.equal(b(0x80b9), 0x43, "((0x806b)-1 +5 & 0xf8) - B(0x0d) = 0x43 -> (0x80b9)");
  assert.equal(b(0x80bc), 0x14, "(0x80a3)<<1 = 0x14 -> (0x80bc)");
  assert.equal(b(0x80bd), 0x01, "counter 0x00 -> 0x01 (inc'd)");
  // committed second-entity block (loc_2934)
  assert.equal(b(0x80aa), 0x30, "(0x80aa) = 0x30");
  assert.equal(b(0x80ab), 0x07, "(0x80ab) = 0x07");
  assert.equal(m.mem.read16(0x80af), 0x8100, "(0x80af) = IX reloaded from 0x80ba");
  assert.equal(b(0x80a9), 0x2c, "(0x80a9) = (0x80b6)");
  assert.equal(b(0x80be), 0x2c, "(0x80be) = (0x80b6)");
  assert.equal(b(0x80ac), 0x43, "(0x80ac) = (0x80b9)");
  assert.equal(b(0x80b1), 0x14, "(0x80b1) = (0x80bc)");
  // the two writes to (ix-0x01): 0x70 first (0x2961), then the table value (0x2986)
  assert.equal(b(0x80ff), 0x88, "(ix-0x01) ends as the 0x2dc3 table value 0x88");
  assert.equal(b(0x8100), 0x70, "(ix+0x00) overwritten with 0x70");
  // control-path registers
  assert.equal(m.regs.e, 0x97, "E = OLD (ix-0x01) captured before the overwrite");
  assert.equal(m.regs.a, 0x88, "A = table value at ret");
  assert.equal(m.regs.hl, 0x2dc4, "HL = 0x2dc3 + 1 (index for tile 0x97)");
});

// -- Path C: D neither 0x70 nor 0xc5 -> loc_28e4 `ret nz`, minimal work -------------
test("loc_28ab Path C: D == 0x00 -> immediate `ret nz` after loc_28e4", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write16(0x806e, 0x8100);
  m.mem.write8(0x80ff, 0x00); // E (unused on this arm)
  m.mem.write8(0x8100, 0x00); // D = 0x00 -> jr nz to loc_28e4, then ret nz (D != 0xc5)

  loc_28ab(m);

  assert.equal(m.tstates, 144, "Path C: entry(115) + loc_28e4 7+7+4 + ret nz taken(11)");
  assert.equal(m.pc, CALLER_RET, "`ret nz` popped the caller's return address");
  assert.deepEqual(m.calls, [], "no calls");
  assert.equal(m.mem.read16(0x80ba), 0x8100, "(0x80ba) = saved IX (the only work done)");
  assert.equal(m.mem.read8(0x80bf), 0x00, "returned before the scratch fill -- (0x80bf) untouched");
  assert.equal(m.regs.b, 0x0d, "B = 0x0d (loc_28e4 set it before the ret)");
});

// -- MUTATION: the Path A T-state total must have teeth ------------------------------
test("loc_28ab MUTATION: `ld ix,(0x806e)` mis-charged 16T (not 20T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  // The first step target is 0x28af (following `ld ix,(0x806e)`); mis-charge it 16 T.
  let first = true;
  m.step = (nextAddr, cycles) => {
    if (first && nextAddr === 0x28af) { first = false; return realStep(nextAddr, 16); }
    return realStep(nextAddr, cycles);
  };

  setupPathA(m);
  loc_28ab(m);

  assert.equal(m.tstates, 415, "mutation loses exactly 4 T (20 -> 16)");
  assert.throws(
    () => assertPathAGolden(m),
    /Path A T-state total/,
    "the golden T-state assertion must fail on the mutant",
  );
});
