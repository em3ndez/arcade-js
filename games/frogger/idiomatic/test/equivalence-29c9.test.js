// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateSpriteObjectFrame — memory-equivalent to the frozen oracle at ROM 0x29C9.
 * GATE: crafted-entry. Attract NEVER dispatches this IX sprite-object animation arm (probe: 0 over
 * 5000 frames; it runs only in the in-play cluster 0x2970 -> 0x29b9), so a post-boot attract clone gets
 * IX/IY at a descriptor pair (0x8440 / 0x8048) and the timer / phase / flip cells poked for each path
 * (timer, 0->255 edge, phase 0, the 1->4 wrap, step-downs). Live-in IX/IY + RAM; LIVE-OUT memory-only.
 * NOTE: links once names.js exports loc_2cd5 (the phase-tile table), added in the naming pass.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { animateSpriteObjectFrame } from "../animateSpriteObjectFrame.js";
import { loc_29c9 as oracle } from "../../translated/loc_29c9.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const IX = 0x8440;
const IY = 0x8048;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let seed = null;
function seedMachine() {
  if (seed) return seed;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the seed run stopped early: ${m.stoppedBy}`);
  seed = m.clone();
  return seed;
}

// A post-boot clone with IX/IY at a valid descriptor pair and the given cells poked.
function entry(pokes) {
  const e = seedMachine().clone();
  e.regs.ix = IX;
  e.regs.iy = IY;
  for (const [a, v] of Object.entries(pokes)) e.mem.write8(Number(a), v);
  return e;
}
const o = (n) => IX + n;
const s = (n) => IY + n;

function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// broken twins.
function brokenNoOp() {}
function brokenWrongTile(m) { m.mem.write8(m.regs.iy + 1, 0x77); } // wrong sprite tile
function brokenSkipArm(m) { // arms (iy+1) but omits the paired (iy+5)/(iy+2)/(iy+6)
  const ix = m.regs.ix, iy = m.regs.iy;
  const timer = (m.mem.read8(ix + 8) - 1) & 0xff; m.mem.write8(ix + 8, timer); if (timer) return;
  m.mem.write8(ix + 8, 12); const ph = m.mem.read8(ix + 6); if (ph === 0) return;
  const nx = ph === 1 ? 4 : ph - 1; m.mem.write8(ix + 6, nx);
  m.mem.write8(iy + 1, m.mem.read8((0x2cd5 + nx) & 0xffff) | m.mem.read8(ix + 5));
}

test("EQUAL (crafted): animateSpriteObjectFrame == oracle on every path", { skip }, () => {
  const entries = [
    entry({ [o(8)]: 5 }), // timer not expired
    entry({ [o(8)]: 0 }), // timer 0 -> 255 edge
    entry({ [o(8)]: 1, [o(6)]: 0 }), // expired, phase 0 inactive
    entry({ [o(8)]: 1, [o(6)]: 1, [o(5)]: 0x03 }), // phase 1 wraps to 4 (full write)
    entry({ [o(8)]: 1, [o(6)]: 3, [o(5)]: 0x00 }), // phase 3 -> 2
    entry({ [o(8)]: 1, [o(6)]: 5, [o(5)]: 0x80 }), // phase 5 -> 4, flip bit
  ];
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (const e of entries) assert.equal(ramDiff(animateSpriteObjectFrame, e), null, "a crafted entry diverged");
  assert.ok(ramDiff(brokenNoOp, entries[3]), "vacuous: oracle wrote nothing on the full-write path");
  console.log(`  EQUAL: ${entries.length} crafted paths, animateSpriteObjectFrame == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  // full-write path (phase 1 -> 4) with the sprite cells sentinelled so any missed write diverges.
  const e = entry({ [o(8)]: 1, [o(6)]: 1, [o(5)]: 0x03, [s(1)]: 0xaa, [s(5)]: 0xaa, [s(2)]: 0xaa, [s(6)]: 0xaa });
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongTile, e), "the wrong-tile twin escaped");
  assert.ok(ramDiff(brokenSkipArm, e), "the skip-arm twin escaped");
  console.log("  TEETH: no-op, wrong-tile, skip-arm all caught");
});
