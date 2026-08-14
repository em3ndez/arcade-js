// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearObjectBlocksAndMirrorToObjRam — memory-equivalent to the frozen oracle at ROM 0x064b.
 * GATE: real-capture + seeded entry. Attract dispatches this once, but on that state the three
 * cleared regions are already zero, so the clear is a no-op there and equivalence would be vacuous.
 * The real dispatch is still replayed (oracle == rewrite), and a seeded twin marks the three regions
 * non-zero so the clears/mirror are exercised and the teeth bite. Live-out is memory-only, so RAM is
 * compared and registers/SP are not. Teeth: three broken twins, each leaving a RAM difference.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { clearObjectBlocksAndMirrorToObjRam } from "../clearObjectBlocksAndMirrorToObjRam.js";
import { loc_064b as oracle } from "../../translated/loc_064b.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const TARGET = 0x064b;
const CAP = 200;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let captured = null;
function capture() {
  if (captured) return captured;
  const entries = [];
  const real = TRANSLATED.get(TARGET);
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (entries.length < CAP) entries.push(mm.clone());
    return real(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  captured = entries;
  return captured;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// a real state with the three touched regions marked non-zero, so the routine's writes are observable.
function craftDirty(machine) {
  const c = machine.clone();
  for (let i = 0; i < 44; i++) c.mem8[0x800c + i] = (i + 1) & 0xff;
  for (let i = 0; i < 43; i++) c.mem8[0xb00c + i] = (i + 101) & 0xff;
  for (let i = 0; i < 99; i++) c.mem8[0x8100 + i] = (i + 151) & 0xff;
  return c;
}

function oracled(machine) { const a = machine.clone(); oracle(a); return a.dumpState(); }

// broken twins, each leaving wrong RAM the diff must catch (on the seeded entry).
function brokenNoOp() {}
function brokenShortClear(m) {
  const { mem8 } = m;
  for (let i = 0; i < 43; i++) mem8[0x800c + i] = 0;   // BUG: 43 not 44 — 0x8037 left dirty
  for (let i = 0; i < 43; i++) mem8[0xb00c + i] = mem8[0x800c + i];
  for (let i = 0; i < 99; i++) mem8[0x8100 + i] = 0;
}
function brokenSkipMirror(m) {
  const { mem8 } = m;
  for (let i = 0; i < 44; i++) mem8[0x800c + i] = 0;
  // BUG: omit the OBJRAM mirror — 0xb00c left dirty
  for (let i = 0; i < 99; i++) mem8[0x8100 + i] = 0;
}

test("CAPTURE: attract dispatches the clear; oracle == rewrite on real + seeded states", { skip }, () => {
  const entries = capture();
  assert.ok(entries.length > 0, "vacuous: the clear was never dispatched in attract");
  for (const e of entries) assert.equal(ramDiff(clearObjectBlocksAndMirrorToObjRam, e), null, "a captured machine diverged");
  const dirty = craftDirty(entries[0]);
  assert.equal(ramDiff(clearObjectBlocksAndMirrorToObjRam, dirty), null, "the rewrite diverged on the seeded entry");
  assert.notDeepEqual(oracled(dirty), dirty.dumpState(), "seeded entry vacuous: oracle changed nothing");
  console.log(`  CAPTURE: ${entries.length} real dispatch(es) + seeded entry, oracle == rewrite`);
});

test("TEETH: broken twins are caught on the seeded entry", { skip }, () => {
  const dirty = craftDirty(capture()[0]);
  assert.ok(ramDiff(brokenNoOp, dirty), "the no-op twin escaped");
  assert.ok(ramDiff(brokenShortClear, dirty), "the short-clear twin escaped");
  assert.ok(ramDiff(brokenSkipMirror, dirty), "the skip-mirror twin escaped");
  console.log("  TEETH: no-op, short-clear, skip-mirror all caught");
});
