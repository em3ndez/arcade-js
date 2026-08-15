// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchFrogMoveAgainstLanes — memory-equivalent to the frozen oracle at ROM 0x11BF.
 * GATE: crafted-entry (probe: 0 over ENTRY_FRAMES). A post-boot clone sweeps every frog position 0..255
 * (both guards clear) — the low-nibble short-circuit, the six delegate nibbles, the ten lane nibbles from
 * the ROM arm table — then crafted entries force each path: the guards, an in-band kill (tail 0x12D0),
 * an in-band delegate to the upper half 0x12E4, a lane-clear kill in [0x30,0x80), a lane-clear delegate,
 * a last-in-band-X object (width off-by-one), and a wrap past 0xFF. The delegated upper half and kill
 * tail run for real on both sides. Memory-only live-out: RAM compared (masking the dead stack scratch the
 * dissolved delegate drops), not registers/SP. Teeth: no-op, wrong-value, skip-scan, skip-kill.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { dispatchFrogMoveAgainstLanes } from "../dispatchFrogMoveAgainstLanes.js";
import { resolveFrogMoveAgainstLanes } from "../resolveFrogMoveAgainstLanes.js";
import { loc_11bf as oracle } from "../../translated/loc_11bf.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const KILL_TAIL = 0x12d0;

