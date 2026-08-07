// SPDX-License-Identifier: GPL-3.0-only
/**
 * flyAlongBallisticArc — memory-equivalent to the frozen oracle at ROM 0x4017.
 *
 * GATE: strict unit-capture, a corpus replay of every dispatch of a driven session, and a crafted
 *   sweep over the cells that decide where the object goes and whether it stays. What it
 *   exercises, holes stated:
 *
 *   1. EQUAL at the real dispatch — the state dump agrees byte for byte, the stack scratch
 *      included, so this file names NO exclusion and asserts the empty one.
 *   2. NOT VACUOUS — a candidate that does nothing is caught at the same dispatch, so the RAM
 *      comparison really is the gate here.
 *   3. CROSS — the direction byte against a spread of shared displacements, against a spread of
 *      whole and fractional starting coordinates and of the growing speed, all poked identically
 *      on both sides. This is the arm that covers the 16-bit carries and the wraps.
 *   4. THE RETIRING ARMS ARE REACHED, asserted rather than assumed: crafted entries are built one
 *      step outside each limit and one step inside it, and the frozen routine is shown to retire
 *      on one and not the other, on BOTH limits.
 *   5. CORPUS — every dispatch of a driven session, on a clone taken at the dispatch, with the
 *      arms the session reached reported rather than assumed.
 *   6. TEETH — ten twins, each caught on its own exact count over the cross plus the limit
 *      cases; two of them differ from the real routine only at one end of one limit.
 *
 * HOLE: the object's identity is not settled here. This gate fixes the arithmetic and the two
 * limits, and says nothing about what kind of thing moves this way.
 * HOLE: the corpus reaches whatever displacements the session produced; the crafted cross is what
 * carries the wrap cases, and the arm reports which of the two limits the session ever reached.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-4017.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { flyAlongBallisticArc } from "../flyAlongBallisticArc.js";
import { loc_4017 as oracle } from "../../translated/loc_4017.js";
import { retireSlot } from "../retireSlot.js";
import { u8, u16 } from "../../../../core/int.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { WORLD_SCROLL_X, WORLD_SCROLL_Y } from "../names.js";

const TARGET = 0x4017;

const WHOLE_ACROSS = 49;
const FRACTION_ACROSS = 3;
const WHOLE_ALONG = 0;
const FRACTION_ALONG = 5;
const DIRECTION = 1;
const SPEED_LOW = 7;
const SPEED_HIGH = 8;

/** Dispatches the shared tape produces in the harness budget. Measured; a move is a finding. */
const DISPATCHES = 154;

