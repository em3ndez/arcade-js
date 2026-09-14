// SPDX-License-Identifier: GPL-3.0-only
// Equivalence for loc_c7bd (ROM 0xc7bd-0xc7d9) -- a DSW-gated RTS-trick dispatcher: when (DSW1_COINAGE & 0x83)
// == 0x82 it returns immediately; otherwise it runs a pre-pass (stepSpikeTableCollapse), sets bit7 of INPUT_EDGE_FLAGS, and
// rts-dispatches to word($c7da+GAME_MODE)+1. The table has 19 entries (idx0..18); idx6 is an unused slot
// (ROM word 0x0000 -> a jump into RAM, never validly selected). The idiomatic form dissolves the trick
// into TABLE[GAME_MODE>>1](m). Contract: RAM (dumpState minus STACK_SCRATCH). DSW1_COINAGE is the read-only DSW1
// port (driven via m.io.dsw1); a handler reaches the clock-coupled POKEY RANDOM so CAPTURE freezes it.
// Run: node --test games/tempest/idiomatic/test/equivalence-c7bd.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_c7bd as oracle } from "../../translated/loc_c7bd.js";
import { loc_c7bd } from "../loc_c7bd.js";
import { resetLevelPlayfieldSlots } from "../resetLevelPlayfieldSlots.js";
import { setupLevelTimers } from "../setupLevelTimers.js";
import { loc_970b } from "../loc_970b.js";
import { tickEnemyPacingCountdown } from "../tickEnemyPacingCountdown.js";
import { reloadPacingFromPeakSlot } from "../reloadPacingFromPeakSlot.js";
import { commitPendingModeAfterDelay } from "../commitPendingModeAfterDelay.js";
import { bumpLevelEnemyQuota } from "../bumpLevelEnemyQuota.js";
import { buildSortedSoundRequest } from "../buildSortedSoundRequest.js";
import { tickActiveSoundSlot } from "../tickActiveSoundSlot.js";
import { seedModeParamsFromMaskedFlags } from "../seedModeParamsFromMaskedFlags.js";
import { tickWaveSpawnCadence, reseedWaveWorkingSet } from "../selectWaveStartSlot.js";
import { autoAdvanceRimRotation } from "../autoAdvanceRimRotation.js";
import { seedModeParamsWithBounds } from "../seedModeParamsWithBounds.js";
import { seedModeParamsMinimal } from "../seedModeParamsMinimal.js";
import { loc_9729 } from "../loc_9729.js";
import { armModeAndRebuildIfEnabled } from "../armModeAndRebuildIfEnabled.js";
import { stepEnemyFleetAndSpawn } from "../stepEnemyFleetAndSpawn.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, GAME_MODE, INPUT_EDGE_FLAGS } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) { const u = new URL(name, ROM_DIR); return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined; }
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xc7bd;
const GARBAGE_IDX = 6; // the only unused slot (ROM word 0x0000)
const TABLE = [
  resetLevelPlayfieldSlots, setupLevelTimers, loc_970b, tickEnemyPacingCountdown, reloadPacingFromPeakSlot, commitPendingModeAfterDelay, null, bumpLevelEnemyQuota, buildSortedSoundRequest, tickActiveSoundSlot,
  seedModeParamsFromMaskedFlags, tickWaveSpawnCadence, autoAdvanceRimRotation, seedModeParamsWithBounds, reseedWaveWorkingSet, seedModeParamsMinimal, loc_9729, armModeAndRebuildIfEnabled, stepEnemyFleetAndSpawn,
];
const OFFSETS = TABLE.map((t, idx) => (t ? idx * 2 : -1)).filter((o) => o >= 0);
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) => firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);
const freezePokey = (m) => { for (const p of m.io.pokeys) p.skctl &= ~0x03; return m; };

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 3000) : [];

