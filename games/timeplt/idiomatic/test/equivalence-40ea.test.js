// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_40ea — memory-equivalent to the frozen oracle at ROM 0x40EA.
 *
 * GATE: real dispatches captured under an era poke, plus crafted entries that force the head slot into
 *   each of the five arms at both an ending and a looping turn count, compared under the LIVE registry
 *   (translated table with every idiomatic override wired, as the running game has it) so oracle and
 *   rewrite reach the SAME callees and any divergence is this body's own. The candidate runs through
 *   the game's withOmittedRet seam, so SP and pc are compared exactly, not as a per-arm drift. The dead
 *   stack scratch below the seat is masked, bounded above game data. Registers: all but A and F.
 *
 * ★ WHY THE LIVE REGISTRY. Under the pure translated table the oracle reaches translated callees while
 *   the rewrite reaches their idiomatic modules directly, and every callee's own register ceiling would
 *   be charged to this routine. Under the live table both sides reach the same wired modules; the
 *   sweep body itself is removed from it so nested turns run the oracle on BOTH sides.
 *
 * ★ A AND F ARE DEAD. On the ending turn the only reader after the sweep is the sprite multiplexer,
 *   which reads C and F; the F it inherits is already outside the turn-closer's own ceiling (the
 *   turn-closer never set the flags the stride addition leaves), and A is overwritten there.
 *
 * What it exercises, holes stated:
 *   1. REACHABILITY — the tapes' dispatch count, with the sweep's entry as the positive control.
 *   2. CORPUS — every poked-run dispatch, real.
 *   3. ARMS — each arm crafted, turn count 1 (ends) and 3 (loops round through the oracle).
 *   4. DRIFTING MARKERS — the non-full marker values across the drifting object's own thresholds.
 *   5. EXCLUDED — nothing outside A/F diverges, with a control twin that can be seen.
 *   6. TEETH — broken twins, each caught on the arm it breaks.
 * HOLE: the era poke puts the game in an era it did not earn; the crafts vary the routine's own inputs.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-40ea.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { resolveAllIdiomatic, withOmittedRet } from "../../machine.js";
import { ROUTINES } from "../../routines.js";
import { loc_40ea as candidate } from "../loc_40ea.js";
import { loc_40ea as oracle } from "../../translated/loc_40ea.js";
import { loc_40d6 as sweepEntry } from "../../translated/loc_40d6.js";
import { closeOneTurnOfTheSlotSweep } from "../closeOneTurnOfTheSlotSweep.js";
import { stepDriftingCountdownObjectByEraFrames } from "../stepDriftingCountdownObjectByEraFrames.js";
import { stepSlotApproachThenBreakawayRetire } from "../stepSlotApproachThenBreakawayRetire.js";
import { flyLiveSlotAndTickCountdown } from "../flyLiveSlotAndTickCountdown.js";
import { chaseOneAimPointAndRetireAtTheLine } from "../chaseOneAimPointAndRetireAtTheLine.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { ERA_INDEX } from "../names.js";

const TARGET = 0x40ea;
const SWEEP_ENTRY = 0x40d6;

const MARKER = 0x00;
const COUNTDOWN = 0x0e;
const FREE = 0x00;
const FULL = 0xff;
const FINAL_ERA = 4;

const ERA_WITH_SWEEP = 2;
const POKE_FROM_FRAME = 900;
const CORPUS = 200;
const CRAFT_BASES = 24;

// The oracle's stack reach sits far above game data; a window bounded above this cannot hide a write.
const DATA_TOP = 0xadff;
const EXCLUDED = ["a", "f"];

// Drifting-object counts straddling its thresholds: retire at 1, below the window, in it, the reset
// mark, and a marker with bit 7 set that is still not full.
const DRIFT_MARKERS = [0x01, 0x02, 0x10, 0x1c, 0x20, 0x3b, 0x3c, 0x80, 0xfe];

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── the live registry ─────────────────────────────────────────────────────────────────────

const LIVE = new Map(ROUTINES);
if (romsPresent()) {
  for (const [addr, fn] of await resolveAllIdiomatic(new URL("../../machine.js", import.meta.url))) {
    LIVE.set(addr, fn);
  }
}
LIVE.set(TARGET, oracle);
const seamed = (fn) => withOmittedRet(fn, TARGET);

// ── the captured dispatches, and the crafted slot ─────────────────────────────────────────

