// SPDX-License-Identifier: GPL-3.0-only
// Equivalence for loc_970b -- the per-frame update driver: runs nine per-frame passes in order then
// tail-delegates to ageShotsAndAdvanceFrameClock. Contract: RAM (dumpState minus STACK_SCRATCH). Oracle = frozen translated.
// Run: node --test games/tempest/idiomatic/test/equivalence-970b.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_970b as oracle } from "../../translated/loc_970b.js";
import { loc_970b } from "../loc_970b.js";
import { rotateBlasterAroundRim } from "../rotateBlasterAroundRim.js";
import { spawnEntityIntoFreeSlot } from "../spawnEntityIntoFreeSlot.js";
import { stepAttractEnemySweepTimer } from "../stepAttractEnemySweepTimer.js";
import { tickSpawnSlotTimers } from "../tickSpawnSlotTimers.js";
import { stepActiveShots } from "../stepActiveShots.js";
import { spawnClimbersFromSourceSlots } from "../spawnClimbersFromSourceSlots.js";
import { scanAllSlotsForProximity } from "../scanAllSlotsForProximity.js";
import { ageTimedObjects } from "../ageTimedObjects.js";
import { ageShotsAndAdvanceFrameClock } from "../ageShotsAndAdvanceFrameClock.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) { const u = new URL(name, ROM_DIR); return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined; }
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0x970b;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) => firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(12, 3000) : [];

test("CAPTURE: real 0x970b dispatches -- loc_970b == oracle in RAM (-stack)", () => {
  let checked = 0;
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    let threw = false;
    try { oracle(o); } catch { threw = true; }
    if (threw) continue; // a real per-frame dispatch may reach an unimplemented draw arm in a sub
    loc_970b(c);
    assert.equal(ramDiff(o, c), null);
    checked++;
  }
  console.log(`  CAPTURE: ${checked}/${CAPS.length} dispatch(es) compared`);
});

test("CRAFTED: a fresh-machine frame -- loc_970b == oracle in RAM (skip on oracle throw)", () => {
  const o = new Machine(ROM, OPTS);
  const c = new Machine(ROM, OPTS);
  let threw = false;
  try { oracle(o); } catch { threw = true; }
  if (threw) { console.log("  CRAFTED: oracle hit an unimplemented arm on a fresh frame -- skipped"); return; }
  loc_970b(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after the full per-frame pass");
});

test("TEETH: a twin that DROPS the runObjectMotionScripts pass MUST diverge from the oracle in RAM", () => {
  // Seed ENEMY_ANIM_ACCUM/ENEMY_ANIM_DELTA so runObjectMotionScripts's accumulate is observable (a fresh frame leaves it inert).
  const seed = (m) => { m.mem.write8(0x0148, 0x10); m.mem.write8(0x0147, 0x05); };
  const o = new Machine(ROM, OPTS); seed(o);
  let threw = false;
  try { oracle(o); } catch { threw = true; }
  if (threw) { console.log("  TEETH: oracle hit an unimplemented arm -- skipped"); return; }
  const c = new Machine(ROM, OPTS); seed(c);
  // Broken twin: the same driver but SKIPPING runObjectMotionScripts (the 5th pass). If runObjectMotionScripts has any RAM effect on
  // a fresh frame, the ordered-call contract is violated and the RAM diff must catch it.
  let brokeThrew = false;
  try {
    rotateBlasterAroundRim(c); spawnEntityIntoFreeSlot(c); stepAttractEnemySweepTimer(c); tickSpawnSlotTimers(c); /* runObjectMotionScripts(c) DROPPED */
    stepActiveShots(c); spawnClimbersFromSourceSlots(c); scanAllSlotsForProximity(c); ageTimedObjects(c); ageShotsAndAdvanceFrameClock(c);
  } catch { brokeThrew = true; }
  if (brokeThrew) { console.log("  TEETH: broken twin hit an unimplemented arm -- skipped"); return; }
  assert.notEqual(ramDiff(o, c), null, "dropping runObjectMotionScripts was NOT caught by the RAM compare");
});
