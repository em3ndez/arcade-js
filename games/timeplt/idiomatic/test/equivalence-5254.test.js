// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_5254 — memory-equivalent to the frozen oracle at ROM 0x5254.
 *
 * WHAT IT IS. The tail of the shot-versus-target sweep at ROM 0x5211: restage the two target
 * cursors from the cells that hold them, take the per-pass target count out of the shadow
 * accumulator, step the shot cursor one record on without leaving its page, and go round again
 * for every shot still owed a pass. With none left it returns. The loop back is a `jp` to ROM
 * 0x5211, WHICH IS ALREADY DECOMPILED, so the rewrite calls destroyTargetsHitByShots directly with
 * the five values it computed as arguments; dissolving that transfer belongs to this caller's unit.
 *
 * ★ THIS ADDRESS IS NOT A DISPATCH ENTRY, AND EVERY ARM HERE IS SHAPED BY THAT. The little-endian
 *   word for it occurs nowhere in the 24KB image, so no table can name it, and the only ways in
 *   are a `jr nz` and a `djnz` exit interior to ROM 0x5211. The override map therefore never
 *   reaches it: the NOT AN ENTRY arm wires an override at this address and watches it fire zero
 *   times while a program-counter tap at the SAME address inside the enclosing dispatch counts
 *   thousands of arrivals in the same run, which is what makes that zero a fact about the image
 *   rather than about the rig. Those tapped arrivals are the entry corpus — real states from real
 *   dispatches, captured at the instant control lands on this address, not constructed.
 *
 * ★ THE ORACLE PUSHES AND RETURNS, AND THE REWRITE DOES NEITHER. Reaching ROM 0x5211 through
 *   `m.call` runs its body, which pushes a return address around the score post and takes the
 *   return the direct call never takes. That leaves DEAD STACK SCRATCH below the entry seat. The
 *   window is MEASURED — the WINDOW arm instruments the oracle's own `push16` over this file's
 *   whole corpus and crafted space and reports the deepest stack pointer reached — never assumed,
 *   and never copied from another gate. The BOUNDARY arm then shows the mask is exactly as wide as
 *   it declares. Every other arm walks the whole dump and masks ONLY that window.
 *
 * ★ THE LIVE-OUT IS DERIVED FROM THE ORACLE'S EXIT SUCCESSORS, NOT FROM THE REWRITE. Both of this
 *   entry's exits end in the same place: one is its own `ret`, the other loops through ROM 0x5211
 *   which comes back here and eventually takes that same `ret`. So its successor set IS the
 *   successor set of ROM 0x5211, and that is what the LIVE-OUT arm instruments — every register
 *   but the stack pointer forced hostile at the point the enclosing dispatch returns, across a
 *   whole session, with the machine bit-identical. Reading the four call sites agrees: the two
 *   that call rather than tail-jump reload the accumulator out of memory before using it. The
 *   positive control in the same arm nudges a cell the sweep reloads from and forks the run.
 *
 * ★ RAM ALONE PASSES ALMOST EVERYTHING ON A REAL DISPATCH, AND THAT IS THE HEADLINE. This entry
 *   writes no cell of its own; every byte it is responsible for is written by the sweep it hands
 *   to, and the sweep writes only when a shot actually destroys something. Most arrivals destroy
 *   nothing, so most comparisons are vacuous — measured, not argued: the ACTING arm counts how
 *   many arrivals of each session move a byte at all, and the driven tape's answer is zero,
 *   because that tape never presses fire. The teeth therefore rest on the undriven attract demo,
 *   which does fire, and on a CRAFTED space that stocks the shot slots and the target run so each
 *   shot matches one target and a wrong cursor, count or stride destroys the wrong slots.
 *
 * GATE: captured-interior replay over two real sessions, a stocked crafted space, and a SPLICED
 *   whole-machine run. What it exercises, holes stated:
 *
 *   1. NOT AN ENTRY — the image scan and the dispatch/tap A/B that makes the zero mean something.
 *   2. ACTING — how many arrivals of each session move a byte, so no later arm can be read as
 *      stronger than the states it ran on.
 *   3. WINDOW — the oracle's own deepest push, measured over everything this file compares and
 *      PINNED, so a change that deepens its stack traffic turns this gate red instead of being
 *      absorbed by a wider mask.
 *   4. BOUNDARY — the exclusion is exactly as wide as it declares: a planted divergence one byte
 *      BELOW the window is caught, one AT the seat is caught, and one INSIDE is masked. The last
 *      is what shows the first two are not the instrument catching everything.
 *   5. CORPUS — every captured arrival of both sessions, not a deduplicated sample.
 *   6. CRAFTED — a stocked space where kills really happen, including the page-wrap of the shot
 *      cursor, the count of zero, and both box shapes.
 *   7. EXCLUDED — a CEILING: no register outside the declared set moves, with an in-arm control
 *      showing the measurement can see one that does.
 *   8. SEAT — the rewrite leaves the stack pointer where it found it, which is the shape the
 *      dispatch seam measures.
 *   9. LIVE-OUT — the hostile-register instrument at the enclosing routine's own exit, with its
 *      positive control.
 *  10. SPLICED WHOLE-MACHINE — the enclosing dispatch run to its FIRST arrival here and then handed
 *      to the rewrite for the rest, in a live session diffed every frame. What differs must lie
 *      inside the game's own declared dead-stack window, and the control shows the comparison can
 *      see something outside it.
 *  11. DISSOLVES, NOT RESTATES — the module's text: it must name the sweep's file and call it
 *      rather than carry the sweep's own body, with an inlined variant as the positive control.
 *  12. TEETH — eleven twins at eleven distinct behaviours plus a no-bug CONTROL built from the same
 *      skeleton, so a twin's catches are attributable to its own bug and not to the skeleton. Each
 *      carries its crafted count, its per-session count and its spliced verdict; the three the
 *      whole run cannot see say so.
 *
 * HOLE: the crafted space is seeded from three real arrivals and varies the counts, the cursors,
 * the box and the shot base. It does not vary where the target run lives in memory beyond two
 * pokes at the cursor cells, and nothing here speaks for a target run on another page.
 * HOLE: no session here presents a shot base whose low byte is near the page end. The page-wrap of
 * the shot cursor is reached only by crafting, and the twin that carries it says so.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-5254.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { makeMachine, romsPresent } from "./_harness.js";
