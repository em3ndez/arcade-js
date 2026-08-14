// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0766 — memory-equivalent to the frozen oracle at ROM 0x0766.
 * GATE: real-capture. Attract dispatches this fixed-block tilemap fill; each captured machine is
 * replayed through oracle and rewrite and their RAM compared. The routine reads no live-in and its
 * live-out is memory-only, so registers and SP are not compared (the fill writes VRAM, never the
 * stack). Teeth: three broken twins, each making a RAM difference the gate catches.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_0766 } from "../loc_0766.js";
import { loc_0766 as oracle } from "../../translated/loc_0766.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const TARGET = 0x0766;
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

// broken twins, each writing wrong RAM the diff must catch.
function brokenNoOp() {}
function brokenWrongTile(m) {
  const { mem8 } = m;
  let p = 0xa802;
  for (let r = 0; r < 32; r++) { for (let c = 0; c < 28; c++) { mem8[p] = 17; p = (p + 1) & 0xffff; } p = (p + 4) & 0xffff; }
}
function brokenShortRow(m) {
  const { mem8 } = m;
  let p = 0xa802;
  for (let r = 0; r < 32; r++) { for (let c = 0; c < 27; c++) { mem8[p] = 16; p = (p + 1) & 0xffff; } p = (p + 5) & 0xffff; }
}

test("CAPTURE: attract dispatches the fill; oracle == rewrite on every state", { skip }, () => {
  const entries = capture();
  assert.ok(entries.length > 0, "vacuous: the fill was never dispatched in attract");
  for (const e of entries) assert.equal(ramDiff(loc_0766, e), null, "a captured machine diverged");
  console.log(`  CAPTURE: ${entries.length} dispatches, oracle == rewrite`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = capture()[0];
  assert.ok(e, "no capture to test teeth against");
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongTile, e), "the wrong-tile twin escaped");
  assert.ok(ramDiff(brokenShortRow, e), "the short-row twin escaped");
  console.log("  TEETH: no-op, wrong-tile, short-row all caught");
});
