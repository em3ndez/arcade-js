// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_2fc0 (ROM 0x2fc0, The Pit) -- the per-frame
 * animation phase clock: A = --(0x80e3), then a three-way route depending on the
 * result.
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags, a
 * flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine) so the
 * routine runs in isolation without a ROM image. The routine has NO ret and exits
 * only by tail-jumping (delegating) into one of three shared routines; the mock's
 * `call` records the target and does NOT execute it, so the final PC is that target
 * and m.calls is a single-element witness that the tail-jump fired (not a `ret`).
 * `pcSeq` records every step boundary for a deterministic stepcheck.
 *
 * The four paths pinned against the disassembly (0x2fc0-0x2fe2):
 *   A. (0x80e3)=0x01 -> --=0 -> `jr nz` NOT taken -> reload; (0x80dc)=0x39 (!=0x38)
 *      -> `cp b` NZ -> `jr nz,0x2fd9` TAKEN -> delegate loc_2fd9 with A=0x38.  (97 T)
 *   B. (0x80e3)=0x01 -> --=0 -> reload; (0x80dc)=0x38 -> `cp b` Z -> `jr nz` NOT
 *      taken -> `ld a,0x39` -> fall into loc_2fd9 with A=0x39.                  (99 T)
 *   C. (0x80e3)=0x06 -> --=5 -> `jr nz` TAKEN -> loc_2fde: 5&3=1 (NZ) ->
 *      `jp nz,0x3029` TAKEN -> delegate loc_3029.                              (59 T)
 *   D. (0x80e3)=0x05 -> --=4 -> `jr nz` TAKEN -> loc_2fde: 4&3=0 (Z) -> `jp nz`
 *      NOT taken -> fall into the wave body loc_2fe3.                          (59 T)
 * In every path both `ld (0x80e3),a` writes are checked (the decremented value at
 * 0x2fc4, and the 0x08 reload on paths A/B), plus A at the delegation and the full
 * step-boundary sequence.
 *
 * TEETH (required mutation): mis-charge the `jp nz,0x3029` (path C) as 12 T -- the
 * plausible "a taken conditional jump costs 12 like `jr cc`" error. `jp cc,nn` is
 * ALWAYS 10 T (taken or not); the golden T-state assertion MUST catch the 12.
 *
 * Run: node --test games/thepit/translated/test/loc_2fc0.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2fc0 } from "../loc_2fc0.js";

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
  const m = {
    regs,
    mem,
    ram,
    calls: [],
    tstates: 0,
    pc: 0x2fc0,
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
      return undefined; // tail-jump target is recorded, not executed, in isolation
    },
  };
  // Seat a caller return address on the stack. loc_2fc0 has no ret, so it must stay
  // put -- a stray pop (a wrongly-modelled tail-jump) would disturb SP.
  regs.sp = 0x8700;
  m.push16(CALLER_RET);
  return m;
}

// Every path is a tail-jump: no ret, so the caller frame on the stack is untouched.
function assertNoRet(m) {
  assert.equal(m.regs.sp, 0x86fe, "SP unchanged (no ret popped the caller frame)");
  assert.equal(m.mem.read16(0x86fe), CALLER_RET, "caller return address left intact");
}

// ---- Path A: reload, tile != 0x38, `jr nz,0x2fd9` TAKEN -> loc_2fd9 (A=0x38) -------
const EXPECTED_PC_SEQ_A = [
  0x2fc3, 0x2fc4, 0x2fc7, 0x2fc9, 0x2fcb, 0x2fce, 0x2fd1, 0x2fd2, 0x2fd4, 0x2fd5,
  0x2fd9, // jr nz TAKEN -> loc_2fd9
];

function assertPathAGolden(m) {
  assert.equal(m.tstates, 97, "Path A T-state total (reload, jr nz taken)");
  assert.equal(m.mem.read8(0x80e3), 0x08, "(0x80e3) reloaded to 0x08");
  assert.equal(m.regs.a, 0x38, "A = 0x38 (tile stays 0x38) at the delegation");
  assert.equal(m.pc, 0x2fd9, "ends at loc_2fd9 (tail-jump target set by the last step)");
  assert.deepEqual(m.calls, [0x2fd9], "delegated via m.call(0x2fd9) -- not a ret");
  assertNoRet(m);
}

test("loc_2fc0 Path A: (0x80e3)=1 -> reload, tile 0x39 -> loc_2fd9 with A=0x38", () => {
  const m = makeMachine();
  m.mem.write8(0x80e3, 0x01);
  m.mem.write8(0x80dc, 0x39);
  loc_2fc0(m);
  assertPathAGolden(m);
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ_A, "Path A step boundaries match the disassembly");
});