import { buildRoutines } from "../../routines.js";
import { loc_5254 } from "../loc_5254.js";
import { destroyTargetsHitByShots } from "../destroyTargetsHitByShots.js";
import { loc_5254 as oracle } from "../../translated/loc_5254.js";
import { loc_5211 as enclosing } from "../../translated/loc_5211.js";
import manifest from "../../manifest.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u8, u16 } from "../../../../core/int.js";

const TARGET = 0x5254;
const ENCLOSING = 0x5211;

/** Measured by the WINDOW arm: the deepest the oracle's own pushes reach below the entry seat. */
const SCRATCH_BYTES = 8;

/** The ceiling on register divergence. Containment is asserted, never equality. */
const EXCLUDED = ["a", "f", "b", "c", "e", "ix", "iy", "sp"];

/** The two cells the pass reloads its cursors from, and the shape of a slot run. */
const ENTRY_CURSOR_CELL = 0xa991;
const RECORD_CURSOR_CELL = 0xa993;
const RECORD_STRIDE = 16;
const ENTRY_SECOND_AXIS = 49;
const SHOT_FIRST_AXIS = 6;
const SHOT_SECOND_AXIS = 4;
const LIVE = 255;

const CORPUS_FRAMES = 2000;
const WHOLE_FRAMES = 2000;
/** Long enough for the attract demo to start firing, which is when the sweep first runs at all. */
const REACH_FRAMES = 1400;
const RET_TSTATES = 10;

/** The game's own declaration of which addresses are dead stack, read rather than restated. */
const [STACK_LOW, STACK_HIGH] = manifest.convergence.stateExclude.stack;

const skip = romsPresent() ? false : "ROM images are not assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => {
  if (!d) return "identical";
  return d.addr === null ? `${d.reg}: ${d.b}` : `${hex4(d.addr)}: oracle=${d.a} candidate=${d.b}`;
};

const PLAIN = buildRoutines();
const nextRecord = (cursor) => (cursor & 0xff00) | u8(cursor + RECORD_STRIDE);
const attractMachine = (overrides) => makeMachine(overrides, { tape: [] });
const drivenMachine = (overrides) => makeMachine(overrides);
const SESSIONS = [["attract", attractMachine], ["driven", drivenMachine]];

/** Arrivals and acting arrivals each session produces. Measured; a move here is a finding. */
const ARRIVALS = { attract: 2634, driven: 3588 };
const ACTING = { attract: 46, driven: 0 };

// ── capturing the interior ──────────────────────────────────────────────────────────────

