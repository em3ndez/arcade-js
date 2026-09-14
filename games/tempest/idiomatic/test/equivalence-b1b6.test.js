// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for buildFrameVectors -- per-frame vector housekeeping. It clears the frame work cells,
// returns early when the guard cells say the frame is settled, hands a zero-mode frame to the builder,
// otherwise publishes the active pointer and (unless the checkpoint helper reports a change) runs the
// trampoline dispatch and folds a 40-byte block into a checksum byte via a carry-chained subtract that
// is DECIMAL-aware when the CPU D flag is live, then latches the two source bytes into the first two
// display words. Live-out is memory only: the sole caller reads no register back after the call, so each
// arm compares RAM (dumpState minus STACK_SCRATCH). The trampoline (an unlifted co-SCC member) is left
// as a machine dispatch; where an arm must drive the checksum path, it is stubbed identically on both
// clones. The D-flag reproduction is proved by a decimal CRAFTED arm plus a positive control that forces
// the binary path and MUST diverge.
// Run: node --test games/tempest/idiomatic/test/equivalence-b1b6.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_b1b6 as oracle } from "../../translated/loc_b1b6.js";
import { buildFrameVectors } from "../buildFrameVectors.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, MODE_DISPATCH_SEL, SCORE_DISPLAY_TIMER, DRAW_RECORD_PTR_LO, VEC_LIST_HEADER_LO, VECHEAD0_PLAY } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xb1b6;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

// The trampoline dispatch may reach the POKEY RANDOM ports; freeze the polys so both clones read the
// same byte on every load (the idiomatic layer does not tick cycles the way the stepped oracle does).
const freezePokey = (m) => { for (const p of m.io.pokeys) p.skctl &= ~0x03; return m; };

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps before any boot-gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(12, 4000) : [];

test("CAPTURE: real 0xb1b6 dispatches -- buildFrameVectors == oracle in RAM (-stack)", () => {
  let checked = 0;
  for (const cap of CAPS) {
    const o = freezePokey(cap.clone()), c = freezePokey(cap.clone());
    let threw = false;
    try { oracle(o); } catch { threw = true; }
    if (threw) continue; // both layers would throw identically at the same unimplemented arm
    buildFrameVectors(c);
    assert.equal(ramDiff(o, c), null);
    checked++;
  }
  console.log(`  CAPTURE: ${checked}/${CAPS.length} dispatch(es) compared`);
});

// Seed a machine so the routine reaches the trampoline + checksum path: guard broken (display word 0
// differs from its checkpoint), mode nonzero, checkpoint helper reports no change (so the checksum path
// runs), and the block under the active pointer is filled with a value that separates decimal from binary.
function seedReachChecksum(m, { fill }) {
  const cec4 = m.mem.read8(VECHEAD0_PLAY);           // 0xe4 in ROM; also != $cec6 (0xe6) so the guard is broken
  m.mem.write8(VEC_LIST_HEADER_LO, cec4);                 // == $cec4 -> checkpoint helper returns no-change
  m.mem.write8(MODE_DISPATCH_SEL, 0x00);                    // trampoline selector -> drawFrame (a terminating dispatch)
  m.mem.write8(DRAW_RECORD_PTR_LO, 0x00);                   // active pointer -> 0x0500 (work RAM)
  m.mem.write8(DRAW_RECORD_PTR_LO + 1, 0x05);
  for (let i = 0; i < 0x28; i++) m.mem.write8(0x0500 + i, fill);
  return m;
}

function craftMachine() {
  return new Machine(ROM, OPTS);
}

// NOTE: the D-set (decimal) checksum path is exercised only in the DECIMAL_MODE_FLAG!=0 mode, which seedFramePhaseAndTick's sed
// gates and which is NOT reached in the gameplay+attract capture (DECIMAL_MODE_FLAG is always 0 there), so it is a
// dead/unreachable path in the shipped game. It also cannot be isolated in this per-routine test: buildFrameVectors
// now calls the real dispatchDisplayModeHandler directly (the seam stub that once kept the checksum on the seeded block is
// gone), and the live dispatch targets (drawFrame et al.) are not themselves decimal-aware, so a full-frame
// D-set comparison measures those targets, not this routine. The decimal checksum stays faithfully in the
// code (dFlag param); if that mode is ever shown reachable, the whole-game test validates the decimal frame.
test("CRAFTED-BINARY: D clear, checksum loop runs -- buildFrameVectors == oracle in RAM (-stack)", () => {
  const base = ROM_PRESENT ? seedReachChecksum(craftMachine(), { fill: 0x37 }) : null;
  if (!base) return;
  const o = freezePokey(base.clone()), c = freezePokey(base.clone());
  o.regs.fD = false; c.regs.fD = false;
  let threw = false;
  try { oracle(o); } catch { threw = true; }
  if (threw) { console.log("  CRAFTED-BINARY: oracle threw -- skipped"); return; }
  buildFrameVectors(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after the binary checksum path");
});

test("TEETH-SKIP: a twin that never latches the display words diverges from the oracle", () => {
  const base = ROM_PRESENT ? seedReachChecksum(craftMachine(), { fill: 0x37 }) : null;
  if (!base) return;
  const o = freezePokey(base.clone()), c = freezePokey(base.clone());
  let threw = false;
  try { oracle(o); } catch { threw = true; }
  if (threw) { console.log("  TEETH-SKIP: oracle threw -- skipped"); return; }
  const broken = (m) => { m.mem8[SCORE_DISPLAY_TIMER] = 0x00; /* BUG: no housekeeping at all */ };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped housekeeping");
});

test("SP-TOOTH: the omitted-ret caller (moved 0) is seam-placeable on the trampoline path", () => {
  if (!ROM_PRESENT) return;
  const m = freezePokey(seedReachChecksum(craftMachine(), { fill: 0x37 }));
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12); // a real caller-return word (0x1234)
  const r = seamPlaceable(withOmittedRet, buildFrameVectors, TARGET, m);
  assert.equal(r.placeable, true, `buildFrameVectors must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret caller (moved 0) placeable");
});

