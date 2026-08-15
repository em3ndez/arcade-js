// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_287e — memory-equivalent to the frozen oracle at ROM 0x287E.
 * GATE: crafted-entry. Attract NEVER dispatches this arm (probe: 0 dispatches over ENTRY_FRAMES; it
 * runs only in the in-play diver cluster), so a post-boot attract clone gets its busy latch (0x814f)
 * and nibble source (0x819b) poked for each path: the busy no-op, and the active seed across nibble
 * values (0x0a, the 0x0f max, and the 0 seed). The two seeded cells are pre-dirtied so the writes are
 * observable. The routine reads all inputs from memory (no register live-in) and the sole caller
 * tail-jumps and reloads, so LIVE-OUT is memory-only: RAM is compared, registers/SP are not.
 * The oracle's internal call convention writes a return address to the [SP-8, SP) stack scratch that
 * the idiomatic plain-JS helper does not, so that dead window is masked. Teeth: four broken twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_287e } from "../loc_287e.js";
import { loc_287e as oracle } from "../../translated/loc_287e.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const BUSY = 0x814f; // busy latch; non-zero => the arm is a no-op
const NIBBLE_SRC = 0x819b; // low nibble * 8 seeds the two cells
const GATE = 0x8150;
const CELL_A = 0x8146, CELL_B = 0x8147;
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

// A post-boot clone with the busy latch and nibble source poked; the seeded cells pre-dirtied.
function craft({ busy, rng }) {
  const e = seedMachine().clone();
  e.mem8[BUSY] = busy;
  e.mem8[NIBBLE_SRC] = rng;
  e.mem8[GATE] = 0;
  e.mem8[CELL_A] = 0xee;
  e.mem8[CELL_B] = 0xee;
  return e;
}

// zero the [SP-8, SP) dead stack scratch so the oracle's internal return-address push does not diverge.
function maskDeadStack(mm, sp) {
  for (let i = 1; i <= 8; i++) mm.mem8[(sp - i) & 0xffff] = 0;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM (dead stack window masked), not registers/SP.
function ramDiff(cand, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  maskDeadStack(a, sp); maskDeadStack(b, sp);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

const PATHS = [
  ["busy -> no-op", { busy: 3, rng: 0x0a }],
  ["active nibble 0x0a", { busy: 0, rng: 0x0a }],
  ["active nibble 0x0f (max)", { busy: 0, rng: 0xff }],
  ["active nibble 0 (zero seed)", { busy: 0, rng: 0x10 }],
];

// broken twins.
function brokenNoOp() {}
function brokenWrongSeed(m) { // BUG: seed off by one
  const { mem8 } = m;
  if (mem8[BUSY] !== 0) return;
  mem8[GATE] = 1;
  const s = ((mem8[NIBBLE_SRC] & 0x0f) * 8 + 1) & 0xff;
  mem8[CELL_A] = s; mem8[CELL_B] = s; mem8[BUSY] = 1;
}
function brokenSkipSeed(m) { // BUG: sets the gate but skips the seed helper
  const { mem8 } = m;
  if (mem8[BUSY] !== 0) return;
  mem8[GATE] = 1;
}
function brokenNoGuard(m) { // BUG: ignores the busy guard, always seeds
  const { mem8 } = m;
  mem8[GATE] = 1;
  const s = (mem8[NIBBLE_SRC] & 0x0f) * 8;
  mem8[CELL_A] = s; mem8[CELL_B] = s; mem8[BUSY] = 1;
}

test("EQUAL (crafted): loc_287e == oracle on every path", { skip }, () => {
  const entries = PATHS.map(([, cfg]) => craft(cfg));
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (let i = 0; i < entries.length; i++) assert.equal(ramDiff(loc_287e, entries[i]), null, `diverged: ${PATHS[i][0]}`);
  assert.ok(ramDiff(brokenNoOp, craft(PATHS[1][1])), "vacuous: oracle wrote nothing on the active path");
  console.log(`  EQUAL: ${entries.length} crafted paths, loc_287e == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const active = craft(PATHS[1][1]);
  const busy = craft(PATHS[0][1]);
  assert.ok(ramDiff(brokenNoOp, active), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongSeed, active), "the wrong-seed twin escaped");
  assert.ok(ramDiff(brokenSkipSeed, active), "the skip-seed twin escaped");
  assert.ok(ramDiff(brokenNoGuard, busy), "the no-guard twin escaped on the busy entry");
  console.log("  TEETH: no-op, wrong-seed, skip-seed, no-guard all caught");
});