/**
 * Every state at which control ARRIVES at this address, taken inside real dispatches of the
 * enclosing routine. The snapshot's registry is swapped for the plain one so that running the
 * oracle on it later reaches the frozen sweep rather than re-entering this tap.
 */
function captureSession(factory) {
  const entries = [];
  let arrivals = 0;
  let returning = 0;
  const bases = new Set();
  const counts = new Set();
  const m = factory(
    new Map([[ENCLOSING, (mm) => {
      const step = mm.step.bind(mm);
      mm.step = (addr, cycles) => {
        if (addr === TARGET) {
          arrivals++;
          if (u8(mm.regs.c - 1) === 0) returning++;
          bases.add(mm.regs.ix);
          counts.add(mm.regs.c);
          const snapshot = mm.clone();
          snapshot.routines = PLAIN;
          entries.push(snapshot);
        }
        return step(addr, cycles);
      };
      try {
        return enclosing(mm);
      } finally {
        mm.step = step;
      }
    }]]),
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return { entries, arrivals, returning, bases, counts };
}

let sessionCache = null;
function sessions() {
  if (!sessionCache) {
    sessionCache = SESSIONS.map(([label, factory]) => ({ label, ...captureSession(factory) }));
  }
  return sessionCache;
}

// ── the comparison ──────────────────────────────────────────────────────────────────────

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

/** The masked window, and nothing else: the bytes the oracle's own pushes reach and no others. */
const inScratch = (addr, sp) => addr !== null && addr >= sp - SCRATCH_BYTES && addr < sp;

/**
 * Oracle vs candidate on clones of one machine: the whole dump masked to the measured window. A
 * candidate that raises counts as caught; only the candidate's side is wrapped, because a raise
 * from the oracle is a harness fault and must not be swallowed.
 */
function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, reg: "raised", a: "returned", b: String(e).slice(0, 50) };
  }
  return allDiffs(a, b).find((d) => !inScratch(d.addr, sp)) ?? null;
}

/** Whether the oracle moves any byte at all from this state, outside the masked window. */
function acts(state) {
  const a = state.clone();
  const sp = a.regs.sp;
  oracle(a);
  return allDiffs(a, state).some((d) => !inScratch(d.addr, sp));
}

/** How far below its seat the oracle's own pushes take the stack pointer, on one state. */
function oracleDepth(machine) {
  const c = machine.clone();
  const seat = c.regs.sp;
  let deepest = seat;
  const push = c.push16.bind(c);
  c.push16 = (v) => {
    const r = push(v);
    if (c.regs.sp < deepest) deepest = c.regs.sp;
    return r;
  };
  oracle(c);
  return seat - deepest;
}

// ── the crafted space ───────────────────────────────────────────────────────────────────

/**
 * A real arrival with the target run and the shot slots STOCKED so kills really happen. Aligned
 * puts every shot and every target on one coordinate, so the count decides how many die; the
 * default gives shot number k and target number k the same coordinate and everyone else a
 * different one, so the ORDER decides which die. A few spare targets past the count are stocked
 * too, which is what lets a wrong count show. The three registers the pass reloads are left
 * deliberately disagreeing with the cells they reload from, so a twin that keeps them shows.
 */
function stocked(seed, { shots, targets, spare = 3, gap = 20, first = 40, aligned = false, base } = {}) {
  const m = seed.clone();
  if (base !== undefined) m.regs.ix = base;
  if (shots !== undefined) m.regs.c = shots;
  if (targets !== undefined) m.regs.a_ = targets;
  const runLength = (m.regs.a_ === 0 ? 256 : m.regs.a_) + spare;
  let entryCursor = m.mem16[ENTRY_CURSOR_CELL];
  let recordCursor = m.mem16[RECORD_CURSOR_CELL];
  for (let j = 0; j < runLength; j++) {
    const coord = aligned ? first : u8(first + gap * j);
    m.mem8[recordCursor] = LIVE;
    m.mem8[entryCursor] = coord;
    m.mem8[entryCursor + ENTRY_SECOND_AXIS] = coord;
    entryCursor = u16(entryCursor + 2);
    recordCursor = nextRecord(recordCursor);
  }
  let slot = nextRecord(m.regs.ix);
  for (let k = 0; k < (m.regs.c === 0 ? 256 : m.regs.c); k++) {
    const coord = aligned ? first : u8(first + gap * k);
    m.mem8[slot] = LIVE;
    m.mem8[slot + SHOT_FIRST_AXIS] = coord;
    m.mem8[slot + SHOT_SECOND_AXIS] = coord;
    slot = nextRecord(slot);
  }
  m.regs.iy = u16(m.mem16[ENTRY_CURSOR_CELL] + 6);
  m.regs.de = u16(m.mem16[RECORD_CURSOR_CELL] + 32);
  m.regs.b = u8(m.regs.a_ + 2);
  m.regs.a = u8(m.regs.a_ + 1);
  return m;
}

