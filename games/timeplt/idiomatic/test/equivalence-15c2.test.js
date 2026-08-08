// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_15c2 — memory-equivalent to the frozen oracle at ROM 0x15C2.
 *
 * WHAT IT IS. Three instructions: read the inner sequence step, keep its low three bits, and enter
 * the restart-vector dispatch with the address of the word table that follows. Nothing is pushed
 * for the arm to come back to, so the arm's own return carries this entry's — which is why both
 * sides here end with the SAME stack pointer and the SAME program counter, unlike a rewrite that
 * merely omits a return.
 *
 * ★ HOW THE LIVE-OUT WAS DERIVED, and it is from the ORACLE. The oracle's exit successor is the
 *   ARM, entered as a jump: whatever the arm writes and whatever it leaves in registers is this
 *   entry's product, and nothing of this entry's own survives it. So the live-out is memory plus
 *   the arm's, and the gate runs the arms rather than stopping at the address it computed. The
 *   registers the dispatch chain sets up on the way in are inputs to the arm, not outputs of this
 *   entry, and the EXCLUDED arm measures which of them the arms actually carry through.
 *
 * ★ THE COMPARISON IS MASKED BELOW THE EXIT STACK POINTER, and the mask is not free. The frozen
 *   chain pushes and pops three nested return addresses in the bytes just under the arm's own
 *   frame; the rewrite computes the same arm arithmetically and never writes them. On every state
 *   this gate reaches the raw difference is nonetheless EMPTY — those bytes already hold the very
 *   values the chain writes, because the same dispatch runs there over and over at the same depth.
 *   An empty difference proves nothing on its own, so the SCRATCH arm carries a POSITIVE CONTROL:
 *   with those bytes poked to a value the chain does not write, the difference appears, and the
 *   arm measures how deep it goes. That is what makes the emptiness a measurement rather than a
 *   coincidence nobody checked.
 *
 * GATE: strict unit-capture over the shared coin-then-start tape, plus crafted selectors off each
 *   live arm. What it exercises, holes stated:
 *
 *   1. DISPATCHED — the dispatch count, the exact spread of selectors the session presents, and how
 *      many of those dispatches are INFORMATIVE, meaning the arm wrote something a do-nothing
 *      candidate would be caught by. The entry kept per selector is the first that qualifies.
 *   2. EQUAL at each real dispatch — masked RAM identical, with the raw difference reported.
 *   3. NOT VACUOUS — a candidate that does nothing FAILS the same comparison.
 *   4. SCRATCH — the raw difference across corpus and crafted sweeps, plus the positive control
 *      that makes the dead scratch visible and bounds how deep it reaches.
 *   5. CORPUS — every dispatch of the session replayed.
 *   6. ARMS — all eight table entries off each captured entry, identical or faulting identically.
 *   7. SELECTOR — all 256 values of the selector cell, so the five ignored bits are measured
 *      rather than assumed.
 *   8. STACK — the exit stack pointer AND the program counter are identical on every arm that
 *      completes. This entry parks nothing, so there is no omitted return here to excuse.
 *   9. EXCLUDED — the registers that move over the sweep, pinned to an exact set.
 *  10. TEETH — one twin per named way the lookup could be wrong, each required to be caught
 *      OUTSIDE the window, so the mask cannot be what is passing them.
 *
 * HOLE: the session presents only two of the eight selectors. The other six are crafted, and from
 * an entry state their arm would not really see; where such an arm faults it is asserted only to
 * fault IDENTICALLY on both sides, never to be correct.
 * HOLE: only two of the eight table words address code this port has transcribed. The other six
 * read as addresses only because the three bits admit them; the sweep runs them and records that
 * both sides fault the same way, which is a statement about the dispatch, not about those words.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-15c2.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { loc_15c2 } from "../loc_15c2.js";
import { SEQUENCE_SUBSTEP } from "../names.js";
import { loc_15c2 as oracle } from "../../translated/loc_15c2.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x15c2;
const ARM_TABLE = 0x15c8;
const ARM_MASK = 0x07;
const ARM_COUNT = ARM_MASK + 1;

/** Bytes below the exit stack pointer the frozen dispatch's dead scratch can reach; measured. */
const WINDOW = 8;

const CORPUS_FRAMES = 2000;
const DISPATCHES = 33;
/**
 * selector -> how many of the session's dispatches presented it, and how many of those are
 * INFORMATIVE: the arm wrote something a do-nothing candidate would be caught by. The entry kept
 * per selector is the first informative one, because a capture at an inert dispatch would leave
 * every crafted arm below resting on a comparison with no power. Measured; a move is a finding.
 */
