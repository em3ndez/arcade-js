// SPDX-License-Identifier: GPL-3.0-only
/**
 * retireSlotIntoCooldown — memory-equivalent to the frozen oracle at ROM 0x48AD.
 *
 * GATE: strict unit-capture on the coin-and-start tape, every captured dispatch replayed, an
 *   exhaustive crafted cross over the two bases and the four prior byte values, a whole-machine
 *   replay, and teeth. RAM IS A REAL GATE HERE: the routine writes four bytes and the NOT VACUOUS
 *   arm proves a do-nothing candidate fails on RAM alone at the real dispatch.
 *
 * What it exercises, with the holes stated:
 *   1. EQUAL at the real dispatch — the whole state dump is identical, stack scratch included,
 *      because this routine pushes nothing and the test asserts that rather than masking for it.
 *   2. NOT VACUOUS — a no-op candidate fails the same diff.
 *   3. EXCLUDED, deliberately: the stack pointer and pc, and NOTHING else. The oracle returns and
 *      the rewrite does not; every other register is untouched by both, which is asserted as an
 *      exact set so "excluded" cannot quietly widen.
 *   4. CORPUS — every dispatch the tape produces, replayed one at a time.
 *   5. EXHAUSTIVE CRAFTED CROSS — the real entry with both bases moved to unused work RAM and all
 *      four written bytes forced, over a cross of prior values including the ones the writes
 *      already hold, so "wrote nothing because it was already right" cannot pass.
 *   6. WHOLE-MACHINE — the whole session replayed with the rewrite wired through a shim.
 *   7. TEETH — six twins at six distinct behaviours, each caught on an exact declared count.
 *
 * The whole-machine arm needs a shim. The host engine is cycle-driven and every path in either
 * calls or tail-jumps here, so a candidate that charges nothing and does not take the Z80 return
 * moves the vblank interrupt and leaks two stack bytes per dispatch. The shim measures the
 * oracle's own charge on a throwaway copy of the machine and pays exactly that, so it cannot
 * drift from a hand-written total; one arm below removes the shim and shows the run dies.
 *
 * HOLE: the corpus is TWO dispatches, both from one level-setup moment, and both present the same
 * pair of bases. Everything discriminating here comes from the crafted cross, and the per-twin
 * catch counts say so explicitly — three of the six twins are invisible to the real dispatches.
 * HOLE: the tail-jump callers are not exercised as tail jumps; the whole-machine arm covers the
 * paths this tape drives and no test here reaches the other two entry sites.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-48ad.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { retireSlotIntoCooldown } from "../retireSlotIntoCooldown.js";
import { loc_48ad as oracle } from "../../translated/loc_48ad.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { DEFERRED_BLANK_CURSOR } from "../names.js";

const TARGET = 0x48ad;

const OCCUPANCY = 0;
const DELAY = 0x0e;
const SECOND_AXIS = 0x31;
const DELAY_FRAMES = 0xf0;

const MOVED = ["sp"];
const CORPUS_FRAMES = 1400;
const WHOLE_FRAMES = 1400;
const RET_TSTATES = 10;

/** Measured over the corpus below; a move here is a finding, not a nuisance. */
const DISPATCHES = 2;

const skip = romsPresent() ? false : "ROM images are not assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

const factory = (overrides) => makeMachine(overrides);

// ── the entry, and the comparison ───────────────────────────────────────────────────────

let entry = null;

function gate(candidate) {
  return unitEquivalence(factory, TARGET, oracle, (m) => {
    if (entry === null) entry = m.clone();
    return candidate(m);
  }, { maxFrames: ENTRY_FRAMES });
}

function entryState() {
  if (entry === null) gate(retireSlotIntoCooldown);
  return entry;
}