/** Shot bases whose low byte is near the page end, which is where the dropped carry shows. */
const WRAPPING_BASES = [0xaaf0, 0xaaf8];

let craftedCache = null;
function crafted() {
  if (craftedCache) return craftedCache;
  const attract = sessions()[0];
  const seeds = [attract.entries[0], attract.entries.find(acts), sessions()[1].entries[0]];
  assert.ok(seeds.every(Boolean), "no acting arrival to seed the crafted space from");
  const out = [];
  for (const seed of seeds) {
    for (const shots of [1, 2, 3, 6]) for (const targets of [2, 5, 7]) out.push(stocked(seed, { shots, targets }));
    for (const gap of [8, 20, 40]) out.push(stocked(seed, { shots: 4, targets: 6, gap }));
    out.push(stocked(seed, { shots: 3, targets: 7, first: 100 }));
    for (const shots of [2, 4]) {
      for (const targets of [3, 7]) out.push(stocked(seed, { shots, targets, aligned: true, first: 100 }));
    }
    for (const base of WRAPPING_BASES) {
      out.push(stocked(seed, { shots: 3, targets: 5, base, aligned: true, first: 100 }));
    }
    out.push(stocked(seed, { shots: 0, targets: 2, aligned: true, first: 100 }));
  }
  craftedCache = out;
  return out;
}

const everyState = () => [...sessions().flatMap((s) => s.entries), ...crafted()];
const corpusCaught = (candidate) =>
  sessions().map((s) => s.entries.filter((e) => unitDiff(candidate, e) !== null).length);

// ── the spliced whole-machine run ───────────────────────────────────────────────────────

const STOP = Symbol("spliced");

let baselineRun = null;
function baseline() {
  if (!baselineRun) {
    const base = attractMachine();
    const frames = base.runFrames(WHOLE_FRAMES);
    assert.equal(base.stoppedBy, null, `the baseline stopped early: ${base.stoppedBy}`);
    baselineRun = { frames, offsetToAddr: (o) => base.stateOffsetToAddr(o) };
  }
  return baselineRun;
}

/** Run the attract session with one override on the ENCLOSING routine, and report every cell. */
function sessionAddrs(override) {
  const base = baseline();
  let fired = 0;
  const host = attractMachine(new Map([[ENCLOSING, (mm) => (fired++, override(mm))]]));
  let hostFrames = [];
  let threw = null;
  try {
    hostFrames = host.runFrames(WHOLE_FRAMES);
  } catch (e) {
    threw = String(e).slice(0, 70);
  }
  const addrs = new Set();
  let frame = -1;
  const n = Math.min(base.frames.length, hostFrames.length);
  for (let f = 0; f < n; f++) {
    const x = base.frames[f];
    const y = hostFrames[f];
    for (let o = 0; o < x.length; o++) {
      if (x[o] !== y[o]) {
        addrs.add(base.offsetToAddr(o));
        if (frame < 0) frame = f;
      }
    }
  }
  return { fired, addrs: [...addrs], frame, frames: n, threw, stopped: host.stoppedBy };
}

/**
 * The enclosing dispatch, run under the oracle until control first lands on this address and then
 * handed to the candidate for the whole rest of the sweep. Stopping there is what puts the
 * candidate in a LIVE machine at exactly the state this file's corpus is captured at. The T-states
 * the oracle would have spent are measured off a clone and charged back, so the vblank interrupt
 * lands where it would have; the one return the candidate does not take is supplied at the end.
 */
function spliced(candidate) {
  return (mm) => {
    const probe = mm.clone();
    const before = probe.cycles;
    enclosing(probe);
    const total = probe.cycles - before;
    const start = mm.cycles;
    const step = mm.step.bind(mm);
    let arrived = false;
    mm.step = (addr, cycles) => {
      if (addr === TARGET && !arrived) {
        arrived = true;
        throw STOP;
      }
      return step(addr, cycles);
    };
    try {
      enclosing(mm);
    } catch (e) {
      if (e !== STOP) throw e;
    } finally {
      mm.step = step;
    }
    if (!arrived) throw new Error("the enclosing dispatch never reached this address");
    candidate(mm);
    mm.tick(total - (mm.cycles - start) - RET_TSTATES);
    mm.ret(RET_TSTATES);
  };
}