const SELECTOR_SPREAD = [[0, 1], [6, 32]];
const SELECTOR_INFORMATIVE = [[0, 1], [6, 32]];
const LIVE_SELECTORS = SELECTOR_SPREAD.map(([s]) => s);

const MOVED = ["a", "d", "e"];
/** Named separately so a failure says which: the pointer registers an arm hands on, and the seat. */
const HELD = ["b", "c", "h", "l", "ix", "iy", "sp"];
const SELECTOR_VALUES = 256;
const POKE = 0xa5;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (ds) =>
  ds.length === 0 ? "identical" : ds.map((d) => `${hex4(d.addr)}(${d.a}/${d.b})`).join(" ");

// ── the session ─────────────────────────────────────────────────────────────────────────

/** One captured entry per selector the session really presents, plus the session's own tallies. */
let corpus = null;

function runSession(candidate) {
  const entries = new Map();
  const spread = new Map();
  const informative = new Map();
  const moved = new Set();
  let dispatches = 0;
  let caught = 0;
  const m = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    const selector = mm.mem8[SEQUENCE_SUBSTEP] & ARM_MASK;
    spread.set(selector, (spread.get(selector) ?? 0) + 1);
    const r = diffOf(candidate, mm);
    if (r.informative) {
      informative.set(selector, (informative.get(selector) ?? 0) + 1);
      if (!entries.has(selector)) entries.set(selector, mm.clone());
    }
    for (const k of r.moved) moved.add(k);
    if (r.caught) caught++;
    return oracle(mm);
  }]]));
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `the session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "the session ran short");
  return { entries, spread, informative, moved, dispatches, caught };
}

function session() {
  if (corpus === null) corpus = runSession(loc_15c2);
  assert.notEqual(corpus.dispatches, 0, "vacuous: the session never reached the routine");
  return corpus;
}

const entryFor = (selector) => {
  const e = session().entries.get(selector);
  assert.notEqual(e, undefined, `the session no longer presents selector ${selector}`);
  return e;
};

/**
 * Run both sides on clones of one machine and report EVERYTHING: the raw byte difference, the
 * difference outside the dead window, the exit pointers, how each side faulted, the registers that
 * moved, and whether the comparison has any POWER here — `informative` is the oracle's own masked
 * footprint against the untouched entry, which is exactly what a do-nothing candidate would be
 * caught by. It costs one extra dump rather than a second emulation.
 */
function diffOf(candidate, machine) {
  const before = machine.dumpState();
  const a = machine.clone();
  const b = machine.clone();
  let faultA = null;
  let faultB = null;
  try { oracle(a); } catch (e) { faultA = e.constructor.name; }
  try { candidate(b); } catch (e) { faultB = e.constructor.name; }
  const moved = faultA || faultB ? [] : REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);

  const da = a.dumpState();
  const db = b.dumpState();
  const exitSp = a.regs.sp;
  const outside = (addr) => !(addr >= exitSp - WINDOW && addr < exitSp);
  const raw = [];
  let informative = false;
  for (let off = 0; off < da.length; off++) {
    const addr = a.stateOffsetToAddr(off);
    if (da[off] !== db[off]) raw.push({ addr, a: da[off], b: db[off] });
    if (da[off] !== before[off] && outside(addr)) informative = true;
  }
  const masked = raw.filter((d) => outside(d.addr));
  const faulted = faultA !== null || faultB !== null;
  return {
    raw,
    masked,
    informative,
    moved,
    exitSp,
    spB: b.regs.sp,
    pcA: a.pc,
    pcB: b.pc,
    faultA,
    faultB,
    faulted,
    caught: faulted ? faultA !== faultB : masked.length > 0,
  };
}

/** A clone of a real entry with the selector forced, and optionally the dead bytes overwritten. */
function craft(selector, base = entryFor(LIVE_SELECTORS[0]), pokeScratch = false) {
  const m = base.clone();
  m.mem8[SEQUENCE_SUBSTEP] = selector;
  if (pokeScratch) for (let k = 1; k <= WINDOW; k++) m.mem8[(m.regs.sp - k) & 0xffff] = POKE;
  return m;
}

const everySelector = Array.from({ length: SELECTOR_VALUES }, (_unused, v) => v);

function sweepCaught(candidate) {
  let caught = 0;
  for (const live of LIVE_SELECTORS) {
    for (const v of everySelector) if (diffOf(candidate, craft(v, entryFor(live))).caught) caught++;
  }
  return caught;
}

const SWEEP_SIZE = LIVE_SELECTORS.length * SELECTOR_VALUES;

// ── the twins ───────────────────────────────────────────────────────────────────────────

const armAt = (index) => (m) => m.call(m.mem16[ARM_TABLE + 2 * index]);
const armFrom = (table, mask) => (m) =>
  m.call(m.mem16[table + 2 * (m.mem8[SEQUENCE_SUBSTEP] & mask)]);

/** BUG: does nothing — neither the lookup nor the arm. */
function brokenNoOp() {}

/** BUG: takes the next entry of the table. */
function brokenNextArm(m) {
  m.call(m.mem16[ARM_TABLE + 2 * ((m.mem8[SEQUENCE_SUBSTEP] + 1) & ARM_MASK)]);
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["next-arm", brokenNextArm],
  ["wide-mask", armFrom(ARM_TABLE, 0x0f)],
  ["narrow-mask", armFrom(ARM_TABLE, 0x03)],
  ["fixed-first-arm", armAt(0)],
  ["table-off-by-one-entry", armFrom(ARM_TABLE + 2, ARM_MASK)],
  ["table-misaligned", armFrom(ARM_TABLE + 1, ARM_MASK)],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("DISPATCHED: the session reaches this entry, presenting a measured spread", { skip }, () => {
  const s = session();
  assert.equal(s.dispatches, DISPATCHES, "the dispatch count moved");
  assert.deepEqual(
    [...s.spread.entries()].sort((a, b) => a[0] - b[0]),
    SELECTOR_SPREAD,
    "the spread of selectors the session presents moved",
  );
  assert.deepEqual(
    [...s.informative.entries()].sort((a, b) => a[0] - b[0]),
    SELECTOR_INFORMATIVE,
    "the share of dispatches at which the arm writes anything moved",
  );
  console.log(
    `  DISPATCHED: ${s.dispatches} times, selectors ` +
      `${[...s.spread].map(([k, v]) => `${k}x${v}`).join(" ")}; informative ` +
      `${[...s.informative].map(([k, v]) => `${k}x${v}`).join(" ")}`,
  );
});

test("EQUAL at every real dispatch: masked RAM identical on each live selector", { skip }, () => {
  for (const selector of LIVE_SELECTORS) {
    const r = diffOf(loc_15c2, entryFor(selector));
    assert.equal(r.faultA, null, `selector ${selector}: the oracle faulted (${r.faultA})`);
    assert.equal(r.faultB, null, `selector ${selector}: the rewrite faulted (${r.faultB})`);
    assert.deepEqual(r.masked, [], `selector ${selector}: ${show(r.masked)}`);
    console.log(
      `  EQUAL: selector ${selector}, exit pointer ${hex4(r.exitSp)}, raw difference ` +
        show(r.raw),
    );
  }
});

test("NOT VACUOUS: a candidate that does nothing FAILS the same comparison", { skip }, () => {
  for (const selector of LIVE_SELECTORS) {
    const r = diffOf(brokenNoOp, entryFor(selector));
    assert.ok(r.caught, `selector ${selector}: the comparison passed a candidate that does nothing`);
  }
  const r = diffOf(brokenNoOp, entryFor(LIVE_SELECTORS[0]));
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(r.masked)}`);
});