test("CAPTURE: real 0xc7bd dispatches -- loc_c7bd == oracle in RAM (-stack)", () => {
  let checked = 0, skippedGarbage = 0;
  for (const cap of CAPS) {
    // Only the genuine idx6 garbage slot is skipped (there the oracle jumps into RAM); the coinage gate
    // (DSW1_COINAGE & 0x83)==0x82 short-circuits before the dispatch and is compared normally.
    if ((cap.io.readDsw1() & 0x83) !== 0x82 && (cap.mem.read8(GAME_MODE) >> 1) === GARBAGE_IDX) { skippedGarbage++; continue; }
    const o = freezePokey(cap.clone()), c = freezePokey(cap.clone());
    let threw = false;
    try { oracle(o); } catch { threw = true; }
    if (threw) continue; // a real dispatch may reach an unimplemented handler arm; POKEY RANDOM frozen
    loc_c7bd(c);
    assert.equal(ramDiff(o, c), null);
    checked++;
  }
  console.log(`  CAPTURE: ${checked}/${CAPS.length} compared (${skippedGarbage} idx6-garbage skipped)`);
});

test("GATE: (DSW1 & 0x83)==0x82 -> early return, no dispatch (INPUT_EDGE_FLAGS bit7 untouched)", () => {
  const o = new Machine(ROM, OPTS); o.io.dsw1 = 0x82; o.mem.write8(INPUT_EDGE_FLAGS, 0x00);
  const c = new Machine(ROM, OPTS); c.io.dsw1 = 0x82; c.mem.write8(INPUT_EDGE_FLAGS, 0x00);
  oracle(o); loc_c7bd(c);
  assert.equal(ramDiff(o, c), null, "RAM equal on the gated (no-dispatch) path");
  assert.equal(c.mem.read8(INPUT_EDGE_FLAGS) & 0x80, 0, "gate closed: the dispatch (and its INPUT_EDGE_FLAGS bit7 set) did not run");
});

test("CRAFTED: each live entry offset -> loc_c7bd == oracle in RAM (gate open); skip on oracle throw", () => {
  let checked = 0;
  for (const off of OFFSETS) {
    const o = freezePokey(new Machine(ROM, OPTS)); o.io.dsw1 = 0x00; o.mem.write8(GAME_MODE, off);
    const c = freezePokey(new Machine(ROM, OPTS)); c.io.dsw1 = 0x00; c.mem.write8(GAME_MODE, off);
    let threw = false;
    try { oracle(o); } catch { threw = true; }
    if (threw) continue; // a handler the generic seed cannot provision
    loc_c7bd(c);
    assert.equal(ramDiff(o, c), null, `RAM equal after dispatching offset ${off}`);
    checked++;
  }
  console.log(`  CRAFTED: ${checked}/${OFFSETS.length} entries provisioned and checked`);
  assert.ok(checked >= 1, "no entry could be provisioned -- seed is inert");
});

test("TEETH: a twin that dispatches the WRONG entry (off>>1)^1 diverges in RAM", () => {
  let caught = false, tried = 0;
  for (const off of OFFSETS) {
    const o = freezePokey(new Machine(ROM, OPTS)); o.io.dsw1 = 0x00; o.mem.write8(GAME_MODE, off);
    let threw = false;
    try { oracle(o); } catch { threw = true; }
    if (threw) continue;
    const idx = off >> 1, flipped = idx ^ 1;
    if (flipped >= TABLE.length || !TABLE[flipped]) continue;
    const c = freezePokey(new Machine(ROM, OPTS)); c.io.dsw1 = 0x00; c.mem.write8(GAME_MODE, off);
    let brokeThrew = false;
    try { c.mem.write8(INPUT_EDGE_FLAGS, c.mem.read8(INPUT_EDGE_FLAGS) | 0x80); TABLE[flipped](c); } catch { brokeThrew = true; }
    if (brokeThrew) continue;
    tried++;
    if (ramDiff(o, c) !== null) { caught = true; break; }
  }
  assert.ok(tried > 0, "no entry pair could be exercised for the teeth arm");
  assert.ok(caught, "the RAM diff FAILED to catch a wrong-entry dispatch on every exercised pair");
});

test("SP-TOOTH: the omitted-ret dispatcher is seam-placeable", () => {
  const m = freezePokey(new Machine(ROM, OPTS)); m.io.dsw1 = 0x00; m.mem.write8(GAME_MODE, 0x04); // -> loc_970b
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_c7bd, TARGET, m);
  assert.equal(r.placeable, true, `loc_c7bd must be seam-placeable; got: ${r.error}`);
});
