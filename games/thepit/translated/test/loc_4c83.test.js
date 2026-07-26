// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_4c83 (ROM 0x4c83-0x4c86, The Pit): a sound-request stub that
// loads the command index 0x0d into A and UNCONDITIONALLY tail-jumps into the shared
// enqueue handler loc_4ca5 (0x4ca5). loc_4ca5's own ret unwinds to loc_4c83's caller,
// so the tail is modelled `return m.call(0x4ca5)` with NO m.ret.
//
// There is no built Pit Machine yet, so the routine is driven against a minimal mock
// of the surface it touches: a real Regs (so `ld a` / `jr` truly touch no flags), a
// `step` that accumulates T-states + records the PC-boundary sequence, a `call` that
// captures the tail dispatch (target + A + the machine state at the jump) and hands
// back a sentinel, and a `ret` that MUST NOT run on this path (single unwind).
//
// Pinned against the disassembly:
//   * A = 0x0d seeded; exact 19 T total (ld a,n = 7, jr = 12); boundary sequence
//     [0x4c85, 0x4ca5]; control leaves via return m.call(0x4ca5) (no ret); the
//     caller's seeded flags survive (neither instruction writes F).
//
// TEETH: a faithful twin whose only break is the payload immediate `ld a,0x0d`
// swapped for `ld a,0x0c` (its neighbour loc_4c7f's value) -- the single byte that
// distinguishes this stub from its ~20 siblings -- must be CAUGHT (A and the arg
// into loc_4ca5 both diverge 0x0d -> 0x0c).
//
// Run: node --test games/thepit/translated/test/loc_4c83.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs, F_S, F_C, F_Z } from "../../../../core/cpu/z80.js";
import { loc_4c83 } from "../loc_4c83.js";

const RET = 0x1234; // sentinel return address; the ret path must NOT run here
const TAIL = 0x4ca5; // loc_4ca5, the unconditional tail-jump target
const SENTINEL = "RET_FROM_4ca5"; // stands in for loc_4ca5's return-through

function makeMachine({ f = 0x00 } = {}) {
  const regs = new Regs();
  regs.f = f & 0xff;

  const m = {
    regs,
    tstates: 0,
    pc: 0x4c83,
    pcSeq: [], // every step target, in order (stepcheck)
    returned: false,
    tail: null, // captured tail dispatch, if the jr is taken
    step(addr, cycles) {
      this.pc = addr;
      this.tstates += cycles;
      this.pcSeq.push(addr);
    },
    ret(cycles = 10) {
      // Should never fire on a pure tail-jump -- flag it if it does.
      this.pc = RET;
      this.tstates += cycles;
      this.returned = true;
    },
    call(addr) {
      // Unconditional tail-jump modelled as `return m.call(target)`: capture the
      // machine state at the instant control leaves loc_4c83, return a sentinel.
      this.tail = { addr, cyclesAtJump: this.tstates, a: regs.a & 0xff, f: regs.f & 0xff };
      return SENTINEL;
    },
  };
  return m;
}

// Instruction-boundary sequence, straight off the disassembly.
const EXPECTED_PC_SEQ = [0x4c85, 0x4ca5];

// Shared contract, run against both the real routine and the TEETH twin so the
// mutation is measured against the exact same assertions.
function checkContract(m, ret) {
  // Payload: A = the command index 0x0d.
  assert.equal(m.regs.a, 0x0d, "A = the sound-command index 0x0d");

  // Control flow: unconditional tail-jump into loc_4ca5, no ret (single unwind).
  assert.ok(m.tail, "must have tail-jumped");
  assert.equal(m.tail.addr, TAIL, "tail-jump target must be loc_4ca5 (0x4ca5)");
  assert.equal(m.tail.a, 0x0d, "A into loc_4ca5 = 0x0d");
  assert.equal(ret, SENTINEL, "loc_4c83 returns loc_4ca5's result straight through");
  assert.equal(m.returned, false, "no ret executed on the tail path (single unwind)");

  // Exact local T-state total: ld a,n (7) + jr (12) = 19.
  assert.equal(m.tail.cyclesAtJump, 19, "19 T up to and incl. the jr");
  assert.equal(m.tstates, 19, "total local T = 19");

  // stepcheck: every step target is a real instruction boundary, in order.
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ, "step targets match the disassembly boundaries");
}

test("loc_4c83: seeds A=0x0d and tail-jumps to loc_4ca5, 19 T, no ret", () => {
  const m = makeMachine();
  const ret = loc_4c83(m);
  checkContract(m, ret);
  console.log("  loc_4c83: A=0x0d, 19 T, [0x4c85, 0x4ca5], jr -> 0x4ca5 (tail)");
});

test("loc_4c83: ld a / jr touch no flags -- the caller's F survives unchanged", () => {
  const seedF = F_S | F_C | F_Z; // a distinctive seed that must reach the jump intact
  const m = makeMachine({ f: seedF });
  loc_4c83(m);
  assert.equal(m.regs.f, seedF, "F unchanged -- neither ld a,n nor jr writes flags");
  assert.equal(m.tail.f, seedF, "F into loc_4ca5 is exactly the caller's F");
});

// -- TEETH -------------------------------------------------------------------
// A faithful copy of loc_4c83 with EXACTLY ONE break: the payload immediate
// `ld a,0x0d` (3e 0d) swapped for `ld a,0x0c` (3e 0c) -- its neighbour loc_4c7f's
// value, and the ONLY byte that distinguishes this stub from its ~20 siblings.
// The contract rejects it: A and the arg into loc_4ca5 both flip 0x0d -> 0x0c.
function brokenLoc4c83(m) {
  const { regs } = m;
  regs.a = 0x0c; // BUG: ld a,0x0c instead of ld a,0x0d (neighbour loc_4c7f's index)
  m.step(0x4c85, 7);
  m.step(0x4ca5, 12);
  return m.call(0x4ca5);
}

test("TEETH: the ld a,0x0d -> ld a,0x0c twin is CAUGHT by the contract", () => {
  // The real routine passes the contract.
  {
    const m = makeMachine();
    checkContract(m, loc_4c83(m));
  }
  // The mutant fails it -- A (and the arg into loc_4ca5) diverge.
  const m = makeMachine();
  const ret = brokenLoc4c83(m);
  assert.throws(
    () => checkContract(m, ret),
    /0x0d/,
    "the contract FAILED to catch ld a,0x0d -> ld a,0x0c -- it has no teeth",
  );
  // Concretely: the wrong index reaches A and would enqueue the wrong sound.
  assert.equal(m.regs.a, 0x0c, "mutant: A = 0x0c (wrong sound-command index)");
  assert.equal(m.tail.a, 0x0c, "mutant: 0x0c would be enqueued, not 0x0d");
});
