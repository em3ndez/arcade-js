// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3793 — poke-assisted real dispatches, crafted entries at the site that branches here, an
 * exhaustive sweep of the slot occupancy the pass walks, and a MASKED diff.
 *
 * Neither tape dispatches this address, structurally: one branching site swallows the block and
 * runs it inline (arm 6 compares against it), the other's arm is never taken (arm 1 measures both
 * at zero with the swallowing range as the live control). So arm 2 pokes two cells and lets the ROM
 * reach the address itself, and arm 3 replays the machine captured at the other site.
 *
 * This entry seats three values and transfers into the body that works a slot, and the body walks
 * the whole bank, so a comparison is the whole pass on both sides; the sweeps vary occupancy because
 * that decides how much of the pass runs. The dissolved body drops its tail return and never writes
 * the stack scratch the frozen side leaves, so [low, seat) is masked (floor watched off the oracle's
 * pushes, proved above the data), the two-byte drift asserted, and the registers it leaves excluded
 * as a ceiling. Teeth are required to catch OUTSIDE the mask, in memory as well as in a cursor.
 *
 * HOLE: the poked run forces two cells for the session, so downstream runs in a state the cabinet
 * would not produce on its own — a real dispatch, not a realistic session.
 * HOLE: nothing here says which bank the game SHOULD use when; that belongs to the branching sites.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-3793.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_3793 } from "../loc_3793.js";
import { loc_3793 as oracle } from "../../translated/loc_3793.js";
// The transcribed range that swallows this block and runs it inline, and the only site that
// reaches it in an untouched session. It is arm 1's positive control and arm 6's subject.
import { loc_37bd as inlineTwin } from "../../translated/loc_37bd.js";
import { KILLS_REMAINING, LIFE_TICKS_MID } from "../names.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x3793;
const BRANCHING_SITE = 0x37bd;
const DISPATCHING_SITE = 0x379f;
const SLOT_BODY = 0x37d6;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

/** The three values this entry seats. */
const SLOTS_IN_THE_PASS = 5;
const RECORD_CURSOR_SEAT = 0xa890;
const ENTRY_CURSOR_SEAT = 0xaa22;

const RECORD_STRIDE = 16;
/** The five records the seated pass walks, from the seat downward. */
const BANK_FLOOR = RECORD_CURSOR_SEAT - (SLOTS_IN_THE_PASS - 1) * RECORD_STRIDE;
const OCCUPANCY_PATTERNS = 1 << SLOTS_IN_THE_PASS;
const BUSY = 0xff;

/** The two cells the poked run forces, and from which frame. The digit is the low nibble. */
const DISPATCHING_DIGIT = 0x08;
const POKE_FROM = 600;

/** How many machines to keep from the branching site; it runs hundreds of times. */
const NEIGHBOUR_CAP = 120;

/** Every data write lands at or below here; the stack seats far above it, so the mask is safe. */
const DATA_TOP = 0xadff;

/**
 * The ceiling on divergence. This entry seats three values and touches nothing else, but the body
 * it tails into drops its tail return and leaves the flag byte, the accumulator, the staging pair
 * and the shadow set differently, and moves the stack pointer. Checked as a SUBSET, a ceiling.
 */
const EXCLUDED = ["a", "d", "e", "f", "sp", "a_", "f_", "b_", "c_", "d_", "e_", "h_", "l_"];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) =>
  d ? `${d.addr == null ? "registers" : hex4(d.addr)}: frozen=${d.a} rewrite=${d.b}` : "identical";

// ── captures ────────────────────────────────────────────────────────────────────────────

let poked = null;
let neighbours = null;

