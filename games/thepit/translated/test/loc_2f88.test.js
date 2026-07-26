// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_2f88 (ROM 0x2f88-0x2fbf, The Pit) -- the
 * frame-gated 6-tile vertical column animation step that DELEGATES to loc_2fc0.
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags, a
 * flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine) so the
 * routine runs in isolation without a ROM image. Every exit is a delegation into
 * loc_2fc0 (`m.step(0x2fc0,c); return m.call(0x2fc0)`); the mock's `call` records
 * the target and does NOT execute it, so the final PC is 0x2fc0 and m.calls ==
 * [0x2fc0] proves the delegation fired (and that it is not a `ret`). `pcSeq` records
 * every step boundary for a deterministic stepcheck.
 *
 * It pins, against the disassembly, all three exit paths:
 *   1. GATE EXPIRES + RENDERS: (0x80e5)=1 -> dec -> 0 -> jr nz NOT taken; reload
 *      (0x80e5) from (0x80e4)=0x08; cursor (0x80e6)=0x0c -> sub 6 = 0x06 (no carry)
 *      -> jr c NOT taken; ix = 0x3048+6 = 0x304e; copy table[0x304e..0x3053] UP the
 *      column to 0x938c,0x936c,0x934c,0x932c,0x930c,0x92ec; djnz loop x6; delegate
 *      to loc_2fc0. 553 T. Full pcSeq stepcheck.
 *   2. GATE NOT EXPIRED: (0x80e5)=5 -> dec -> 4 (non-zero) -> jr nz TAKEN -> delegate
 *      immediately; (0x80e5) stored as 4; (0x80e4)/(0x80e6)/video RAM untouched. 42 T.
 *   3. CURSOR UNDERFLOW: (0x80e5)=1 -> gate expires + reload; (0x80e6)=0x03 -> sub 6
 *      = 0xfd with carry -> jr c TAKEN -> delegate; (0x80e6) NOT stored (still 0x03),
 *      no video-RAM writes. 95 T.
 *
 * TEETH (required mutation): mis-charge the `ld ix,(0x80e1)` step (0x2fab, nextAddr
 * 0x2faf) as 16 T instead of 20 T -- the exact cost of the PRECEDING `ld (0x80e1),hl`
 * (0x2fa8, also 16 T), a plausible "the two memory-word moves cost the same" copy
 * error, correct value, wrong cycle budget. Path 1 is re-run with that one step
 * mis-charged and the golden T-state assertion MUST catch it.
 *
 * Run: node --test games/thepit/translated/test/loc_2f88.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2f88 } from "../loc_2f88.js";

const CALLER_RET = 0xabcd; // seated on the stack; a `ret` (there is none) would pop it

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
    pc: 0x2f88,
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
      return undefined; // delegation target is recorded, not executed, in isolation
    },
  };
}

// Every path ends by delegating into loc_2fc0 (never a ret).
function assertDelegatesToLoc2fc0(m) {
  assert.equal(m.pc, 0x2fc0, "ends at loc_2fc0 (delegation target set by the last step)");
  assert.deepEqual(m.calls, [0x2fc0], "delegated via m.call(0x2fc0) -- not a ret");
}

// ---- Path 1: gate expires and the column renders ----------------------------------
// Six destination cells written UP the column from 0x938c, step -0x20 per byte.
const COLUMN_DEST = [0x938c, 0x936c, 0x934c, 0x932c, 0x930c, 0x92ec];
// The 6 source bytes we seed into the table at 0x304e..0x3053 (arbitrary tile codes).
const SRC_BYTES = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66];

const STRAIGHT_SEQ_1 = [
  0x2f8b, 0x2f8c, 0x2f8f, 0x2f91, 0x2f94, 0x2f97, 0x2f9a, 0x2f9c, 0x2f9e,
  0x2fa1, 0x2fa2, 0x2fa4, 0x2fa7, 0x2fa8, 0x2fab, 0x2faf, 0x2fb2, 0x2fb5, 0x2fb7,
];
const LOOP_SEQ_1 = [];
for (let i = 0; i < 6; i++) {
  LOOP_SEQ_1.push(0x2fba, 0x2fbb, 0x2fbc, 0x2fbe);
  LOOP_SEQ_1.push(i < 5 ? 0x2fb7 : 0x2fc0); // djnz back x5, then fall-through
}
const EXPECTED_PC_SEQ_1 = [...STRAIGHT_SEQ_1, ...LOOP_SEQ_1];

function setupPath1(m) {
  m.regs.sp = 0x8f00;
  m.push16(CALLER_RET);
  m.mem.write8(0x80e5, 0x01); // gate -> dec -> 0
  m.mem.write8(0x80e4, 0x08); // gate reload period
  m.mem.write8(0x80e6, 0x0c); // cursor -> sub 6 -> 0x06 (no underflow)
  SRC_BYTES.forEach((b, i) => m.mem.write8(0x304e + i, b)); // table[0x304e..0x3053]
}

