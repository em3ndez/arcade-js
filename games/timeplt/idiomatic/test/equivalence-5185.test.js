// SPDX-License-Identifier: GPL-3.0-only
/**
 * destroyPlayerAndObjectsTouchingIt — memory-equivalent to the frozen oracle at ROM 0x5185.
 *
 * ★ THE REAL DISPATCHES ARE VACUOUS ON RAM AND THIS GATE MEASURES IT. Every dispatch the tape
 *   produces either finds the mover already spent or finds no live target in the list, so nothing
 *   is written and a do-nothing candidate is byte-identical at each. The arm below asserts exactly
 *   that; the destroying path is reached only by crafting, and the per-twin counts say which twins
 *   depend on it.
 *
 * GATE: strict unit-capture on the coin-and-start tape, every captured dispatch replayed, a
 *   crafted cross that puts the mover and a live target inside and outside the window on both
 *   axes, a whole-machine replay, and teeth.
 *   1. EQUAL at the real dispatch — the whole dump identical, stack scratch included, because this
 *      routine calls nothing and pushes nothing.
 *   2. VACUITY, MEASURED — a no-op passes at every real dispatch, and the crafted arm that catches
 *      it is named.
 *   3. EXCLUDED, deliberately, pinned to an exact set — the two CURSORS are not in it. Callers
 *      of this address go straight on to another sweep without reloading either, so both are
 *      live-outs and both are compared on every arm.
 *   4. CORPUS — every dispatch the tape produces, with the list bases and lengths it presented.
 *   5. CRAFTED CROSS — the mover live or spent, one target live or not, and its two coordinates
 *      swept across the window edge on each axis, over three list lengths.
 *   6. THE SWEEP DOES NOT STOP AT THE FIRST HIT — two live targets are put inside the window and
 *      both are asserted to be marked, which is what separates this from a first-match search.
 *   7. THE WINDOW EDGE IS EXACT — the coordinate at which a target stops being reached is swept and
 *      the boundary asserted, on both axes.
 *   8. WHOLE-MACHINE — the session replayed with the rewrite wired through a measured shim.
 *   9. TEETH — nine twins, each caught on an exact declared count.
 *
 * HOLE: the occupancy cursor steps its LOW half only, so a list long enough to wrap inside its page
 *   would revisit its own start. No list the tape presents is anywhere near that long and the
 *   crafted cross does not build one, so that wrap is exercised NOWHERE here — the twin that steps
 *   the cursor whole is declared with a catch count of zero, which is the honest reading of it.
 *
 * HOLE: the target count is the caller's B and the hardware loop tests it at the BOTTOM, so a
 *   count of zero walks 256 targets rather than none. Every dispatch the tape presents hands in
 *   the same count and it is not zero, the crafted cross builds no list of zero length, and no
 *   twin varies the count — so that path is exercised NOWHERE here and nothing has teeth on it.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-5185.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { destroyPlayerAndObjectsTouchingIt } from "../destroyPlayerAndObjectsTouchingIt.js";
import { loc_5185 as oracle } from "../../translated/loc_5185.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { PLAYER_STATE } from "../names.js";

const TARGET = 0x5185;

const OCCUPANCY_STRIDE = 0x10;
const ENTRY_STRIDE = 2;
const ENTRY_FIRST_AXIS = 0;
const ENTRY_SECOND_AXIS = 0x31;
const MOVER_FIRST_AXIS = 0xaa10;
const MOVER_SECOND_AXIS = 0xaa41;
const LIVE = 0xff;
const DESTROYED = 0xf0;

/** Unused work RAM the crafted list is built in, so no real slot is disturbed. */
const CRAFT_OCCUPANCY = 0xae00;
const CRAFT_ENTRY = 0xae90;

const MOVED = ["a", "f", "b", "sp"];
const FRAMES = 1400;
const RET_TSTATES = 10;