const outsideStack = (addrs) => addrs.filter((a) => !(a >= STACK_LOW && a < STACK_HIGH));
const replay = (candidate) => sessionAddrs(spliced(candidate));

/** Every register but the stack pointer: moving that one measures the harness, not the contract. */
const HOSTILE = REG_FIELDS.filter((k) => k !== "sp");

// ── the twins ───────────────────────────────────────────────────────────────────────────
// One skeleton, one named bug each. The skeleton with no bug is a CONTROL: it must be clean
// everywhere, which is what makes a twin's catches attributable to its own bug.

function twinWith(bug) {
  return function twin(m) {
    const shot = m.regs.ix;
    const shots = m.regs.c;
    const perPass = m.regs.a_;
    const reach = m.regs.l;
    const span = m.regs.h;
    const left = bug === "one-shot-too-many" ? u8(shots) : u8(shots - 1);
    if (left === 0 && bug !== "runs-with-no-shots-left") return;
    const next = bug === "cursor-carries"
      ? u16(shot + RECORD_STRIDE)
      : bug === "cursor-unmoved"
        ? shot
        : (shot & 0xff00) | u8(shot + RECORD_STRIDE);
    const entryCursor = bug === "keeps-the-entry-cursor"
      ? m.regs.iy
      : m.mem16[bug === "cursors-swapped" ? RECORD_CURSOR_CELL : ENTRY_CURSOR_CELL];
    const recordCursor = bug === "keeps-the-record-cursor"
      ? m.regs.de
      : m.mem16[bug === "cursors-swapped" ? ENTRY_CURSOR_CELL : RECORD_CURSOR_CELL];
    const count = bug === "count-from-the-live-accumulator"
      ? m.regs.a
      : bug === "count-from-b"
        ? m.regs.b
        : perPass;
    const [near, far] = bug === "box-swapped" ? [span, reach] : [reach, span];
    destroyTargetsHitByShots(m, next, entryCursor, recordCursor, count, count, left, near, far);
  };
}

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/**
 * label, twin, its crafted catch count, its per-session catch counts, and whether the spliced run
 * sees it. All measured. Three twins the spliced run cannot see carry a false; the crafted space
 * is what holds those, and the counts say by how much.
 */
const TWINS = [
  ["no-op", brokenNoOp, 60, [46, 0], true],
  ["runs-with-no-shots-left", twinWith("runs-with-no-shots-left"), 9, [0, 0], false],
  ["cursor-carries", twinWith("cursor-carries"), 6, [0, 0], false],
  ["cursor-unmoved", twinWith("cursor-unmoved"), 45, [10, 0], true],
  ["keeps-the-entry-cursor", twinWith("keeps-the-entry-cursor"), 47, [23, 0], true],
  ["keeps-the-record-cursor", twinWith("keeps-the-record-cursor"), 60, [20, 0], true],
  ["cursors-swapped", twinWith("cursors-swapped"), 60, [19, 0], true],
  ["count-from-the-live-accumulator", twinWith("count-from-the-live-accumulator"), 24, [73, 0], true],
  ["count-from-b", twinWith("count-from-b"), 24, [67, 0], true],
  ["box-swapped", twinWith("box-swapped"), 60, [67, 0], true],
  ["one-shot-too-many", twinWith("one-shot-too-many"), 42, [0, 0], false],
];

/**
 * The BOUNDARY arm's probe: the ORACLE ITSELF, plus one byte flipped at `sp + offset`. Built on the
 * oracle rather than on the rewrite so that what the arm reports is a property of the MASK alone.
 */
function scribbler(offset) {
  return (m) => {
    const at = u16(m.regs.sp + offset);
    oracle(m);
    m.mem8[at] ^= 0xff;
  };
}

/**
 * The module's text against the sweep it is supposed to CALL. The sweep is identified by a name out
 * of its own body; the module must name the sweep's file, call it, and NOT carry that name. The
 * positive control is the module with the call replaced by the sweep's own body, which is exactly
 * the mistake the check exists to catch.
 */
const HELPER = ["destroyTargetsHitByShots", "../destroyTargetsHitByShots.js", "postChainedHitScore"];
const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