function assertPath1Golden(m) {
  assert.equal(m.tstates, 553, "Path 1 T-state total (gate expires + full 6-tile render)");
  assert.equal(m.mem.read8(0x80e5), 0x08, "(0x80e5) reloaded from (0x80e4)=0x08");
  assert.equal(m.mem.read8(0x80e6), 0x06, "(0x80e6) advanced 0x0c - 6 = 0x06");
  COLUMN_DEST.forEach((dst, i) =>
    assert.equal(m.mem.read8(dst), SRC_BYTES[i],
      `column cell 0x${dst.toString(16)} = table byte ${i}`));
  assert.equal(m.regs.a, SRC_BYTES[5], "A holds the last table byte copied");
  assert.equal(m.regs.ix, 0x304e + 6, "ix advanced by 6 (once per tile)");
  assert.equal(m.regs.b, 0x00, "B counted down to 0");
  assertDelegatesToLoc2fc0(m);
}

test("loc_2f88 Path 1: gate expires -> reload + render 6-tile column -> delegate", () => {
  const m = makeMachine();
  setupPath1(m);
  loc_2f88(m);
  assertPath1Golden(m);
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ_1, "Path 1 step boundaries match the disassembly");
});

// ---- Path 2: gate not expired -> immediate delegate -------------------------------
test("loc_2f88 Path 2: gate not expired (jr nz taken) -> delegate, no render", () => {
  const m = makeMachine();
  m.mem.write8(0x80e5, 0x05); // dec -> 4, non-zero
  m.mem.write8(0x80e4, 0x08);
  m.mem.write8(0x80e6, 0x0c);
  loc_2f88(m);

  assert.equal(m.tstates, 42, "Path 2 T-state total (ld/dec/ld + jr nz taken)");
  assert.equal(m.mem.read8(0x80e5), 0x04, "(0x80e5) stored decremented to 4");
  assert.equal(m.mem.read8(0x80e6), 0x0c, "(0x80e6) untouched (step skipped)");
  assert.equal(m.mem.read8(0x938c), 0x00, "no video-RAM column write");
  assert.deepEqual(m.pcSeq, [0x2f8b, 0x2f8c, 0x2f8f, 0x2fc0], "boundaries: dec/store then jr nz taken");
  assertDelegatesToLoc2fc0(m);
});

// ---- Path 3: cursor underflow -> delegate, no render ------------------------------
test("loc_2f88 Path 3: cursor underflow (jr c taken) -> delegate, no render", () => {
  const m = makeMachine();
  m.mem.write8(0x80e5, 0x01); // gate expires
  m.mem.write8(0x80e4, 0x08);
  m.mem.write8(0x80e6, 0x03); // 0x03 - 6 -> carry (underflow)
  loc_2f88(m);

  assert.equal(m.tstates, 95, "Path 3 T-state total (through sub + jr c taken)");
  assert.equal(m.mem.read8(0x80e5), 0x08, "(0x80e5) reloaded before the underflow check");
  assert.equal(m.mem.read8(0x80e6), 0x03, "(0x80e6) NOT stored (jr c skipped the store)");
  assert.equal(m.regs.a, 0xfd, "A = 0x03 - 0x06 = 0xfd");
  assert.equal(m.regs.fC, true, "carry set by the underflowing sub");
  assert.equal(m.mem.read8(0x938c), 0x00, "no video-RAM column write");
  assert.deepEqual(
    m.pcSeq,
    [0x2f8b, 0x2f8c, 0x2f8f, 0x2f91, 0x2f94, 0x2f97, 0x2f9a, 0x2f9c, 0x2fc0],
    "boundaries: through the sub then jr c taken",
  );
  assertDelegatesToLoc2fc0(m);
});

// ---- MUTATION: `ld ix,(0x80e1)` must be charged 20 T, not 16 T --------------------
test("loc_2f88 MUTATION: `ld ix,(nn)` mis-charged 16T (not 20T) is caught", () => {
  const m = makeMachine();
  setupPath1(m);
  const realStep = m.step.bind(m);
  // The `ld ix,(0x80e1)` step lands on 0x2faf exactly once; mis-charge it 16 T
  // (the cost of the preceding `ld (0x80e1),hl`) instead of the correct 20 T.
  let mutated = false;
  m.step = (nextAddr, cycles) => {
    if (!mutated && nextAddr === 0x2faf) { mutated = true; return realStep(nextAddr, 16); }
    return realStep(nextAddr, cycles);
  };

  loc_2f88(m);

  assert.equal(m.tstates, 549, "mutation drops exactly 4 T (20 -> 16)");
  assert.throws(
    () => assertPath1Golden(m),
    /Path 1 T-state total/,
    "the golden T-state assertion must fail on the mutant",
  );
});