/** Measured over the corpus below; a move is a finding. */
const DISPATCHES = 152;

const MOVER_STATES = [LIVE, DESTROYED, 0x00];
const TARGET_STATES = [LIVE, 0x00];
/** Offsets chosen so the tested distance lands on 0, on both sides of the window edge,
 *  and well outside it, on each axis. */
const OFFSETS = [0, 1, 5, 6, 10, 11, 250, 251, 255];
const LENGTHS = [1, 2, 4];
const SWEEP_SIZE =
  MOVER_STATES.length * TARGET_STATES.length * OFFSETS.length * OFFSETS.length * LENGTHS.length;

const SLACK = 5;
const REACH = 11;

const skip = romsPresent() ? false : "ROM images are not assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

const factory = (overrides) => makeMachine(overrides);

// ── the entry ───────────────────────────────────────────────────────────────────────────

let entry = null;

function gate(candidate) {
  return unitEquivalence(factory, TARGET, oracle, (m) => {
    if (entry === null) entry = m.clone();
    return candidate(m);
  }, { maxFrames: ENTRY_FRAMES });
}

function entryState() {
  if (entry === null) gate(destroyPlayerAndObjectsTouchingIt);
  return entry;
}

/** RAM first, then the two cursors, which callers of this address go on to use. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return ram;
  if (a.regs.e !== b.regs.e) return { addr: null, a: a.regs.e, b: b.regs.e };
  if (a.regs.iy !== b.regs.iy) return { addr: null, a: a.regs.iy, b: b.regs.iy };
  return null;
}

const caught = (candidate, machine) => unitDiff(candidate, machine) !== null;
const shapeOf = (m) => `${hex4(m.regs.de)}/${hex4(m.regs.iy)}/${m.regs.b}/${hex4(m.regs.hl)}`;

// ── the corpus ──────────────────────────────────────────────────────────────────────────

let corpus = null;
function captureCorpus() {
  if (corpus) return corpus;
  const entries = [];
  const shapes = new Set();
  let noOpSeen = 0;
  const m = factory(new Map([[TARGET, (mm) => {
    entries.push(mm.clone());
    shapes.add(shapeOf(mm));
    if (ramDiff(() => {}, mm) !== null) noOpSeen++;
    return oracle(mm);
  }]]));
  const frames = m.runFrames(FRAMES);
  assert.equal(m.stoppedBy, null, `corpus run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, FRAMES, "corpus run ran short");
  corpus = { entries, shapes, noOpSeen };
  return corpus;
}

/**
 * A real captured machine with a whole list of targets built in unused work RAM: the mover's
 * flag and coordinates, one live target placed by an offset on each axis, and the rest cleared.
 */
function craft(moverState, targetState, acrossOffset, alongOffset, length) {
  const m = entryState().clone();
  m.regs.de = CRAFT_OCCUPANCY;
  m.regs.iy = CRAFT_ENTRY;
  m.regs.l = SLACK;
  m.regs.h = REACH;
  m.regs.b = length;

  m.mem8[PLAYER_STATE] = moverState;
  m.mem8[MOVER_FIRST_AXIS] = 0x80;
  m.mem8[MOVER_SECOND_AXIS] = 0x60;
  for (let i = 0; i < length; i++) {
    m.mem8[CRAFT_OCCUPANCY + OCCUPANCY_STRIDE * i] = i === 0 ? targetState : 0;
    m.mem8[CRAFT_ENTRY + ENTRY_STRIDE * i + ENTRY_FIRST_AXIS] = 0x80 + acrossOffset;
    m.mem8[CRAFT_ENTRY + ENTRY_STRIDE * i + ENTRY_SECOND_AXIS] = 0x60 + alongOffset;
  }
  return m;
}