test("SCRATCH: the dead window is real, and the instrument can see into it", { skip }, () => {
  let rawSeen = 0;
  let deepest = 0;
  for (const live of LIVE_SELECTORS) {
    for (let i = 0; i < ARM_COUNT; i++) {
      const r = diffOf(loc_15c2, craft(i, entryFor(live)));
      for (const d of r.raw) {
        assert.ok(d.addr < r.exitSp, `selector ${i}: ${hex4(d.addr)} is at or above the exit pointer`);
        deepest = Math.max(deepest, r.exitSp - d.addr);
        rawSeen++;
      }
    }
  }

  // THE POSITIVE CONTROL. Nothing above proves the comparison can SEE the chain's scratch, since
  // those bytes already hold what the chain writes. Overwrite them with a value it never writes
  // and the difference must appear — otherwise the emptiness above is measuring nothing at all.
  let controlSeen = 0;
  let controlDeepest = 0;
  for (const live of LIVE_SELECTORS) {
    for (let i = 0; i < ARM_COUNT; i++) {
      const r = diffOf(loc_15c2, craft(i, entryFor(live), true));
      for (const d of r.raw) {
        assert.ok(d.addr < r.exitSp, `control ${i}: ${hex4(d.addr)} is at or above the exit pointer`);
        controlDeepest = Math.max(controlDeepest, r.exitSp - d.addr);
        controlSeen++;
      }
      assert.deepEqual(r.masked, [], `control ${i}: a difference escaped the window — ${show(r.masked)}`);
    }
  }
  assert.ok(controlSeen > 0, "the control changed nothing: this comparison cannot see the scratch " +
    "at all, so the empty difference above is not evidence of anything");
  assert.ok(
    controlDeepest <= WINDOW,
    `the control reaches ${controlDeepest} bytes below the exit pointer, past the ${WINDOW}-byte ` +
      "window this file masks — widen it deliberately, do not let it drift",
  );
  console.log(
    `  SCRATCH: ${rawSeen} raw differing bytes untouched, deepest ${deepest}; with the dead bytes ` +
      `overwritten, ${controlSeen} appear, deepest ${controlDeepest}, window ${WINDOW}`,
  );
});

