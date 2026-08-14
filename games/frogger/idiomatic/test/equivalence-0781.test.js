// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0781 — memory-equivalent to the frozen oracle at ROM 0x0781.
 * GATE: crafted-entry. This fixed-block fill runs in mode-3 board setup, which plain attract never
 * reaches (measured: 0 dispatches in 6000 attract frames), so there is no real dispatch to capture.
 * Instead a corpus of REAL attract machine states is captured (snapshotted at the column-copy
 * primitive, which fires constantly), and on each the oracle and rewrite are run and their RAM
 * compared. The routine takes no live-in and its live-out is memory-only, so registers and SP are not
 * compared. Teeth: three broken twins, each making a RAM difference the gate catches.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_0781 } from "../loc_0781.js";
import { loc_0781 as oracle } from "../../translated/loc_0781.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const STATE_SOURCE = 0x0028; // a leaf the fill never calls, dispatched constantly in attract
const CAP = 120;
const STRIDE = 90; // spread the snapshots across the whole attract run
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let states = null;
function corpus() {
  if (states) return states;
  const out = [];
  let seen = 0;
  const real = TRANSLATED.get(STATE_SOURCE);
  const m = makeMachine(new Map([[STATE_SOURCE, (mm) => {
    if (seen++ % STRIDE === 0 && out.length < CAP) out.push(mm.clone());
    return real(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  states = out;
  return states;
}

// Real attract VRAM in this block already holds the fill tile, so a fresh fill would be invisible.
// The surgical nudge: paint the whole tilemap with a sentinel on BOTH sides first, so every cell the
// routine writes is observable and a missed/extra/wrong write shows as a difference.
const SENTINEL = 0xee;
function paint(m) {
  const { mem8 } = m;
  for (let a = 0xa800; a < 0xac00; a++) mem8[a] = SENTINEL;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); paint(a); oracle(a);
  const b = machine.clone(); paint(b); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

function brokenNoOp() {}
function brokenWrongTile(m) {
  const { mem8 } = m; let p = 0xa808;
  for (let r = 0; r < 32; r++) { for (let c = 0; c < 22; c++) { mem8[p] = 17; p = (p + 1) & 0xffff; } p = (p + 10) & 0xffff; }
}
function brokenWrongWidth(m) {
  const { mem8 } = m; let p = 0xa808;
  for (let r = 0; r < 32; r++) { for (let c = 0; c < 21; c++) { mem8[p] = 16; p = (p + 1) & 0xffff; } p = (p + 11) & 0xffff; }
}

test("CRAFTED: over real attract states, oracle == rewrite", { skip }, () => {
  const c = corpus();
  assert.ok(c.length > 0, "vacuous: no attract states were captured");
  for (const s of c) assert.equal(ramDiff(loc_0781, s), null, "a crafted entry diverged");
  console.log(`  CRAFTED: ${c.length} real attract states, oracle == rewrite`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const c = corpus();
  for (const [name, twin] of [["no-op", brokenNoOp], ["wrong-tile", brokenWrongTile], ["wrong-width", brokenWrongWidth]]) {
    assert.ok(c.some((s) => ramDiff(twin, s) !== null), `the ${name} twin escaped on every state`);
  }
  console.log("  TEETH: no-op, wrong-tile, wrong-width all caught");
});