// ---- Path B: reload, tile == 0x38 -> `jr nz` NOT taken -> `ld a,0x39` -> loc_2fd9 --
const EXPECTED_PC_SEQ_B = [
  0x2fc3, 0x2fc4, 0x2fc7, 0x2fc9, 0x2fcb, 0x2fce, 0x2fd1, 0x2fd2, 0x2fd4, 0x2fd5,
  0x2fd7, 0x2fd9, // jr nz NOT taken -> 0x2fd7 (flip to 0x39) -> loc_2fd9
];

function assertPathBGolden(m) {
  assert.equal(m.tstates, 99, "Path B T-state total (reload, jr nz not taken, flip)");
  assert.equal(m.mem.read8(0x80e3), 0x08, "(0x80e3) reloaded to 0x08");
  assert.equal(m.regs.a, 0x39, "A = 0x39 (tile flipped from 0x38) at the delegation");
  assert.equal(m.pc, 0x2fd9, "ends at loc_2fd9");
  assert.deepEqual(m.calls, [0x2fd9], "delegated via m.call(0x2fd9) -- not a ret");
  assertNoRet(m);
}

test("loc_2fc0 Path B: (0x80e3)=1 -> reload, tile 0x38 -> flip -> loc_2fd9 with A=0x39", () => {
  const m = makeMachine();
  m.mem.write8(0x80e3, 0x01);
  m.mem.write8(0x80dc, 0x38);
  loc_2fc0(m);
  assertPathBGolden(m);
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ_B, "Path B step boundaries match the disassembly");
});

// ---- Path C: counter running, off-phase -> `jp nz,0x3029` TAKEN -> loc_3029 --------
const EXPECTED_PC_SEQ_C = [
  0x2fc3, 0x2fc4, 0x2fc7, 0x2fde, 0x2fe0, 0x3029, // jr nz TAKEN, jp nz TAKEN
];

function assertPathCGolden(m) {
  assert.equal(m.tstates, 59, "Path C T-state total (jr nz taken, jp nz taken)");
  assert.equal(m.mem.read8(0x80e3), 0x05, "(0x80e3) = 6-1 = 0x05 (no reload)");
  assert.equal(m.regs.a, 0x01, "A = 0x05 & 0x03 = 0x01 at the delegation");
  assert.equal(m.pc, 0x3029, "ends at loc_3029 (off-phase tail)");
  assert.deepEqual(m.calls, [0x3029], "delegated via m.call(0x3029) -- not a ret");
  assertNoRet(m);
}

test("loc_2fc0 Path C: (0x80e3)=6 -> --=5, off-phase (5&3) -> loc_3029", () => {
  const m = makeMachine();
  m.mem.write8(0x80e3, 0x06);
  loc_2fc0(m);
  assertPathCGolden(m);
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ_C, "Path C step boundaries match the disassembly");
});

// ---- Path D: counter running, on-phase -> `jp nz` NOT taken -> loc_2fe3 ------------
const EXPECTED_PC_SEQ_D = [
  0x2fc3, 0x2fc4, 0x2fc7, 0x2fde, 0x2fe0, 0x2fe3, // jr nz TAKEN, jp nz NOT taken
];

function assertPathDGolden(m) {
  assert.equal(m.tstates, 59, "Path D T-state total (jr nz taken, jp nz not taken)");
  assert.equal(m.mem.read8(0x80e3), 0x04, "(0x80e3) = 5-1 = 0x04 (no reload)");
  assert.equal(m.regs.a, 0x00, "A = 0x04 & 0x03 = 0x00 at the delegation");
  assert.equal(m.pc, 0x2fe3, "ends at loc_2fe3 (on-phase wave body)");
  assert.deepEqual(m.calls, [0x2fe3], "delegated via m.call(0x2fe3) -- not a ret");
  assertNoRet(m);
}

test("loc_2fc0 Path D: (0x80e3)=5 -> --=4, on-phase (4&3==0) -> loc_2fe3", () => {
  const m = makeMachine();
  m.mem.write8(0x80e3, 0x05);
  loc_2fc0(m);
  assertPathDGolden(m);
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ_D, "Path D step boundaries match the disassembly");
});

// ---- MUTATION: the `jp nz,0x3029` step must be charged 10 T, not 12 T --------------
test("loc_2fc0 MUTATION: `jp nz` mis-charged 12T (the `jr` taken cost) instead of 10T is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  // On Path C the taken `jp nz` lands on 0x3029; mis-charge it 12 T (jr-taken cost).
  // jp cc,nn is ALWAYS 10 T -- this is the "a jump is a jump" copy error.
  let mutated = false;
  m.step = (nextAddr, cycles) => {
    if (!mutated && nextAddr === 0x3029) { mutated = true; return realStep(nextAddr, 12); }
    return realStep(nextAddr, cycles);
  };

  m.mem.write8(0x80e3, 0x06);
  loc_2fc0(m);

  assert.equal(m.tstates, 61, "mutation adds exactly 2 T (10 -> 12)");
  assert.throws(
    () => assertPathCGolden(m),
    /Path C T-state total/,
    "the golden T-state assertion must fail on the mutant",
  );
});
