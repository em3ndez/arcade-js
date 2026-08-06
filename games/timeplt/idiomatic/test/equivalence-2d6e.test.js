// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2d6e — memory-equivalent to the frozen oracle at ROM 0x2D6E.
 *
 * GATE: strict unit-capture for the entry state, judged by a RAM diff that MASKS the pushed
 *   continuation, plus crafted entries and three replayed sessions. The host game runs the
 *   shared coin -> start tape until 0x2D6E first dispatches, and both arms then run on
 *   independent clones of that one pristine machine.
 *
 * ★ THE STACK SCRATCH IS MASKED, AND THE MASK IS MEASURED. The oracle brackets each of its two
 *   helper calls with a pushed continuation and the rewrite pushes nothing, so two bytes below
 *   the entry stack pointer differ for a CORRECT routine. Every comparison here skips exactly
 *   those two addresses. SCRATCH pins the set — it asserts the unmasked diff is non-empty and
 *   lies wholly inside that window — and every TEETH arm asserts the byte a twin is caught on is
 *   one of the four the routine writes, so a twin caught on a stack ghost would not count.
 *
 * ★ THE REAL DISPATCH HAS NO TEETH, MEASURED RATHER THAN ASSUMED. Both displacement cells hold
 *   zero at the dispatch the shared budget reaches, so not one of the four written bytes moves:
 *   VACUOUS puts an empty body through the same comparison and it passes, and BLIND puts all
 *   eight broken twins through it and every one passes. Everything with teeth in this file
 *   therefore runs on crafted entries or on replayed real traffic.
 *
 * ★ THE SHARED CORPUS IS BLIND TO THE ROUNDING, AND BOTH DIRECTIONS ARE ASSERTED. The
 *   displacement is quartered with a floor, so a backward displacement that does not divide by
 *   four rounds AWAY from zero — the case that separates this routine from a truncating one, and
 *   ROUNDING pins the arithmetic to concrete bytes. The shared tape holds one heading and
 *   presents only two distinct displacement values, neither backward; UNIFORM asserts that
 *   rather than assuming it, then asserts the widened corpus — the stick walked round the
 *   compass, plus undriven attract — does present backward displacements and displacements that
 *   round. The two rounding twins must then be caught on the widened corpus and NOT on the
 *   shared one.
 *
 * LIVE-OUT is memory only, derived from the CALLERS rather than from the instruction sequence:
 *   all three go straight on to a routine that reloads both halves out of the object record, and
 *   what follows that overwrites the address pairs before reading them. The position pair the
 *   rewrite leaves standing agrees with the oracle's anyway, and EXCLUDED asserts that beside
 *   the register set that is allowed to differ.
 *
 * HOLE: one object slot. Every dispatch of all three sessions arrives with the same record
 * bases, so the crafted entries vary the values the routine reads and never the bases it reads
 * them from. REAL TRAFFIC asserts the bases really are constant instead of assuming it.
 *
 * HOLE: seven of the eight twins are pinned to an exact predicate over the input and the catch
 * counts must equal it; the no-carry twin has no closed form here and is held to a named
 * discriminating entry plus a positive catch count on both the sweep and real traffic.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-2d6e.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, COIN_FRAME, START_FRAME, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_2d6e } from "../loc_2d6e.js";
import { loc_2d6e as oracle } from "../../translated/loc_2d6e.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u8, u16 } from "../../../../core/int.js";

const TARGET = 0x2d6e;
const DISPLACEMENT_A = 0xa808;
const DISPLACEMENT_B = 0xa80a;
// One pushed continuation, live only for the length of a helper call and never read again.
const SCRATCH_BYTES = 2;
const CORPUS_FRAMES = 1500;

const skip = romsPresent() ? false : "ROM images are not assembled";

const IN0 = 0xc300;
const IN1 = 0xc320;
const COIN = 0x01;
const START = 0x08;
const LEFT = 0x01;
const RIGHT = 0x02;
const UP = 0x04;
const DOWN = 0x08;
const FIRE = 0x10;
const HOLD = 8;
const TURN_HOLD = 60;
const TURN_FIRST_FRAME = 640;

