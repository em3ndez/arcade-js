// SPDX-License-Identifier: GPL-3.0-only
/**
 * nextSpawnRandomByte — memory + A equivalent to the frozen oracle at ROM 0x0AEE.
 * GATE: crafted-entry. Attract never dispatches this ring-XOR step (probe: 0 dispatches over
 * ENTRY_FRAMES), so a post-boot attract machine is cloned, its cursor cell (0x8400) and ring
 * elements poked to a known pattern (a valid entry: this leaf reads the whole ring out of its own
 * RAM). LIVE-OUT is memory + register A: both callers (the IX sprite arms) consume A after each
 * call as a spawn RNG; HL/DE are saved and restored by the routine, so they are not compared. The
 * oracle's balanced push/pop of HL and DE leaves dead scratch in [SP-8, SP) that the register-free
 * rewrite never writes, so that stack window is excluded from the RAM diff. Teeth: three broken
 * twins across memory, the fold, and the register arm.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { nextSpawnRandomByte } from "../nextSpawnRandomByte.js";
import { loc_0aee as oracle } from "../../translated/loc_0aee.js";

const RING_BASE = 0x8400;
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

// A post-boot machine with the cursor seeded and the ring elements set to a distinct pattern so the
// XOR result is non-trivial and observable.
function craft(cursorSeed) {
  const m = seedMachine().clone();
  m.mem8[RING_BASE] = cursorSeed;
  for (let i = 1; i < 32; i++) m.mem8[RING_BASE + i] = (i * 7 + 3) & 0xff;
  return m;
}

// null == equivalent on the declared live-out: RAM (minus the dead [SP-8,SP) stack scratch from the
// oracle's push/pop of HL and DE) plus register A.
function unitDiff(cand, machine) {
  const sp0 = machine.regs.sp;
  const lo = (sp0 - 8) & 0xffff, hi = sp0;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const da = a.dumpState(), db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= lo && addr < hi) continue; // dead stack scratch
    return `RAM 0x${addr.toString(16)}: ${da[i]} vs ${db[i]}`;
  }
  if (a.regs.a !== b.regs.a) return `A ${a.regs.a} vs ${b.regs.a}`;
  return null;
}

// [name, cursor seed] — normal step, the 0->0x1F wrap, and the +0x0D fold-back.
const CASES = [
  ["normal step", 5],
  ["wrap 0 -> 0x1F", 1],
  ["fold back", 0x14],
  ["cursor to 2", 3],
  ["cursor to 0x1F", 0x20],
];

// broken twins.
function brokenNoOp() {}
function brokenWrongA(m) { nextSpawnRandomByte(m); m.regs.a = (m.regs.a + 1) & 0xff; } // correct RAM, wrong A
function brokenNoFold(m) {
  const { regs, mem8 } = m;
  let cursor = (mem8[RING_BASE] - 1) & 0xff;
  if (cursor === 0) cursor = 31;
  mem8[RING_BASE] = cursor;
  const j = (cursor + 13) & 0xff; // BUG: never folds j back under the ring size
  const v = mem8[(RING_BASE + cursor) & 0xffff] ^ mem8[(RING_BASE + j) & 0xffff];
  mem8[(RING_BASE + j) & 0xffff] = v;
  regs.a = v;
}

test("EQUAL (crafted): nextSpawnRandomByte == oracle on RAM + A for every ring path", { skip }, () => {
  assert.ok(CASES.length > 0, "vacuous: no crafted entries");
  for (const [name, cs] of CASES) {
    assert.equal(unitDiff(nextSpawnRandomByte, craft(cs)), null, `diverged: ${name}`);
  }
  assert.ok(unitDiff(brokenNoOp, craft(5)), "vacuous: oracle changed nothing");
  console.log(`  EQUAL: ${CASES.length} crafted ring paths, nextSpawnRandomByte == oracle (RAM + A)`);
});

test("TEETH: broken twins are caught across memory, fold, and the A arm", { skip }, () => {
  assert.ok(unitDiff(brokenNoOp, craft(5)), "the no-op twin escaped");
  assert.ok(unitDiff(brokenWrongA, craft(5)), "the wrong-A twin escaped");
  assert.ok(unitDiff(brokenNoFold, craft(0x14)), "the no-fold twin escaped"); // fold path only
  console.log("  TEETH: no-op, wrong-A, no-fold all caught");
});
