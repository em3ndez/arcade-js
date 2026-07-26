// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_29ad (ROM 0x29ad, The Pit) -- the per-frame
 * handler for the digging object at (0x806e).
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags, a
 * flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine). loc_29ad
 * has NO plain `ret` -- every terminal path tail-jumps to another routine via
 * `m.call(target)` and returns -- so the mock's `call` records the target address and
 * `m.calls` names which jump-out fired. `pcSeq` records every step boundary so a
 * deterministic path can be pinned exactly (stepcheck).
 *
 * It pins, against the disassembly, five concrete paths:
 *   A. (0x8078)==0 -> the first `jr z,0x29d3`; then (0x80bd)==0 -> tail-jump loc_2f71
 *      (102 T). Full pcSeq.
 *   B. object busy, (0x80aa)!=0x30 -> the entry gate falls all the way through to the
 *      `jp nz,0x2cb7` tail-jump (151 T). Full pcSeq -- exercises every "not taken" arm
 *      of the entry gate.
 *   C. object busy, (0x80bd)==0 -> `jp z,0x2bf2` spawn tail-jump (121 T).
 *   D. timer path: (0x80bd)==1 -> loc_2a03, timer 0x80b1 rolls to 0, 0x80c1 set ->
 *      column bump + the two calls (0x4c77, 0x1b5b) + counter/flag writes, then
 *      `jp nz,0x2bd3` (462 T). Exercises both `call` sites and the commit writes.
 *   E. carve path: timer idle (0x80b1==0) -> loc_2ab1 -> loc_2ae6 -> loc_2b16 address
 *      arithmetic -> tile==0 -> loc_2b6e `jr c,0x2bd3` (680 T). Pins the >>3 tilemap
 *      fold: row 0x40 / col 0x60 -> VRAM cell 0x92ED into (0x80af), col bumped to 0x61.
 *
 * TEETH (required mutation): mis-charge the taken `jr z,0x29d3` (12 T) as the
 * not-taken cost (7 T) -- a classic taken/not-taken confusion, same logic, wrong
 * cycle budget. Path A is re-run with that one step mis-charged and the golden
 * T-state assertion MUST catch it.
 *
 * Run: node --test games/thepit/translated/test/loc_29ad.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_29ad } from "../loc_29ad.js";

function makeMachine() {
  const regs = new Regs();
  regs.sp = 0x8780; // valid stack for the internal `call` pushes (inside work RAM)
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
    pc: 0x29ad,
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
      return undefined; // tail-jumps: callee's own ret returns to loc_29ad's caller
    },
  };
}

// -- Path A: (0x8078)==0 -> jr z,0x29d3, then (0x80bd)==0 -> tail-jump loc_2f71 -------
const EXPECTED_PC_SEQ_A = [
  0x29af, 0x29b2, 0x29b5, 0x29b8, 0x29bb, 0x29bc,
  0x29d3, // jr z,0x29d3 taken
  0x29d6, 0x29d7,
  0x2f71, // jp z,0x2f71 taken
];

function assertPathAGolden(m) {
  assert.equal(m.tstates, 102, "Path A T-state total");
  assert.deepEqual(m.calls, [0x2f71], "Path A tail-jumps to loc_2f71");
  assert.equal(m.pc, 0x2f71, "Path A ends at 0x2f71");
  assert.equal(m.mem.read8(0x8080), 0x00, "0x8080 cleared");
  assert.equal(m.mem.read8(0x807f), 0x00, "0x807f cleared");
  assert.equal(m.mem.read8(0x807e), 0x00, "0x807e cleared");
}

test("loc_29ad Path A: (0x8078)==0 & (0x80bd)==0 -> tail-jump loc_2f71", () => {
  const m = makeMachine();
  // all RAM zero -> (0x8078)==0 takes the first jr z; (0x80bd)==0 takes jp z,0x2f71
  loc_29ad(m);
  assertPathAGolden(m);
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ_A, "Path A step boundaries match the disassembly");
});

// -- Path B: entry gate all "not taken" -> jp nz,0x2cb7 ------------------------------
const EXPECTED_PC_SEQ_B = [
  0x29af, 0x29b2, 0x29b5, 0x29b8, 0x29bb, 0x29bc,
  0x29be, 0x29c1, 0x29c2,
  0x29c4, 0x29c7, 0x29c8,
  0x29cb, 0x29ce, 0x29d0,
  0x2cb7, // jp nz,0x2cb7 taken
];

test("loc_29ad Path B: object busy, (0x80aa)!=0x30 -> tail-jump loc_2cb7", () => {
  const m = makeMachine();
  m.mem.write8(0x8078, 0x01); // non-zero -> first jr z not taken
  m.mem.write8(0x8076, 0x01); // non-zero -> second jr z not taken
  m.mem.write8(0x80bd, 0x01); // non-zero -> jp z,0x2bf2 not taken
  m.mem.write8(0x80aa, 0x20); // != 0x30 -> jp nz,0x2cb7 taken
  loc_29ad(m);
  assert.equal(m.tstates, 151, "Path B T-state total");
  assert.deepEqual(m.calls, [0x2cb7], "Path B tail-jumps to loc_2cb7");
  assert.equal(m.pc, 0x2cb7, "Path B ends at 0x2cb7");
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ_B, "Path B step boundaries match the disassembly");
});

// -- Path C: (0x80bd)==0 with object busy -> jp z,0x2bf2 spawn ------------------------
test("loc_29ad Path C: object busy, (0x80bd)==0 -> tail-jump loc_2bf2 (spawn)", () => {
  const m = makeMachine();
  m.mem.write8(0x8078, 0x01);
  m.mem.write8(0x8076, 0x01);
  m.mem.write8(0x80bd, 0x00); // zero -> jp z,0x2bf2 taken
  loc_29ad(m);
  assert.equal(m.tstates, 121, "Path C T-state total");
  assert.deepEqual(m.calls, [0x2bf2], "Path C tail-jumps to loc_2bf2");
  assert.equal(m.pc, 0x2bf2, "Path C ends at 0x2bf2");
});