const hex4 = (v) => "0x" + u16(v).toString(16).padStart(4, "0");
const signed = (v) => (v << 16) >> 16;
/** The displacement as it lands: itself plus a quarter of itself, the quarter floored. */
const lengthen = (d) => u16(signed(d) + (signed(d) >> 2));
const show = (d) => (d ? `${hex4(d.addr)}: oracle=${d.a} candidate=${d.b}` : "identical");

let entry = null;

/** The capture call, with the entry state harvested off the candidate arm's clone. */
function capture(candidate) {
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
  if (entry === null) capture(loc_2d6e);
  return entry;
}

/** The two bytes below the entry stack pointer — the whole of what the mask hides. */
function scratchWindow() {
  const sp = entryState().regs.sp;
  return { low: u16(sp - SCRATCH_BYTES), high: sp };
}

/** Every differing byte between two machines, with the address each came from. */
function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

/** The first differing byte outside that window, or null when only the scratch moved. */
function maskedDiff(a, b) {
  const w = scratchWindow();
  return allDiffs(a, b).find((d) => d.addr < w.low || d.addr >= w.high) ?? null;
}

// The four bytes the routine writes, addressed off the two record bases the caller supplies.
const wholeA = (m) => u16(m.regs.iy + 49);
const fractionA = (m) => u16(m.regs.ix + 3);
const wholeB = (m) => u16(m.regs.iy);
const fractionB = (m) => u16(m.regs.ix + 5);
const writtenBytes = (m) => [wholeA(m), fractionA(m), wholeB(m), fractionB(m)];

/** The real entry with both displacements and all four position bytes forced. */
function craft(prior) {
  const m = entryState().clone();
  m.mem16[DISPLACEMENT_A] = prior.dA;
  m.mem16[DISPLACEMENT_B] = prior.dB;
  m.mem8[wholeA(m)] = prior.wA;
  m.mem8[fractionA(m)] = prior.fA;
  m.mem8[wholeB(m)] = prior.wB;
  m.mem8[fractionB(m)] = prior.fB;
  return m;
}

function craftedDiff(candidate, prior) {
  const a = craft(prior);
  const b = craft(prior);
  oracle(a);
  candidate(b);
  return maskedDiff(a, b);
}

/** Zero, the values either side of where a quarter first appears, whole steps, the two
 * magnitudes the game's own drift uses, the sign extremes, and backward steps that do and do
 * not divide by four. */
const DISPLACEMENTS = [
  0x0000, 0x0001, 0x0003, 0x0004, 0x00ff, 0x0100,
  0x0180, 0x7fff, 0x8000, 0xff00, 0xfffd, 0xffff,
];

const POSITIONS = [
  { wA: 0, fA: 0, wB: 0, fB: 0 },
  { wA: 0, fA: 255, wB: 255, fB: 0 },
  { wA: 255, fA: 255, wB: 255, fB: 255 },
  { wA: 138, fA: 203, wB: 129, fB: 88 },
  { wA: 1, fA: 1, wB: 254, fB: 254 },
];

function craftedPriors() {
  const out = [];
  for (const dA of DISPLACEMENTS) {
    for (const dB of DISPLACEMENTS) {
      for (const p of POSITIONS) out.push({ ...p, dA, dB });
    }
  }
  return out;
}

/** One fraction byte swept 0..255 against displacements that reach into the whole byte. */
function carryPriors() {
  const out = [];
  for (let f = 0; f < 256; f++) out.push({ wA: 200, fA: f, wB: 7, fB: f, dA: 1, dB: 0xffff });
  return out;
}

/** The shared tape plus the stick walked once round the compass, so the heading keeps changing. */
function turnTape() {
  const tape = [
    { frame: COIN_FRAME, port: IN0, bits: COIN, dur: HOLD },
    { frame: START_FRAME, port: IN0, bits: START, dur: HOLD },
    { frame: TURN_FIRST_FRAME - HOLD, port: IN1, bits: FIRE, dur: CORPUS_FRAMES },
  ];
  const compass = [
    LEFT, LEFT | UP, UP, UP | RIGHT, RIGHT, RIGHT | DOWN,
    DOWN, DOWN | LEFT, LEFT, UP, RIGHT, DOWN,
  ];
  let frame = TURN_FIRST_FRAME;
  for (const bits of compass) {
    tape.push({ frame, port: IN1, bits, dur: TURN_HOLD });
    frame += TURN_HOLD;
  }
  return tape;
}

const TAPES = [
  ["shared", {}],
  ["turning", { tape: turnTape() }],
  ["attract", { tape: [] }],
];

