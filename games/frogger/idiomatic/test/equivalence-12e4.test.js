// SPDX-License-Identifier: GPL-3.0-only
/**
 * resolveFrogMoveAgainstLanes — memory-equivalent to the frozen oracle at ROM 0x12E4.
 * GATE: crafted-entry. Attract never dispatches this move dispatcher (probe: 0 dispatches over
 * ENTRY_FRAMES), so a post-boot attract machine is cloned and the frog X / lane cells are poked.
 * A broad sweep drives every frog X 0..255 (the guard, the low-nibble short-circuit, all sixteen ROM
 * arms). Crafted entries then force the specific paths: the resolved-move guard, an in-band object
 * that blocks the move, a lane-clear kill that transfers to the frozen tail 0x12D0 (run identically
 * on both sides — its writes are part of the compared live-out), an object at the last in-band X (so a
 * lane-width off-by-one diverges), and — with DIR>=128 selecting the offset-3 low bound — a band that
 * genuinely wraps past 0xFF, with an object in-band only through the wrap.
 * No register live-in; memory-only live-out, so registers/SP are not compared. Teeth: no-op,
 * wrong-value, skip-scan (dispatched but never scans), skip-kill (never reaches the kill tail).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { resolveFrogMoveAgainstLanes } from "../resolveFrogMoveAgainstLanes.js";
import { loc_12e4 as oracle } from "../../translated/loc_12e4.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const HOLD = 0x8004; // resolved-move flag / block flag
const FROG_X = 0x8047;
const DIR = 0x802f; // < 128 selects the wide low-bound offset
const FROG_BASE = 0x8044;
const ARM_TABLE = 0x130b;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// arm pointer -> [lane object-list base, band width]; the five other arms scan no lane.
const LANES = new Map([
  [0x1334, [0x8100, 60]], [0x133c, [0x8109, 31]], [0x1344, [0x8112, 92]],
  [0x134c, [0x811b, 44]], [0x1354, [0x8124, 47]], [0x1364, [0x8136, 34]],
  [0x136c, [0x813f, 18]], [0x1374, [0x8148, 18]], [0x137c, [0x8151, 18]], [0x1384, [0x815a, 18]],
]);

let seed = null;
function seedMachine() {
  if (seed) return seed;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the seed run stopped early: ${m.stoppedBy}`);
  seed = m.clone();
  return seed;
}

// frog X values whose arm lands on a lane, split by the across threshold (128).
function laneFrogX() {
  const s = seedMachine();
  const hit = [];
  for (let x = 0; x <= 255; x++) {
    const key = (x + 15) & 0xff;
    if ((key & 0x0f) < 5) continue;
    const arm = s.mem16[(ARM_TABLE + 2 * ((key & 0xf0) >> 4)) & 0xffff];
    if (LANES.has(arm)) hit.push([x, arm]);
  }
  return hit;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}
function oracleWrote(machine) {
  const a = machine.clone(); const before = a.dumpState(); oracle(a);
  return firstStateDiff(before, a.dumpState(), (o) => a.stateOffsetToAddr(o)) !== null;
}

// an entry that places one object at `obj` in `lane`, with the given frog X / base / direction.
function laneEntry(x, lane, base, obj, dir = 0) {
  const [laneBase] = lane;
  const e = seedMachine().clone();
  e.mem8[HOLD] = 0; e.mem8[FROG_X] = x; e.mem8[DIR] = dir; e.mem8[FROG_BASE] = base;
  e.mem8[laneBase] = 1; e.mem8[(laneBase + 1) & 0xffff] = obj;
  return e;
}

test("EQUAL (broad): resolveFrogMoveAgainstLanes == oracle on every frog X 0..255", { skip }, () => {
  let n = 0;
  for (let x = 0; x <= 255; x++) {
    const e = seedMachine().clone(); e.mem8[HOLD] = 0; e.mem8[FROG_X] = x;
    assert.equal(ramDiff(resolveFrogMoveAgainstLanes, e), null, `broad frog X=${x} diverged`); n++;
  }
  console.log(`  EQUAL: ${n} frog-X sweep values, resolveFrogMoveAgainstLanes == oracle`);
});

test("EQUAL (crafted): guard / block / kill / wrap paths", { skip }, () => {
  const lanes = laneFrogX();
  assert.ok(lanes.length > 0, "no lane-hitting frog X found");

  // guard: HOLD set -> immediate return, no change on either side.
  const g = seedMachine().clone(); g.mem8[HOLD] = 1; g.mem8[FROG_X] = 0x80;
  assert.equal(ramDiff(resolveFrogMoveAgainstLanes, g), null, "guard path diverged");
  assert.ok(!oracleWrote(g), "guard path unexpectedly wrote memory");

  // block: across frog (X>=128), object inside the band -> sets HOLD=1.
  const [bx, barm] = lanes.find(([x]) => x >= 128);
  const blane = LANES.get(barm);
  const blow = (0x40 + 12) & 0xff;
  const be = laneEntry(bx, blane, 0x40, (blow + Math.min(blane[1] - 1, 5)) & 0xff);
  assert.equal(ramDiff(resolveFrogMoveAgainstLanes, be), null, "block path diverged");
  const bchk = be.clone(); oracle(bchk);
  assert.equal(bchk.mem8[HOLD], 1, "block path did not raise HOLD");

  // kill: not-across frog in [0x30,0x80) if available, lane clear -> transfers to 0x12D0.
  const [kx, karm] = lanes.find(([x]) => x >= 0x30 && x < 0x80) ?? lanes.find(([x]) => x < 128);
  const ke = laneEntry(kx, LANES.get(karm), 0x40, 0); // object at 0 is below the low bound
  assert.equal(ramDiff(resolveFrogMoveAgainstLanes, ke), null, "kill path diverged");
  const kchk = ke.clone(); oracle(kchk);
  assert.equal(kchk.mem8[HOLD], 1, "kill path did not reach the tail");

  // width edge (non-wrap, across): object at the last in-band X (low+width-1, offset 12) so a
  // lane-width off-by-one in the module diverges from the oracle exactly here.
  const ee = laneEntry(bx, blane, 0x40, (((0x40 + 12) & 0xff) + blane[1] - 1) & 0xff);
  assert.equal(ramDiff(resolveFrogMoveAgainstLanes, ee), null, "width-edge path diverged");

  // wrap + across, DIR>=128 -> offset 3: low=(0xf8+3)=0xfb, low+width overflows 0xFF so the band wraps.
  // The object at X=1 is in-band ONLY through the wrap ([0, top)); the across frog then raises HOLD.
  const we = laneEntry(bx, blane, 0xf8, 1, 0x80);
  assert.equal(ramDiff(resolveFrogMoveAgainstLanes, we), null, "wrap path diverged");
  const wchk = we.clone(); oracle(wchk);
  assert.equal(wchk.mem8[HOLD], 1, "wrap path did not see the object through the band wrap");

  console.log(`  EQUAL: guard, block (X=${bx}), kill (X=${kx}), width-edge, wrap, resolveFrogMoveAgainstLanes == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const lanes = laneFrogX();
  const [bx, barm] = lanes.find(([x]) => x >= 128);
  const blow = (0x40 + 12) & 0xff;
  const be = laneEntry(bx, LANES.get(barm), 0x40, (blow + 3) & 0xff);

  assert.ok(ramDiff(() => {}, be), "the no-op twin escaped");
  assert.ok(ramDiff((m) => { m.mem8[HOLD] = 2; }, be), "the wrong-value twin escaped");
  // dispatched but never scans -> misses the block write.
  assert.ok(ramDiff((m) => {
    const { mem8, mem16 } = m;
    if (mem8[HOLD] !== 0) return;
    const k = (mem8[FROG_X] + 15) & 0xff; if ((k & 0x0f) < 5) return;
    const arm = mem16[(ARM_TABLE + 2 * ((k & 0xf0) >> 4)) & 0xffff];
    if (!LANES.has(arm)) return; // BUG: never scans
  }, be), "the skip-scan twin escaped");

  // never reaches the kill tail on a kill entry.
  const [kx, karm] = lanes.find(([x]) => x < 128);
  const ke = laneEntry(kx, LANES.get(karm), 0x40, 0);
  assert.ok(ramDiff((m) => {
    const { mem8, mem16 } = m;
    if (mem8[HOLD] !== 0) return;
    const k = (mem8[FROG_X] + 15) & 0xff; if ((k & 0x0f) < 5) return;
    const arm = mem16[(ARM_TABLE + 2 * ((k & 0xf0) >> 4)) & 0xffff];
    if (!LANES.has(arm)) return; // BUG: never reaches the kill tail
  }, ke), "the skip-kill twin escaped");

  console.log("  TEETH: no-op, wrong-value, skip-scan, skip-kill all caught");
});