function lean(mm) {
  mm.assets = {};
  mm.video = null;
  return mm;
}

let raw = null;
function captured() {
  if (raw) return raw;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (entries.length < CORPUS) entries.push(lean(mm.clone()));
    return oracle(mm);
  }]]));
  m.pokes = [{ addr: ERA_INDEX, val: ERA_WITH_SWEEP, frame: POKE_FROM_FRAME, dur: null }];
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `capture run stopped early: ${m.stoppedBy}`);
  raw = entries;
  return raw;
}

function craft(base, { marker, era = ERA_WITH_SWEEP, cd = 0, count = 1 }) {
  const m = base.clone();
  m.mem8[ERA_INDEX] = era;
  m.mem8[(m.regs.ix + MARKER) & 0xffff] = marker;
  m.mem8[(m.regs.ix + COUNTDOWN) & 0xffff] = cd;
  m.regs.b = count;
  return m;
}

const ARM_SHAPES = {
  free: { marker: FREE },
  drifting: { marker: 0x20 },
  final: { marker: FULL, era: FINAL_ERA, cd: 3 },
  live: { marker: FULL, cd: 3 },
  chased: { marker: FULL, cd: 0 },
};

function armEntries(arm, count) {
  return captured().slice(0, CRAFT_BASES).map((e) => craft(e, { ...ARM_SHAPES[arm], count }));
}

function armOf(m) {
  const marker = m.mem8[(m.regs.ix + MARKER) & 0xffff];
  if (marker === FREE) return "free";
  if (marker !== FULL) return "drifting";
  if (m.mem8[ERA_INDEX] === FINAL_ERA) return "final";
  return m.mem8[(m.regs.ix + COUNTDOWN) & 0xffff] !== 0 ? "live" : "chased";
}

// ── comparison ────────────────────────────────────────────────────────────────────────────

/**
 * Oracle vs seamed candidate on independent clones, both on the live registry. The oracle threads
 * return slots through the stack and the rewrite does not, so [floor, seat) is masked, floor being
 * the deepest either side pushed.
 */
function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  a.routines = LIVE;
  b.routines = LIVE;
  const seat = a.regs.sp;
  let floor = seat;
  const pushA = a.push16.bind(a);
  a.push16 = (v) => { pushA(v); if (a.regs.sp < floor) floor = a.regs.sp; };
  const pushB = b.push16.bind(b);
  b.push16 = (v) => { pushB(v); if (b.regs.sp < floor) floor = b.regs.sp; };
  oracle(a);
  try {
    seamed(cand)(b);
  } catch (e) {
    return { escaped: { addr: null, note: String(e).slice(0, 80) }, floor, seat };
  }
  let escaped = null;
  if (a.regs.sp !== b.regs.sp) escaped = { addr: null, reg: "sp", a: a.regs.sp, b: b.regs.sp };
  else if (a.pc !== b.pc) escaped = { addr: null, reg: "pc", a: a.pc, b: b.pc };
  if (!escaped) {
    const da = a.dumpState();
    const db = b.dumpState();
    for (let i = 0; i < da.length && escaped === null; i++) {
      if (da[i] === db[i]) continue;
      const addr = a.stateOffsetToAddr(i);
      if (addr >= floor && addr < seat) continue;
      escaped = { addr, a: da[i], b: db[i] };
    }
  }
  if (!escaped) {
    for (const k of REG_FIELDS) {
      if (EXCLUDED.includes(k)) continue;
      if (a.regs[k] !== b.regs[k]) { escaped = { addr: null, reg: k, a: a.regs[k], b: b.regs[k] }; break; }
    }
  }
  return { escaped, floor, seat };
}

const show = (r) => r.escaped && `escaped at ${hex4(r.escaped.addr ?? 0)}: ${JSON.stringify(r.escaped)}`;

/** Bytes the oracle moves in game data from a state — proof an entry is not idle. */
function footprint(machine) {
  const a = machine.clone();
  a.routines = LIVE;
  const before = a.dumpState().slice();
  oracle(a);
  const now = a.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) {
    if (now[i] !== before[i] && a.stateOffsetToAddr(i) <= DATA_TOP) n++;
  }
  return n;
}