/** Oracle vs candidate on independent clones of one machine, diffed on the whole dump. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

// ── the corpus ──────────────────────────────────────────────────────────────────────────

let corpus = null;
function captureCorpus() {
  if (corpus) return corpus;
  const entries = [];
  const bases = new Set();
  const m = factory(new Map([[TARGET, (mm) => {
    entries.push(mm.clone());
    bases.add(`${hex4(mm.regs.ix)}/${hex4(mm.regs.iy)}`);
    return oracle(mm);
  }]]));
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `corpus run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "corpus run ran short");
  corpus = { entries, bases };
  return corpus;
}

// ── the crafted cross ───────────────────────────────────────────────────────────────────

/** Two bases inside work RAM that no captured dispatch uses, so the cross is not shadowed. */
const CRAFT_RECORD = 0xae00;

/** Prior values, including the ones the writes would leave anyway. */
const PRIORS = [0x00, 0x01, 0x7f, 0x80, 0xf0, 0xff];

function craft(record, entryBase, prior) {
  const m = entryState().clone();
  m.regs.ix = record;
  m.regs.iy = entryBase;
  m.mem8[record + OCCUPANCY] = prior.occupancy;
  m.mem8[record + DELAY] = prior.delay;
  m.mem8[entryBase] = prior.first;
  m.mem8[entryBase + SECOND_AXIS] = prior.second;
  return m;
}

let crossCache = null;
function cross() {
  if (crossCache) return crossCache;
  const out = [];
  for (const occupancy of PRIORS) {
    for (const delay of PRIORS) {
      for (const first of PRIORS) {
        for (const second of PRIORS) out.push({ occupancy, delay, first, second });
      }
    }
  }
  crossCache = out;
  return out;
}

const craftedCaught = (candidate) =>
  cross().filter((p) => unitDiff(candidate, craft(CRAFT_RECORD, DEFERRED_BLANK_CURSOR, p)) !== null).length;

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
  wholeMachineEquivalence(factory, WHOLE_FRAMES, new Map([[TARGET, hosted(candidate)]]));

// ── the twins ───────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: empties the slot but never puts it on the delay, so it is free again immediately. */
function brokenNoDelay(m) {
  const { mem8 } = m;
  mem8[m.regs.ix + OCCUPANCY] = 0;
  mem8[m.regs.iy] = 0;
  mem8[m.regs.iy + SECOND_AXIS] = 0;
}

/** BUG: arms the delay and leaves the slot occupied, so the object stays in play. */
function brokenKeepsOccupancy(m) {
  const { mem8 } = m;
  mem8[m.regs.iy] = 0;
  mem8[m.regs.iy + SECOND_AXIS] = 0;
  mem8[m.regs.ix + DELAY] = DELAY_FRAMES;
}

/** BUG: zeroes only one of the two coordinate bytes, so the object half-vanishes. */
function brokenOneCoordinate(m) {
  const { mem8 } = m;
  mem8[m.regs.ix + OCCUPANCY] = 0;
  mem8[m.regs.iy] = 0;
  mem8[m.regs.ix + DELAY] = DELAY_FRAMES;
}

/** BUG: the delay is one frame short, which is the smallest wrong count there is. */
function brokenDelayOffByOne(m) {
  const { mem8 } = m;
  mem8[m.regs.ix + OCCUPANCY] = 0;
  mem8[m.regs.iy] = 0;
  mem8[m.regs.iy + SECOND_AXIS] = 0;
  mem8[m.regs.ix + DELAY] = DELAY_FRAMES - 1;
}

/** BUG: the delay byte is written into the sprite entry instead of the record. */
function brokenDelayOnWrongBase(m) {
  const { mem8 } = m;
  mem8[m.regs.ix + OCCUPANCY] = 0;
  mem8[m.regs.iy] = 0;
  mem8[m.regs.iy + SECOND_AXIS] = 0;
  mem8[m.regs.iy + DELAY] = DELAY_FRAMES;
}