function sweepCaught(candidate) {
  let n = 0;
  for (const mover of MOVER_STATES) {
    for (const target of TARGET_STATES) {
      for (const across of OFFSETS) {
        for (const along of OFFSETS) {
          for (const length of LENGTHS) {
            if (caught(candidate, craft(mover, target, across, along, length))) n++;
          }
        }
      }
    }
  }
  return n;
}

// ── the shim, measured rather than asserted ─────────────────────────────────────────────

function hosted(candidate) {
  return (mm) => {
    const probe = mm.clone();
    const before = probe.cycles;
    oracle(probe);
    const total = probe.cycles - before;
    candidate(mm);
    mm.tick(total - RET_TSTATES);
    mm.ret(RET_TSTATES);
  };
}

const replay = (candidate) =>
  wholeMachineEquivalence(factory, FRAMES, new Map([[TARGET, hosted(candidate)]]));

// ── the twins ───────────────────────────────────────────────────────────────────────────

/**
 * The correct sweep, with one knob per twin, so each twin breaks ONE behaviour and not the cursor
 * bookkeeping. The cursors are written back exactly as the real rewrite does, and only the arm
 * that deliberately breaks them leaves them wrong.
 */
function sweep(m, { stopAtFirst = false, skipMoverTest = false, oneAxis = false, edge = 0,
  moverSurvives = false, wholeCursor = false } = {}) {
  const { mem8 } = m;
  if (!skipMoverTest && mem8[PLAYER_STATE] !== LIVE) return;
  let at = m.regs.de;
  let of = m.regs.iy;
  let left = m.regs.b === 0 ? 256 : m.regs.b;
  while (left-- > 0) {
    if (mem8[at] === LIVE) {
      const across = (mem8[MOVER_FIRST_AXIS] - mem8[of + ENTRY_FIRST_AXIS] + m.regs.l) & 0xff;
      const along = (mem8[MOVER_SECOND_AXIS] - mem8[of + ENTRY_SECOND_AXIS] + m.regs.l) & 0xff;
      const reach = m.regs.h + edge;
      if (across < reach && (oneAxis || along < reach)) {
        if (!moverSurvives) mem8[PLAYER_STATE] = DESTROYED;
        mem8[at] = DESTROYED;
        if (stopAtFirst) break;
      }
    }
    at = wholeCursor ? at + OCCUPANCY_STRIDE : (at & 0xff00) | ((at + OCCUPANCY_STRIDE) & 0xff);
    of = (of + ENTRY_STRIDE) & 0xffff;
  }
  m.regs.e = at;
  m.regs.iy = of;
}

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: sweeps even when the mover is already spent, so one shot takes a second target. */
function brokenIgnoresMoverFlag(m) {
  sweep(m, { skipMoverTest: true });
}

/** BUG: stops at the first target reached, so a shot cannot take two in one pass. */
function brokenStopsAtFirst(m) {
  sweep(m, { stopAtFirst: true });
}

/** BUG: only one axis is tested, so anything in the same column is destroyed. */
function brokenOneAxis(m) {
  sweep(m, { oneAxis: true });
}

/** BUG: the window is one unit wider, which is the smallest wrong reach there is. */
function brokenWindowTooWide(m) {
  sweep(m, { edge: 1 });
}

/** BUG: the window is one unit narrower. */
function brokenWindowTooNarrow(m) {
  sweep(m, { edge: -1 });
}

/** BUG: the target is marked and the mover is left live, so one shot never runs out. */
function brokenMoverSurvives(m) {
  sweep(m, { moverSurvives: true });
}

/** BUG: the occupancy cursor steps whole rather than by its low half alone. */
function brokenWholeCursor(m) {
  sweep(m, { wholeCursor: true });
}

/** BUG: sweeps correctly and hands the cursors back where they started. */
function brokenCursorsNotReturned(m) {
  const e = m.regs.e;
  const iy = m.regs.iy;
  sweep(m);
  m.regs.e = e;
  m.regs.iy = iy;
}