/**
 * Every entry state a session under one tape presents — both displacements and all four
 * position bytes. Collected by snooping the dispatch and delegating, so the host run is the
 * untouched one.
 */
const corpora = new Map();
function corpus(label, opts) {
  if (!corpora.has(label)) {
    const seen = new Map();
    const bases = new Set();
    let dispatches = 0;
    const snoop = new Map([[TARGET, (mm) => {
      dispatches++;
      bases.add(`${hex4(mm.regs.ix)}/${hex4(mm.regs.iy)}`);
      const prior = {
        dA: mm.mem16[DISPLACEMENT_A],
        dB: mm.mem16[DISPLACEMENT_B],
        wA: mm.mem8[wholeA(mm)],
        fA: mm.mem8[fractionA(mm)],
        wB: mm.mem8[wholeB(mm)],
        fB: mm.mem8[fractionB(mm)],
      };
      const key = Object.values(prior).join(",");
      if (!seen.has(key)) seen.set(key, prior);
      return oracle(mm);
    }]]);
    const host = makeMachine(snoop, opts);
    const frames = host.runFrames(CORPUS_FRAMES);
    corpora.set(label, {
      priors: [...seen.values()],
      bases: [...bases],
      dispatches,
      frames: frames.length,
      stoppedBy: host.stoppedBy,
    });
  }
  return corpora.get(label);
}

/** The three sessions' entry states merged, deduplicated across tapes. */
function everyPrior() {
  const out = new Map();
  for (const [label, opts] of TAPES) {
    for (const p of corpus(label, opts).priors) out.set(Object.values(p).join(","), p);
  }
  return [...out.values()];
}

/** How many priors a twin is caught on, how many a predicate says it must be, and whether any
 * catch landed on something other than the four bytes the routine writes. */
function catchCount(twin, priors, pred) {
  let caught = 0;
  let want = 0;
  let ghosts = 0;
  for (const p of priors) {
    const d = craftedDiff(twin, p);
    if (d) {
      caught++;
      if (!writtenBytes(entryState()).includes(d.addr)) ghosts++;
    }
    if (pred && pred(p)) want++;
  }
  return { caught, want, ghosts };
}

// ── the contract call ───────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: loc_2d6e == oracle outside the pushed continuation", { skip }, () => {
  capture(loc_2d6e);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  loc_2d6e(b);
  assert.equal(maskedDiff(a, b), null, `RAM diverged — ${show(maskedDiff(a, b))}`);
  for (const at of writtenBytes(a)) {
    assert.equal(a.mem8[at], b.mem8[at], `the byte at ${hex4(at)} diverged`);
  }
  const e = entryState();
  console.log(
    `  EQUAL: entry bases ${hex4(e.regs.ix)}/${hex4(e.regs.iy)} within ${ENTRY_FRAMES} frames; ` +
      "RAM identical outside the scratch",
  );
});

test("SCRATCH: the masked bytes are exactly the pushed continuation, and nothing else moves",
  { skip },
  () => {
    const a = entryState().clone();
    const b = entryState().clone();
    oracle(a);
    loc_2d6e(b);
    const w = scratchWindow();
    const diffs = allDiffs(a, b);
    assert.ok(
      diffs.length > 0,
      "the unmasked diff is clean, so the mask hides nothing and this file's whole premise — " +
        "that the frozen side pushes and the rewrite does not — has changed",
    );
    for (const d of diffs) {
      assert.ok(
        d.addr >= w.low && d.addr < w.high,
        `${hex4(d.addr)} differs and is OUTSIDE the masked window — the mask is hiding a real ` +
          "cell somewhere and every comparison in this file is suspect",
      );
    }
    assert.equal(diffs.length, SCRATCH_BYTES, "the scratch grew or shrank");
    console.log(
      `  SCRATCH: ${diffs.length} bytes differ, all within ${hex4(w.low)}..${hex4(w.high - 1)} — ` +
        diffs.map((d) => `${hex4(d.addr)} ${d.a}/${d.b}`).join(", "),
    );
  });

/** Both arms from the untouched real entry, judged by the masked diff. */
function diffAtEntry(candidate) {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  candidate(b);
  return maskedDiff(a, b);
}