/** Per twin: its exact catch count over the crafted cross, and whether a real dispatch sees it. */
const TWINS = [
  ["no-op", brokenNoOp, 1295, true],
  ["no-delay", brokenNoDelay, 1080, true],
  ["keeps-occupancy", brokenKeepsOccupancy, 1080, false],
  ["one-coordinate", brokenOneCoordinate, 1080, false],
  ["delay-off-by-one", brokenDelayOffByOne, 1296, true],
  ["delay-on-wrong-base", brokenDelayOnWrongBase, 1296, true],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: retireSlotIntoCooldown == oracle on the whole dump", { skip }, () => {
  const r = gate(retireSlotIntoCooldown);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  const e = entryState();
  console.log(
    `  EQUAL: entry bases ${hex4(e.regs.ix)}/${hex4(e.regs.iy)}; every byte identical, the ` +
      "stack scratch included",
  );
});

test("NOT VACUOUS: a no-op candidate FAILS the same diff at the real dispatch", { skip }, () => {
  const d = unitDiff(brokenNoOp, entryState());
  assert.notEqual(d, null, "the diff passed a candidate that does nothing, so RAM is NOT this gate");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("EXCLUDED, deliberately: the stack pointer and pc, and nothing else", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  retireSlotIntoCooldown(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    MOVED,
    "the excluded set changed shape: this routine reads no register into a result, so only the " +
      "return may show",
  );
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${MOVED.join(", ")} and pc`);
});

test("CORPUS: every captured dispatch replays identically", { skip }, () => {
  const { entries, bases } = captureCorpus();
  assert.equal(entries.length, DISPATCHES, "the dispatch count moved");
  for (const captured of entries) {
    assert.equal(unitDiff(retireSlotIntoCooldown, captured), null, "a captured dispatch diverged");
  }
  console.log(`  CORPUS: ${entries.length} dispatches, bases ${[...bases].join(" ")}, identical`);
});

test("EXHAUSTIVE: the crafted cross of prior values is identical", { skip }, () => {
  for (const p of cross()) {
    const d = unitDiff(retireSlotIntoCooldown, craft(CRAFT_RECORD, DEFERRED_BLANK_CURSOR, p));
    assert.equal(d, null, `${JSON.stringify(p)}: ${show(d)}`);
  }
  assert.equal(cross().length, PRIORS.length ** 4, "the crafted cross shrank");
  console.log(`  EXHAUSTIVE: ${cross().length} prior combinations identical`);
});

test("WHOLE-MACHINE: the session is byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(retireSlotIntoCooldown);
  assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the override never dispatched");
  assert.equal(w.framesCompared, WHOLE_FRAMES, "the replay ran short");
  assert.equal(w.equal, true, `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  console.log(`  WHOLE-MACHINE: ${w.framesCompared} frames, ${w.invocations.get(TARGET)} dispatches`);
});

test("TEETH: removing the shim's return kills the run, so the shim is load-bearing", { skip }, () => {
  let threw = null;
  try {
    const w = wholeMachineEquivalence(factory, WHOLE_FRAMES, new Map([[TARGET, retireSlotIntoCooldown]]));
    threw = w.equal ? null : "forked";
  } catch (e) {
    threw = String(e).slice(0, 80);
  }
  assert.notEqual(threw, null, "the unshimmed rewrite ran clean, so the shim proves nothing");
  console.log(`  TEETH/shim: the unshimmed rewrite dies — ${threw}`);
});

for (const [label, twin, crossCaught, seenAtDispatch] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    assert.equal(craftedCaught(twin), crossCaught, `the ${label} twin's crafted catch count moved`);
    console.log(`  TEETH/${label}: caught on ${crossCaught} of ${cross().length} crafted entries`);
  });

  test(`TEETH: the ${label} twin at the real dispatch, hole pinned`, { skip }, () => {
    const d = unitDiff(twin, entryState());
    assert.equal(d !== null, seenAtDispatch, `the real dispatch's view of the ${label} twin moved`);
    console.log(`  TEETH/${label}: real dispatch ${d ? `caught — ${show(d)}` : "BLIND, as recorded"}`);
  });
}
