// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for entry_0000 (The Pit reset vector, ROM 0x0000):
//
//   0000  c3 a4 01     jp   0x01a4
//
// A single unconditional `jp nn`. The disassembly-derived contract is:
//   - exactly ONE instruction, charging exactly 10 T-states (jp nn = 10T);
//   - PC advances to the jump target 0x01A4;
//   - control transfers there via m.call(0x01A4) — the tail-jump seam — and
//     the target's result propagates back as entry_0000's return value;
//   - a plain JP pushes no return address and performs NO ret of its own
//     (the routine touches zero registers/flags/memory);
//
// The Pit has no Machine/routines.js yet (this is the first translated routine),
// so the test drives the routine against a minimal recording double for `m`
// rather than a real Machine. That is sufficient to pin the control-flow and
// timing facts this routine has.
//
// The MUTATION block below proves the contract has teeth: three deliberate
// breaks — wrong jump target, wrong T-state cost, and the unfaithful
// call+ret shape (a spurious extra ret) — are each caught by the contract.

import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { entry_0000 } from "../entry_0000.js";

// A recording stand-in for the Machine: captures every step/call/ret so the
// contract can be asserted against the exact effects the routine produced.
function recordRun(fn) {
  const regs = new Regs();
  const rec = {
    cycles: 0,
    pc: 0x0000,
    steps: [],
    calls: [],
    rets: 0,
    ret: undefined,
    regs,
    // snapshot of the register file BEFORE the routine runs
    afBefore: regs.af,
    bcBefore: regs.bc,
    deBefore: regs.de,
    hlBefore: regs.hl,
    spBefore: regs.sp,
  };
  const m = {
    regs,
    step(addr, t) {
      rec.pc = addr;
      rec.cycles += t;
      rec.steps.push({ addr, t });
    },
    call(addr) {
      rec.calls.push(addr);
      return "TARGET_RESULT"; // sentinel so we can see it propagate out
    },
    ret(t = 10) {
      rec.rets += 1;
      rec.cycles += t;
      rec.pc = null;
    },
  };
  rec.ret = fn(m);
  return rec;
}

// The disassembly-derived contract, asserted against a recorded run.
function checkContract(rec) {
  // jp nn is 10 T-states, and it is the ONLY instruction in the routine.
  assert.equal(rec.cycles, 10, "entry_0000 must charge exactly 10 T-states (jp nn)");
  assert.equal(rec.steps.length, 1, "exactly one instruction executes");
  assert.deepEqual(
    rec.steps[0],
    { addr: 0x01a4, t: 10 },
    "the jp advances PC to 0x01a4 and charges 10T",
  );
  assert.equal(rec.pc, 0x01a4, "PC lands on the jump target 0x01a4");

  // Tail-jump into the boot entry: control transfers via m.call(0x01a4)...
  assert.deepEqual(rec.calls, [0x01a4], "tail-jumps into the routine at 0x01a4");
  assert.equal(rec.ret, "TARGET_RESULT", "returns the target routine's result");

  // ...and a plain JP pushes no return address and performs no ret of its own.
  // (The unfaithful `m.call(); m.ret()` shape would trip this.)
  assert.equal(rec.rets, 0, "a JP performs no ret (it pushes nothing)");

  // A jp touches no registers or flags: the register file is untouched.
  assert.equal(rec.regs.af, rec.afBefore, "jp leaves AF/flags unchanged");
  assert.equal(rec.regs.bc, rec.bcBefore, "jp leaves BC unchanged");
  assert.equal(rec.regs.de, rec.deBefore, "jp leaves DE unchanged");
  assert.equal(rec.regs.hl, rec.hlBefore, "jp leaves HL unchanged");
  assert.equal(rec.regs.sp, rec.spBefore, "jp does not move SP (no push)");
}

test("entry_0000 matches the disassembly contract", () => {
  checkContract(recordRun(entry_0000));
});

test("the contract catches deliberate mutations", () => {
  // M1 — wrong jump target (off-by-one in the disassembled address).
  const wrongTarget = (m) => {
    m.step(0x01a5, 10);
    return m.call(0x01a5);
  };
  assert.throws(() => checkContract(recordRun(wrongTarget)), /0x01a4|jp/i);

  // M2 — wrong T-state cost (jp nn charged as 4 instead of 10).
  const wrongCycles = (m) => {
    m.step(0x01a4, 4);
    return m.call(0x01a4);
  };
  assert.throws(() => checkContract(recordRun(wrongCycles)), /10 T-states/);

  // M3 — the unfaithful call+ret shape: a spurious extra ret a plain JP
  // never performs (and would corrupt the diffed stack on real hardware).
  const extraRet = (m) => {
    m.step(0x01a4, 10);
    m.call(0x01a4);
    m.ret();
  };
  assert.throws(() => checkContract(recordRun(extraRet)));
});
