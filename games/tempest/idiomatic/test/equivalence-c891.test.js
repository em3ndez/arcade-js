// SPDX-License-Identifier: GPL-3.0-only
// Equivalence for seedFramePhaseAndTick (ROM 0xc891-0xc90b) -- the per-frame dispatcher. It sets speed/mode cells from
// the coin input + phase counters, then a common tail advances FRAME_COUNTER and fires the sub-steps advanceLevelCounter
// (c8d2), stepEaromTransfer (odd frames) and requestActiveSoundCue (when SOUND_STEP_GATE is live), threading the slot index X/Y from one to
// the next. Contract: RAM (dumpState minus STACK_SCRATCH). The ROM's decimal-mode arm (SED gated on
// DECIMAL_MODE_FLAG != 0 && loc_9f > 0x13) is DEAD -- DECIMAL_MODE_FLAG is the checksum 0xa7 ^ fold(ROM[0xaace..0xaad8]) of a
// fixed program-ROM span, which is 0, so the gate never opens (verified statically and by a MAME tap over
// gameplay). The idiomatic routine omits it; on every reachable state D is left untouched, matching the
// oracle, which the CAPTURE test still checks. c891 is a full JS dispatcher (calls its sub-steps as JS),
// not an omitted-ret leaf, so there is no SP-tooth. The X/Y threading into requestActiveSoundCue is load-bearing: ccfa
// forwards them to loadSoundVoiceSlots, which stamps loc_31/loc_32 -- a stale (entry) X/Y writes the wrong cells.
// Run: node --test games/tempest/idiomatic/test/equivalence-c891.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_c891 as oracle } from "../../translated/loc_c891.js";
import { seedFramePhaseAndTick } from "../seedFramePhaseAndTick.js";
import { stepEaromTransfer } from "../stepEaromTransfer.js";
import { requestActiveSoundCue } from "../requestActiveSoundCue.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, FRAME_COUNTER, SOUND_STEP_GATE } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) { const u = new URL(name, ROM_DIR); return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined; }
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xc891;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) => firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);
const freezePokey = (m) => { for (const p of m.io.pokeys) p.skctl &= ~0x03; return m; };

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(24, 4000) : [];

test("CAPTURE: real 0xc891 dispatches -- seedFramePhaseAndTick == oracle in RAM (-stack) and in the D flag", () => {
  let checked = 0;
  for (const cap of CAPS) {
    const o = freezePokey(cap.clone()), c = freezePokey(cap.clone());
    let threw = false;
    try { oracle(o); } catch { threw = true; }
    if (threw) continue;
    seedFramePhaseAndTick(c);
    assert.equal(ramDiff(o, c), null);
    assert.equal(c.regs.fD, o.regs.fD, "decimal-flag live-out matches");
    checked++;
  }
  console.log(`  CAPTURE: ${checked}/${CAPS.length} compared`);
});

// Force the tail sub-steps: odd frame (so stepEaromTransfer runs) and SOUND_STEP_GATE live (so requestActiveSoundCue runs).
const forceTailSubsteps = (m) => { m.mem.write8(FRAME_COUNTER, 0x00); m.mem.write8(SOUND_STEP_GATE, 0x01); };

test("CRAFTED: requestActiveSoundCue reached (odd frame + SOUND_STEP_GATE live) -- RAM equal, X/Y threaded correctly", () => {
  let checked = 0;
  for (const cap of CAPS) {
    const o = freezePokey(cap.clone()); forceTailSubsteps(o);
    const c = freezePokey(cap.clone()); forceTailSubsteps(c);
    let threw = false;
    try { oracle(o); } catch { threw = true; }
    if (threw) continue;
    seedFramePhaseAndTick(c);
    assert.equal(ramDiff(o, c), null, "RAM equal after the ccfa-reaching tail (loc_31/loc_32 stamped by threaded X/Y)");
    checked++;
  }
  console.log(`  CRAFTED ccfa: ${checked} states`);
  assert.ok(checked >= 1, "no state reached the ccfa tail cleanly");
});

// A full copy of seedFramePhaseAndTick identical EXCEPT the ccfa call hands over the stale (entry-register) X/Y
// instead of the threaded locals -- the exact R37 defect this routine's threading prevents.
function brokenStaleBridge(m, x = m.regs.x, y = m.regs.y) {
  const rd = (a) => m.mem8[a], wr = (a, v) => { m.mem8[a] = v & 0xff; };
  let toC81b = false, toTail = false;
  if ((rd(0x0c00) & 0x10) === 0) { wr(0x00, 0x22); toTail = true; }
  else if ((rd(0x05) & 0x40) !== 0) { toTail = true; }
  else if ((rd(0x0a) & 0x01) === 0) { toC81b = true; }
  else {
    y = rd(0x06);
    if (y === 0) wr(0xa2, 0x80);
    if ((rd(0xa2) & 0x80) === 0) toC81b = true;
    else if (y >= 2) { wr(0x00, 0x14); wr(0xa2, 0x00); toC81b = true; }
    else if (y !== 0) { wr(0x01, 0x16); wr(0x00, 0x0a); }
  }
  if (!toTail) {
    if (toC81b && rd(0x06) !== 0) [x, y] = advanceLevelCounter(m, x);
    if ((rd(0x09) & 0x03) === 0) wr(0x06, 0x02);
  }
  wr(0x03, rd(0x03) + 1);
  if ((rd(0x03) & 0x01) !== 0) [x, y] = stepEaromTransfer(m, x, y);
  if (rd(0x0c) !== 0) requestActiveSoundCue(m); // BUG: stale entry X/Y from the bridge, not the threaded de1b/c81b exit
  if ((rd(0x4e) & 0x80) !== 0) wr(0x4e, 0x00);
}

test("TEETH (X/Y threading): a twin that lets requestActiveSoundCue read the stale bridge diverges from the oracle", () => {
  // On an odd frame stepEaromTransfer changes X/Y, so a ccfa that reads the entry registers stamps the wrong
  // loc_31/loc_32. Scan the forced states for one that diverges (the design measured ~148/200), proving it.
  let caught = false, tried = 0;
  for (const cap of CAPS) {
    const o = freezePokey(cap.clone()); forceTailSubsteps(o);
    let threw = false;
    try { oracle(o); } catch { threw = true; }
    if (threw) continue;
    const s = freezePokey(cap.clone()); forceTailSubsteps(s);
    brokenStaleBridge(s);
    tried++;
    if (ramDiff(o, s) !== null) { caught = true; break; }
  }
  assert.ok(tried > 0, "no state could be exercised for the threading teeth");
  assert.ok(caught, "the RAM diff FAILED to catch a stale-bridge ccfa on every exercised state");
});