function movedOver(cand, entries) {
  const moved = new Set();
  for (const m of entries) {
    const a = m.clone();
    const b = m.clone();
    a.routines = LIVE;
    b.routines = LIVE;
    oracle(a);
    try { seamed(cand)(b); } catch { continue; }
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

// ── the twins ─────────────────────────────────────────────────────────────────────────────

const markerAt = (m) => m.mem8[(m.regs.ix + MARKER) & 0xffff];

/** BUG: a free slot is stepped as a drifting object instead of passed over. */
function freeNotSkipped(m) {
  if (markerAt(m) !== FULL) {
    stepDriftingCountdownObjectByEraFrames(m);
    return closeOneTurnOfTheSlotSweep(m);
  }
  return candidate(m);
}
/** BUG: tests bit 7 for "full", so a high non-full marker is chased instead of drifted. */
function fullAsBitSeven(m) {
  const marker = markerAt(m);
  if (marker !== FREE && marker & 0x80 && marker !== FULL) {
    chaseOneAimPointAndRetireAtTheLine(m);
    return closeOneTurnOfTheSlotSweep(m);
  }
  return candidate(m);
}
/** BUG: a drifting object is passed over without being stepped. */
function driftNotStepped(m) {
  if (markerAt(m) !== FREE && markerAt(m) !== FULL) return closeOneTurnOfTheSlotSweep(m);
  return candidate(m);
}
/** BUG: the final-era test is skipped, so the final era takes the countdown arms. */
function eraIgnored(m) {
  if (markerAt(m) === FULL && m.mem8[ERA_INDEX] === FINAL_ERA) {
    return m.mem8[(m.regs.ix + COUNTDOWN) & 0xffff] !== 0
      ? flyLiveSlotAndTickCountdown(m)
      : (chaseOneAimPointAndRetireAtTheLine(m), closeOneTurnOfTheSlotSweep(m));
  }
  return candidate(m);
}
/** BUG: the countdown is read one byte short. */
function countdownOffByOne(m) {
  if (markerAt(m) === FULL && m.mem8[ERA_INDEX] !== FINAL_ERA) {
    if (m.mem8[(m.regs.ix + COUNTDOWN - 1) & 0xffff] !== 0) return flyLiveSlotAndTickCountdown(m);
    chaseOneAimPointAndRetireAtTheLine(m);
    return closeOneTurnOfTheSlotSweep(m);
  }
  return candidate(m);
}
/** BUG: a spent countdown closes the turn without the chase frame. */
function chaseSkipped(m) {
  if (markerAt(m) === FULL && m.mem8[ERA_INDEX] !== FINAL_ERA &&
      m.mem8[(m.regs.ix + COUNTDOWN) & 0xffff] === 0) return closeOneTurnOfTheSlotSweep(m);
  return candidate(m);
}
/** BUG: the free-slot arm never closes the turn, so the sweep stops there. */
function freeEndsSweep(m) {
  if (markerAt(m) === FREE) return undefined;
  return candidate(m);
}
/** The control for the excluded set: scribbles a register the routine leaves alone. */
function movesSpareCounter(m) {
  const r = candidate(m);
  m.regs.c = (m.regs.c + 1) & 0xff;
  return r;
}

const TWINS = [
  ["no-op", () => {}, ["free", "drifting", "final", "live", "chased"]],
  ["free-not-skipped", freeNotSkipped, ["free"]],
  ["full-as-bit-seven", fullAsBitSeven, ["drift-high"]],
  ["drift-not-stepped", driftNotStepped, ["drifting"]],
  ["era-ignored", eraIgnored, ["final"]],
  ["countdown-off-by-one", countdownOffByOne, ["live-shadowed", "chased-shadowed"]],
  ["chase-skipped", chaseSkipped, ["chased"]],
  ["free-ends-sweep", freeEndsSweep, ["free-loop"]],
];

function twinEntries(which) {
  if (which === "drift-high") return captured().slice(0, CRAFT_BASES).map((e) => craft(e, { marker: 0x80 }));
  if (which === "free-loop") return armEntries("free", 3);
  // the byte one short of the countdown is set to the opposite sense, so reading it picks the other arm
  if (which.endsWith("-shadowed")) {
    const arm = which.replace("-shadowed", "");
    return armEntries(arm, 1).map((m) => {
      m.mem8[(m.regs.ix + COUNTDOWN - 1) & 0xffff] = arm === "live" ? 0 : 5;
      return m;
    });
  }
  return armEntries(which, 1);
}

// ── the gate ──────────────────────────────────────────────────────────────────────────────

test("REACHABILITY: tape dispatch counts, with the sweep entry as the control", { skip }, () => {
  for (const [label, opts] of [["coin-start", {}], ["undriven", { tape: [] }]]) {
    const seen = { [TARGET]: 0, [SWEEP_ENTRY]: 0 };
    const m = makeMachine(new Map([
      [TARGET, (mm) => { seen[TARGET]++; return oracle(mm); }],
      [SWEEP_ENTRY, (mm) => { seen[SWEEP_ENTRY]++; return sweepEntry(mm); }],
    ]), opts);
    m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the ${label} run stopped early: ${m.stoppedBy}`);
    // ★ A zero is a finding only while the same tap counts the sweep's own entry.
    assert.ok(seen[SWEEP_ENTRY] > 0, `${label}: the tap counted nothing for the sweep entry either`);
    console.log(`  REACHABILITY/${label}: ${hex4(TARGET)} ${seen[TARGET]}, ` +
      `${hex4(SWEEP_ENTRY)} ${seen[SWEEP_ENTRY]}`);
  }
  assert.ok(captured().length > 0, "the era-poked run never dispatched the sweep body");
});

test("CORPUS: every captured dispatch is identical, and some are not idle", { skip }, () => {
  const tally = {};
  let footprints = 0;
  for (const m of captured()) {
    const r = compare(candidate, m);
    assert.equal(r.escaped, null, show(r));
    assert.ok(r.floor > DATA_TOP, `the stack window ${hex4(r.floor)} reached into game data`);
    tally[armOf(m)] = (tally[armOf(m)] ?? 0) + 1;
    if (footprint(m) > 0) footprints++;
  }
  assert.ok(footprints > 0, "vacuous: the oracle writes nothing on any captured dispatch");
  console.log(`  CORPUS: ${captured().length} dispatches identical, ${footprints} with a footprint; ` +
    `arms ${JSON.stringify(tally)}`);
});

for (const arm of Object.keys(ARM_SHAPES)) {
  for (const count of [1, 3]) {
    test(`ARM ${arm}, turn count ${count}: crafted entries identical`, { skip }, () => {
      const entries = armEntries(arm, count);
      assert.ok(entries.length > 0, "no base to craft from");
      for (const m of entries) {
        assert.equal(armOf(m), arm, "the craft did not land in its arm");
        const r = compare(candidate, m);
        assert.equal(r.escaped, null, show(r));
        assert.ok(r.floor > DATA_TOP, `the stack window ${hex4(r.floor)} reached into game data`);
      }
      console.log(`  ARM ${arm}/${count}: ${entries.length} identical`);
    });
  }
}

test("DRIFTING MARKERS: every non-full marker across the drifting thresholds", { skip }, () => {
  let n = 0;
  for (const e of captured().slice(0, 8)) {
    for (const marker of DRIFT_MARKERS) {
      for (const era of [ERA_WITH_SWEEP, FINAL_ERA]) {
        const r = compare(candidate, craft(e, { marker, era, count: 1 }));
        assert.equal(r.escaped, null, `marker ${hex4(marker)} era ${era}: ${show(r)}`);
        n++;
      }
    }
  }
  console.log(`  DRIFTING MARKERS: ${n} identical`);
});

test("EXCLUDED: nothing outside A/F diverges, and the check can see one", { skip }, () => {
  const entries = [...captured(), ...Object.keys(ARM_SHAPES).flatMap((a) => armEntries(a, 1))];
  const moved = movedOver(candidate, entries);
  const control = movedOver(movesSpareCounter, entries);
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !EXCLUDED.includes(k)),
    "even a twin that scribbles C moves nothing, so the reading below proves nothing");
  // A CEILING, not a demand: a rewrite exact on A/F as well still passes.
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k) && !EXCLUDED.includes(k)), [],
    "a register outside the dead A/F diverged");
  console.log(`  EXCLUDED: moves ${[...moved].sort().join(",") || "nothing"}; ceiling ${EXCLUDED.join(",")}`);
});

for (const [label, twin, targets] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT on every entry of the arm it breaks`, { skip }, () => {
    let caught = 0;
    let total = 0;
    for (const which of targets) {
      for (const m of twinEntries(which)) {
        total++;
        if (compare(twin, m).escaped) caught++;
      }
    }
    console.log(`  TEETH/${label}: caught on ${caught}/${total}`);
    assert.ok(total > 0, "no entries to bite on");
    assert.equal(caught, total, `the ${label} twin escaped an entry`);
  });
}
