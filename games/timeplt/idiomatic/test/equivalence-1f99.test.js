// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1f99 — the table-as-code arm at ROM 0x1F99, dissolved to a throw.
 * The ADDRESS is a live data table that real routines read as DATA; only this ROUTINE, decoding
 * those bytes as CODE, is a dead arm. It is reached as code only through loc_1f2e's fold arm, which
 * the whole live-in space proves is never taken, and loc_1f2e itself only runs on the copyright-glyph
 * tamper divert a genuine image never fires — so no input tape dispatches 0x1F99. The idiomatic
 * rewrite therefore traps ON ENTRY rather than reproducing the ROM's stack-pop churn.
 * This gate asserts the two real properties of that trap: (1) UNREACHABLE — no tape dispatches
 * 0x1F99, with the region owner (0x2010) as the not-blind positive control; and (2) TRAPS ON ENTRY —
 * the rewrite throws where the oracle would churn to its off-map transfer. The oracle-side churn is
 * kept as documentation. Teeth below: a rewrite that DID NOT throw (the no-op twin) is caught.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_1f99 } from "../loc_1f99.js";
import { loc_1f99 as oracle } from "../../translated/loc_1f99.js";
import { NotImplemented } from "../../../../boards/timeplt/io.js";

const TARGET = 0x1f99;
const NEIGHBOUR = 0x2010; // advancePlayerAnimationStrip owns the table region the trap lives in
const CAP = 200;
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

// Whether fn terminates abnormally (throws) on a clone of `machine`.
function faults(fn, machine) {
  try { fn(machine.clone()); return false; }
  catch { return true; }
}

// The broken twin: a rewrite that returns instead of throwing. The throw-on-entry assertion catches it.
function brokenNoOp() {}

// ── UNREACHABLE ───────────────────────────────────────────────────────────────────────────────
test("UNREACHABLE: no tape dispatches the table-as-code arm at 0x1f99", { skip }, () => {
  const seen = { [TARGET]: 0, [NEIGHBOUR]: 0 };
  const realTarget = TRANSLATED.get(TARGET);
  const realNeighbour = TRANSLATED.get(NEIGHBOUR);
  const m = makeMachine(new Map([
    [TARGET, (mm) => { seen[TARGET]++; return realTarget(mm); }],
    [NEIGHBOUR, (mm) => { seen[NEIGHBOUR]++; return realNeighbour(mm); }],
  ]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
  // ★ The zero counts only because the same run saw the region owner dispatched.
  assert.ok(seen[NEIGHBOUR] > 0, "the region owner never ran, so the instrument is blind");
  assert.equal(seen[TARGET], 0, "the table-as-code arm 0x1f99 was dispatched on a good ROM");
  console.log(`  UNREACHABLE: 0x1f99 entered ${seen[TARGET]}, region owner 0x2010 ${seen[NEIGHBOUR]}`);
});

// ── TRAPS ON ENTRY + oracle still churns/faults ─────────────────────────────────────────────────
test("TRAPS: rewrite throws on entry where the oracle churns to its off-map transfer", { skip }, () => {
  const entries = captureNeighbours();

  // The rewrite traps on every captured state (it ignores its live-ins and throws unconditionally).
  for (const e of entries) {
    assert.throws(() => loc_1f99(e.clone()), NotImplemented, "the rewrite did not trap on entry");
  }

  // Oracle documentation: run the ROM's own bytes as code from these states; some transfer off the
  // map and fault, proving the churn arm is the derail the rewrite stands in for.
  const faulted = entries.filter((e) => faults(oracle, e)).length;
  assert.ok(faulted > 0, "no captured state faults the oracle, so the off-map derail is undocumented");

  // Teeth: the no-op twin returns without throwing, so the throw-on-entry assertion catches it.
  assert.throws(
    () => { for (const e of entries) assert.throws(() => brokenNoOp(e.clone()), NotImplemented); },
    "the no-op twin (no throw on entry) escaped the trap assertion",
  );
  console.log(`  TRAPS: ${entries.length} states trap on entry; oracle faults on ${faulted}`);
});