const GUARD = 0x83cd; // demo / frog-state guard
const HOLD = 0x8004; // resolved-move / block flag
const KILL_CELL = 0x829c; // the kill tail's second write, for a mid-band not-crossed frog
const FROG_X = 0x8047;
const FROG_BASE = 0x8044;
const ARM_TABLE = 0x11e9; // ROM arm-pointer table indexed by the frog X high nibble
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// arm pointer -> [lane object-list base, band width]; the six other arms scan no lane.
const LANES = new Map([
  [0x1212, [0x8100, 60]], [0x121a, [0x8109, 31]], [0x1222, [0x8112, 92]],
  [0x122a, [0x811b, 44]], [0x1232, [0x8124, 47]], [0x1242, [0x8136, 34]],
  [0x124a, [0x813f, 18]], [0x1252, [0x8148, 18]], [0x125a, [0x8151, 18]], [0x1262, [0x815a, 18]],
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

// frog X values whose high nibble lands on a lane (low nibble < 9), with the arm read from the ROM.
function laneFrogX() {
  const s = seedMachine();
  const hit = [];
  for (let x = 0; x <= 255; x++) {
    if ((x & 0x0f) >= 9) continue; // low nibble >= 9 -> delegate, no lane
    const arm = s.mem16[(ARM_TABLE + 2 * (x >> 4)) & 0xffff];
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

// an entry that places one object at `obj` in `lane`, with the given frog X / base, both guards clear.
function laneEntry(x, lane, base, obj) {
  const [laneBase] = lane;
  const e = seedMachine().clone();
  e.mem8[GUARD] = 0; e.mem8[HOLD] = 0; e.mem8[FROG_X] = x; e.mem8[FROG_BASE] = base;
  e.mem8[laneBase] = 1; e.mem8[(laneBase + 1) & 0xffff] = obj;
  return e;
}

test("EQUAL (broad): dispatchFrogMoveAgainstLanes == oracle on every frog X 0..255", { skip }, () => {
  let lanes = 0, delegates = 0;
  for (let x = 0; x <= 255; x++) {
    const e = seedMachine().clone(); e.mem8[GUARD] = 0; e.mem8[HOLD] = 0; e.mem8[FROG_X] = x;
    assert.equal(ramDiff(dispatchFrogMoveAgainstLanes, e), null, `broad frog X=${x} diverged`);
    const arm = seedMachine().mem16[(ARM_TABLE + 2 * (x >> 4)) & 0xffff];
    if ((x & 0x0f) < 9 && LANES.has(arm)) lanes++; else delegates++;
  }
  assert.ok(lanes > 0 && delegates > 0, `sweep did not cover both arm kinds (lanes=${lanes}, delegates=${delegates})`);
  console.log(`  EQUAL: 256 frog-X sweep values (${lanes} lane, ${delegates} delegate), dispatchFrogMoveAgainstLanes == oracle`);
});

test("EQUAL (crafted): guard / block / delegate / kill / wrap paths", { skip }, () => {
  const lanes = laneFrogX();
  assert.ok(lanes.length > 0, "no lane-hitting frog X found");
  const [bx, barm] = lanes.find(([x]) => x >= 128);        // upper-band frog on a lane
  const blane = LANES.get(barm);
  const blow = (0x40 + 3) & 0xff;                            // upper band -> offset 3

  // guard set (either flag) -> immediate return, no change on either side.
  const g1 = seedMachine().clone(); g1.mem8[GUARD] = 1; g1.mem8[FROG_X] = 0x80;
  assert.equal(ramDiff(dispatchFrogMoveAgainstLanes, g1), null, "83cd guard path diverged");
  assert.ok(!oracleWrote(g1), "83cd guard path unexpectedly wrote memory");
  const g2 = seedMachine().clone(); g2.mem8[GUARD] = 0; g2.mem8[HOLD] = 1; g2.mem8[FROG_X] = 0x80;
  assert.equal(ramDiff(dispatchFrogMoveAgainstLanes, g2), null, "8004 guard path diverged");
  assert.ok(!oracleWrote(g2), "8004 guard path unexpectedly wrote memory");

  // block: upper-band frog (0x8047>=128), object inside the band -> kill tail raises HOLD.
  const be = laneEntry(bx, blane, 0x40, (blow + Math.min(blane[1] - 1, 5)) & 0xff);
  assert.equal(ramDiff(dispatchFrogMoveAgainstLanes, be), null, "block path diverged");
  const bchk = be.clone(); oracle(bchk);
  assert.equal(bchk.mem8[HOLD], 1, "block path did not raise HOLD");

  // delegate on an in-band object: lower-band frog (0x8047<128) -> the upper half resolves it.
  const [dx, darm] = lanes.find(([x]) => x < 128);
  const dlane = LANES.get(darm); const dlow = (0x40 + 12) & 0xff; // lower band -> offset 12
  const de = laneEntry(dx, dlane, 0x40, (dlow + Math.min(dlane[1] - 1, 5)) & 0xff);
  assert.equal(ramDiff(dispatchFrogMoveAgainstLanes, de), null, "in-band delegate path diverged");

  // kill: lower-band frog in [0x30,0x80), lane clear -> kill tail writes HOLD and the mid-band cell.
  const [kx, karm] = lanes.find(([x]) => x >= 0x30 && x < 0x80);
  const ke = laneEntry(kx, LANES.get(karm), 0x40, 0); // object at 0 is below the low bound
  assert.equal(ramDiff(dispatchFrogMoveAgainstLanes, ke), null, "kill path diverged");
  const kchk = ke.clone(); oracle(kchk);
  assert.equal(kchk.mem8[HOLD], 1, "kill path did not reach the tail");
  assert.equal(kchk.mem8[KILL_CELL], 1, "kill path did not write the mid-band cell");

  // lane-clear delegate: upper-band frog, lane clear -> the upper half resolves it.
  const ce = laneEntry(bx, blane, 0x40, 0);
  assert.equal(ramDiff(dispatchFrogMoveAgainstLanes, ce), null, "lane-clear delegate path diverged");

  const ee = laneEntry(bx, blane, 0x40, (blow + blane[1] - 1) & 0xff);
  assert.equal(ramDiff(dispatchFrogMoveAgainstLanes, ee), null, "width-edge path diverged");

  const we = laneEntry(bx, blane, 0xf8, 1);
  assert.equal(ramDiff(dispatchFrogMoveAgainstLanes, we), null, "wrap path diverged");
  const wchk = we.clone(); oracle(wchk);
  assert.equal(wchk.mem8[HOLD], 1, "wrap path did not see the object through the band wrap");

  console.log(`  EQUAL: guard x2, block (X=${bx}), in-band delegate (X=${dx}), kill (X=${kx}), lane-clear delegate, width-edge, wrap, dispatchFrogMoveAgainstLanes == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const lanes = laneFrogX();
  const [bx, barm] = lanes.find(([x]) => x >= 128);
  const blow = (0x40 + 3) & 0xff;
  const be = laneEntry(bx, LANES.get(barm), 0x40, (blow + 3) & 0xff); // in-band block entry

  assert.ok(ramDiff(() => {}, be), "the no-op twin escaped");
  assert.ok(ramDiff((m) => { m.mem8[HOLD] = 2; }, be), "the wrong-value twin escaped");
  // dispatched but never scans -> misses the block write.
  assert.ok(ramDiff((m) => {
    const { mem8, mem16 } = m;
    if (mem8[GUARD] !== 0) return; if (mem8[HOLD] !== 0) return;
    const fx = mem8[FROG_X]; if ((fx & 0x0f) >= 9) return;
    const arm = mem16[(ARM_TABLE + 2 * (fx >> 4)) & 0xffff];
    if (!LANES.has(arm)) return; // BUG: never scans
  }, be), "the skip-scan twin escaped");

  // never reaches the kill tail on a kill entry.
  const [kx, karm] = lanes.find(([x]) => x >= 0x30 && x < 0x80);
  const ke = laneEntry(kx, LANES.get(karm), 0x40, 0);
  assert.ok(ramDiff((m) => {
    const { mem8, mem16 } = m;
    if (mem8[GUARD] !== 0) return; if (mem8[HOLD] !== 0) return;
    const fx = mem8[FROG_X]; if ((fx & 0x0f) >= 9) return;
    const arm = mem16[(ARM_TABLE + 2 * (fx >> 4)) & 0xffff];
    if (!LANES.has(arm)) return; // BUG: never reaches the kill tail
  }, ke), "the skip-kill twin escaped");

  // width twin, per lane: a lower-band boundary object at low+width-1 delegates on the correct width but
  // a one-narrower band drops it -> lane-clear -> kill; covers every lane's width, not just one.
  const seenLanes = new Set();
  let widthLanes = 0;
  for (const [x, arm] of lanes) {
    if (x >= 128 || seenLanes.has(arm)) continue;
    seenLanes.add(arm);
    const lane = LANES.get(arm);
    const le = laneEntry(x, lane, 0x40, (((0x40 + 12) & 0xff) + lane[1] - 1) & 0xff);
    assert.equal(ramDiff(dispatchFrogMoveAgainstLanes, le), null, `width base entry (lane 0x${arm.toString(16)}) diverged`);
    assert.ok(ramDiff(brokenNarrowBand, le), `the narrow-band (width-1) twin escaped on lane 0x${arm.toString(16)}`);
    widthLanes++;
  }
  assert.ok(widthLanes > 0, "no lower-band lane found for the width twin");

  console.log(`  TEETH: no-op, wrong-value, skip-scan, skip-kill, narrow-band (${widthLanes} lanes) all caught`);
});

// A width-1 regression of the scan: the boundary object at low+width-1 falls out of the band, flipping
// a lower-band in-band delegate into a lane-clear kill. Mirrors dispatchFrogMoveAgainstLanes's dispatch + scan otherwise.
function brokenNarrowBand(m) {
  const { mem8, mem16 } = m;
  if (mem8[GUARD] !== 0 || mem8[HOLD] !== 0) return;
  const fx = mem8[FROG_X];
  if ((fx & 0x0f) >= 9) return resolveFrogMoveAgainstLanes(m);
  const lane = LANES.get(mem16[(ARM_TABLE + 2 * (fx >> 4)) & 0xffff]);
  if (!lane) return resolveFrogMoveAgainstLanes(m);
  const [laneBase, width] = lane;
  const upperBand = fx >= 128;
  const low = (mem8[FROG_BASE] + (upperBand ? 3 : 12)) & 0xff;
  const top = (low + width - 1) & 0xff; // BUG: band one narrower
  const wrapped = low + width - 1 > 0xff;
  let remaining = mem8[laneBase] || 256, p = laneBase;
  for (;;) {
    p = (p + 1) & 0xffff;
    const objX = mem8[p];
    const inBand = wrapped ? objX >= low || objX < top : objX >= low && objX < top;
    if (inBand) return upperBand ? m.call(KILL_TAIL) : resolveFrogMoveAgainstLanes(m);
    remaining = (remaining - 1) & 0xff;
    if (remaining !== 0) continue;
    return upperBand ? resolveFrogMoveAgainstLanes(m) : m.call(KILL_TAIL);
  }
}
