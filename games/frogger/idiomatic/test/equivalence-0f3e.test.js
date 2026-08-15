// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickAttractCellFrameClock — memory-equivalent to the frozen oracle at ROM 0x0F3E.
 * GATE: crafted-entry. This is a stack-manipulating routine with two exits, so the gate compares the
 * full observable contract — RAM, the boolean return, SP, and the returned PC (which slot the ret
 * landed on) — plus the register live-out (the tile in A and the restored pointer in HL) on the
 * normal exit only, where the caller consumes them. Attract enters the routine every frame but the
 * captured dispatch state does not span both timer phases, so the two paths are reached by crafting
 * a post-attract clone with a controlled call frame (a saved-pointer slot the routine pushes itself,
 * a synthetic arm return below it, and — for the skip-out — a synthetic caller-of-caller return
 * below that) and poking the tick timer and frame cursor.
 *
 * The not-elapsed exit is a double caller-skip: it drops its own saved pointer AND the arm's return
 * and rets to the arm's caller, moving SP by two return slots net. The dispatch seam only seats a
 * rewrite that leaves SP put or moves it by one slot, so this routine cannot be wired as a live
 * override; the seam test at the end asserts that directly, which is why the module is recorded
 * UNWIRED and the frozen oracle serves the in-game call. Teeth: six broken twins, each positive-
 * controlled (the real module passes the same entry).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { tickAttractCellFrameClock } from "../tickAttractCellFrameClock.js";
import { loc_0f3e as oracle } from "../../translated/loc_0f3e.js";
import { withOmittedRet } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { u8 } from "../../../../core/int.js";

const FRAME_TIMER = 0x83bd;
const FRAME_INDEX = 0x83be;
const TILE_TABLE = 0x2e1b;

