// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_2fd9 (ROM 0x2fd9, The Pit) -- stores A to
 * (0x80dc), then TAIL-JUMPS to loc_2fe3.
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags,
 * a flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine) so the
 * routine runs in isolation without a ROM image. The only exit is an unconditional
 * `jr 0x2fe3`, modelled as `m.step(0x2fe3,12); return m.call(0x2fe3)`; the mock's
 * `call` records the target and does NOT execute it, so the final PC is 0x2fe3 and
 * m.calls == [0x2fe3] proves the tail-jump fired (and that it is not a `ret`).
 * `pcSeq` records every step boundary for a deterministic stepcheck.
 *
 * It pins, against the disassembly:
 *   - the T-state total: 13 (ld (nn),a) + 12 (jr unconditional) = 25 T;
 *   - the memory effect: whatever byte is in A lands verbatim at (0x80dc);
 *   - A is left unchanged (a store reads A, never writes it);
 *   - the control flow: exactly one m.call, to 0x2fe3, and NO ret (the caller's
 *     return address seated on the stack is left untouched);
 *   - the step boundaries: [0x2fdc, 0x2fe3].
 * Two representative A values (0x38 and 0x39, the toggler's two states) confirm
 * the store copies A byte-for-byte rather than any hardcoded constant.
 *
 * TEETH (required mutation): mis-charge the `jr 0x2fe3` step as 10 T (the `jp nn`
 * cost) instead of 12 T (the `jr e` cost) -- a plausible "jump is a jump" copy
 * error from a sibling routine that tail-jumps via `jp`. The golden T-state
 * assertion MUST catch it.
 *
 * Run: node --test games/thepit/translated/test/loc_2fd9.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2fd9 } from "../loc_2fd9.js";

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
    pc: 0x2fd9,
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
  // Seat a caller return address on the stack. loc_2fd9 has no ret, so it must
  // stay put -- a stray pop (a wrongly-modelled tail-jump) would disturb SP.
  regs.sp = 0x8700;
  m.push16(CALLER_RET);
  return m;
}

const EXPECTED_PC_SEQ = [0x2fdc, 0x2fe3];

function assertGolden(m, aValue) {
  assert.equal(m.tstates, 25, "T-state total (13 store + 12 jr)");
  assert.equal(m.mem.read8(0x80dc), aValue, `(0x80dc) = A = 0x${aValue.toString(16)}`);
  assert.equal(m.regs.a, aValue, "A is unchanged by the store");
  assert.equal(m.pc, 0x2fe3, "ends at loc_2fe3 (tail-jump target set by the last step)");
  assert.deepEqual(m.calls, [0x2fe3], "tail-jumped via m.call(0x2fe3) -- not a ret");
  // No ret: the caller's return address is still on the stack, SP undisturbed.
  assert.equal(m.regs.sp, 0x86fe, "SP unchanged (no ret popped the caller frame)");
  assert.equal(m.mem.read16(0x86fe), CALLER_RET, "caller return address left intact");
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ, "step boundaries match the disassembly");
}

test("loc_2fd9: A=0x38 -> (0x80dc)=0x38, tail-jump loc_2fe3", () => {
  const m = makeMachine();
  m.regs.a = 0x38;
  loc_2fd9(m);
  assertGolden(m, 0x38);
});

test("loc_2fd9: A=0x39 -> (0x80dc)=0x39, tail-jump loc_2fe3 (store copies A, not a constant)", () => {
  const m = makeMachine();
  m.regs.a = 0x39;
  loc_2fd9(m);
  assertGolden(m, 0x39);
});

// ---- MUTATION: the `jr 0x2fe3` step must be charged 12 T, not the `jp nn` 10 T ----
test("loc_2fd9 MUTATION: `jr` mis-charged 10T (the jp cost) instead of 12T is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  // The jr step lands on 0x2fe3; mis-charge it the `jp nn` cost (10 T) not `jr` (12 T).
  let mutated = false;
  m.step = (nextAddr, cycles) => {
    if (!mutated && nextAddr === 0x2fe3) { mutated = true; return realStep(nextAddr, 10); }
    return realStep(nextAddr, cycles);
  };

  m.regs.a = 0x38;
  loc_2fd9(m);

  assert.equal(m.tstates, 23, "mutation removes exactly 2 T (12 -> 10)");
  assert.throws(
    () => assertGolden(m, 0x38),
    /T-state total/,
    "the golden T-state assertion must fail on the mutant",
  );
});