test("VACUOUS: the real dispatch moves no byte at all, so an empty body passes", { skip }, () => {
  const e = entryState();
  assert.equal(e.mem16[DISPLACEMENT_A], 0, "the first displacement is no longer zero here");
  assert.equal(e.mem16[DISPLACEMENT_B], 0, "the second displacement is no longer zero here");

  const a = entryState().clone();
  oracle(a);
  for (const at of writtenBytes(a)) {
    assert.equal(a.mem8[at], e.mem8[at], `${hex4(at)} moved — the dispatch is no longer inert`);
  }
  assert.equal(
    diffAtEntry(() => {}),
    null,
    "an empty body was caught at the real dispatch, so the dispatch is NOT inert after all and " +
      "the blindness this file is built around must be re-measured",
  );
  console.log("  VACUOUS: both displacements zero, no byte moves, an empty body passes");
});

test("EXCLUDED, deliberately: registers and pc diverge, the position pair does not", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  loc_2d6e(b);

  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(
    moved,
    ["f", "d", "e", "sp"],
    "the excluded set changed shape: only the flag byte, the pair the frozen side loads each " +
      "coordinate into, and the stack pointer may differ",
  );
  assert.notEqual(a.pc, b.pc, "the frozen side's return moves pc; the rewrite returns to JS");
  assert.equal(a.regs.hl, b.regs.hl, "the position pair left standing must agree");
  console.log(`  EXCLUDED: registers ${moved.join(", ")} and pc — hl and RAM agree`);
});

// ── crafted entries, which is where the teeth are ───────────────────────────────────────────

test("CRAFTED: every displacement x position combination steps as the frozen side steps it",
  { skip },
  () => {
    const priors = craftedPriors();
    for (const p of priors) {
      const d = craftedDiff(loc_2d6e, p);
      assert.equal(d, null, `${JSON.stringify(p)}: ${show(d)}`);
    }
    assert.equal(priors.length, DISPLACEMENTS.length ** 2 * POSITIONS.length, "the sweep shrank");
    console.log(`  CRAFTED: ${priors.length} entries identical`);
  });

test("CARRY: a fraction swept 0..255 carries into the whole byte the same way", { skip }, () => {
  const priors = carryPriors();
  for (const p of priors) {
    const d = craftedDiff(loc_2d6e, p);
    assert.equal(d, null, `fraction=${p.fA}: ${show(d)}`);
  }
  const wrapped = craft({ wA: 255, fA: 255, wB: 0, fB: 0, dA: 1, dB: 0 });
  loc_2d6e(wrapped);
  assert.equal(wrapped.mem8[wholeA(wrapped)], 0, "the whole byte must round, not widen");
  assert.equal(wrapped.mem8[fractionA(wrapped)], 0, "the fraction must round too");
  console.log(`  CARRY: ${priors.length} fractions identical, including the wrap back to zero`);
});

test("ROUNDING: the quarter is floored, so a backward displacement overshoots", { skip }, () => {
  const cases = [
    { d: 0x0004, moved: 0x1005, why: "a forward step of four gains a whole quarter" },
    { d: 0x0003, moved: 0x1003, why: "a forward step of three gains nothing" },
    { d: 0xfffd, moved: 0x0ffc, why: "a backward step of three gives back four" },
    { d: 0xffff, moved: 0x0ffe, why: "a backward step of one gives back two" },
  ];
  for (const c of cases) {
    const prior = { wA: 0x10, fA: 0x00, wB: 0x10, fB: 0x00, dA: c.d, dB: c.d };
    const b = craft(prior);
    loc_2d6e(b);
    const got = (b.mem8[wholeA(b)] << 8) + b.mem8[fractionA(b)];
    assert.equal(got, c.moved, `${hex4(c.d)}: ${c.why} — got ${hex4(got)}`);
    assert.equal(craftedDiff(loc_2d6e, prior), null, `${hex4(c.d)} diverged from the frozen side`);
  }
  console.log(
    "  ROUNDING: " + cases.map((c) => `${hex4(c.d)} -> ${hex4(c.moved)}`).join(", ") +
      " from a starting coordinate of 0x1000",
  );
});

// ── the corpora, and the blindness of the shared one ────────────────────────────────────────

