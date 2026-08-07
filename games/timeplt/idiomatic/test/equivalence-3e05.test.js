// SPDX-License-Identifier: GPL-3.0-only
/**
 * flyAlongStoredVelocity — memory-equivalent to the frozen oracle at ROM 0x3E05.
 *
 * WHAT IT IS. Two coordinates, each sixteen bits stored split across two records, each displaced
 * by its own velocity word out of the object record PLUS one of two shared per-frame cells. Four
 * bytes written and nothing else; no register is a live-out, and the four callers all reload or
 * ignore everything it leaves behind.
 *
 * GATE: strict unit-capture, two replayed real sessions at every dispatch, an exhaustive carry
 *   sweep, a crafted cross over velocities and displacements, and a whole-machine replay. What it
 *   exercises, with the holes stated:
 *
 *   1. EQUAL at the real dispatch — RAM byte-identical across the whole state dump.
 *   2. NOT VACUOUS — a candidate that does nothing FAILS that same diff at that same dispatch, so
 *      RAM really is the gate here.
 *   3. EXCLUDED, deliberately — registers and pc, pinned to a fixed shape over the whole crafted
 *      cross rather than at one entry, so "excluded" cannot quietly widen. The four written bytes
 *      are asserted equal on every one of those entries.
 *   4. UNIFORM CORPUS — what real play actually presents at this entry: the record bases, the
 *      sprite bases, and how often either displacement cell is non-zero. Asserted as counts, so a
 *      move is a finding rather than a silent change of coverage.
 *   5. CORPUS — every dispatch of two whole sessions replayed, not a deduplicated sample.
 *   6. CARRY — a fraction byte swept 0..255 against a half-unit displacement, on both coordinates,
 *      which is the only arm that forces the carry from a fraction into its whole byte. It is
 *      also the only arm the lost-carry twin is caught on at the captured entry, which is BLIND
 *      to it — the per-twin verdicts say so.
 *   7. CRAFTED CROSS — velocities x displacements x positions poked identically on both sides.
 *   8. WHOLE-MACHINE — the rewrite wired into a whole attract session, frame-by-frame identical.
 *   9. TEETH — eight twins at eight distinct behaviours, each with an exactly declared catch set.
 *
 * HOLE: the crafted arms vary the VALUES read, never the base addresses they are read from; the
 * corpus arm reports which bases real play presents and that is the whole coverage of them.
 * HOLE: the two sessions run the eras attract and a coin-and-start tape reach. Nothing here
 * speaks for an era neither reaches.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-3e05.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { flyAlongStoredVelocity } from "../flyAlongStoredVelocity.js";
import { loc_3e05 as oracle } from "../../translated/loc_3e05.js";
import { ERA_INDEX, WORLD_SCROLL_X, WORLD_SCROLL_Y } from "../names.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x3e05;

/** The record fields this entry reads. */
const VELOCITY_HIGH = 10;
const VELOCITY_LOW = 12;
const FRACTION_HIGH = 3;
const FRACTION_LOW = 5;
const WHOLE_HIGH = 49;
const WHOLE_LOW = 0;

const MOVED = ["f", "d", "e", "h", "l", "sp"];
const HELD = ["b", "c", "ix", "iy"];

const CORPUS_FRAMES = 2000;
const WHOLE_FRAMES = 1600;
const RET_TSTATES = 10;

const skip = romsPresent() ? false : "ROM images are not assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

const attractMachine = (overrides) => makeMachine(overrides, { tape: [] });
const drivenMachine = (overrides) => makeMachine(overrides);

const SESSIONS = [
  ["attract", attractMachine],
  ["driven", drivenMachine],
];

/** Dispatches each session produces in CORPUS_FRAMES frames. Measured; a move here is a finding. */
const DISPATCHES = { attract: 911, driven: 131 };
const RECORD_BASES = { attract: 4, driven: 1 };
const ERAS = { attract: [1], driven: [0] };

// The four bytes the routine writes, addressed off the two bases the caller supplies.
const wholeHigh = (m) => (m.regs.iy + WHOLE_HIGH) & 0xffff;
const fractionHigh = (m) => (m.regs.ix + FRACTION_HIGH) & 0xffff;
const wholeLow = (m) => (m.regs.iy + WHOLE_LOW) & 0xffff;
const fractionLow = (m) => (m.regs.ix + FRACTION_LOW) & 0xffff;
const WRITTEN = [wholeHigh, fractionHigh, wholeLow, fractionLow];

