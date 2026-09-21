// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2251 — the tamper-trap landing at ROM 0x2251, dissolved to a throw.
 * It is a self-checksum's dead failure arm aimed at DATA: the only caller (loc_210e) jumps here
 * only when the tile-image readback fails, i.e. only on a tampered ROM. On a good ROM it is never
 * dispatched, so the idiomatic rewrite traps ON ENTRY rather than reproducing the ROM's churn.
 * This gate asserts the two real properties of that trap: (1) UNREACHABLE — no tape dispatches
 * 0x2251; and (2) TRAPS ON ENTRY — the rewrite throws where the oracle would churn to its ROM-write
 * fault. The oracle-side fault is kept as documentation of the ROM's own behaviour. Teeth below: a
 * rewrite that DID NOT throw (fell through / returned) is caught.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_2251 } from "../loc_2251.js";
import { loc_2251 as oracle } from "../../translated/loc_2251.js";
import { NotImplemented } from "../../../../boards/timeplt/io.js";

const TRAP = 0x2251;
const NEIGHBOUR = 0x2010; // advancePlayerAnimationStrip owns the table region the trap lives in
const CAP = 200;
// Bounds the oracle's terminal HALT so a no-fault state unwinds; well above the churn-to-fault cost.
const CYCLE_BUDGET = 4096;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let captured = null;
function captureNeighbours() {
  if (captured) return captured;
  const entries = [];
  const real = TRANSLATED.get(NEIGHBOUR);
  const m = makeMachine(new Map([[NEIGHBOUR, (mm) => {
    if (entries.length < CAP) entries.push(mm.clone());
    return real(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  assert.ok(entries.length > 0, "vacuous: the neighbour was never dispatched, no state to replay");
  captured = entries;
  return captured;
}

// Whether fn faults when run on a clone of `machine`, with the churn's terminal HALT bounded.
function faults(fn, machine) {
  const c = machine.clone();
  c.maxCycles = c.cycles + CYCLE_BUDGET;
  try { fn(c); return false; }
  catch { return true; }
}

// ── UNREACHABLE ───────────────────────────────────────────────────────────────────────────
// The dispatch vector is m.call(0x2251) (loc_210e models the tamper `jp` as a call). Override the
// address with a probe over the frozen oracle: on a good ROM the readback guard never selects the
// trap, so the probe never fires across a full playing run.
test("UNREACHABLE: no tape dispatches the tamper trap at 0x2251", { skip }, () => {
  let dispatched = 0;
  const real = TRANSLATED.get(TRAP);
  const m = makeMachine(new Map([[TRAP, (mm) => { dispatched++; return real(mm); }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
  assert.equal(dispatched, 0, "the tamper trap 0x2251 was dispatched on a good ROM");
});

// ── TRAPS ON ENTRY + oracle still faults ────────────────────────────────────────────────────
// A rewrite that returns instead of throwing (the no-op twin) must be caught: that is the teeth.
function brokenNoOp() {}

test("TRAPS: rewrite throws on entry where the oracle churns to its ROM-write fault", { skip }, () => {
  const entries = captureNeighbours();
  const faulted = entries.filter((e) => faults(oracle, e)).length;
  assert.ok(faulted > 0, "no captured state faults the oracle, so the ROM-write behaviour is undocumented");

  for (const e of entries) {
    assert.throws(() => loc_2251(e.clone()), NotImplemented, "the rewrite did not trap on entry");
  }
  // teeth: the no-op twin returns without throwing, so the throw-on-entry assertion catches it.
  const escaped = entries.filter((e) => faults(brokenNoOp, e)).length;
  assert.equal(escaped, 0, "sanity: the no-op twin should never fault");
  assert.throws(
    () => { for (const e of entries) assert.throws(() => brokenNoOp(e.clone()), NotImplemented); },
    "the no-op twin (no throw on entry) escaped the trap assertion",
  );
  console.log(`  TRAPS: ${entries.length} states trap on entry; oracle faults on ${faulted}`);
});
