// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_2f2f (ROM 0x2f2f, The Pit) -- seeds the
 * 0x80db-0x80e7 parameter block, derives the animation reload byte (0x80e4) from
 * the level counter (0x8028), then TAIL-JUMPS to loc_30de.
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags,
 * a flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine) so the
 * routine runs in isolation without a ROM image. The only exit is an unconditional
 * `jp 0x30de`, modelled as `m.step(0x30de,10); return m.call(0x30de)`; the mock's
 * `call` records the target and does NOT execute it, so the final PC is 0x30de and
 * m.calls == [0x30de] proves the tail-jump fired (and that it is not a `ret`).
 * `pcSeq` records every step boundary for a deterministic stepcheck.
 *
 * It pins, against the disassembly, both arms of the one branch:
 *   A. (0x8028)=0x01 -> A=inc=0x02, cp4 -> C set -> `jr c` TAKEN (skip clamp) ->
 *      A=0x02^0x07=0x05 stored to (0x80e4); tail-jump loc_30de (259 T).
 *      Full pcSeq stepcheck.
 *   B. (0x8028)=0x10 -> A=inc=0x11, cp4 -> C clear -> `jr c` NOT taken -> clamp
 *      A=0x04 -> A=0x04^0x07=0x03 stored to (0x80e4); tail-jump loc_30de (261 T).
 * Both arms also assert the fixed constant block is identical (it is seeded before
 * the branch).
 *
 * TEETH (required mutation): mis-charge the `jr c` NOT-taken step as 12 T (the
 * taken cost) instead of 7 T -- a plausible "both arms cost the same" copy error,
 * same logic, wrong cycle budget. Path B is re-run with that one step mis-charged
 * and the golden T-state assertion MUST catch it.
 *
 * Run: node --test games/thepit/translated/test/loc_2f2f.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2f2f } from "../loc_2f2f.js";

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
    pc: 0x2f2f,
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
}

// The fixed constant block seeded before the branch -- identical on every path.
function assertConstantBlock(m) {
  const b = (a) => m.mem.read8(a);
  assert.equal(b(0x80dc), 0x39, "(0x80dc)=0x39");
  assert.equal(b(0x80db), 0x28, "(0x80db)=0x28");
  assert.equal(b(0x80de), 0x78, "(0x80de)=0x78");
  assert.equal(b(0x80dd), 0xc0, "(0x80dd)=0xc0");
  assert.equal(b(0x80df), 0x01, "(0x80df)=0x01");
  assert.equal(b(0x80e0), 0xfc, "(0x80e0)=0xfc");
  assert.equal(b(0x80e3), 0x01, "(0x80e3)=0x01");
  assert.equal(b(0x80e5), 0x01, "(0x80e5)=0x01 (A=0x01 reused)");
  assert.equal(b(0x80e7), 0x00, "(0x80e7)=0x00");
  assert.equal(b(0x80e6), 0x96, "(0x80e6)=0x96");
}

// Every path ends in the same unconditional tail-jump to loc_30de.
function assertTailJump(m) {
  assert.equal(m.pc, 0x30de, "ends at loc_30de (tail-jump target set by the last step)");
  assert.deepEqual(m.calls, [0x30de], "tail-jumped via m.call(0x30de) -- not a ret");
}

// ---- Path A: (0x8028)=0x01 -> `jr c` TAKEN (A+1 < 4), no clamp ---------------------
const EXPECTED_PC_SEQ_A = [
  0x2f31, 0x2f34, 0x2f36, 0x2f39, 0x2f3b, 0x2f3e, 0x2f40, 0x2f43, 0x2f45, 0x2f48,
  0x2f4a, 0x2f4d, 0x2f4f, 0x2f52, 0x2f55, 0x2f57, 0x2f5a, 0x2f5c, 0x2f5f, 0x2f62,
  0x2f63, 0x2f65, 0x2f69, // jr c TAKEN jumps straight to loc_2f69 (0x2f67 skipped)
  0x2f6b, 0x2f6e, 0x30de,
];

