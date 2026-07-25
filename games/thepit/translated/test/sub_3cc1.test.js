// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated sub_3cc1 (ROM 0x3cc1-0x3d48), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs. sub_3cc1 is a
// straight-line "panel layout" script: it stages the helper parameter cells
// (0x8055/0x8057/0x8058/0x8059) + IX and drives the shared draw helpers, then
// TAIL-jumps into 0x47a1. Every callee (0x46f4, 0x472c, 0x3dae, 0x3dc9, 0x3dea,
// 0x3e01, 0x3ddb, 0x3e1d, 0x4785, and the tail target 0x47a1) is stubbed as a
// trivial "pop-and-return" that balances the stack and adds no cycles, so the
// asserted T-state total is sub_3cc1's OWN instruction cost (612 T).
//
// The mutation is a CYCLE-ONLY break (the DD-prefixed `ld ix,0x497b` charged 10 T
// as if it were a plain `ld rr,nn`, dropping the +4 prefix cost). It moves NO
// memory and touches no register the callees don't, so every state/register
// assertion stays green -- ONLY the T-state total (4 T short) catches it. That is
// the whole point of charging cycles (docs/03-translation.md): a timing error
// invisible to the state diff.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { sub_3cc1 } from "../sub_3cc1.js";

const SENTINEL = 0xbeef; // caller return address the tail-jump's callee `ret` lands on
const SP0 = 0x8780; // initial SP (inside work RAM so pushes are mapped)

// -- T-state accounting (own instruction cost; stubbed callees add 0) ---------
//   16 call (17) + 15 ld-imm8 (7) + 13 ld(nn),a (13) + 4 ld ix,nn (14) + 1 jp (10)
const CALLS = 16;
const LD_IMM8 = 15; // 14 `ld a,nn` + 1 `ld c,nn`
const LD_NN_A = 13;
const LD_IX = 4;
const EXP_CYCLES = CALLS * 17 + LD_IMM8 * 7 + LD_NN_A * 13 + LD_IX * 14 + 10; // 612

// The exact call sequence, in execution order (16 CALLs + the final tail JP).
const EXP_CALLS = [
  0x46f4, 0x472c, 0x3dae, 0x3dc9, 0x3dea, 0x3e01, 0x3dae, 0x3dc9,
  0x3dea, 0x3ddb, 0x3e01, 0x3dae, 0x3dc9, 0x3dea, 0x3e1d, 0x4785, 0x47a1,
];

// -- minimal machine: real mem/io/regs + the step/call/push/pop seam ----------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x3cc1;
    this.calls = [];
    this.regs.sp = SP0;
  }
  step(nextAddr, t) {
    this.pc = nextAddr;
    this.cycles += t;
  }
  push16(v) {
    this.regs.sp = (this.regs.sp - 2) & 0xffff;
    this.mem.write8(this.regs.sp, v & 0xff);
    this.mem.write8((this.regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
  }
  pop16() {
    const lo = this.mem.read8(this.regs.sp);
    const hi = this.mem.read8((this.regs.sp + 1) & 0xffff);
    this.regs.sp = (this.regs.sp + 2) & 0xffff;
    return lo | (hi << 8);
  }
  // Stubbed callee: record it, then behave as a bare `ret` (pop the address the
  // CALL/JP left on the stack). No cycle charge -- the callee's cost is not ours.
  call(addr) {
    this.calls.push(addr);
    this.pc = this.pop16();
    return undefined;
  }
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
}

function run(MachineClass) {
  const rom = new Uint8Array(0x5000); // AddressSpace requires exactly 20480 bytes
  const m = new MachineClass(rom);
  m.push16(SENTINEL); // the caller's return address (consumed by the tail-jump's ret)
  sub_3cc1(m);
  return {
    cycles: m.cycles,
    ram: m.mem.workRam.slice(),
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    a: m.regs.a,
    c: m.regs.c,
    ix: m.regs.ix,
  };
}

// Full spec, factored so the mutant runs through the identical checks.
function checkSpec(res) {
  assert.equal(res.cycles, EXP_CYCLES, "T-state total");
  // Final parameter-cell values: 0x8058/0x8059 rewritten 3x, 0x8057 2x, 0x8055 5x.
  assert.equal(res.ram[0x0055], 0x0f, "(0x8055) = last length/index written");
  assert.equal(res.ram[0x0057], 0xa5, "(0x8057) = last tile/char code written");
  assert.equal(res.ram[0x0058], 0x0d, "(0x8058) = last row written");
  assert.equal(res.ram[0x0059], 0x09, "(0x8059) = last col written");
  assert.deepEqual(res.calls, EXP_CALLS, "call sequence (16 CALL + tail JP)");
  assert.equal(res.pc, SENTINEL, "tail-jump callee ret lands on OUR caller");
  assert.equal(res.sp, SP0, "stack balanced");
  assert.equal(res.a, 0x0d, "A = last `ld a,nn` (0x0d), callees don't touch it here");
  assert.equal(res.c, 0xa3, "C = 0xa3 from `ld c,0xa3`");
  assert.equal(res.ix, 0x49f7, "IX = last `ld ix,nn` (0x49f7)");
}

test("sub_3cc1: stages helper cells, drives draws, tail-jumps 0x47a1; 612 T", () => {
  checkSpec(run(TestMachine));
});

// -- MUTATION: charge the DD-prefixed `ld ix,0x497b` (at 0x3ce1, whose step
// advances PC to 0x3ce5) 10 T instead of 14 -- the classic "forgot the DD prefix
// adds 4 T" slip. Injected at the machine seam so the REAL sub_3cc1 runs: the
// observable effect is identical to editing that one `m.step(0x3ce5, 14)` to
// `m.step(0x3ce5, 10)` in the source. It moves NO memory (the RAM/register diffs
// stay byte-identical), so ONLY the 4-T-short total exposes it. 0x3ce5 is the PC
// after exactly one instruction, so the short fires exactly once.
class MutantMachine extends TestMachine {
  step(nextAddr, t) {
    if (nextAddr === 0x3ce5 && !this._shorted) {
      this._shorted = true;
      t = 10; // BUG: ld ix,nn is 14 T (DD prefix), not 10
    }
    super.step(nextAddr, t);
  }
}

test("mutation (ld ix,nn mischarged 10 T) is caught by the cycle assertion", () => {
  const bad = run(MutantMachine);
  const good = run(TestMachine);
  // Memory + the observed registers are byte-identical -- a state-only diff MISSES this.
  assert.deepEqual(bad.ram, good.ram, "work RAM identical to the correct run");
  assert.deepEqual(bad.calls, good.calls, "call sequence identical to the correct run");
  assert.equal(bad.pc, SENTINEL, "control flow unchanged");
  // Exactly 4 T short of the true total.
  assert.equal(bad.cycles, EXP_CYCLES - 4, "mutant is exactly 4 T short");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => checkSpec(bad));
});