/** Machines the ROM itself dispatched this address with, after two cells were forced. */
function capturePoked() {
  if (poked) return poked;
  let collecting = true;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (collecting) entries.push(mm.clone());
    return oracle(mm);
  }]]));
  m.pokes = [
    { frame: POKE_FROM, addr: KILLS_REMAINING, val: 0 },
    { frame: POKE_FROM, addr: LIFE_TICKS_MID, val: DISPATCHING_DIGIT },
  ];
  const frames = m.runFrames(ENTRY_FRAMES);
  collecting = false;
  assert.equal(m.stoppedBy, null, `the poked run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the poked run ran short");
  poked = entries;
  return poked;
}

/** Machines taken at the other site that branches here, in a session with nothing forced. */
function captureNeighbours() {
  if (neighbours) return neighbours;
  const entries = [];
  const m = makeMachine(new Map([[BRANCHING_SITE, (mm) => {
    if (entries.length < NEIGHBOUR_CAP) entries.push(mm.clone());
    return inlineTwin(mm);
  }]]));
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the neighbour run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the neighbour run ran short");
  assert.ok(entries.length > 0,
    "vacuous: the branching site was never dispatched either, so there is no state to craft from");
  neighbours = entries;
  return neighbours;
}

function anEntry() {
  return captureNeighbours()[0];
}

/**
 * Oracle vs candidate on independent clones: the whole dump outside the dead stack scratch, then
 * the registers outside the ceiling. The frozen body pushes below its seat and takes a return the
 * rewrite leaves; [low, seat) is masked, low watched off the oracle's own pushes.
 */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  try {
    oracle(a);
  } catch (e) {
    return { addr: null, a: `the frozen side threw: ${String(e).slice(0, 40)}`, b: "not run" };
  }
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, a: "returned", b: String(e).slice(0, 40) };
  }
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    return { addr, a: da[i], b: db[i] };
  }
  for (const k of REG_FIELDS) {
    if (EXCLUDED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) return { addr: null, a: `${k}=${a.regs[k]}`, b: `${k}=${b.regs[k]}` };
  }
  return null;
}

/** The mask floor and the sp drift, watched off the frozen side's own pushes. */
function maskProbe(machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  oracle(a);
  loc_3793(b);
  return { low, seat, spDiff: a.regs.sp - b.regs.sp };
}

/** How many bytes of the whole dump the oracle moves from this entry. */
function footprint(machine) {
  const before = machine.dumpState().slice();
  const after = machine.clone();
  oracle(after);
  const now = after.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) if (now[i] !== before[i]) n++;
  return n;
}

/** A neighbour machine with the bank's five heads set free or busy by the mask. */
function craftOccupancy(mask) {
  const m = anEntry().clone();
  for (let i = 0; i < SLOTS_IN_THE_PASS; i++) {
    m.mem8[BANK_FLOOR + i * RECORD_STRIDE] = (mask >> i) & 1 ? BUSY : 0;
  }
  return m;
}

function sweepOccupancy(candidate) {
  let caught = 0;
  for (let mask = 0; mask < OCCUPANCY_PATTERNS; mask++) {
    if (unitDiff(candidate, craftOccupancy(mask))) caught++;
  }
  return caught;
}

/**
 * The same sweep counting only patterns where the two sides' RAM parted company. With nothing
 * excluded, a register difference alone catches everything, and a teeth count that cannot tell
 * the two apart would report a gate with real memory reach and one with none identically.
 */
function sweepOccupancyRam(candidate) {
  let caught = 0;
  for (let mask = 0; mask < OCCUPANCY_PATTERNS; mask++) {
    const machine = craftOccupancy(mask);
    const a = machine.clone();
    const b = machine.clone();
    oracle(a);
    try {
      candidate(b);
    } catch {
      caught++;
      continue;
    }
    if (firstStateDiff(a.dumpState(), b.dumpState()) !== null) caught++;
  }
  return caught;
}

function sweepNeighbours(candidate) {
  let caught = 0;
  for (const e of captureNeighbours()) if (unitDiff(candidate, e)) caught++;
  return caught;
}

function sweepPoked(candidate) {
  let caught = 0;
  for (const e of capturePoked()) if (unitDiff(candidate, e)) caught++;
  return caught;
}

// ── broken twins ────────────────────────────────────────────────────────────────────────

/** BUG: does nothing, so the pass never starts. */
function brokenNoOp() {}

/** BUG: seats the pass on the other bank the game keeps, cursors and all. */
function brokenOtherBank(m) {
  const { regs } = m;
  regs.b = SLOTS_IN_THE_PASS;
  regs.ix = 0xa8b0;
  regs.iy = 0xaa26;
  return m.call(SLOT_BODY);
}

/** BUG: covers one slot too few. */
function brokenOneSlotShort(m) {
  const { regs } = m;
  regs.b = SLOTS_IN_THE_PASS - 1;
  regs.ix = RECORD_CURSOR_SEAT;
  regs.iy = ENTRY_CURSOR_SEAT;
  return m.call(SLOT_BODY);
}

/** BUG: the record cursor is one record out, so every slot is read off by a record. */
function brokenRecordCursorOff(m) {
  const { regs } = m;
  regs.b = SLOTS_IN_THE_PASS;
  regs.ix = RECORD_CURSOR_SEAT + RECORD_STRIDE;
  regs.iy = ENTRY_CURSOR_SEAT;
  return m.call(SLOT_BODY);
}

/** BUG: the entry cursor is one entry out, so a filled slot paints the wrong sprite entry. */
function brokenEntryCursorOff(m) {
  const { regs } = m;
  regs.b = SLOTS_IN_THE_PASS;
  regs.ix = RECORD_CURSOR_SEAT;
  regs.iy = ENTRY_CURSOR_SEAT + 2;
  return m.call(SLOT_BODY);
}

/** BUG: seats everything correctly and never hands over. */
function brokenNeverTransfers(m) {
  const { regs } = m;
  regs.b = SLOTS_IN_THE_PASS;
  regs.ix = RECORD_CURSOR_SEAT;
  regs.iy = ENTRY_CURSOR_SEAT;
}

/** BUG: scribbles a register the routine has no business touching; the control for EXCLUDED. */
function brokenMovesSpareRegister(m) {
  loc_3793(m);
  m.regs.h = (m.regs.h + 1) & 0xff;
}

/** Each twin with the number of occupancy patterns that must catch it IN MEMORY rather than in
 * a cursor. The one is the finding: covering one slot too few is invisible in RAM on all but a
 * single pattern, because the pass fills at most one slot and usually not the one that was cut. */
const TWINS = [
  ["no-op", brokenNoOp, 31],
  ["other-bank", brokenOtherBank, 32],
  ["one-slot-short", brokenOneSlotShort, 1],
  ["record-cursor-off", brokenRecordCursorOff, 32],
  ["entry-cursor-off", brokenEntryCursorOff, 31],
  ["never-transfers", brokenNeverTransfers, 31],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("UNREACHED: neither tape dispatches this address, with a live control", { skip }, () => {
  for (const [label, opts] of [["coin-start", {}], ["undriven", { tape: [] }]]) {
    const seen = { [TARGET]: 0, [BRANCHING_SITE]: 0, [DISPATCHING_SITE]: 0 };
    const realDispatchingSite = TRANSLATED.get(DISPATCHING_SITE);
    const m = makeMachine(new Map([
      [TARGET, (mm) => {
        seen[TARGET]++;
        return oracle(mm);
      }],
      [BRANCHING_SITE, (mm) => {
        seen[BRANCHING_SITE]++;
        return inlineTwin(mm);
      }],
      [DISPATCHING_SITE, (mm) => {
        seen[DISPATCHING_SITE]++;
        return realDispatchingSite(mm);
      }],
    ]), opts);
    m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the ${label} run stopped early: ${m.stoppedBy}`);
    // The zero is evidence ONLY because the same taps, in the same run, counted the site that
    // branches here. A tap that could never fire looks exactly like an address nothing reaches.
    assert.ok(seen[BRANCHING_SITE] > 0,
      `the ${label} run counted nothing at the branching site either, so the instrument is ` +
        "broken and the zero beside it means nothing");
    assert.equal(seen[TARGET], 0,
      `${label} DOES dispatch this address now, so the poked entries below are no longer the ` +
        "best evidence available and this gate should capture plain ones");
    assert.equal(seen[DISPATCHING_SITE], 0,
      `${label} now reaches the site that WOULD dispatch this address, so the account above of ` +
        "why nothing does is out of date");
    console.log(`  UNREACHED: ${label} — ${hex4(TARGET)} entered ${seen[TARGET]} times, the ` +
      `site that would dispatch it ${hex4(DISPATCHING_SITE)} ${seen[DISPATCHING_SITE]}, the ` +
      `control ${hex4(BRANCHING_SITE)} ${seen[BRANCHING_SITE]}`);
  }
});