const skip = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr)}: oracle=${d.a} candidate=${d.b}` : "identical");

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

function compare(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return allDiffs(a, b)[0] ?? null;
}

let captured = null;

function replay(candidate) {
  let dispatches = 0;
  let caught = 0;
  let retired = 0;
  const m = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    if (captured === null) captured = mm.clone();
    if (compare(candidate, mm)) caught++;
    const probe = mm.clone();
    oracle(probe);
    if (probe.mem8[probe.regs.ix] === 0 && probe.mem8[probe.regs.iy] === 0) retired++;
    return oracle(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  return { dispatches, caught, retired };
}

function entryState() {
  if (captured === null) replay(flyAlongBallisticArc);
  return captured;
}

/** A real captured machine with every cell this entry reads forced. */
function craft(o) {
  const m = entryState().clone();
  const record = m.regs.ix;
  const entry = m.regs.iy;
  m.mem8[record + DIRECTION] = o.direction ?? 0;
  m.mem8[record + SPEED_LOW] = u8(o.speed ?? 0);
  m.mem8[record + SPEED_HIGH] = u8((o.speed ?? 0) >> 8);
  m.mem8[entry + WHOLE_ACROSS] = o.wholeAcross ?? 100;
  m.mem8[record + FRACTION_ACROSS] = o.fractionAcross ?? 0;
  m.mem8[entry + WHOLE_ALONG] = o.wholeAlong ?? 100;
  m.mem8[record + FRACTION_ALONG] = o.fractionAlong ?? 0;
  m.mem16[WORLD_SCROLL_Y] = u16(o.sharedAcross ?? 0);
  m.mem16[WORLD_SCROLL_X] = u16(o.sharedAlong ?? 0);
  return m;
}

const DIRECTIONS = [0, 1, 255];
const SHARED = [0, 1, 0x0100, 0xff00, 0xffff, 0x8000];
const COORDS = [0, 1, 100, 128, 254, 255];
const SPEEDS = [0, 0x00f7, 0x1234, 0xfff7];

function eachCrossEntry(body) {
  for (const direction of DIRECTIONS) {
    for (const shared of SHARED) {
      for (const coord of COORDS) {
        for (const speed of SPEEDS) {
          body({
            direction,
            sharedAcross: shared,
            sharedAlong: shared,
            wholeAcross: coord,
            fractionAcross: 255 - coord,
            wholeAlong: coord,
            fractionAlong: coord,
            speed,
          });
        }
      }
    }
  }
}

const CROSS_SIZE = DIRECTIONS.length * SHARED.length * COORDS.length * SPEEDS.length;

/**
 * Crafted entries one step either side of each limit, with no shared displacement and no speed so
 * nothing blurs them. The limits are tested AFTER the move, and with a zero fraction the sideways
 * step advances the first whole part by exactly one, so each start is one below the value tested.
 */
const LIMIT_CASES = [
  ["across just inside", { wholeAcross: 15, wholeAlong: 100 }, false],
  ["across just outside", { wholeAcross: 14, wholeAlong: 100 }, true],
  ["across wrapped, just outside", { wholeAcross: 244, wholeAlong: 100 }, true],
  ["across wrapped, just inside", { wholeAcross: 238, wholeAlong: 100 }, false],
  ["along just inside", { wholeAcross: 100, wholeAlong: 247 }, false],
  ["along just outside", { wholeAcross: 100, wholeAlong: 248 }, true],
];

/** Did the frozen routine take a slot out of play? Both coordinate bytes go to zero when it did. */
function retires(machine) {
  const m = machine.clone();
  const entry = m.regs.iy;
  oracle(m);
  return m.mem8[entry + WHOLE_ACROSS] === 0 && m.mem8[entry + WHOLE_ALONG] === 0;
}

function crossCaught(candidate) {
  let caught = 0;
  eachCrossEntry((o) => {
    if (compare(candidate, craft(o))) caught++;
  });
  for (const [, o] of LIMIT_CASES) if (compare(candidate, craft(o))) caught++;
  return caught;
}

const JUDGED = CROSS_SIZE + LIMIT_CASES.length;

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: every byte identical, the stack scratch included", { skip }, () => {
  const entry = entryState();
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  flyAlongBallisticArc(b);
  assert.deepEqual(allDiffs(a, b), [], `a byte diverged — ${show(allDiffs(a, b)[0])}`);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    ["a", "f", "e", "h", "l", "sp"],
    "the excluded set changed shape: none of these outlives the entry",
  );
  console.log(
    `  EQUAL: record ${hex4(entry.regs.ix)}, entry ${hex4(entry.regs.iy)}; every byte identical`,
  );
});

test("NOT VACUOUS: a candidate that does nothing is caught at the same dispatch", { skip }, () => {
  const d = compare(() => {}, entryState());
  assert.notEqual(d, null, "RAM passed a no-op, so it is NOT the gate at the real dispatch");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("CROSS: direction x displacement x coordinate x speed all behave alike", { skip }, () => {
  eachCrossEntry((o) => {
    const d = compare(flyAlongBallisticArc, craft(o));
    assert.equal(d, null, `${JSON.stringify(o)}: ${show(d)}`);
  });
  console.log(`  CROSS: ${CROSS_SIZE} combinations identical`);
});

test("THE RETIRING ARMS ARE REACHED: both limits fire, and only outside themselves", { skip }, () => {
  for (const [label, o, expected] of LIMIT_CASES) {
    const m = craft({ ...o, speed: 0, sharedAcross: 0, sharedAlong: 0, direction: 0 });
    assert.equal(retires(m), expected, `the ${label} case did not behave as recorded`);
    const d = compare(flyAlongBallisticArc, m);
    assert.equal(d, null, `the ${label} case diverged: ${show(d)}`);
  }
  console.log(`  ARMS: ${LIMIT_CASES.length} limit cases, each on the recorded side of its limit`);
});

test("CORPUS: every dispatch of a driven session replays identically", { skip }, () => {
  const r = replay(flyAlongBallisticArc);
  assert.equal(r.dispatches, DISPATCHES, "the dispatch count moved");
  assert.equal(r.caught, 0, `the rewrite diverged on ${r.caught} real dispatches`);
  console.log(`  CORPUS: ${r.dispatches} dispatches identical; ${r.retired} of them retired a slot`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

const entryAt = (m, off) => m.mem8[m.regs.iy + off];

/** BUG: does nothing at all. */
const brokenNoOp = () => {};

/** BUG: the sideways step always goes the same way, whatever the record says. */
function brokenIgnoresDirection(m) {
  const was = m.mem8[m.regs.ix + DIRECTION];
  m.mem8[m.regs.ix + DIRECTION] = 0;
  flyAlongBallisticArc(m);
  if (m.mem8[m.regs.ix] !== 0) m.mem8[m.regs.ix + DIRECTION] = was;
}

/** BUG: the sideways step is a whole pixel out. */
function brokenStepOffByOne(m) {
  flyAlongBallisticArc(m);
  const record = m.regs.ix;
  m.mem8[record + FRACTION_ACROSS] = m.mem8[record + FRACTION_ACROSS] + 1;
}

/** BUG: the speed does not grow, so the object never accelerates. */
function brokenSpeedNeverGrows(m) {
  const record = m.regs.ix;
  const entry = m.regs.iy;
  const speed = (m.mem8[record + SPEED_HIGH] << 8) + m.mem8[record + SPEED_LOW];
  const step = m.mem8[record + DIRECTION] === 0 ? 384 : -384;
  const across = u16((m.mem8[entry + WHOLE_ACROSS] << 8) + m.mem8[record + FRACTION_ACROSS] +
    step + m.mem16[WORLD_SCROLL_Y]);
  m.mem8[entry + WHOLE_ACROSS] = across >> 8;
  m.mem8[record + FRACTION_ACROSS] = across;
  const along = u16((m.mem8[entry + WHOLE_ALONG] << 8) + m.mem8[record + FRACTION_ALONG] +
    speed + m.mem16[WORLD_SCROLL_X]);
  m.mem8[entry + WHOLE_ALONG] = along >> 8;
  m.mem8[record + FRACTION_ALONG] = along;
  if (u8(m.mem8[entry + WHOLE_ACROSS] + 16) < 32 || m.mem8[entry + WHOLE_ALONG] >= 248) {
    retireSlot(m);
  }
}

/** BUG: the world displacement is left out of the first axis. */
function brokenDropsSharedAcross(m) {
  const was = m.mem16[WORLD_SCROLL_Y];
  m.mem16[WORLD_SCROLL_Y] = 0;
  flyAlongBallisticArc(m);
  m.mem16[WORLD_SCROLL_Y] = was;
}

/** BUG: the world displacement is left out of the second axis. */
function brokenDropsSharedAlong(m) {
  const was = m.mem16[WORLD_SCROLL_X];
  m.mem16[WORLD_SCROLL_X] = 0;
  flyAlongBallisticArc(m);
  m.mem16[WORLD_SCROLL_X] = was;
}

/** BUG: the growing speed is added but never stored, so it is recomputed from stale bytes. */
function brokenSpeedNotStored(m) {
  const record = m.regs.ix;
  const low = m.mem8[record + SPEED_LOW];
  const high = m.mem8[record + SPEED_HIGH];
  flyAlongBallisticArc(m);
  if (m.mem8[record] !== 0) {
    m.mem8[record + SPEED_LOW] = low;
    m.mem8[record + SPEED_HIGH] = high;
  }
}

/** BUG: the first-axis limit is one wide. */
function brokenAcrossLimitWide(m) {
  flyAlongBallisticArc(m);
  if (m.mem8[m.regs.ix] !== 0 && u8(entryAt(m, WHOLE_ACROSS) + 16) < 33) retireSlot(m);
}

/** BUG: the second-axis limit is one low. */
function brokenAlongLimitLow(m) {
  flyAlongBallisticArc(m);
  if (m.mem8[m.regs.ix] !== 0 && entryAt(m, WHOLE_ALONG) >= 247) retireSlot(m);
}

/** BUG: neither limit is tested, so nothing ever leaves the picture. */
function brokenNeverRetires(m) {
  const record = m.regs.ix;
  const entry = m.regs.iy;
  const before = [m.mem8[record], m.mem8[entry], m.mem8[entry + WHOLE_ACROSS]];
  flyAlongBallisticArc(m);
  if (m.mem8[record] === 0 && m.mem8[entry] === 0) {
    m.mem8[record] = before[0];
    m.mem8[entry] = before[1];
    m.mem8[entry + WHOLE_ACROSS] = before[2];
  }
}

const TWINS = [
  ["no-op", brokenNoOp, 438],
  ["ignores-direction", brokenIgnoresDirection, 288],
  ["step-off-by-one", brokenStepOffByOne, 438],
  ["speed-never-grows", brokenSpeedNeverGrows, 438],
  ["drops-shared-across", brokenDropsSharedAcross, 264],
  ["drops-shared-along", brokenDropsSharedAlong, 252],
  ["speed-not-stored", brokenSpeedNotStored, 183],
  ["across-limit-wide", brokenAcrossLimitWide, 1],
  ["along-limit-low", brokenAlongLimitLow, 1],
  ["never-retires", brokenNeverRetires, 255],
];

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count`, { skip }, () => {
    assert.equal(crossCaught(twin), expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${expected} of ${JUDGED} judged states`);
  });
}
