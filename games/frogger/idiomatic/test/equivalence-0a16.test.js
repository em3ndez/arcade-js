// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderTimeBar — memory-equivalent to the frozen oracle at ROM 0x0a16.
 * GATE: crafted-entry. Attract never dispatches this time-bar render (probe: 0 over ENTRY_FRAMES).
 * The routine reads no live-in registers — it selects a countdown cell from work RAM — so entries are
 * cloned from a booted attract machine and the countdown cells are seeded to cover each branch: the
 * default source, both phase sources, a zero count (cap only), and the inactive early-return. Live-out
 * is memory-only. Teeth run on a bar-drawing entry (a positive control asserts the oracle mutates it):
 * a no-op, a wrong-tile twin, and a wrong-count twin.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { renderTimeBar } from "../renderTimeBar.js";
import { loc_0a16 as oracle } from "../../translated/loc_0a16.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const E4 = 0x83e4, E5 = 0x83e5, E6 = 0x83e6, PLAY = 0x83fe, PHASE = 0x83fd, BAR = 0xabbe;

let crafted = null;
function entries() {
  if (crafted) return crafted;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the boot run stopped early: ${m.stoppedBy}`);
  const seed = (cfg) => {
    const c = m.clone();
    c.mem8[E4] = cfg.e4; c.mem8[PLAY] = cfg.play; c.mem8[PHASE] = cfg.phase;
    c.mem8[E5] = cfg.e5; c.mem8[E6] = cfg.e6;
    for (let a = BAR; a > BAR - 320; a--) c.mem8[a & 0xffff] = 0; // clear the bar column
    return c;
  };
  crafted = [
    seed({ e4: 5, play: 0, phase: 0, e5: 0, e6: 0 }), // default source, count 5
    seed({ e4: 3, play: 1, phase: 1, e5: 4, e6: 9 }), // phase-1 source, count 4
    seed({ e4: 2, play: 1, phase: 2, e5: 4, e6: 8 }), // other-phase source, count 8
    seed({ e4: 0, play: 0, phase: 0, e5: 0, e6: 0 }), // count 0 -> cap only
    seed({ e4: 255, play: 0, phase: 0, e5: 0, e6: 0 }), // inactive -> early return
  ];
  return crafted;
}

// null == RAM-equivalent (memory-only live-out).
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// broken twins on a bar-drawing entry: no-op, wrong tile, wrong count.
function brokenNoOp() {}
function brokenWrongTile(m) { drawBar(m, 200, 0); }
function brokenWrongCount(m) { drawBar(m, 77, 1); }
function drawBar(m, tile, extra) {
  const { mem8 } = m;
  if (mem8[E4] === 255) return;
  let src = E4;
  if (mem8[PLAY] !== 0) src = mem8[PHASE] === 1 ? E5 : E6;
  let count = mem8[src] + extra;
  let p = BAR;
  while (count-- > 0) { mem8[p] = tile; p = (p - 32) & 0xffff; }
  mem8[p] = 16;
}

test("CRAFTED: time-bar render is RAM-equivalent across the branch set", { skip }, () => {
  const es = entries();
  assert.ok(es.length > 0, "vacuous: no crafted entry");
  for (const e of es) assert.equal(ramDiff(renderTimeBar, e), null, "a crafted entry diverged");
  console.log(`  CRAFTED: ${es.length} branch entries, oracle == rewrite`);
});

test("TEETH: broken twins are caught on a bar-drawing entry", { skip }, () => {
  const bar = entries()[0];
  assert.ok(ramDiff(brokenNoOp, bar), "positive control: the oracle must draw on this entry");
  assert.ok(ramDiff(brokenWrongTile, bar), "the wrong-tile twin escaped");
  assert.ok(ramDiff(brokenWrongCount, bar), "the wrong-count twin escaped");
  console.log("  TEETH: no-op, wrong-tile, wrong-count all caught (positive control passed)");
});