test("POKED DISPATCH: two cells forced, and the ROM reaches the address itself", { skip }, () => {
  const entries = capturePoked();
  assert.notEqual(entries[0] ?? null, null,
    "vacuous: forcing the kill counter and the life-progress digit no longer makes the ROM " +
      "reach this address, so the arm has nothing to compare");
  for (const e of entries) {
    const d = unitDiff(loc_3793, e);
    assert.equal(d, null, `a poked dispatch diverged: ${show(d)}`);
  }
  const footprints = entries.map(footprint);
  assert.ok(footprints.some((n) => n > 0),
    "every poked dispatch makes the oracle write nothing, so these comparisons would pass a " +
      "rewrite that did nothing");
  console.log(`  POKED DISPATCH: ${entries.length} real dispatches identical, footprints ` +
    `${footprints.join(", ")} bytes`);
});

test("NEIGHBOURS: the machine at the other branching site, replayed here", { skip }, () => {
  const entries = captureNeighbours();
  for (const e of entries) {
    const d = unitDiff(loc_3793, e);
    assert.equal(d, null, `a neighbour machine diverged: ${show(d)}`);
  }
  console.log(`  NEIGHBOURS: ${entries.length} machines captured at ${hex4(BRANCHING_SITE)}, ` +
    "all identical");
});