/** Per twin: exact catch count over the crafted cross, and its verdict at the real dispatch. */
const TWINS = [
  ["no-op", brokenNoOp, 486, true],
  ["ignores-mover-flag", brokenIgnoresMoverFlag, 972, false],
  ["stops-at-first", brokenStopsAtFirst, 75, false],
  ["one-axis", brokenOneAxis, 60, false],
  ["window-too-wide", brokenWindowTooWide, 33, false],
  ["window-too-narrow", brokenWindowTooNarrow, 27, false],
  ["mover-survives", brokenMoverSurvives, 75, false],
  ["whole-cursor", brokenWholeCursor, 0, false],
  ["cursors-not-returned", brokenCursorsNotReturned, 486, true],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: destroyPlayerAndObjectsTouchingIt == oracle on the whole dump", { skip }, () => {
  const r = gate(destroyPlayerAndObjectsTouchingIt);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  console.log(`  EQUAL: entry list/entries/count/window ${shapeOf(entryState())}; identical`);
});

function ramDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

test("VACUITY, MEASURED: RAM sees nothing at any real dispatch", { skip }, () => {
  const { entries, noOpSeen } = captureCorpus();
  assert.equal(
    noOpSeen,
    0,
    "a real dispatch caught a do-nothing candidate, so the destroying path IS reached in play and " +
      "the framing of this file has to be re-derived",
  );
  assert.notEqual(
    ramDiff(brokenNoOp, craft(LIVE, LIVE, 0, 0, 1)),
    null,
    "the crafted arm must catch on RAM what the real dispatches cannot",
  );
  console.log(`  VACUITY: RAM sees a no-op at 0 of ${entries.length} real dispatches; crafted does`);
});

