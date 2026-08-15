// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_29f9 — memory-equivalent to the frozen oracle at ROM 0x29F9.
 * GATE: crafted-entry. Attract NEVER dispatches this IX sprite-object motion arm (probe: 0 over 5000
 * frames; it runs only in the in-play cluster 0x2970 -> 0x29b9), so a post-boot attract clone gets IX/IY
 * at a descriptor pair (0x8440 / 0x8048) and cells poked for every branch: inactive, gated (0x842c),
 * timer-running, the 0->255 timer edge, the below-row +/-2 step (both facings), and the above-row
 * toward/away/turn drift to the free-running counter 0x8014. Live-in IX/IY (preserved) + RAM; LIVE-OUT memory-only.
 * NOTE: 0x8014 is a free-running position counter (grounded), not the frog X.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_29f9 } from "../loc_29f9.js";
import { loc_29f9 as oracle } from "../../translated/loc_29f9.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const IX = 0x8440;
const IY = 0x8048;
const GATE = 0x842c;
const TRACK_X = 0x8014;
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

// the turn path (full write): facing 0, below-frog anchor, reached -> flips direction + sprite.
const TURN = { [o(6)]: 1, [GATE]: 0, [o(9)]: 1, [s(3)]: 0x20, [o(5)]: 0, [o(0)]: 0x40, [TRACK_X]: 0x60, [s(0)]: 0x08, [s(4)]: 0x33, [s(1)]: 0x11, [o(7)]: 0 };

// broken twins.
function brokenNoOp() {}
function brokenWrongReload(m) { // faithful copy differing ONLY in the move-timer reload (7 not 8)
  const ix = m.regs.ix, iy = m.regs.iy;
  if (m.mem.read8(ix + 6) === 0) return; if (m.mem.read8(GATE) !== 0) return;
  const t = (m.mem.read8(ix + 9) - 1) & 0xff; m.mem.write8(ix + 9, t); if (t) return;
  m.mem.write8(ix + 9, 7); // BUG: should be 8
  const facing = m.mem.read8(ix + 5); m.mem.write8(ix + 7, 1);
  if (m.mem.read8(iy + 3) >= 96) { m.mem.write8(ix + 3, (m.mem.read8(ix + 3) + (facing === 0 ? -2 : 2)) & 0xff); return; }
  const fx = m.mem.read8(TRACK_X);
  const turn = () => { m.mem.write8(ix + 5, m.mem.read8(ix + 5) ^ 0x80); m.mem.write8(iy + 0, m.mem.read8(iy + 4)); m.mem.write8(iy + 1, m.mem.read8(iy + 1) ^ 0x80); };
  if (facing === 0) { const an = m.mem.read8(ix + 0); if (fx < an) return; if (((fx - an) & 0xff) >= m.mem.read8(iy + 0)) return turn(); m.mem.write8(ix + 2, (m.mem.read8(ix + 2) + 1) & 0xff); }
  else { const an = m.mem.read8(ix + 1); if (((fx - an) & 0xff) < m.mem.read8(iy + 0)) return turn(); m.mem.write8(ix + 2, (m.mem.read8(ix + 2) - 1) & 0xff); }
}
function brokenSkipArm(m) { // does the turn but forgets the (ix+7)=1 arm
  const ix = m.regs.ix, iy = m.regs.iy;
  if (m.mem.read8(ix + 6) === 0) return; if (m.mem.read8(GATE) !== 0) return;
  const t = (m.mem.read8(ix + 9) - 1) & 0xff; m.mem.write8(ix + 9, t); if (t) return;
  m.mem.write8(ix + 9, 8); // (skip ix+7 = 1)
  const fx = m.mem.read8(TRACK_X), an = m.mem.read8(ix + 0);
  if (fx < an) return;
  if (((fx - an) & 0xff) >= m.mem.read8(iy + 0)) {
    m.mem.write8(ix + 5, m.mem.read8(ix + 5) ^ 0x80);
    m.mem.write8(iy + 0, m.mem.read8(iy + 4));
    m.mem.write8(iy + 1, m.mem.read8(iy + 1) ^ 0x80);
  }
}

test("EQUAL (crafted): loc_29f9 == oracle on every path", { skip }, () => {
  const entries = [
    entry({ [o(6)]: 0 }), // inactive
    entry({ [o(6)]: 1, [GATE]: 1 }), // gated off
    entry({ [o(6)]: 1, [GATE]: 0, [o(9)]: 5 }), // move timer not expired
    entry({ [o(6)]: 1, [GATE]: 0, [o(9)]: 0 }), // timer 0 -> 255 edge
    entry({ [o(6)]: 1, [GATE]: 0, [o(9)]: 1, [s(3)]: 0x60, [o(5)]: 0, [o(3)]: 10, [o(7)]: 0 }), // below-row step -2
    entry({ [o(6)]: 1, [GATE]: 0, [o(9)]: 1, [s(3)]: 0x60, [o(5)]: 0x80, [o(3)]: 10, [o(7)]: 0 }), // below-row step +2
    entry({ [o(6)]: 1, [GATE]: 0, [o(9)]: 1, [s(3)]: 0x20, [o(5)]: 0, [o(0)]: 0x50, [TRACK_X]: 0x40, [o(7)]: 0 }), // above, hold
    entry(TURN), // above facing0, reached -> turn
    entry({ [o(6)]: 1, [GATE]: 0, [o(9)]: 1, [s(3)]: 0x20, [o(5)]: 0, [o(0)]: 0x40, [TRACK_X]: 0x44, [s(0)]: 0x10, [o(2)]: 5, [o(7)]: 0 }), // step toward
    entry({ [o(6)]: 1, [GATE]: 0, [o(9)]: 1, [s(3)]: 0x20, [o(5)]: 0x80, [o(1)]: 0x40, [TRACK_X]: 0x44, [s(0)]: 0x10, [s(4)]: 0x33, [s(1)]: 0x11, [o(7)]: 0 }), // facing1 turn
    entry({ [o(6)]: 1, [GATE]: 0, [o(9)]: 1, [s(3)]: 0x20, [o(5)]: 0x80, [o(1)]: 0x40, [TRACK_X]: 0x60, [s(0)]: 0x08, [o(2)]: 5, [o(7)]: 0 }), // facing1 step away
  ];
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (const e of entries) assert.equal(ramDiff(loc_29f9, e), null, "a crafted entry diverged");
  assert.ok(ramDiff(brokenNoOp, entry(TURN)), "vacuous: oracle wrote nothing on the turn path");
  console.log(`  EQUAL: ${entries.length} crafted paths, loc_29f9 == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = entry(TURN);
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongReload, e), "the wrong-reload twin escaped");
  assert.ok(ramDiff(brokenSkipArm, e), "the skip-arm twin escaped");
  console.log("  TEETH: no-op, wrong-reload, skip-arm all caught");
});