function assertPathAGolden(m) {
  assert.equal(m.tstates, 259, "Path A T-state total (jr c taken)");
  assertConstantBlock(m);
  assert.equal(m.mem.read8(0x80e4), 0x05, "(0x80e4) = (0x01+1) ^ 0x07 = 0x05");
  assert.equal(m.regs.a, 0x05, "A = 0x05 at the tail-jump");
  // (carry was SET at `cp 0x04` -- that is what drove `jr c` taken -- but the
  //  later `xor 0x07` clears C, so it is 0 here; the pcSeq is the branch witness.)
  assert.equal(m.regs.fC, false, "carry cleared by the final `xor` (xor always clears C)");
  assertTailJump(m);
}

test("loc_2f2f Path A: (0x8028)=0x01 -> jr c taken, (0x80e4)=0x05", () => {
  const m = makeMachine();
  m.mem.write8(0x8028, 0x01);
  loc_2f2f(m);
  assertPathAGolden(m);
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ_A, "Path A step boundaries match the disassembly");
});

// ---- Path B: (0x8028)=0x10 -> `jr c` NOT taken -> clamp A to 4 ---------------------
const EXPECTED_PC_SEQ_B = [
  0x2f31, 0x2f34, 0x2f36, 0x2f39, 0x2f3b, 0x2f3e, 0x2f40, 0x2f43, 0x2f45, 0x2f48,
  0x2f4a, 0x2f4d, 0x2f4f, 0x2f52, 0x2f55, 0x2f57, 0x2f5a, 0x2f5c, 0x2f5f, 0x2f62,
  0x2f63, 0x2f65, 0x2f67, 0x2f69, // jr c NOT taken -> 0x2f67 (clamp) -> loc_2f69
  0x2f6b, 0x2f6e, 0x30de,
];

function assertPathBGolden(m) {
  assert.equal(m.tstates, 261, "Path B T-state total (jr c not taken -> clamp)");
  assertConstantBlock(m);
  assert.equal(m.mem.read8(0x80e4), 0x03, "(0x80e4) = 0x04 (clamped) ^ 0x07 = 0x03");
  assert.equal(m.regs.a, 0x03, "A = 0x03 at the tail-jump");
  // (carry was CLEAR at `cp 0x04`, driving the fall-through clamp; `xor` also
  //  clears C, so it is 0 here regardless -- the pcSeq via 0x2f67 is the witness.)
  assert.equal(m.regs.fC, false, "carry cleared (fall-through clamp + final `xor`)");
  assertTailJump(m);
}

test("loc_2f2f Path B: (0x8028)=0x10 -> jr c not taken, clamp -> (0x80e4)=0x03", () => {
  const m = makeMachine();
  m.mem.write8(0x8028, 0x10);
  loc_2f2f(m);
  assertPathBGolden(m);
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ_B, "Path B step boundaries match the disassembly");
});

// ---- MUTATION: the `jr c` NOT-taken step must be charged 7 T, not 12 T --------------
test("loc_2f2f MUTATION: `jr c` not-taken mis-charged 12T (not 7T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  // On Path B the not-taken step lands on 0x2f67; mis-charge it the taken cost (12 T).
  let mutated = false;
  m.step = (nextAddr, cycles) => {
    if (!mutated && nextAddr === 0x2f67) { mutated = true; return realStep(nextAddr, 12); }
    return realStep(nextAddr, cycles);
  };

  m.mem.write8(0x8028, 0x10);
  loc_2f2f(m);

  assert.equal(m.tstates, 266, "mutation adds exactly 5 T (7 -> 12)");
  assert.throws(
    () => assertPathBGolden(m),
    /Path B T-state total/,
    "the golden T-state assertion must fail on the mutant",
  );
});