// ── the entry, and the comparison ───────────────────────────────────────────────────────

let entry = null;

/** The required contract call, with the entry state harvested off the candidate arm's clone. */
function gate(candidate) {
  return unitEquivalence(
    attractMachine,
    TARGET,
    oracle,
    (m) => {
      if (entry === null) entry = m.clone();
      return candidate(m);
    },
    { maxFrames: ENTRY_FRAMES },
  );
}

function entryState() {
  if (entry === null) gate(flyAlongStoredVelocity);
  return entry;
}

/** Oracle vs candidate on independent clones of one machine, diffed on RAM. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/** A real captured machine with every value this entry reads forced, the crafted-entry idiom. */
function craft(prior) {
  const m = entryState().clone();
  m.mem16[WORLD_SCROLL_Y] = prior.dHigh;
  m.mem16[WORLD_SCROLL_X] = prior.dLow;
  m.mem16[(m.regs.ix + VELOCITY_HIGH) & 0xffff] = prior.vHigh;
  m.mem16[(m.regs.ix + VELOCITY_LOW) & 0xffff] = prior.vLow;
  m.mem8[wholeHigh(m)] = prior.wHigh;
  m.mem8[fractionHigh(m)] = prior.fHigh;
  m.mem8[wholeLow(m)] = prior.wLow;
  m.mem8[fractionLow(m)] = prior.fLow;
  return m;
}

// Zero, one, a low-byte-only step, a whole step, both sign extremes, and two negatives.
const WORDS = [0x0000, 0x0001, 0x00ff, 0x0100, 0x7fff, 0x8000, 0xfe80, 0xffff];

const POSITIONS = [
  { wHigh: 0, fHigh: 0, wLow: 0, fLow: 0 },
  { wHigh: 0, fHigh: 255, wLow: 255, fLow: 0 },
  { wHigh: 255, fHigh: 255, wLow: 255, fLow: 255 },
  { wHigh: 138, fHigh: 203, wLow: 129, fLow: 88 },
];

let crossCache = null;
function cross() {
  if (crossCache) return crossCache;
  const out = [];
  for (const vHigh of WORDS) {
    for (const dHigh of WORDS) {
      for (const p of POSITIONS) {
        out.push({ ...p, vHigh, dHigh, vLow: WORDS[(WORDS.indexOf(dHigh) + 3) % WORDS.length], dLow: vHigh });
      }
    }
  }
  crossCache = out;
  return out;
}

/** One fraction byte swept 0..255 against a displacement of one, on both coordinates at once. */
function carryPriors() {
  const out = [];
  for (let f = 0; f < 256; f++) {
    out.push({ wHigh: 200, fHigh: f, wLow: 7, fLow: f, vHigh: 128, vLow: 128, dHigh: 0, dLow: 0 });
  }
  return out;
}

// ── replaying whole sessions, one dispatch at a time ────────────────────────────────────