test("OCCUPANCY: all 32 free/busy patterns of the bank this entry seats", { skip }, () => {
  assert.equal(sweepOccupancy(loc_3793), 0, "an occupancy pattern diverged");
  const allFree = footprint(craftOccupancy(0));
  const allBusy = footprint(craftOccupancy(OCCUPANCY_PATTERNS - 1));
  assert.notEqual(allFree, allBusy,
    "a full bank and an empty one move the same number of bytes, so this sweep is not reaching " +
      "the decision the slot heads drive and the patterns are decoration");
  console.log(`  OCCUPANCY: ${OCCUPANCY_PATTERNS} patterns identical; all-free moves ` +
    `${allFree} bytes, all-busy moves ${allBusy}`);
});

test("SP AND SCRATCH: the drift is exactly two bytes and the mask floor sits above the data",
  { skip }, () => {
    // On a bank the pass actually fills the frozen side pushes and pops a return the rewrite leaves;
    // its deepest push stays above every data cell, so the masked window can hide nothing real.
    for (const mask of [0, OCCUPANCY_PATTERNS - 1]) {
      const r = maskProbe(craftOccupancy(mask));
      assert.equal(r.spDiff, 2, `the frozen side no longer re-seats two bytes higher (${r.spDiff})`);
      assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached down into game data`);
    }
    const r = maskProbe(craftOccupancy(0));
    console.log(`  SP AND SCRATCH: spDiff 2; window floor ${hex4(r.low)} over an all-free bank`);
  });

test("THE SEATS: the three values, read back off the frozen side and pinned", { skip }, () => {
  // This arm reads the FROZEN side only, deliberately: it pins what the seats are so the prose
  // here cannot drift from them. Holding the rewrite to them is the other arms' job.
  const seatOnly = anEntry().clone();
  // Stopping the pass before it starts is what makes the seats readable: with the transfer
  // target replaced the three values are still in place when control comes back. The real entry
  // is put back afterwards -- a clone shares its registry with every other clone of the same run,
  // so removing it rather than restoring it would break every arm that follows.
  const registry = seatOnly.routines;
  const realBody = registry.get(SLOT_BODY);
  registry.set(SLOT_BODY, () => undefined);
  try {
    oracle(seatOnly);
  } finally {
    registry.set(SLOT_BODY, realBody);
  }
  assert.equal(seatOnly.regs.b, SLOTS_IN_THE_PASS, "the pass no longer covers five slots");
  assert.equal(seatOnly.regs.ix, RECORD_CURSOR_SEAT, "the record cursor is seated elsewhere");
  assert.equal(seatOnly.regs.iy, ENTRY_CURSOR_SEAT, "the entry cursor is seated elsewhere");
  console.log(`  THE SEATS: count ${seatOnly.regs.b}, record cursor ${hex4(seatOnly.regs.ix)}, ` +
    `entry cursor ${hex4(seatOnly.regs.iy)}`);
});

test("INLINE TWIN: the swallowing range and this entry agree once both conditions hold",
  { skip }, () => {
    let compared = 0;
    for (const e of captureNeighbours().slice(0, 40)) {
      const whole = e.clone();
      const part = e.clone();
      // The range only reaches this block when its own head byte lets it through and the kill
      // counter reads empty. Force both, identically, on the two machines.
      for (const mm of [whole, part]) {
        mm.mem8[mm.regs.hl] = 0;
        mm.mem8[KILLS_REMAINING] = 0;
      }
      inlineTwin(whole);
      oracle(part);
      const d = firstStateDiff(whole.dumpState(), part.dumpState(),
        (off) => whole.stateOffsetToAddr(off));
      assert.equal(d, null, `the range and this entry parted company — ${show(d)}`);
      compared++;
    }
    assert.ok(compared > 0, "no neighbour machine was available to compare");
    console.log(`  INLINE TWIN: ${compared} machines, the swallowing range and this entry ` +
      "byte-identical");
  });

/** Which registers a candidate parts company with the oracle on, over the occupancy sweep. */
function movedOver(candidate) {
  const moved = new Set();
  for (let mask = 0; mask < OCCUPANCY_PATTERNS; mask++) {
    const a = craftOccupancy(mask);
    const b = a.clone();
    oracle(a);
    try {
      candidate(b);
    } catch {
      continue;
    }
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

test("EXCLUDED, deliberately: nothing moves outside the ceiling, with a control that does",
  { skip }, () => {
    const moved = movedOver(loc_3793);
    const control = movedOver(brokenMovesSpareRegister);
    // A clean result is worth nothing on its own: the same measurement must report a register for a
    // twin that scribbles on one outside the ceiling, or it is not looking at registers at all.
    assert.ok(REG_FIELDS.some((k) => control.has(k) && !EXCLUDED.includes(k)),
      "the measurement reports nothing even for a twin that scribbles on a register, so the " +
        "clean reading below proves nothing");
    const unexpected = REG_FIELDS.filter((k) => moved.has(k) && !EXCLUDED.includes(k));
    assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
    console.log(`  EXCLUDED (measured): observed moving ${EXCLUDED.filter((k) => moved.has(k)).join(", ")}; ` +
      `the control twin also moves ${REG_FIELDS.filter((k) => control.has(k) && !EXCLUDED.includes(k)).join(", ")}`);
  });

for (const [label, twin, ramExpected] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const onPatterns = sweepOccupancy(twin);
    const inRam = sweepOccupancyRam(twin);
    const onNeighbours = sweepNeighbours(twin);
    const onPoked = sweepPoked(twin);
    console.log(`  TEETH/${label}: caught on ${onPatterns}/${OCCUPANCY_PATTERNS} patterns ` +
      `(${inRam} of them in memory rather than in a cursor), ` +
      `${onNeighbours}/${captureNeighbours().length} neighbours, ` +
      `${onPoked}/${capturePoked().length} poked`);
    assert.ok(onPatterns + onNeighbours + onPoked > 0, `every sweep PASSED the ${label} twin`);
    assert.equal(onPatterns, OCCUPANCY_PATTERNS,
      `the ${label} twin escaped an occupancy pattern`);
    assert.equal(inRam, ramExpected, `the ${label} twin's MEMORY catch count moved`);
  });
}