function callsRatherThanRestates(text, [name, file, ownName]) {
  return text.includes(`from "./${file.slice(3)}"`) && text.includes(`${name}(`) &&
    !text.includes(ownName);
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("NOT AN ENTRY: no table can name it, and no dispatch reaches it", { skip }, () => {
  const image = readFileSync(new URL("../../rom/maincpu.bin", import.meta.url));
  const occurrences = [];
  for (let i = 0; i < image.length - 1; i++) {
    if (image[i] === (TARGET & 0xff) && image[i + 1] === TARGET >> 8) occurrences.push(i);
  }
  let dispatched = 0;
  let tapped = 0;
  const m = makeMachine(
    new Map([
      [TARGET, (mm) => (dispatched++, PLAIN.get(TARGET)(mm))],
      [ENCLOSING, (mm) => {
        const step = mm.step.bind(mm);
        mm.step = (addr, cycles) => (addr === TARGET && tapped++, step(addr, cycles));
        try {
          return enclosing(mm);
        } finally {
          mm.step = step;
        }
      }],
    ]),
    { tape: [] },
  );
  m.runFrames(REACH_FRAMES);
  console.log(
    `  NOT AN ENTRY (measured): the word occurs ${occurrences.length} times in ${image.length} ` +
      `bytes; the override fired ${dispatched} times while the tap counted ${tapped} arrivals`,
  );
  assert.deepEqual(occurrences, [], "the address now appears in the image, so a table may name it " +
    "and the dispatch story this file is built on has to be re-derived");
  assert.ok(tapped > 0, "the tap counted no arrival either, so the zero beside it is a rig that " +
    "can see nothing rather than an address nothing dispatches, and it proves nothing");
  assert.equal(dispatched, 0, "the override map now reaches this address, so it IS a dispatch " +
    "entry and this gate should be capturing entries the ordinary way");
});

test("ACTING: how many arrivals move a byte at all", { skip }, () => {
  const seen = sessions();
  const acting = seen.map((s) => s.entries.filter(acts).length);
  console.log(
    `  ACTING (measured): ${seen.map((s, i) => `${s.label} ${acting[i]} of ${s.arrivals}`).join(", ")}` +
      `; return-arm arrivals ${seen.map((s) => s.returning).join("/")}`,
  );
  for (const [i, s] of seen.entries()) {
    assert.equal(s.arrivals, ARRIVALS[s.label], `${s.label} arrival count moved`);
    assert.equal(acting[i], ACTING[s.label], `${s.label} acting count moved`);
  }
  assert.ok(acting[0] > 0, "no arrival of any session moves a byte, so every corpus arm below is " +
    "vacuous and only the crafted space is testing anything");
  assert.ok(seen.every((s) => s.returning > 0), "a session stopped reaching the returning arm, so " +
    "nothing here exercises the exit that does not loop");
});

test("WINDOW: the oracle's own deepest push, measured over everything compared", { skip }, () => {
  let deepest = 0;
  for (const s of everyState()) deepest = Math.max(deepest, oracleDepth(s));
  console.log(`  WINDOW (measured): the oracle reaches ${deepest} bytes below its seat`);
  assert.equal(deepest, SCRATCH_BYTES, "the oracle's stack footprint moved, so the masked window " +
    "is no longer the measured one and every arm below is masking the wrong bytes");
});

test("BOUNDARY: the exclusion is exactly as wide as it declares", { skip }, () => {
  const state = sessions()[0].entries[0];
  const sp = state.regs.sp;
  const below = unitDiff(scribbler(-SCRATCH_BYTES - 1), state);
  const seat = unitDiff(scribbler(0), state);
  const inside = unitDiff(scribbler(-1), state);
  console.log(
    `  BOUNDARY: ${hex4(sp - SCRATCH_BYTES - 1)} caught, ${hex4(sp)} caught, ${hex4(sp - 1)} masked`,
  );
  assert.notEqual(below, null, "a divergence one byte BELOW the window was swallowed, so the " +
    "exclusion is wider than it declares and a leaking stack pointer would walk out of sight");
  assert.notEqual(seat, null, "a divergence AT the entry seat was swallowed: the window must lie " +
    "strictly below the seat, and live stack above it must still fail");
  assert.equal(inside, null, "a divergence INSIDE the window was caught, so the two catches above " +
    "are the instrument catching everything rather than the boundary being where it says");
});

test("CORPUS: every captured arrival of both sessions replays identically", { skip }, () => {
  const caught = corpusCaught(loc_5254);
  const total = sessions().reduce((n, s) => n + s.arrivals, 0);
  assert.ok(total > 0, "vacuous: no session reaches the routine at all");
  assert.deepEqual(caught, SESSIONS.map(() => 0), "the rewrite diverged on a real arrival");
  console.log(`  CORPUS: ${total} real arrivals, identical outside the measured window`);
});

test("CRAFTED: the stocked space really kills, and the rewrite matches on all of it", { skip }, () => {
  const acting = crafted().filter(acts).length;
  console.log(`  CRAFTED: ${acting} of ${crafted().length} stocked points move a byte`);
  assert.ok(acting > 0, "no stocked point destroys anything, so the crafted space compares two " +
    "candidates that both do nothing and every twin count below is meaningless");
  for (const p of crafted()) {
    const d = unitDiff(loc_5254, p);
    assert.equal(d, null, `shots ${p.regs.c} targets ${p.regs.a_} base ${hex4(p.regs.ix)}: ${show(d)}`);
  }
});

/** Which registers a candidate parts company with the oracle on, over everything compared. */
function movedOver(candidate) {
  const moved = new Set();
  for (const s of everyState()) {
    const a = s.clone();
    const b = s.clone();
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

test("EXCLUDED, as a CEILING: no register outside the declared set moves", { skip }, () => {
  const moved = movedOver(loc_5254);
  // The absence is evidence only if the same measurement CAN report a register outside the
  // ceiling, so the control leaves a mark in one the contract does not cover.
  const control = movedOver((m) => {
    loc_5254(m);
    m.regs.d = u8(m.regs.d + 1);
    m.regs.h = u8(m.regs.h + 1);
  });
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !EXCLUDED.includes(k)),
    "the measurement reports nothing outside the ceiling even for a candidate that deliberately " +
      "moves a register outside it, so a clean reading below proves nothing");
  const measured = REG_FIELDS.filter((k) => moved.has(k));
  console.log(`  EXCLUDED (measured): ${measured.join(", ")} — ceiling ${EXCLUDED.join(", ")}`);
  // EXCLUDED is a CEILING, not a set the rewrite is required to fill. deepEqual against it would
  // DEMAND the divergence and go RED on a rewrite that became register-exact.
  assert.deepEqual(measured.filter((k) => !EXCLUDED.includes(k)), [], "a register outside the " +
    "declared ceiling diverged, so the contract this file gates on no longer describes the rewrite");
});

test("SEAT: the rewrite leaves the stack pointer where it found it", { skip }, () => {
  for (const s of crafted()) {
    const m = s.clone();
    const seat = m.regs.sp;
    loc_5254(m);
    assert.equal(m.regs.sp, seat, `the rewrite moved the stack pointer at shots ${s.regs.c}`);
  }
  const watched = sessions()[0].entries[0].clone();
  const seat = watched.regs.sp;
  oracle(watched);
  console.log(
    `  SEAT: rewrite holds its seat across ${crafted().length} stocked points; the oracle takes ` +
      `the sweep's own return and lands on ${hex4(watched.pc)} with the pointer at ` +
      `${hex4(watched.regs.sp)}`,
  );
  assert.equal(watched.regs.sp, u16(seat + 2), "the oracle stopped consuming the caller's slot, so " +
    "the seam that supplies the omitted return for the rewrite is no longer describing this entry");
});

test("LIVE-OUT: no register the sweep leaves behind steers anything", { skip }, () => {
  const dead = sessionAddrs((mm) => {
    const v = enclosing(mm);
    for (const k of HOSTILE) mm.regs[k] = 0x5a;
    return v;
  });
  assert.equal(dead.threw, null, `the hostile run threw: ${dead.threw}`);
  assert.equal(dead.stopped, null, `a run stopped early (${dead.stopped})`);
  assert.equal(dead.frames, WHOLE_FRAMES, `compared ${dead.frames} of ${WHOLE_FRAMES} frames`);
  assert.ok(dead.fired > 0, "vacuous: the instrument never reached the enclosing routine");
  assert.deepEqual(dead.addrs, [], "a hostile register reached game memory, so a caller CONSUMES " +
    "one and the memory-only live-out declaration is wrong");
  const control = sessionAddrs((mm) => {
    const v = enclosing(mm);
    mm.mem8[ENTRY_CURSOR_CELL] = u8(mm.mem8[ENTRY_CURSOR_CELL] + 1);
    return v;
  });
  assert.ok(control.addrs.length > 0, "nudging a cell the sweep reloads from changed nothing " +
    "either, so the instrument does not reach this code and the clean reading above proves nothing");
  console.log(
    `  LIVE-OUT: ${HOSTILE.length} registers forced hostile after all ${dead.fired} dispatches of ` +
      `the enclosing routine, no trace; a one-byte cursor nudge forks ${control.addrs.length} cells`,
  );
});

test("SPLICED WHOLE-MACHINE: the rewrite finishes a live sweep, dead stack aside", { skip }, () => {
  const w = replay(loc_5254);
  assert.equal(w.threw, null, `the spliced replay threw: ${w.threw}`);
  assert.ok(w.fired > 0, "vacuous: the enclosing dispatch never fired");
  assert.equal(w.frames, WHOLE_FRAMES, "the replay ran short of the frames asked for");
  const strays = outsideStack(w.addrs);
  const control = sessionAddrs((mm) => {
    const v = enclosing(mm);
    mm.mem8[ENTRY_CURSOR_CELL] = u8(mm.mem8[ENTRY_CURSOR_CELL] + 1);
    return v;
  });
  assert.ok(outsideStack(control.addrs).length > 0, "the masked comparison reports nothing outside " +
    "the declared stack window even for a run that deliberately corrupts a live cell, so the " +
    "clean reading below proves nothing");
  console.log(
    `  SPLICED WHOLE-MACHINE: ${w.frames} frames, ${w.fired} spliced dispatches; ${w.addrs.length} ` +
      `cells differ, all inside the declared dead stack ${hex4(STACK_LOW)}..${hex4(STACK_HIGH)}`,
  );
  assert.deepEqual(strays.map(hex4), [], "a spliced divergence landed outside the game's own " +
    "declared dead-stack window, which is live memory and a real fork");
});

test("DISSOLVES, NOT RESTATES: the module's text, with an inlined variant as the control", () => {
  const module = read("../loc_5254.js");
  const helper = read(HELPER[1]);
  assert.ok(callsRatherThanRestates(module, HELPER), `the module does not call ${HELPER[0]}`);
  const inlined = module.replace(`${HELPER[0]}(\n`, `${helper}\n(`);
  assert.notEqual(inlined, module, "the substitution found nothing to replace, so the control is " +
    "the same text as the subject and decides nothing");
  assert.ok(!callsRatherThanRestates(inlined, HELPER), "the check passes a module carrying the " +
    "sweep's OWN body inline, so it cannot tell a call from a copy and proves nothing");
  console.log(`  DISSOLVES, NOT RESTATES: ${HELPER[0]} is called, and an inlined copy fails the same check`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

test("TEETH/CONTROL: the twin skeleton with no bug is clean everywhere", { skip }, () => {
  const control = twinWith("none");
  const craftedCaught = crafted().filter((p) => unitDiff(control, p) !== null).length;
  const counts = corpusCaught(control);
  console.log(`  TEETH/CONTROL: ${craftedCaught} crafted, ${counts.join("/")} real — all must be 0`);
  assert.equal(craftedCaught, 0, "the bug-free skeleton diverges on the crafted space, so every " +
    "twin's catches below are attributable to the skeleton rather than to its own bug");
  assert.deepEqual(counts, SESSIONS.map(() => 0), "the bug-free skeleton diverges on a real arrival");
});

for (const [label, twin, craftedCaught, perSession, splicedSees] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted points`, { skip }, () => {
    const caught = crafted().filter((p) => unitDiff(twin, p) !== null).length;
    console.log(`  TEETH/${label}: caught on ${caught} of ${crafted().length} crafted points`);
    assert.ok(caught > 0, `the crafted space missed the ${label} twin everywhere, so nothing in ` +
      "this file holds the rewrite against it");
    assert.equal(caught, craftedCaught, `the ${label} twin's crafted catch count moved`);
  });

  test(`TEETH: the ${label} twin is caught on an exact count of real arrivals`, { skip }, () => {
    const counts = corpusCaught(twin);
    console.log(
      `  TEETH/${label}: real sessions catch ${counts.join("/")}` +
        (counts.every((n) => n === 0) ? " — BLIND to real play, as recorded" : ""),
    );
    assert.deepEqual(counts, perSession, `the ${label} twin's real catch counts moved`);
  });

  test(`TEETH: the spliced run sees the ${label} twin, or is recorded blind`, { skip }, () => {
    const w = replay(twin);
    assert.ok(w.fired > 0, "vacuous: the twin never ran");
    const strays = outsideStack(w.addrs);
    console.log(
      `  TEETH/${label}: spliced run ${strays.length > 0 ? `forks on ${strays.length} live cells at frame ${w.frame}` : "is BLIND, as recorded"}`,
    );
    assert.equal(strays.length > 0, splicedSees, `the spliced verdict on the ${label} twin changed`);
  });
}