// -- Path D: timer rolls to zero -> re-init projectile (two calls) -> jp nz,0x2bd3 ---
test("loc_29ad Path D: 0x80b1 timer expiry -> 0x4c77 + 0x1b5b + commit -> loc_2bd3", () => {
  const m = makeMachine();
  m.mem.write8(0x8078, 0x01);
  m.mem.write8(0x8076, 0x01);
  m.mem.write8(0x80bd, 0x01); // !=0 and !=2 -> loc_29d3 jr nz,0x2a03
  m.mem.write8(0x80aa, 0x30); // ==0x30 -> jp nz,0x2cb7 not taken (falls to loc_29d3)
  m.mem.write8(0x80b1, 0x01); // timer 1 -> dec to 0, jr nz not taken
  m.mem.write8(0x80a9, 0x05); // dig position -> dec to 4
  m.mem.write8(0x80c1, 0x01); // set -> jp z,0x2ab1 not taken (commit path)
  m.mem.write8(0x80ac, 0x10); // column -> +8 = 0x18
  m.mem.write8(0x80c0, 0x01); // != 2 -> jp nz,0x2bd3 taken

  loc_29ad(m);

  const b = (a) => m.mem.read8(a);
  assert.equal(m.tstates, 462, "Path D T-state total");
  assert.deepEqual(m.calls, [0x4c77, 0x1b5b, 0x2bd3], "calls 0x4c77, 0x1b5b then tail-jumps loc_2bd3");
  assert.equal(m.pc, 0x2bd3, "Path D ends at 0x2bd3");
  assert.equal(b(0x80b1), 0x00, "timer 0x80b1 decremented to 0");
  assert.equal(b(0x80a9), 0x04, "dig position 0x80a9 decremented to 4");
  assert.equal(b(0x80ac), 0x18, "column 0x80ac bumped by 8 -> 0x18");
  assert.equal(b(0x8069), 0x09, "0x8069 = 0x09 (step code)");
  assert.equal(b(0x80bd), 0x00, "projectile counter 0x80bd cleared");
  assert.equal(b(0x807c), 0xb4, "0x807c = 0xb4");
  assert.equal(b(0x8080), 0x00, "0x8080 overlap flag stayed cleared (no D compute on this arm)");
  assert.equal(m.regs.a, 0x01, "A = (0x80c0) held into the jp nz");
});

// -- Path E: carve path -- validates the loc_2b16 >>3 tilemap address arithmetic -----
test("loc_29ad Path E: idle timer -> loc_2ab1/2ae6/2b16 address math -> loc_2bd3", () => {
  const m = makeMachine();
  m.mem.write8(0x8078, 0x01);
  m.mem.write8(0x8076, 0x01);
  m.mem.write8(0x80bd, 0x01); // -> loc_29d3 jr nz,0x2a03
  m.mem.write8(0x80aa, 0x30); // fall to loc_29d3
  m.mem.write8(0x80b1, 0x00); // timer idle -> jp z,0x2ab1
  m.mem.write8(0x80c1, 0x01); // set -> loc_2ab1 jr nz,0x2ae6
  m.mem.write8(0x806b, 0x50); // bbox bound
  m.mem.write8(0x80ac, 0x60); // column: (0x80ac)-5 = 0x5b >= 0x50 -> jr nc,0x2b16
  m.mem.write8(0x80a9, 0x40); // dig row -> (0x40+7)>>3 = 8
  // (0x92ee) tile at (ix+1) defaults to 0 -> classifies as < 0x71 -> jr c,0x2bd3

  loc_29ad(m);

  const b = (a) => m.mem.read8(a);
  assert.equal(m.tstates, 680, "Path E T-state total");
  assert.deepEqual(m.calls, [0x2bd3], "Path E tail-jumps to loc_2bd3");
  assert.equal(m.pc, 0x2bd3, "Path E ends at 0x2bd3");
  // the whole point: the tilemap cell address computed by the >>3 fold
  assert.equal(m.mem.read16(0x80af), 0x92ed, "(0x80af) = VRAM cell 0x9000 + 23*32 + 13 = 0x92ED");
  assert.equal(m.regs.ix, 0x92ed, "IX loaded from the computed (0x80af)");
  assert.equal(b(0x80ac), 0x61, "column 0x80ac advanced by 1 -> 0x61");
  assert.equal(m.regs.a, 0x00, "A = tile at (ix+1) = 0 held into the cp chain");
  assert.equal(m.regs.d, 0xc1, "D = 0xc1 default translated tile");
  assert.equal(m.regs.e, 0x6a, "E = (col+1)+9 = 0x6a");
});

// -- MUTATION: the Path A T-state total must have teeth ------------------------------
test("loc_29ad MUTATION: taken `jr z,0x29d3` mis-charged 7T (not 12T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  // The taken jr z steps to 0x29d3 (12 T). Mis-charge that one boundary as 7 T.
  let first = true;
  m.step = (nextAddr, cycles) => {
    if (first && nextAddr === 0x29d3) { first = false; return realStep(nextAddr, 7); }
    return realStep(nextAddr, cycles);
  };

  loc_29ad(m);

  assert.equal(m.tstates, 97, "mutation loses exactly 5 T (12 -> 7)");
  assert.throws(
    () => assertPathAGolden(m),
    /Path A T-state total/,
    "the golden T-state assertion must fail on the mutant",
  );
});