function replaySession(factory, candidate) {
  let dispatches = 0;
  let caught = 0;
  let scrolling = 0;
  const records = new Set();
  const sprites = new Set();
  const eras = new Set();
  const m = factory(
    new Map([[TARGET, (mm) => {
      dispatches++;
      records.add(mm.regs.ix);
      sprites.add(mm.regs.iy);
      eras.add(mm.mem8[ERA_INDEX]);
      if (mm.mem16[WORLD_SCROLL_Y] !== 0 || mm.mem16[WORLD_SCROLL_X] !== 0) scrolling++;
      const b = mm.clone();
      const r = oracle(mm);
      candidate(b);
      if (firstStateDiff(mm.dumpState(), b.dumpState(), (o) => mm.stateOffsetToAddr(o))) caught++;
      return r;
    }]]),
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return { dispatches, caught, scrolling, records, sprites, eras };
}

let sessionCache = null;
function sessions() {
  if (sessionCache) return sessionCache;
  sessionCache = SESSIONS.map(([label, factory]) => ({ label, ...replaySession(factory, flyAlongStoredVelocity) }));
  return sessionCache;
}

// ── the cycle shim ──────────────────────────────────────────────────────────────────────
// The host engine is cycle-driven and every path in ends in this routine's own return, so a
// candidate charging nothing and not taking that return would move the interrupt and leak two
// stack bytes per dispatch. The total is measured off a clone rather than predicted, which is
// exact by construction; what the whole-machine arm then tests is memory, not timing.

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
  wholeMachineEquivalence(attractMachine, WHOLE_FRAMES, new Map([[TARGET, hosted(candidate)]]));

// ── the twins ───────────────────────────────────────────────────────────────────────────

/** The correct split store, so a twin below breaks the DISPLACEMENT rather than the store. */
function store(m, wholeAddr, fractionAddr, displacement) {
  const moved = (m.mem8[wholeAddr] << 8) + m.mem8[fractionAddr] + displacement;
  m.mem8[wholeAddr] = moved >> 8;
  m.mem8[fractionAddr] = moved;
}

const velocityHigh = (m) => m.mem16[(m.regs.ix + VELOCITY_HIGH) & 0xffff];
const velocityLow = (m) => m.mem16[(m.regs.ix + VELOCITY_LOW) & 0xffff];

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: carries the object with the world but never along its own velocity. */
function brokenScrollOnly(m) {
  store(m, wholeHigh(m), fractionHigh(m), m.mem16[WORLD_SCROLL_Y]);
  store(m, wholeLow(m), fractionLow(m), m.mem16[WORLD_SCROLL_X]);
}

/** BUG: flies the object but pins it to the world instead of letting the world stream past. */
function brokenVelocityOnly(m) {
  store(m, wholeHigh(m), fractionHigh(m), velocityHigh(m));
  store(m, wholeLow(m), fractionLow(m), velocityLow(m));
}

/** BUG: each coordinate gets the other one's velocity, so the object flies sideways. */
function brokenAxesSwapped(m) {
  store(m, wholeHigh(m), fractionHigh(m), velocityLow(m) + m.mem16[WORLD_SCROLL_Y]);
  store(m, wholeLow(m), fractionLow(m), velocityHigh(m) + m.mem16[WORLD_SCROLL_X]);
}

/** BUG: reads the velocity pair one field early, so it picks up the neighbouring words. */
function brokenVelocityOffByTwo(m) {
  const { mem16, regs } = m;
  store(m, wholeHigh(m), fractionHigh(m), mem16[(regs.ix + VELOCITY_HIGH - 2) & 0xffff] + mem16[WORLD_SCROLL_Y]);
  store(m, wholeLow(m), fractionLow(m), mem16[(regs.ix + VELOCITY_LOW - 2) & 0xffff] + mem16[WORLD_SCROLL_X]);
}

/** BUG: adds each half to its own byte, so a fraction overflow never banks into the whole. */
function brokenNoCarry(m) {
  const dHigh = (velocityHigh(m) + m.mem16[WORLD_SCROLL_Y]) & 0xffff;
  const dLow = (velocityLow(m) + m.mem16[WORLD_SCROLL_X]) & 0xffff;
  m.mem8[wholeHigh(m)] = m.mem8[wholeHigh(m)] + (dHigh >> 8);
  m.mem8[fractionHigh(m)] = m.mem8[fractionHigh(m)] + (dHigh & 0xff);
  m.mem8[wholeLow(m)] = m.mem8[wholeLow(m)] + (dLow >> 8);
  m.mem8[fractionLow(m)] = m.mem8[fractionLow(m)] + (dLow & 0xff);
}

/** BUG: moves the first coordinate and forgets the second one entirely. */
function brokenSecondSkipped(m) {
  store(m, wholeHigh(m), fractionHigh(m), velocityHigh(m) + m.mem16[WORLD_SCROLL_Y]);
}

/** BUG: whole and fraction change places, so the sub-pixel part lands in the sprite entry. */
function brokenHalvesSwapped(m) {
  store(m, fractionHigh(m), wholeHigh(m), velocityHigh(m) + m.mem16[WORLD_SCROLL_Y]);
  store(m, fractionLow(m), wholeLow(m), velocityLow(m) + m.mem16[WORLD_SCROLL_X]);
}

/**
 * Per twin: its exact catch count over the crafted cross, whether the ONE real captured entry
 * can see it, its catch count in each session, and whether a whole attract session forks. Every
 * number is measured and asserted as an equality, so a twin caught on the WRONG set fails as
 * loudly as one not caught at all.
 */
const TWINS = [
  ["no-op", brokenNoOp, 256, true, [911, 131], true],
  ["scroll-only", brokenScrollOnly, 252, true, [911, 131], true],
  ["velocity-only", brokenVelocityOnly, 252, true, [911, 131], true],
  ["axes-swapped", brokenAxesSwapped, 224, true, [911, 131], true],
  ["velocity-off-by-two", brokenVelocityOffByTwo, 252, true, [911, 131], true],
  ["no-carry", brokenNoCarry, 151, false, [696, 36], true],
  ["second-skipped", brokenSecondSkipped, 240, true, [908, 20], true],
  ["halves-swapped", brokenHalvesSwapped, 256, true, [911, 131], true],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: flyAlongStoredVelocity == oracle on RAM", { skip }, () => {
  const r = gate(flyAlongStoredVelocity);
  assert.notEqual(entry, null, "vacuous: the session never reached the routine");
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  const e = entryState();
  console.log(
    `  EQUAL: entry bases ${hex4(e.regs.ix)}/${hex4(e.regs.iy)}, velocities ` +
      `${hex4(e.mem16[(e.regs.ix + VELOCITY_HIGH) & 0xffff])}/` +
      `${hex4(e.mem16[(e.regs.ix + VELOCITY_LOW) & 0xffff])}, displacements ` +
      `${hex4(e.mem16[WORLD_SCROLL_Y])}/${hex4(e.mem16[WORLD_SCROLL_X])}; RAM identical`,
  );
});