test("UNIFORM: the shared tape presents nothing backward and nothing that rounds; two others do",
  { skip },
  () => {
    const shared = corpus("shared", {}).priors;
    assert.ok(shared.length > 0, "vacuous: the shared tape never reached the routine");
    const sharedSteps = [...new Set(shared.flatMap((p) => [p.dA, p.dB]))];
    assert.deepEqual(
      sharedSteps.filter((s) => s >= 0x8000).map(hex4),
      [],
      "the shared tape now presents a backward displacement — the blindness this file is built " +
        "around has changed and the rounding twins must be re-measured",
    );
    assert.deepEqual(
      sharedSteps.filter((s) => roundsAway(s)).map(hex4),
      [],
      "the shared tape now presents a displacement whose quarter rounds",
    );
    assert.ok(sharedSteps.some((s) => s !== 0), "the shared tape presents nothing but zero");

    const wide = everyPrior();
    assert.ok(wide.length > shared.length, "vacuous: widening the tapes added no entry");
    const wideSteps = [...new Set(wide.flatMap((p) => [p.dA, p.dB]))];
    const backward = wideSteps.filter((s) => s >= 0x8000);
    const rounding = wideSteps.filter((s) => roundsAway(s));
    assert.ok(backward.length > 0, "no tape presents a backward displacement — that path is untested");
    assert.ok(rounding.length > 0, "no tape presents a displacement that rounds — likewise");

    const crafted = DISPLACEMENTS.filter((s) => s >= 0x8000 && roundsAway(s));
    assert.ok(crafted.length > 0, "vacuous: no crafted displacement is both backward and rounding");
    console.log(
      `  UNIFORM: shared presents ${sharedSteps.length} distinct displacements, none backward ` +
        `and none rounding; the three tapes present ${wideSteps.length}, ${backward.length} ` +
        `backward and ${rounding.length} rounding; ${crafted.length} crafted are both`,
    );
  });

test("REAL TRAFFIC: every entry state three sessions present, replayed", { skip }, () => {
  const e = entryState();
  const base = `${hex4(e.regs.ix)}/${hex4(e.regs.iy)}`;
  let checked = 0;
  for (const [label, opts] of TAPES) {
    const c = corpus(label, opts);
    assert.equal(c.stoppedBy, null, `the ${label} session stopped early: ${c.stoppedBy}`);
    assert.equal(c.frames, CORPUS_FRAMES, `the ${label} session lost a frame`);
    assert.ok(c.priors.length > 0, `vacuous: the ${label} session never reached the routine`);
    assert.deepEqual(
      c.bases,
      [base],
      `the ${label} session dispatched more than one object slot, so replaying its entries at ` +
        "the captured bases no longer reproduces them",
    );
    for (const p of c.priors) {
      const d = craftedDiff(loc_2d6e, p);
      assert.equal(d, null, `${label} ${JSON.stringify(p)}: ${show(d)}`);
      checked++;
    }
    console.log(
      `  REAL TRAFFIC/${label}: ${c.priors.length} distinct entries over ${c.dispatches} ` +
        `dispatches in ${c.frames} frames — all identical`,
    );
  }
  assert.ok(checked > 0, "vacuous: no entry was replayed");
});

