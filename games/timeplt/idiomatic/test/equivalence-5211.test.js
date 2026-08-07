// SPDX-License-Identifier: GPL-3.0-only
/**
 * destroyTargetsHitByShots — memory-equivalent to the frozen oracle at ROM 0x5211.
 *
 * WHAT IT IS. A nested sweep: six shot records at 0xAA80 (16-byte stride, taken low-byte-only so
 * the page never changes) against a caller-supplied run of target slots, whose state byte lives in
 * a record at DE and whose two coordinates live in a 2-byte sprite entry at IY, halves 49 apart.
 * A live shot inside the caller's box around a live target destroys both — state code 240 — and
 * posts the chained hit score at 0x51DE, which is ALREADY DECOMPILED, so the rewrite calls
 * postChainedHitScore directly; dissolving that call belongs to this caller's unit. The sweep does
 * not stop at the first kill, so one shot can take several targets in one pass and the chain ramps
 * inside a single dispatch. Between outer passes the two cursors reload from 0xA991/0xA993 and the
 * inner count reloads from the SHADOW accumulator, not from B.
 *
 * ★ THE SHARED DRIVEN TAPE IS TOTALLY BLIND TO THIS ROUTINE, AND THAT IS THE HEADLINE. The
 * coin -> start tape never presses fire, so no shot slot is ever live: across every dispatch in
 * 2400 driven frames not one writes a byte, and the required contract call therefore captures a
 * DEAD first dispatch. All four vacuity flavours land on it at once — register-only is moot but
 * `ram === null` passes a no-op (1), the first dispatch is the cloned one and no frame budget
 * changes that (2), the entry is degenerate because every shot state is already 0 (3), and the
 * driven corpus never varies in the one input that matters (4). Measured, not argued: a separate
 * arm asserts the whole driven corpus catches NONE of the eleven twins. The real teeth are the
 * undriven ATTRACT demo, which does fire, and a crafted space.
 *
 * GATE: contract unit-capture (asserted vacuous), plus two replayed real corpora and a crafted
 *   space. What it exercises, holes stated:
 *
 *   1. THE CONTRACT CALL at the real dispatch — RAM identical, and immediately re-run against a
 *      no-op to prove that arm decides nothing. Both facts are asserted; neither is a pass.
 *   2. ATTRACT, replayed at every dispatch, a minority of which actually destroy something. This
 *      is a NATURAL run with zero pokes — the demo's own fire path arms the shot slots.
 *   3. DRIVEN, replayed at every dispatch, all no-ops, kept to pin the blindness and
 *      because it is the only session that presents the shorter three-slot target run.
 *   4. CRAFTED, 1311 comparisons over what neither session presents: both coordinate axes swept
 *      whole, both zero-bands, the state codes, the box bounds, the counts including the 0 -> 256
 *      djnz wrap, the cursor reload, the inner-count reload and both page-preserving strides.
 *   5. THE DEAD STACK SCRATCH is EIGHT bytes, and only on a dispatch that kills: the pushed
 *      return around the score post plus the six the poster's own translated path dirties. The
 *      window is [SP-8, SP) from THIS dispatch's own stack pointer, pinned from both edges over
 *      the 40 acting attract dispatches — every divergence inside it, and its bottom byte reached.
 *   6. REGISTERS AND PC ARE EXCLUDED, DELIBERATELY, so `equal` is false for a CORRECT routine.
 *      Pinned to exactly {a, f, c, ix, sp} — measured over all 939 attract dispatches, where B, E
 *      and IY come back to their entry values because the reload cells hold them.
 *   7. LIVE-OUT IS MEMORY-ONLY, measured: a whole attract session with those four registers forced
 *      hostile after every dispatch leaves the machine bit-identical, and the tooth beside it
 *      proves the instrument reaches the routine.
 *   8. THE SIGNATURE IS HONEST: every register that is NOT a declared parameter forced hostile
 *      BEFORE every dispatch is likewise invisible, while the shadow accumulator — which IS a
 *      parameter — forks the run.
 *   9. TEETH — eleven twins at eleven distinct behaviours plus a no-bug CONTROL built from the
 *      same skeleton, so a twin's catches are attributable to its own bug and not to the skeleton.
 *
 * HOLE: the caller-supplied box is 7/15 on every dispatch either session presents, and the shot
 * base is always 0xAA80 with six slots; only the crafted space varies them. And no real session
 * here presents the 5-slot or 9-slot target runs that two of the five callers set up.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-5211.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { destroyTargetsHitByShots } from "../destroyTargetsHitByShots.js";
import { postChainedHitScore } from "../postChainedHitScore.js";
import { loc_5211 as oracle } from "../../translated/loc_5211.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { COMMAND_RING, CHAIN_WINDOW, CHAIN_STEP } from "../names.js";

const TARGET = 0x5211;
const SHOT_BASE = 0xaa80;
const ENTRY_BASE = 0xaa1a;
const RECORD_BASE = 0xa850;
const ENTRY_CURSOR_CELL = 0xa991;
const RECORD_CURSOR_CELL = 0xa993;
const RING_CURSOR = 0xa9b2;
const LIVE = 255;
const DESTROYED = 240;
const SCRATCH_BYTES = 8;
const ATTRACT_FRAMES = 3000;
const DRIVEN_FRAMES = 2400;

const u8 = (x) => x & 0xff;
const u16 = (x) => x & 0xffff;
const skip = romsPresent() ? false : "ROM images are absent from this checkout";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

// ── the contract call ───────────────────────────────────────────────────────────────────

let entry = null;

/** The required contract call, with the pristine entry harvested off the candidate's clone. */
function gate(candidate) {
  return unitEquivalence(
    makeMachine,
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
  if (entry === null) gate(destroyTargetsHitByShots);
  return entry;
}

// ── the differ ──────────────────────────────────────────────────────────────────────────

/** Every differing byte of two dumps as {addr, a, b}, the dead stack scratch included. */
function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

/** First REAL divergence: the same walk with the window below `sp` skipped. */
function ramDiff(a, b, sp) {
  return allDiffs(a, b).find((d) => !(d.addr >= sp - SCRATCH_BYTES && d.addr < sp)) ?? null;
}

/** Oracle vs candidate from one captured state, each on its own clone. */
function runBoth(state, candidate) {
  const a = state.clone();
  const b = state.clone();
  oracle(a);
  candidate(b);
  return { a, b, diff: ramDiff(a, b, state.regs.sp) };
}

// ── the twins ───────────────────────────────────────────────────────────────────────────
// One skeleton, one named bug each, so eleven behaviours are separable. The skeleton itself is a
// CONTROL: with no bug it must be clean everywhere, which is what makes a twin's catches
// attributable to its own bug rather than to a defect in the shared body.

function twinWith(bug) {
  return function twin(
    m,
    shot = m.regs.ix,
    entry_ = m.regs.iy,
    target = m.regs.de,
    firstCount = m.regs.b,
    laterCount = m.regs.a_,
    shots = m.regs.c,
    reach = m.regs.l,
    span = m.regs.h,
  ) {
    const { mem8, mem16 } = m;
    let slot = shot;
    let cursor = entry_;
    let record = target;
    let count = firstCount;
    let left = shots;
    do {
      if (bug === "ignores-shot-state" || mem8[slot] === LIVE) {
        let n = count;
        do {
          let hit = mem8[record] === LIVE;
          if (hit && bug !== "skips-dead-band") {
            if (u8(mem8[cursor] + 8) < 25) hit = false;
            if (hit && u8(mem8[cursor + 49] + 16) < 17) hit = false;
          }
          if (hit) {
            const limit = bug === "off-by-one-box" ? span + 1 : span;
            const [near, far] =
              bug === "axes-swapped" ? [mem8[slot + 4], mem8[slot + 6]] : [mem8[slot + 6], mem8[slot + 4]];
            hit =
              u8(u8(near - mem8[cursor]) + reach) < limit &&
              u8(u8(far - mem8[cursor + 49]) + reach) < limit;
          }
          if (hit) {
            mem8[slot] = DESTROYED;
            mem8[record] = DESTROYED;
            if (bug !== "no-score") postChainedHitScore(m);
            if (bug === "stops-at-first-hit") break;
          }
          cursor = u16(cursor + 2);
          record = bug === "record-stride-carries" ? u16(record + 16) : (record & 0xff00) | u8(record + 16);
          n = u8(n - 1);
        } while (n !== 0);
      }
      if (bug !== "keeps-register-bases") {
        cursor = mem16[ENTRY_CURSOR_CELL];
        record = mem16[RECORD_CURSOR_CELL];
      }
      count = bug === "first-count-everywhere" ? firstCount : laterCount;
      slot = bug === "shot-stride-carries" ? u16(slot + 16) : (slot & 0xff00) | u8(slot + 16);
      left = u8(left - 1);
    } while (left !== 0);
  };
}

const CONTROL = twinWith("no-bug");
const TWINS = [
  ["no-op", () => {}],
  ...[
    "ignores-shot-state",
    "skips-dead-band",
    "off-by-one-box",
    "axes-swapped",
    "stops-at-first-hit",
    "no-score",
    "record-stride-carries",
    "keeps-register-bases",
    "first-count-everywhere",
    "shot-stride-carries",
  ].map((bug) => [bug, twinWith(bug)]),
];

// ── the crafted space ───────────────────────────────────────────────────────────────────

/** A fully-determined scene stamped over the captured entry: shots, targets, cursors, counts. */
function scene(o = {}) {
  const s = entryState().clone();
  const { mem8 } = s;
  const shots = o.shots ?? SHOT_BASE;
  const cursor = o.cursor ?? ENTRY_BASE;
  const record = o.record ?? RECORD_BASE;
  for (let i = 0; i < 8; i++) {
    const p = (shots & 0xff00) | u8(shots + 16 * i);
    mem8[p] = 0;
    mem8[p + 4] = 0;
    mem8[p + 6] = 0;
  }
  for (let j = 0; j < 16; j++) {
    mem8[(record & 0xff00) | u8(record + 16 * j)] = 0;
    mem8[u16(cursor + 2 * j)] = 0;
    mem8[u16(cursor + 2 * j + 49)] = 0;
  }
  for (const [i, sh] of (o.shotList ?? []).entries()) {
    const p = (shots & 0xff00) | u8(shots + 16 * (sh.slot ?? i));
    mem8[p] = sh.state ?? LIVE;
    mem8[p + 6] = sh.first ?? 0;
    mem8[p + 4] = sh.second ?? 0;
  }
  for (const [j, t] of (o.targetList ?? []).entries()) {
    const k = t.slot ?? j;
    mem8[(record & 0xff00) | u8(record + 16 * k)] = t.state ?? LIVE;
    mem8[u16(cursor + 2 * k)] = t.first ?? 0;
    mem8[u16(cursor + 2 * k + 49)] = t.second ?? 0;
  }
  // A free ring and an expired window, so a posted score is VISIBLE rather than dropped.
  for (let cell = 0; cell < 64; cell++) mem8[COMMAND_RING + cell] = 0xff;
  mem8[RING_CURSOR] = 0;
  mem8[CHAIN_WINDOW] = 0;
  mem8[CHAIN_STEP] = 0;
  s.mem16[ENTRY_CURSOR_CELL] = o.reloadCursor ?? cursor;
  s.mem16[RECORD_CURSOR_CELL] = o.reloadRecord ?? record;
  s.regs.ix = shots;
  s.regs.iy = cursor;
  s.regs.de = record;
  s.regs.b = o.b ?? 7;
  s.regs.a_ = o.laterCount ?? o.b ?? 7;
  s.regs.c = o.c ?? 6;
  s.regs.l = o.reach ?? 7;
  s.regs.h = o.span ?? 15;
  return s;
}

const oneShot = (first, second) => [{ first, second }];
const axisSweep = (shotAt, axis) =>
  [...Array(256).keys()].map((v) => ({
    shotList: oneShot(shotAt, shotAt),
    targetList: [axis === "first" ? { first: v, second: shotAt } : { first: shotAt, second: v }],
  }));

// Each group answers one question the others cannot. The two "band" groups park the shot ON zero
// so the whole box falls inside the zero-band, which is the only way that test is separable.
const CRAFTED = {
  sweepFirst: axisSweep(100, "first"),
  sweepSecond: axisSweep(100, "second"),
  bandFirst: [...Array(256).keys()].map((v) => ({
    shotList: oneShot(0, 100),
    targetList: [{ first: v, second: 100 }],
  })),
  bandSecond: [...Array(256).keys()].map((v) => ({
    shotList: oneShot(100, 0),
    targetList: [{ first: 100, second: v }],
  })),
  states: [0, 1, DESTROYED, 254, LIVE].flatMap((ss) =>
    [0, 1, DESTROYED, 254, LIVE].map((ts) => ({
      shotList: [{ first: 100, second: 100, state: ss }],
      targetList: [{ first: 100, second: 100, state: ts }],
    })),
  ),
  bounds: [0, 1, 3, 7, 8, 16].flatMap((reach) =>
    [0, 1, 2, 15, 16, 31].flatMap((span) =>
      [0, 1, 7, 8, 15, 200, 255].map((delta) => ({
        reach,
        span,
        shotList: oneShot(100, 100),
        targetList: [{ first: u8(100 + delta), second: 100 }],
      })),
    ),
  ),
  multi: [
    {
      shotList: oneShot(100, 100),
      targetList: [
        { first: 100, second: 100 },
        { first: 103, second: 97 },
        { first: 100, second: 100 },
        { first: 200, second: 100 },
        { first: 99, second: 101 },
      ],
    },
  ],
  counts: [
    { b: 0, laterCount: 0, c: 1 },
    { b: 1, laterCount: 1, c: 1 },
    { b: 7, laterCount: 7, c: 0 },
    { b: 2, laterCount: 2, c: 2 },
    { b: 255, laterCount: 255, c: 1 },
  ].map((o) => ({
    ...o,
    shotList: [
      { first: 100, second: 100 },
      { slot: 1, first: 100, second: 100 },
    ],
    targetList: [
      { first: 100, second: 100 },
      { slot: 1, first: 100, second: 100 },
      { slot: 5, first: 100, second: 100 },
    ],
  })),
  countReload: [
    {
      b: 1,
      laterCount: 4,
      c: 3,
      shotList: [
        { first: 100, second: 100 },
        { slot: 1, first: 120, second: 120 },
        { slot: 2, first: 130, second: 130 },
      ],
      targetList: [
        { first: 100, second: 100 },
        { slot: 3, first: 120, second: 120 },
        { slot: 2, first: 130, second: 130 },
      ],
    },
  ],
  cursorReload: [
    {
      reloadCursor: ENTRY_BASE + 8,
      reloadRecord: RECORD_BASE + 0x40,
      b: 2,
      laterCount: 2,
      c: 3,
      shotList: [
        { first: 100, second: 100 },
        { slot: 1, first: 120, second: 120 },
      ],
      targetList: [
        { first: 100, second: 100 },
        { slot: 4, first: 120, second: 120 },
        { slot: 5, first: 120, second: 120 },
      ],
    },
  ],
  recordPage: [
    {
      record: 0xa8f0,
      b: 3,
      laterCount: 3,
      c: 2,
      shotList: [
        { first: 60, second: 100 },
        { slot: 1, first: 120, second: 100 },
      ],
      targetList: [
        { first: 60, second: 100 },
        { slot: 1, first: 120, second: 100 },
        { slot: 2, first: 180, second: 100 },
      ],
    },
  ],
  shotPage: [
    {
      shots: 0xaaf0,
      b: 3,
      laterCount: 3,
      c: 3,
      shotList: [
        { first: 60, second: 100 },
        { slot: 1, first: 120, second: 100 },
        { slot: 2, first: 180, second: 100 },
      ],
      targetList: [
        { first: 60, second: 100 },
        { slot: 1, first: 120, second: 100 },
        { slot: 2, first: 180, second: 100 },
      ],
    },
  ],
};

const CRAFTED_SIZE = Object.values(CRAFTED).reduce((n, g) => n + g.length, 0);

/** How many crafted comparisons a candidate loses. */
function craftedCaught(candidate) {
  let caught = 0;
  for (const group of Object.values(CRAFTED)) {
    for (const o of group) if (runBoth(scene(o), candidate).diff) caught++;
  }
  return caught;
}

// ── the two real corpora ────────────────────────────────────────────────────────────────

const CORPORA = [
  ["attract", [], ATTRACT_FRAMES],
  ["driven", undefined, DRIVEN_FRAMES],
];
const captured = new Map();

/** Every dispatch of one session, cloned at entry, so a candidate can be replayed against it. */
function corpus(name) {
  if (captured.has(name)) return captured.get(name);
  const [, tape, frames] = CORPORA.find(([n]) => n === name);
  const states = [];
  const probe = new Map([[TARGET, (mm) => {
    states.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = makeMachine(probe, tape ? { tape } : {});
  host.runFrames(frames);
  assert.equal(host.stoppedBy, null, `the ${name} corpus run stopped early: ${host.stoppedBy}`);
  assert.equal(host.frames.length, frames, `the ${name} corpus run captured ${host.frames.length}`);
  const after = states.map((s) => {
    const a = s.clone();
    oracle(a);
    return { sp: s.regs.sp, dump: a.dumpState() };
  });
  captured.set(name, { states, after });
  return captured.get(name);
}

/** Dispatches of a session on which a candidate parts from the oracle outside the scratch. */
function corpusCaught(name, candidate) {
  const { states, after } = corpus(name);
  let caught = 0;
  for (let i = 0; i < states.length; i++) {
    const b = states[i].clone();
    candidate(b);
    const db = b.dumpState();
    const { sp, dump } = after[i];
    for (let k = 0; k < dump.length; k++) {
      if (dump[k] === db[k]) continue;
      const addr = states[i].stateOffsetToAddr(k);
      if (addr >= sp - SCRATCH_BYTES && addr < sp) continue;
      caught++;
      break;
    }
  }
  return caught;
}

/** Dispatches of a session on which the oracle itself writes something. */
function corpusActing(name) {
  const { states, after } = corpus(name);
  let acting = 0;
  for (let i = 0; i < states.length; i++) {
    const before = states[i].dumpState();
    if (after[i].dump.some((v, k) => v !== before[k])) acting++;
  }
  return acting;
}

/** The first dispatch of a session on which the oracle writes — the one worth pinning. */
function firstActing(name) {
  const { states, after } = corpus(name);
  for (let i = 0; i < states.length; i++) {
    const before = states[i].dumpState();
    if (after[i].dump.some((v, k) => v !== before[k])) return states[i];
  }
  return null;
}

// ── the contract, and its vacuity ───────────────────────────────────────────────────────

test("THE CONTRACT CALL: destroyTargetsHitByShots == oracle on RAM at the real dispatch", { skip }, () => {
  const r = gate(destroyTargetsHitByShots);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  assert.equal(r.equal, false, "registers are excluded, so equal must be false here");
  console.log(`  CONTRACT: entry at sp=${hex4(entryState().regs.sp)} within ${ENTRY_FRAMES} frames`);
});

test("★ BLIND: that contract call decides NOTHING — a no-op passes it too", { skip }, () => {
  const s = entryState();
  const states = [...Array(6).keys()].map((i) => s.mem8[(SHOT_BASE & 0xff00) | u8(SHOT_BASE + 16 * i)]);
  assert.equal(s.regs.ix, SHOT_BASE, "the captured entry no longer sweeps the shot table");
  assert.deepEqual(states, [0, 0, 0, 0, 0, 0], "a shot slot went live at the captured entry, so " +
    "the first dispatch stopped being degenerate and this arm must be re-derived");

  const r = gate(() => {});
  assert.equal(r.ram, null, "a no-op now FAILS the contract call — re-derive the vacuity claim");
  console.log(`  BLIND: six shot states ${states.join(",")} — every branch is skipped, ` +
    "so RAM-identical is what a routine that does nothing also achieves");
});

test("★ BLIND: the whole driven session is a no-op, and catches none of the twins", { skip }, () => {
  const { states } = corpus("driven");
  assert.ok(states.length > 0, "the driven session never reached the routine");
  assert.equal(corpusActing("driven"), 0, "a driven dispatch now writes — the shared tape has " +
    "started firing and this whole blindness finding must be re-derived");
  const blind = TWINS.filter(([, twin]) => corpusCaught("driven", twin) === 0).map(([l]) => l);
  assert.equal(blind.length, TWINS.length, `the driven corpus caught ${TWINS.length - blind.length}`);
  console.log(`  BLIND: ${states.length} driven dispatches over ${DRIVEN_FRAMES} frames, ` +
    `0 acting, blind to all ${TWINS.length} twins`);
});

// ── the arms that decide ────────────────────────────────────────────────────────────────

test("ATTRACT: every dispatch of a natural firing session replays identically", { skip }, () => {
  const { states } = corpus("attract");
  const acting = corpusActing("attract");
  assert.equal(states.length, 939, `the attract corpus changed size to ${states.length}`);
  assert.equal(acting, 40, `the attract corpus now acts on ${acting} dispatches`);
  assert.equal(corpusCaught("attract", destroyTargetsHitByShots), 0, "the rewrite diverged on a real dispatch");
  console.log(`  ATTRACT: ${states.length} dispatches over ${ATTRACT_FRAMES} frames, ` +
    `${acting} of them destroying, all identical`);
});

test("DRIVEN: every dispatch of the shared tape replays identically", { skip }, () => {
  const { states } = corpus("driven");
  assert.equal(corpusCaught("driven", destroyTargetsHitByShots), 0, "the rewrite diverged on a driven dispatch");
  console.log(`  DRIVEN: ${states.length} dispatches identical (and every one a no-op)`);
});

test("CRAFTED: the whole input space neither session presents", { skip }, () => {
  assert.equal(craftedCaught(CONTROL), 0, "the twin SKELETON is not faithful, so no twin's " +
    "catches can be attributed to its own bug");
  assert.equal(craftedCaught(destroyTargetsHitByShots), 0, "the rewrite diverged somewhere in the crafted space");
  console.log(`  CRAFTED: ${CRAFTED_SIZE} comparisons over ` +
    `${Object.keys(CRAFTED).length} groups identical, control included`);
});

test("MULTI-KILL: one shot takes four targets in one pass and the chain ramps", { skip }, () => {
  const posted = (fn) => {
    const s = scene(CRAFTED.multi[0]);
    fn(s);
    return {
      destroyed: [0, 1, 2, 3, 4].filter((j) => s.mem8[RECORD_BASE + 16 * j] === DESTROYED),
      scores: [0, 1, 2, 3].map((k) => s.mem8[COMMAND_RING + 2 * k + 1]),
      shot: s.mem8[SHOT_BASE],
    };
  };
  const fromOracle = posted(oracle);
  assert.deepEqual(fromOracle.destroyed, [0, 1, 2, 4], "the oracle's own multi-kill is not as " +
    "claimed — the fourth target sits outside the box and the fifth inside it");
  assert.deepEqual(fromOracle.scores, [1, 2, 3, 4], "the chain must climb within one dispatch");
  assert.equal(fromOracle.shot, DESTROYED, "the shot must be destroyed alongside its targets");
  assert.deepEqual(posted(destroyTargetsHitByShots), fromOracle, "the rewrite's multi-kill diverged");
  console.log(`  MULTI-KILL: slots ${fromOracle.destroyed.join(",")} destroyed by one shot, ` +
    `scores ${fromOracle.scores.join(",")}`);
});

// ── what is excluded, and how far it reaches ────────────────────────────────────────────

test("EXCLUDED, deliberately: registers, pc, and eight scratch bytes on a killing pass",
  { skip },
  () => {
    const { states } = corpus("attract");
    const moved = new Set();
    for (const s of states) {
      const { a, b } = runBoth(s, destroyTargetsHitByShots);
      for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
    }
    assert.deepEqual([...moved].sort(), ["a", "c", "f", "ix", "sp"], "the excluded register set " +
      "changed shape across the corpus");

    const killer = firstActing("attract");
    const { a, b } = runBoth(killer, destroyTargetsHitByShots);
    assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
    assert.equal(a.regs.sp - b.regs.sp, 2, "the oracle pops its return address and the rewrite " +
      "does not — that unpopped word IS the mixed-migration leak, recorded not fixed");

    let deepest = 0;
    let shallowest = SCRATCH_BYTES;
    let acting = 0;
    for (const s of states) {
      const pair = runBoth(s, destroyTargetsHitByShots);
      const dirty = allDiffs(pair.a, pair.b).map((d) => d.addr);
      if (dirty.length === 0) continue;
      acting++;
      const sp = s.regs.sp;
      assert.ok(Math.min(...dirty) >= sp - SCRATCH_BYTES, "a divergence escaped the scratch window");
      assert.ok(Math.max(...dirty) < sp, "a divergence landed at or above the entry pointer");
      deepest = Math.max(deepest, sp - Math.min(...dirty));
      shallowest = Math.min(shallowest, sp - Math.max(...dirty));
    }
    assert.equal(acting, 40, `the killing-pass sample changed size to ${acting}`);
    assert.equal(deepest, SCRATCH_BYTES, "the exclusion must reach exactly as deep as the pushes");
    assert.equal(shallowest, 1, "and must start at the byte below the entry pointer");
    console.log(`  EXCLUDED: registers ${[...moved].sort().join(", ")}, pc, and ` +
      `[SP-${SCRATCH_BYTES}, SP) on ${acting} killing dispatches`);
  });

// ── the two claims about registers, measured over a whole session ───────────────────────

const DROPPED = ["a", "f", "c", "ix"];
const NOT_LIVE_IN = ["a", "f", "f_", "b_", "c_", "d_", "e_", "h_", "l_"];

/** Two whole attract sessions diffed frame by frame: clean, and one mutated at every dispatch. */
function hostileSession(mutate) {
  const base = makeMachine(undefined, { tape: [] });
  const baseFrames = base.runFrames(ATTRACT_FRAMES);
  let dispatches = 0;
  const host = makeMachine(new Map([[TARGET, (mm) => {
    dispatches += 1;
    return mutate(mm);
  }]]), { tape: [] });
  const hostFrames = host.runFrames(ATTRACT_FRAMES);
  const addrs = new Set();
  const n = Math.min(baseFrames.length, hostFrames.length);
  for (let i = 0; i < n; i++) {
    const x = baseFrames[i];
    const y = hostFrames[i];
    for (let o = 0; o < x.length; o++) if (x[o] !== y[o]) addrs.add(base.stateOffsetToAddr(o));
  }
  return { cells: addrs.size, frames: n, dispatches, stopped: base.stoppedBy ?? host.stoppedBy };
}

test("LIVE-OUT IS MEMORY-ONLY: the registers the rewrite drops steer nothing", { skip }, () => {
  const r = hostileSession((mm) => {
    const v = oracle(mm);
    for (const k of DROPPED) mm.regs[k] = k === "ix" ? 0x5a5a : 0x5a;
    return v;
  });
  assert.equal(r.stopped, null, `a run stopped early (${r.stopped})`);
  assert.equal(r.frames, ATTRACT_FRAMES, `compared ${r.frames} of ${ATTRACT_FRAMES} frames`);
  assert.ok(r.dispatches > 0, "the instrument never reached the routine");
  assert.equal(r.cells, 0, "a hostile value in a register the rewrite drops reached game memory: " +
    "some caller CONSUMES it and the live-out claim is wrong");
  console.log(`  LIVE-OUT: ${DROPPED.join(", ")} forced hostile after all ${r.dispatches} ` +
    `dispatches over ${r.frames} frames, no trace`);
});

test("HONEST SIGNATURE: every register that is not a parameter steers nothing", { skip }, () => {
  const r = hostileSession((mm) => {
    for (const k of NOT_LIVE_IN) mm.regs[k] = 0x5a;
    return oracle(mm);
  });
  assert.equal(r.stopped, null, `a run stopped early (${r.stopped})`);
  assert.equal(r.cells, 0, "a register absent from the parameter list steered the run, so the " +
    "signature is hiding a live-in");
  console.log(`  HONEST SIGNATURE: ${NOT_LIVE_IN.length} non-parameter registers forced hostile ` +
    `before all ${r.dispatches} dispatches, no trace`);
});

test("TEETH: the two hostile instruments are WIRED — a real input forks the run", { skip }, () => {
  const viaCell = hostileSession((mm) => {
    mm.mem16[ENTRY_CURSOR_CELL] = ENTRY_BASE + 22;
    return oracle(mm);
  });
  const viaShadow = hostileSession((mm) => {
    mm.regs.a_ = 1;
    return oracle(mm);
  });
  assert.ok(viaCell.cells > 0, "forcing the cursor cell left the machine identical, so the two " +
    "arms above never reach the routine and prove nothing");
  assert.ok(viaShadow.cells > 0, "forcing the shadow accumulator — a declared parameter — left " +
    "the machine identical, so the honest-signature arm proves nothing");
  console.log(`  TEETH/instruments: cursor cell forks ${viaCell.cells} cells, shadow ` +
    `accumulator forks ${viaShadow.cells}`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────
// Each twin is a plausible way to get ONE behaviour wrong, and each must be caught by the same
// comparison the rewrite passes — at a real cell, never at a stack-scratch ghost.

const CRAFTED_CATCHES = {
  "no-op": 110,
  "ignores-shot-state": 4,
  "skips-dead-band": 23,
  "off-by-one-box": 12,
  "axes-swapped": 9,
  "stops-at-first-hit": 6,
  "no-score": 110,
  "record-stride-carries": 1,
  "keeps-register-bases": 4,
  "first-count-everywhere": 1,
  "shot-stride-carries": 1,
};

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT in the crafted space`, { skip }, () => {
    const caught = craftedCaught(twin);
    assert.equal(caught, CRAFTED_CATCHES[label], `the ${label} twin's catch count moved`);
    assert.ok(caught > 0, `the crafted space PASSED the ${label} twin — it has no teeth`);
    const sample = Object.values(CRAFTED)
      .flat()
      .map((o) => runBoth(scene(o), twin).diff)
      .find(Boolean);
    console.log(`  TEETH/${label}: caught on ${caught}/${CRAFTED_SIZE} — first ${show(sample)}`);
  });
}

test("TEETH: what the natural session can and cannot see, and the crafted space covers the rest",
  { skip },
  () => {
    const seen = TWINS.filter(([, twin]) => corpusCaught("attract", twin) > 0).map(([l]) => l);
    assert.deepEqual(
      seen,
      ["no-op", "off-by-one-box", "axes-swapped", "no-score", "keeps-register-bases"],
      "the attract session's discriminating set moved — re-derive the crafted space against it",
    );
    const blind = TWINS.filter(([l]) => !seen.includes(l));
    for (const [label, twin] of blind) {
      assert.ok(craftedCaught(twin) > 0, `${label} escapes BOTH real sessions and the crafted space`);
    }
    console.log(`  TEETH: the natural session catches ${seen.length} twins by itself; the ` +
      `remaining ${blind.length} exist only in the crafted space`);
  });

test("TEETH: the contract call is blind to every twin, which is why the arms above exist",
  { skip },
  () => {
    const caught = TWINS.filter(([, twin]) => gate(twin).ram !== null).map(([l]) => l);
    assert.deepEqual(caught, [], `the contract call now catches ${caught.join(", ")} — the ` +
      "captured entry became informative and the vacuity finding must be re-derived");
    console.log(`  TEETH: all ${TWINS.length} twins PASS the required contract call`);
  });