test("EXCLUDED, deliberately: scratch registers and pc, but NOT the two cursors", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  destroyPlayerAndObjectsTouchingIt(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    MOVED,
    "the excluded set changed shape: both cursors are live-outs and must agree on the two arms",
  );
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${MOVED.join(", ")} and pc — the two cursors are live-outs`);
});

test("THE CURSORS ARE LIVE-OUTS, and the spent path leaves them alone", { skip }, () => {
  const swept = craft(LIVE, 0x00, 0, 0, 4);
  const before = { e: swept.regs.e, iy: swept.regs.iy };
  destroyPlayerAndObjectsTouchingIt(swept);
  assert.notEqual(swept.regs.e, before.e, "a sweep must leave the occupancy cursor further on");
  assert.notEqual(swept.regs.iy, before.iy, "and the coordinate cursor with it");

  const spent = craft(DESTROYED, LIVE, 0, 0, 4);
  const held = { e: spent.regs.e, iy: spent.regs.iy };
  destroyPlayerAndObjectsTouchingIt(spent);
  assert.equal(spent.regs.e, held.e, "a spent mover must leave the occupancy cursor untouched");
  assert.equal(spent.regs.iy, held.iy, "and the coordinate cursor too");
  console.log(`  LIVE-OUT: swept ${hex4(swept.regs.e)}/${hex4(swept.regs.iy)}; spent unchanged`);
});

test("CORPUS: every captured dispatch replays identically", { skip }, () => {
  const { entries, shapes } = captureCorpus();
  assert.equal(entries.length, DISPATCHES, "the dispatch count moved");
  for (const captured of entries) {
    assert.equal(unitDiff(destroyPlayerAndObjectsTouchingIt, captured), null, "a captured dispatch diverged");
  }
  console.log(`  CORPUS: ${entries.length} dispatches over ${shapes.size} distinct entry shapes`);
});

test("CRAFTED: every mover, target, offset and length combination is identical", { skip }, () => {
  for (const mover of MOVER_STATES) {
    for (const target of TARGET_STATES) {
      for (const across of OFFSETS) {
        for (const along of OFFSETS) {
          for (const length of LENGTHS) {
            const m = craft(mover, target, across, along, length);
            const d = unitDiff(destroyPlayerAndObjectsTouchingIt, m);
            assert.equal(d, null, `${mover}/${target}/${across}/${along}/${length}: ${show(d)}`);
          }
        }
      }
    }
  }
  console.log(`  CRAFTED: ${SWEEP_SIZE} combinations identical`);
});

test("THE SWEEP DOES NOT STOP AT THE FIRST HIT", { skip }, () => {
  const m = craft(LIVE, LIVE, 0, 0, 3);
  for (let i = 0; i < 3; i++) m.mem8[CRAFT_OCCUPANCY + OCCUPANCY_STRIDE * i] = LIVE;
  destroyPlayerAndObjectsTouchingIt(m);
  const marked = [0, 1, 2].filter((i) => m.mem8[CRAFT_OCCUPANCY + OCCUPANCY_STRIDE * i] === DESTROYED);
  assert.deepEqual(marked, [0, 1, 2], "the sweep stopped before the end of the list");
  assert.equal(m.mem8[PLAYER_STATE], DESTROYED, "and the mover must be spent");
  console.log(`  NO EARLY EXIT: all ${marked.length} live targets in the window are marked`);
});

test("THE WINDOW EDGE IS EXACT, on both axes", { skip }, () => {
  const reached = (across, along) => {
    const m = craft(LIVE, LIVE, across, along, 1);
    destroyPlayerAndObjectsTouchingIt(m);
    return m.mem8[CRAFT_OCCUPANCY] === DESTROYED;
  };
  const acrossReach = [];
  for (let d = 0; d < 256; d++) if (reached(d, 0)) acrossReach.push(d);
  const alongReach = [];
  for (let d = 0; d < 256; d++) if (reached(0, d)) alongReach.push(d);
  const band = [251, 252, 253, 254, 255, 0, 1, 2, 3, 4, 5];
  assert.deepEqual(acrossReach.sort((x, y) => x - y), band.slice().sort((x, y) => x - y),
    "the reachable band on the first axis moved");
  assert.deepEqual(alongReach.sort((x, y) => x - y), band.slice().sort((x, y) => x - y),
    "the reachable band on the second axis moved");
  console.log(`  EDGE: ${acrossReach.length} offsets reachable on each axis, a wrapped band`);
});

test("WHOLE-MACHINE: the session is byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(destroyPlayerAndObjectsTouchingIt);
  assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the override never dispatched");
  assert.equal(w.framesCompared, FRAMES, "the replay ran short");
  assert.equal(w.equal, true, `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  console.log(`  WHOLE-MACHINE: ${w.framesCompared} frames, ${w.invocations.get(TARGET)} dispatches`);
});

test("TEETH: removing the shim's return kills the run, so the shim is load-bearing", { skip }, () => {
  let died = null;
  try {
    const w = wholeMachineEquivalence(factory, FRAMES, new Map([[TARGET, destroyPlayerAndObjectsTouchingIt]]));
    died = w.equal ? null : "forked";
  } catch (e) {
    died = String(e).slice(0, 80);
  }
  assert.notEqual(died, null, "the unshimmed rewrite ran clean, so the shim proves nothing");
  console.log(`  TEETH/shim: the unshimmed rewrite dies — ${died}`);
});

for (const [label, twin, swept, seenAtDispatch] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    assert.equal(sweepCaught(twin), swept, `the ${label} twin's crafted catch count moved`);
    console.log(`  TEETH/${label}: caught on ${swept} of ${SWEEP_SIZE} crafted entries`);
  });

  test(`TEETH: the ${label} twin at the real dispatch, hole pinned`, { skip }, () => {
    const seen = caught(twin, entryState());
    assert.equal(seen, seenAtDispatch, `the real dispatch's view of the ${label} twin moved`);
    console.log(`  TEETH/${label}: real dispatch ${seen ? "catches it" : "is BLIND, as recorded"}`);
  });
}