// A controlled call frame: an empty-stack top, a synthetic arm return the normal exit rets to, and a
// synthetic caller-of-caller return the skip-out rets to. Distinct so a dropped pop lands a wrong PC.
const STACK_TOP = 0x8800;
const ARM_RET = 0x0f01;
const CALLER_RET = 0x012e;
const CELL_PTR = 0x8040;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let seed = null;
function seedMachine() {
  if (seed) return seed;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the seed run stopped early: ${m.stoppedBy}`);
  seed = m.clone();
  return seed;
}

// path "skip" pushes the caller-of-caller return the double-skip needs; both paths push the arm
// return the normal exit needs. The saved-pointer slot is pushed by the routine itself.
function entry({ path, timer, index }) {
  const e = seedMachine().clone();
  e.regs.sp = STACK_TOP;
  if (path === "skip") e.push16(CALLER_RET);
  e.push16(ARM_RET);
  e.regs.hl = CELL_PTR;
  e.mem8[FRAME_TIMER] = timer;
  if (index !== undefined) e.mem8[FRAME_INDEX] = index;
  return e;
}

// Run oracle and candidate on independent clones of one entry; return the list of contract
// divergences. `regLive` compares the register live-out (A, HL), which the caller reads only on the
// normal exit; on the skip-out those registers are dead and are not part of the contract.
function contractDiffs(e, fn, regLive) {
  const a = e.clone();
  const b = e.clone();
  const ra = oracle(a);
  const rb = fn(b);
  const out = [];
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  if (ram) out.push(`RAM 0x${(ram.addr ?? 0).toString(16)}: ${ram.a} vs ${ram.b}`);
  if (ra !== rb) out.push(`ret: ${ra} vs ${rb}`);
  if (a.regs.sp !== b.regs.sp) out.push(`SP: 0x${a.regs.sp.toString(16)} vs 0x${b.regs.sp.toString(16)}`);
  if (a.pc !== b.pc) out.push(`PC: 0x${a.pc.toString(16)} vs 0x${b.pc.toString(16)}`);
  if (regLive) {
    if (a.regs.a !== b.regs.a) out.push(`A: ${a.regs.a} vs ${b.regs.a}`);
    if (a.regs.hl !== b.regs.hl) out.push(`HL: 0x${a.regs.hl.toString(16)} vs 0x${b.regs.hl.toString(16)}`);
  }
  return out;
}

// Broken twins: one faithful reimplementation with a single knobbed defect each.
function broken(bug) {
  return (m) => {
    const { regs, mem8 } = m;
    m.push16(regs.hl);
    const timer = u8(mem8[FRAME_TIMER] - 1);
    mem8[FRAME_TIMER] = timer;
    if (timer !== 0) {
      m.pop16();
      if (bug !== "missingPop") m.pop16(); // missingPop under-pops the double caller-skip
      m.ret();
      return bug === "wrongReturn"; // wrongReturn reports true where the skip-out owes false
    }
    mem8[FRAME_TIMER] = bug === "wrongTimerReload" ? 7 : 8;
    let index = bug === "offByOneIndex" ? mem8[FRAME_INDEX] : u8(mem8[FRAME_INDEX] - 1);
    if (index === 0) index = bug === "wrongWrapReload" ? 3 : 4;
    mem8[FRAME_INDEX] = index;
    const base = bug === "wrongTileBase" ? TILE_TABLE + 1 : TILE_TABLE;
    regs.a = mem8[(base & 0xff00) | u8((base & 0xff) + index)];
    regs.hl = m.pop16();
    m.ret();
    return true;
  };
}
const brokenNoOp = () => undefined;

test("CONTRACT: the crafted frame reproduces both of the oracle's exits", { skip }, () => {
  const s = entry({ path: "skip", timer: 3 });
  const os = s.clone();
  assert.equal(oracle(os), false, "not-elapsed returns false");
  assert.equal(os.pc, CALLER_RET, "skip-out rets past the arm, to the arm's caller");
  assert.equal(os.regs.sp, STACK_TOP, "both extra returns popped, SP balanced");
  assert.equal(os.mem8[FRAME_TIMER], 2, "timer decremented");

  const n = entry({ path: "normal", timer: 1, index: 4 });
  const on = n.clone();
  assert.equal(oracle(on), true, "elapsed returns true");
  assert.equal(on.pc, ARM_RET, "normal exit rets to the arm");
  assert.equal(on.regs.sp, STACK_TOP, "saved pointer and arm return popped, SP balanced");
  assert.equal(on.mem8[FRAME_TIMER], 8, "timer reloaded");
  assert.equal(on.mem8[FRAME_INDEX], 3, "frame cursor stepped down");
  assert.equal(on.regs.hl, CELL_PTR, "cell pointer restored");
});

test("EQUAL: skip-out entries — cand == oracle (returns false, double-skip)", { skip }, () => {
  const entries = [entry({ path: "skip", timer: 3 }), entry({ path: "skip", timer: 2 })];
  for (const e of entries) {
    const d = contractDiffs(e, tickAttractCellFrameClock, false);
    assert.deepEqual(d, [], `skip-out diverged: ${d.join("; ")}`);
  }
  console.log(`  EQUAL: ${entries.length} skip-out entries, cand == oracle`);
});

test("EQUAL: normal entries incl. the cursor wrap — cand == oracle (returns the tile)", { skip }, () => {
  const entries = [
    entry({ path: "normal", timer: 1, index: 4 }), // steps 4 -> 3
    entry({ path: "normal", timer: 1, index: 2 }), // steps 2 -> 1
    entry({ path: "normal", timer: 1, index: 1 }), // steps 1 -> 0 -> wrap to 4
  ];
  for (const e of entries) {
    const d = contractDiffs(e, tickAttractCellFrameClock, true);
    assert.deepEqual(d, [], `normal path diverged: ${d.join("; ")}`);
  }
  // vacuity: the oracle really writes on this path, so an empty diff means agreement, not inaction.
  assert.ok(
    contractDiffs(entry({ path: "normal", timer: 1, index: 4 }), brokenNoOp, true).length > 0,
    "vacuous: a no-op twin was not caught on the normal path",
  );
  console.log(`  EQUAL: ${entries.length} normal entries (incl. wrap), cand == oracle`);
});

test("TEETH: six broken twins caught, each positive-controlled", { skip }, () => {
  // [bug, entry, compares-register-live-out]
  const cases = [
    ["wrongTimerReload", entry({ path: "normal", timer: 1, index: 4 }), true],
    ["wrongWrapReload", entry({ path: "normal", timer: 1, index: 1 }), true],
    ["wrongTileBase", entry({ path: "normal", timer: 1, index: 4 }), true],
    ["offByOneIndex", entry({ path: "normal", timer: 1, index: 4 }), true],
    ["missingPop", entry({ path: "skip", timer: 3 }), false],
    ["wrongReturn", entry({ path: "skip", timer: 3 }), false],
  ];
  const bit = [];
  for (const [bug, e, regLive] of cases) {
    const real = contractDiffs(e, tickAttractCellFrameClock, regLive);
    assert.deepEqual(real, [], `positive control failed: real module diverged on the ${bug} entry: ${real.join("; ")}`);
    const mut = contractDiffs(e, broken(bug), regLive);
    assert.ok(mut.length > 0, `the ${bug} twin escaped`);
    bit.push(`${bug} [${mut.join(", ")}]`);
  }
  console.log(`  TEETH: ${bit.join("  |  ")}`);
});

test("SEAM: the double caller-skip cannot be seated as a live override (why it is UNWIRED)", { skip }, () => {
  const wrapped = withOmittedRet(tickAttractCellFrameClock, 0x0f3e);
  // Normal exit moves SP by one return slot with PC on the arm return — the seam seats it.
  const n = entry({ path: "normal", timer: 1, index: 4 });
  assert.equal(wrapped(n), true, "the seam seats the normal exit");
  // Skip-out moves SP by two return slots — outside the seam's 0/+2 window — so it throws by design.
  const s = entry({ path: "skip", timer: 3 });
  assert.throws(() => wrapped(s), /moved SP by 4/, "the seam must refuse the double caller-skip");
  console.log("  SEAM: normal exit seats; skip-out refused (SP+4) -> module stays UNWIRED, oracle serves the call");
});