test("BUDGET: the shared entry budget reaches this routine", { skip }, () => {
  const r = unitEquivalence(makeMachine, TARGET, oracle, oracle, { maxFrames: ENTRY_FRAMES });
  assert.equal(r.ram, null, "the budget reached the routine but the two frozen arms disagreed");
  console.log(`  BUDGET: ${ENTRY_FRAMES} shared frames reach the routine`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────────
// A gate that cannot fail is worthless. Each twin below is a plausible way to get this routine
// wrong — a dropped write, a dropped carry, a swapped pair, and three different misreadings of
// the quarter — and each must be caught by the same comparison the real arm passes, on exactly
// the entries a predicate over the INPUT names. No predicate consults the twin, so the blind set
// is re-derived from the data rather than recorded off a run.

/** True when the quarter of this displacement does not divide, and the floor runs away from zero. */
function roundsAway(d) {
  return signed(d) < 0 && signed(d) % 4 !== 0;
}

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: stores the whole bytes but never the two fraction bytes, so sub-steps never bank. */
function brokenWholeOnly(m) {
  const { mem8 } = m;
  mem8[wholeA(m)] = ((mem8[wholeA(m)] << 8) + mem8[fractionA(m)] + lengthen(m.mem16[DISPLACEMENT_A])) >> 8;
  mem8[wholeB(m)] = ((mem8[wholeB(m)] << 8) + mem8[fractionB(m)] + lengthen(m.mem16[DISPLACEMENT_B])) >> 8;
}

/** BUG: displaces the first coordinate and forgets the second one entirely. */
function brokenSecondSkipped(m) {
  const { mem8 } = m;
  const moved = (mem8[wholeA(m)] << 8) + mem8[fractionA(m)] + lengthen(m.mem16[DISPLACEMENT_A]);
  mem8[wholeA(m)] = moved >> 8;
  mem8[fractionA(m)] = moved;
}

/** BUG: adds each displacement byte to its own half, so a fraction overflow never carries. */
function brokenNoCarry(m) {
  const { mem8 } = m;
  const dA = m.mem16[DISPLACEMENT_A];
  const dB = m.mem16[DISPLACEMENT_B];
  mem8[wholeA(m)] = mem8[wholeA(m)] + (dA >> 8);
  mem8[fractionA(m)] = mem8[fractionA(m)] + u8(dA);
  mem8[wholeB(m)] = mem8[wholeB(m)] + (dB >> 8);
  mem8[fractionB(m)] = mem8[fractionB(m)] + u8(dB);
}

/** BUG: feeds each coordinate the other coordinate's displacement. */
function brokenSwapped(m) {
  applyStep(m, wholeA(m), fractionA(m), lengthen(m.mem16[DISPLACEMENT_B]));
  applyStep(m, wholeB(m), fractionB(m), lengthen(m.mem16[DISPLACEMENT_A]));
}

/** BUG: applies the displacement whole, dropping the extra quarter. */
function brokenNoQuarter(m) {
  applyStep(m, wholeA(m), fractionA(m), m.mem16[DISPLACEMENT_A]);
  applyStep(m, wholeB(m), fractionB(m), m.mem16[DISPLACEMENT_B]);
}

/** BUG: truncates the quarter toward zero instead of flooring it. */
function brokenTruncatingQuarter(m) {
  applyStep(m, wholeA(m), fractionA(m), truncated(m.mem16[DISPLACEMENT_A]));
  applyStep(m, wholeB(m), fractionB(m), truncated(m.mem16[DISPLACEMENT_B]));
}

/** BUG: quarters the displacement as an unsigned number, so a backward step lurches forward. */
function brokenUnsignedQuarter(m) {
  applyStep(m, wholeA(m), fractionA(m), m.mem16[DISPLACEMENT_A] + (m.mem16[DISPLACEMENT_A] >>> 2));
  applyStep(m, wholeB(m), fractionB(m), m.mem16[DISPLACEMENT_B] + (m.mem16[DISPLACEMENT_B] >>> 2));
}

const truncated = (d) => u16(signed(d) + Math.trunc(signed(d) / 4));

function applyStep(m, wholeAddr, fractionAddr, step) {
  const { mem8 } = m;
  const moved = (mem8[wholeAddr] << 8) + mem8[fractionAddr] + step;
  mem8[wholeAddr] = moved >> 8;
  mem8[fractionAddr] = moved;
}

const eitherCoordinate = (f) => (p) => f(p.dA) || f(p.dB);

const TWINS = [
  // caught wherever the displacement as it lands is not nothing
  ["no-op", brokenNoOp, eitherCoordinate((d) => lengthen(d) !== 0),
    { wA: 0, fA: 0, wB: 0, fB: 0, dA: 1, dB: 1 }],
  // caught wherever the displacement as it lands reaches the fraction byte
  ["whole-only", brokenWholeOnly, eitherCoordinate((d) => u8(lengthen(d)) !== 0),
    { wA: 0, fA: 0, wB: 0, fB: 0, dA: 1, dB: 1 }],
  // caught wherever the second coordinate moves at all
  ["second-skipped", brokenSecondSkipped, (p) => lengthen(p.dB) !== 0,
    { wA: 0, fA: 0, wB: 0, fB: 0, dA: 0, dB: 0x0180 }],
  // no closed form: whether a lost carry shows depends on the fraction it is lost from
  ["no-carry", brokenNoCarry, null, { wA: 0, fA: 255, wB: 0, fB: 0, dA: 1, dB: 0 }],
  // caught wherever the two displacements do not land on the same amount
  ["swapped", brokenSwapped, (p) => lengthen(p.dA) !== lengthen(p.dB),
    { wA: 0, fA: 0, wB: 0, fB: 0, dA: 0x0180, dB: 0xfe80 }],
  // caught wherever the displacement is big enough to have a quarter at all
  ["no-quarter", brokenNoQuarter, eitherCoordinate((d) => (signed(d) >> 2) !== 0),
    { wA: 0, fA: 0, wB: 0, fB: 0, dA: 0x0100, dB: 0 }],
  // caught wherever the quarter does not divide and the displacement runs backward
  ["truncating-quarter", brokenTruncatingQuarter, eitherCoordinate(roundsAway),
    { wA: 0x10, fA: 0, wB: 0x10, fB: 0, dA: 0xffff, dB: 0xffff }],
  // caught wherever the displacement runs backward, which is where the two readings part
  ["unsigned-quarter", brokenUnsignedQuarter, eitherCoordinate((d) => d >= 0x8000),
    { wA: 0x10, fA: 0, wB: 0x10, fB: 0, dA: 0xff00, dB: 0xff00 }],
];

for (const [label, twin, pred, discriminator] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT by a crafted entry, at a byte the routine writes`,
    { skip },
    () => {
      const d = craftedDiff(twin, discriminator);
      assert.notEqual(d, null, `the gate PASSED the ${label} twin — it has no teeth`);
      assert.ok(
        writtenBytes(entryState()).includes(d.addr),
        `the ${label} twin was caught at ${hex4(d.addr)}, which is not one of the four bytes ` +
          "this routine writes — the catch is a ghost",
      );
      console.log(`  TEETH/${label}: caught — ${show(d)}`);
    });

  test(`TEETH: the ${label} twin is CAUGHT across the crafted sweep, on the entries predicted`,
    { skip },
    () => {
      const priors = craftedPriors();
      const r = catchCount(twin, priors, pred);
      assert.ok(r.caught > 0, `the sweep missed the ${label} twin on every one of its entries`);
      assert.equal(r.ghosts, 0, `${r.ghosts} catches landed outside the four written bytes`);
      if (pred) {
        assert.ok(r.want > 0 && r.want < priors.length, `the ${label} predicate must split the sweep`);
        assert.equal(r.caught, r.want, `caught on ${r.caught} entries, predicted ${r.want}`);
      }
      console.log(
        `  TEETH/${label}: caught on ${r.caught} of ${priors.length} crafted entries` +
          (pred ? ", exactly as predicted" : " (no predicate for this twin)"),
      );
    });

  test(`TEETH: the ${label} twin against real traffic, and the shared tape's blindness`,
    { skip },
    () => {
      const wide = everyPrior();
      assert.ok(wide.length > 0, "vacuous: the three sessions presented no entry");
      const all = catchCount(twin, wide, pred);
      assert.ok(all.caught > 0, `the ${label} twin survives every entry any tape presents`);
      assert.equal(all.ghosts, 0, `${all.ghosts} catches landed outside the four written bytes`);
      if (pred) assert.equal(all.caught, all.want, `caught on ${all.caught}, predicted ${all.want}`);

      const shared = corpus("shared", {}).priors;
      assert.ok(shared.length > 0, "vacuous: the shared tape presented no entry");
      const only = catchCount(twin, shared, pred);
      if (pred) assert.equal(only.caught, only.want, "the shared corpus contradicts the predicate");
      if (label === "truncating-quarter" || label === "unsigned-quarter") {
        assert.equal(
          only.caught,
          0,
          `the shared tape now catches the ${label} twin, so it is no longer blind to the ` +
            "rounding and the reason this file widens the tapes has changed",
        );
      }
      console.log(
        `  TEETH/${label}: caught on ${all.caught} of ${wide.length} real entries, ` +
          `${only.caught} of them on the shared tape`,
      );
    });
}

test("BLIND: the real dispatch catches NONE of the twins", { skip }, () => {
  const survivors = TWINS.filter(([, twin]) => diffAtEntry(twin) === null).map(([l]) => l);
  assert.deepEqual(
    survivors,
    TWINS.map(([l]) => l),
    "a twin is now caught at the real dispatch — the dispatch has stopped being inert and the " +
      "holes this file states must be re-derived",
  );
  console.log(`  BLIND: all ${survivors.length} twins pass at the real dispatch, as measured`);
});
