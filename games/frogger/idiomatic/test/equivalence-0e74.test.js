// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0e74 — memory-equivalent to the frozen oracle at ROM 0x0E74.
 * GATE: crafted-entry. Attract never dispatches this attract-idle sequencer tail (probe: 0 dispatches
 * over ENTRY_FRAMES), so a post-boot attract machine is cloned and its game-mode cell (0x83D6) poked
 * to a non-5 value so the forced store is observable. Live-out is memory-only (A=5 is dead — the
 * caller loc_0066 issues sound cmd 0x2341 then xors A before any read), so registers/SP are not
 * compared. Teeth: three broken RAM twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_0e74 } from "../loc_0e74.js";
import { loc_0e74 as oracle } from "../../translated/loc_0e74.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const GAME_MODE = 0x83d6;
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

function entry(mode) {
  const m = seedMachine().clone();
  m.mem8[GAME_MODE] = mode;
  return m;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

const MODES = [3, 0, 0xff, 5]; // non-5 values (store observable) + the already-5 no-change case

function brokenNoOp() {}
function brokenWrongValue(m) { m.mem8[GAME_MODE] = 4; }
function brokenWrongAddr(m) { m.mem8[GAME_MODE + 1] = 5; }

test("EQUAL (crafted): loc_0e74 == oracle on every mode value", { skip }, () => {
  const entries = MODES.map(entry);
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (const e of entries) assert.equal(ramDiff(loc_0e74, e), null, "a crafted entry diverged");
  assert.ok(ramDiff(brokenNoOp, entry(3)), "vacuous: oracle wrote nothing");
  console.log(`  EQUAL: ${entries.length} crafted mode values, loc_0e74 == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = entry(3); // non-5 start so a wrong or missing store shows
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongValue, e), "the wrong-value twin escaped");
  assert.ok(ramDiff(brokenWrongAddr, e), "the wrong-address twin escaped");
  console.log("  TEETH: no-op, wrong-value, wrong-address all caught");
});