test("CORPUS: every dispatch of the session replays identically", { skip }, () => {
  const s = session();
  assert.equal(s.caught, 0, "the rewrite diverged on a real dispatch");
  console.log(`  CORPUS: ${s.dispatches} real dispatches, none diverging`);
});

test("ARMS: every table entry runs identically, or faults identically", { skip }, () => {
  const faulted = new Set();
  let informative = 0;
  for (const live of LIVE_SELECTORS) {
    for (let i = 0; i < ARM_COUNT; i++) {
      const r = diffOf(loc_15c2, craft(i, entryFor(live)));
      if (r.informative) informative++;
      if (r.faulted) {
        assert.equal(r.faultA, r.faultB, `arm ${i}: ${r.faultA} on one side, ${r.faultB} on the other`);
        faulted.add(`${live}/${i}`);
        continue;
      }
      assert.deepEqual(r.masked, [], `arm ${i}: ${show(r.masked)}`);
    }
  }
  assert.ok(
    faulted.size < ARM_COUNT * LIVE_SELECTORS.length,
    "every arm faulted, on both entries: this sweep proves nothing",
  );
  assert.ok(informative > 0, "no swept arm wrote anything outside the window, so `identical` here " +
    "is a comparison with no power rather than a result");
  console.log(`  ARMS: ${ARM_COUNT} entries off ${LIVE_SELECTORS.length} real entries, ` +
    `${faulted.size} faulting identically on both sides, ${informative} writing anything`);
});

test("SELECTOR: the five high bits are ignored, over the cell's whole range", { skip }, () => {
  for (const live of LIVE_SELECTORS) {
    for (const v of everySelector) {
      const r = diffOf(loc_15c2, craft(v, entryFor(live)));
      if (r.faulted) {
        assert.equal(r.faultA, r.faultB, `selector ${v}: ${r.faultA} vs ${r.faultB}`);
      } else {
        assert.deepEqual(r.masked, [], `selector ${v}: ${show(r.masked)}`);
      }
    }
  }
  console.log(`  SELECTOR: ${SWEEP_SIZE} crafted selectors identical — only three bits can matter`);
});

test("STACK: the exit pointer and the program counter are identical", { skip }, () => {
  let completed = 0;
  for (const live of LIVE_SELECTORS) {
    for (let i = 0; i < ARM_COUNT; i++) {
      const r = diffOf(loc_15c2, craft(i, entryFor(live)));
      if (r.faulted) continue;
      assert.equal(r.exitSp, r.spB, `arm ${i}: exit pointers ${hex4(r.exitSp)} and ${hex4(r.spB)}`);
      assert.equal(r.pcA, r.pcB, `arm ${i}: program counters ${hex4(r.pcA)} and ${hex4(r.pcB)}`);
      completed++;
    }
  }
  assert.ok(completed > 0, "no arm completed, so nothing here compared a stack pointer");
  console.log(`  STACK: ${completed} completing arms, exit pointer and program counter identical`);
});

test("EXCLUDED, deliberately: the registers that move, over every real dispatch", { skip }, () => {
  const moved = new Set(session().moved);
  for (const live of LIVE_SELECTORS) {
    for (let i = 0; i < ARM_COUNT; i++) {
      for (const k of diffOf(loc_15c2, craft(i, entryFor(live))).moved) moved.add(k);
    }
  }
  console.log(`  EXCLUDED (measured): ${REG_FIELDS.filter((k) => moved.has(k)).join(", ")}`);
  // MOVED is a CEILING, not a set the rewrite is required to fill. deepEqual against it
  // would demand the divergence and go RED on a rewrite that became register-exact.
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k) && !MOVED.includes(k)), [],
    "a register outside the declared cap diverged");
  for (const k of HELD) assert.ok(!moved.has(k), `a register the arms hand on moved (${k})`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT outside the window`, { skip }, () => {
    const caught = sweepCaught(twin);
    assert.ok(
      caught > 0,
      `the masked comparison PASSED the ${label} twin on every selector — either the twin is ` +
        "not broken or the window has swallowed the evidence",
    );
    console.log(`  TEETH/${label}: caught on ${caught} of ${SWEEP_SIZE} crafted selectors`);
  });
}