test("NOT VACUOUS: a no-op candidate FAILS the RAM diff at the real dispatch", { skip }, () => {
  const d = unitDiff(brokenNoOp, entryState());
  assert.notEqual(
    d,
    null,
    "the RAM diff passed a candidate that does nothing, so RAM is NOT this gate and the whole " +
      "file must be re-derived",
  );
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("EXCLUDED, deliberately: only scratch registers move, over the whole cross", { skip }, () => {
  const moved = new Set();
  for (const p of cross()) {
    const a = craft(p);
    const b = a.clone();
    oracle(a);
    flyAlongStoredVelocity(b);
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
    assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
    for (const at of WRITTEN) assert.equal(a.mem8[at(a)], b.mem8[at(b)], `live-out ${hex4(at(a))}`);
  }
  assert.deepEqual(
    REG_FIELDS.filter((k) => moved.has(k)),
    MOVED,
    "the excluded set changed shape: nothing beyond the scratch registers and the stack " +
      "pointer may differ",
  );
  for (const k of HELD) assert.ok(!moved.has(k), `a register the callers rely on moved (${k})`);
  console.log(`  EXCLUDED: ${[...moved].join(", ")} and pc, over ${cross().length} crafted entries`);
});

test("UNIFORM CORPUS: what real play presents at this entry", { skip }, () => {
  const seen = sessions();
  console.log(`  UNIFORM CORPUS (measured): ${seen.map((s) =>
    `${s.label} ${s.dispatches} dispatches / ${s.records.size} records / ${s.sprites.size} sprites / ` +
    `${s.scrolling} displaced / eras ${[...s.eras].join("+")}`).join("; ")}`);
  assert.equal(seen.length, SESSIONS.length, "vacuous: a session is missing from the corpus");
  for (const s of seen) {
    assert.ok(s.dispatches > 0, `vacuous: the ${s.label} session never reached the routine`);
    assert.equal(s.dispatches, DISPATCHES[s.label], `the ${s.label} dispatch count moved`);
    assert.equal(s.records.size, s.sprites.size, `the ${s.label} bases stopped pairing up`);
    assert.equal(s.records.size, RECORD_BASES[s.label], `the ${s.label} record-base count moved`);
    assert.deepEqual([...s.eras], ERAS[s.label], `the ${s.label} session left the era it ran in`);
  }
  const scrolling = seen.reduce((n, s) => n + s.scrolling, 0);
  const total = seen.reduce((n, s) => n + s.dispatches, 0);
  assert.equal(scrolling, total, "a real dispatch now arrives with BOTH displacement cells zero, " +
    "which the crafted cross covers but the corpus previously did not present at all");
  console.log(
    `  UNIFORM CORPUS: ${seen.map((s) => `${s.label} ${s.dispatches}/${s.records.size} bases`).join(", ")}; ` +
      `all ${total} dispatches displaced; eras ` +
      `${[...new Set(seen.flatMap((s) => [...s.eras]))].join(",")}`,
  );
});

test("CORPUS: every dispatch of both real sessions replays identically", { skip }, () => {
  let total = 0;
  for (const s of sessions()) {
    assert.equal(s.caught, 0, `the rewrite diverged on ${s.caught} ${s.label} dispatches`);
    total += s.dispatches;
  }
  console.log(`  CORPUS: ${total} real dispatches over two sessions, RAM identical on each`);
});

test("CARRY: a fraction swept 0..255 carries into the whole byte as the oracle does", { skip }, () => {
  const priors = carryPriors();
  for (const p of priors) {
    const d = unitDiff(flyAlongStoredVelocity, craft(p));
    assert.equal(d, null, `fraction=${p.fHigh}: ${show(d)}`);
  }
  const caught = priors.filter((p) => unitDiff(brokenNoCarry, craft(p)) !== null).length;
  console.log(`  CARRY (measured): the lost-carry twin dies on ${caught}`);
  assert.equal(caught, 128, "the carry sweep stopped discriminating the lost-carry twin");
  console.log(`  CARRY: ${priors.length} fractions identical; the lost-carry twin dies on ${caught}`);
});

test("CRAFTED: every velocity x displacement x position combination is identical", { skip }, () => {
  for (const p of cross()) {
    const d = unitDiff(flyAlongStoredVelocity, craft(p));
    assert.equal(d, null, `${JSON.stringify(p)}: ${show(d)}`);
  }
  assert.equal(cross().length, WORDS.length ** 2 * POSITIONS.length, "the crafted cross shrank");
  console.log(`  CRAFTED: ${cross().length} entries identical`);
});

test("WHOLE-MACHINE: attract is byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(flyAlongStoredVelocity);
  assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the override never dispatched");
  assert.equal(w.framesCompared, WHOLE_FRAMES, "the replay ran short of the frames asked for");
  assert.equal(w.equal, true, `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  console.log(
    `  WHOLE-MACHINE: ${w.framesCompared} frames, ${w.invocations.get(TARGET)} dispatches, identical`,
  );
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin, crossCaught, caughtAtDispatch, perSession, wholeRunSees] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    const caught = cross().filter((p) => unitDiff(twin, craft(p)) !== null).length;
    console.log(`  TEETH/${label}: caught on ${caught} of ${cross().length} crafted entries`);
    assert.equal(caught, crossCaught, `the ${label} twin's crafted catch count moved`);
    assert.ok(caught > 0, `the crafted cross missed the ${label} twin everywhere`);
  });

  test(`TEETH: the ${label} twin at the real dispatch, hole pinned`, { skip }, () => {
    const d = unitDiff(twin, entryState());
    console.log(`  TEETH/${label}: real dispatch ${d ? `caught — ${show(d)}` : "BLIND, as recorded"}`);
    assert.equal(
      d !== null,
      caughtAtDispatch,
      `the real dispatch's blindness to the ${label} twin changed — re-derive the holes`,
    );
  });

  test(`TEETH: the ${label} twin is caught on an exact count of real dispatches`, { skip }, () => {
    const counts = SESSIONS.map(([, factory]) => replaySession(factory, twin));
    console.log(`  TEETH/${label}: real sessions catch ${counts.map((r) => r.caught).join("/")}`);
    for (const [i, r] of counts.entries()) {
      assert.equal(r.dispatches, DISPATCHES[SESSIONS[i][0]], "the session's dispatch count moved");
      assert.equal(r.caught, perSession[i], `the ${label} twin's ${SESSIONS[i][0]} catch count moved`);
    }
  });

  test(`TEETH: the whole-machine replay sees the ${label} twin, or is recorded blind`, { skip }, () => {
    const w = replay(twin);
    console.log(
      `  TEETH/${label}: whole machine ${w.equal ? "is BLIND, as recorded" : `forks at frame ${w.frame}`}`,
    );
    assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the twin never dispatched");
    assert.equal(w.equal, !wholeRunSees, `the whole-machine verdict on the ${label} twin changed`);
  });
}
