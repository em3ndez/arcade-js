// SPDX-License-Identifier: GPL-3.0-only
/**
 * readPlayerControls — memory-equivalent to the frozen oracle at ROM 0x1ED1.
 *
 * GATE: unit-capture through unitEquivalence, PLUS an explicit live-out comparison run over a
 *   SECOND driven tape that presses the control panels, PLUS a crafted sweep of the selector.
 *
 * WHY THE FIRST ARM ALONE IS A FRAUD HERE. The routine writes no memory whatever: it picks one
 *   of two mirrored control words and hands the byte back in the accumulator. So `r.ram` is
 *   null for EVERY candidate, a no-op included, and the BLIND test asserts that outright rather
 *   than leaving it as an unstated hole. The live-out is derived from the three call sites, not
 *   from the instruction stream: loc_1edf masks the result with 0x0F and branches, loc_23e3
 *   rotates bit 4 of it into a shift register, loc_18c3 rotates bits 0, 1, 4 and 5 of it into
 *   four one-bit histories. All three read the accumulator and nothing else — no caller
 *   consumes a flag, an address pair or the stack — so LIVE_OUT is {a} and EXCLUDED is
 *   {f, h, l, sp}, and the sweep pins that shape so "excluded" cannot quietly widen.
 *
 * AND THE SHARED TAPE CANNOT SEE THE ROUTINE AT ALL. Its coin -> start presses land on the
 *   system port, never on a control panel, so at EVERY dispatch it produces both mirrors read
 *   zero and the selector reads set. Both of the routine's decisions — which mirror, and the
 *   branch that chooses — are therefore invisible on it: three of the five broken twins below
 *   are byte-identical to the oracle across the whole replay. The UNIFORM test measures that
 *   rather than assuming it, and it is the reason the other two corpora exist.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — RAM identical, via unitEquivalence unchanged.
 *   2. BLIND — the same call passes a no-op, which is why every arm below compares live-out.
 *   3. UNIFORM — the shared tape's dispatch classes, measured, with the blindness they imply.
 *   4. DRIVEN — a second tape that presses panel 1 and then panel 2, producing dispatches where
 *      the two mirrors genuinely differ. This half needs NO poke: it is the natural run.
 *   5. CRAFTED — the selector swept over all 256 values against a cross of mirror pairs, which
 *      is the only cover the branch gets.
 *   6. TEETH — six twins, each caught on EXACTLY the trials it can differ on, counted against
 *      a prediction derived from the corpus rather than written down.
 *
 * HOLE: the selector is never observed at anything but set. It is written from the vblank
 * service and cleared only for the far side of a cocktail cabinet, which no tape here reaches,
 * so the cleared branch is covered by crafted entries alone and by nothing observed.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-1ed1.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, COIN_START_TAPE, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { readPlayerControls } from "../readPlayerControls.js";
import { loc_1ed1 as oracle } from "../../translated/loc_1ed1.js";
import { firstStateDiff, unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x1ed1;

const SELECTOR = 0xa987;
const MAIN_PANEL = 0xa9af;
const COCKTAIL_PANEL = 0xa9b0;

/** The register a caller reads back, and the ones memory-equivalence drops. */
const LIVE_OUT = ["a"];
const EXCLUDED = ["f", "h", "l", "sp"];

const PANEL_1 = 0xc320;
const PANEL_2 = 0xc340;

/**
 * The shared tape with three panel presses added: one direction and then one button on panel 1,
 * then a spread of bits on panel 2 alone. The last is the discriminating one — panel 2 is not
 * read on any path the game takes here, so pressing it perturbs nothing and yet makes the two
 * mirrors differ, which is precisely the state that separates a right cell from a wrong one.
 */
const CONTROL_TAPE = [
  ...COIN_START_TAPE,
  { frame: 700, port: PANEL_1, bits: 0x01, dur: 60 },
  { frame: 800, port: PANEL_1, bits: 0x10, dur: 60 },
  { frame: 900, port: PANEL_2, bits: 0x2f, dur: 120 },
];

const skip = romsPresent() ? false : "ROM images are gitignored and absent";

// ── the corpora ─────────────────────────────────────────────────────────────────────────────
// One host run per tape, one pristine clone per distinct entry class. A class is the triple the
// routine actually reads; everything below works off those clones, so each tape costs one run.

function session(tape) {
  const classes = new Map();
  const capture = new Map([[TARGET, (m) => {
    const key = `${m.mem8[SELECTOR]},${m.mem8[MAIN_PANEL]},${m.mem8[COCKTAIL_PANEL]}`;
    if (!classes.has(key)) {
      classes.set(key, {
        key,
        selector: m.mem8[SELECTOR],
        main: m.mem8[MAIN_PANEL],
        cocktail: m.mem8[COCKTAIL_PANEL],
        arriving: m.regs.a,
        entry: m.clone(),
        dispatches: 0,
      });
    }
    classes.get(key).dispatches++;
    return oracle(m);
  }]]);
  const host = makeMachine(capture, { tape });
  const frames = host.runFrames(ENTRY_FRAMES);
  return { classes: [...classes.values()], stoppedBy: host.stoppedBy, frames: frames.length };
}

let sharedRun = null;
let drivenRun = null;
const shared = () => (sharedRun ??= session(COIN_START_TAPE));
const driven = () => (drivenRun ??= session(CONTROL_TAPE));

/** The entry the crafted sweep is built on, and the accumulator value it arrives holding. */
const baseEntry = () => shared().classes[0].entry;
const arrivingA = () => shared().classes[0].entry.regs.a;

// ── the comparison ──────────────────────────────────────────────────────────────────────────

/** Run both arms on independent clones of one state. Caught = RAM moved, or a live-out did. */
function compare(state, candidate) {
  const a = state.clone();
  const b = state.clone();
  oracle(a);
  const returned = candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  const differing = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  return {
    caught: ram !== null || differing.some((k) => LIVE_OUT.includes(k)),
    ram,
    differing,
    returned,
    expected: a.regs.a,
    got: b.regs.a,
    pcMoved: a.pc !== b.pc,
  };
}

const MIRROR_PAIRS = [
  [0, 0],
  [0, 47],
  [1, 0],
  [16, 0],
  [255, 0],
  [0, 255],
  [170, 85],
  [85, 170],
  [33, 33],
  [255, 255],
];

function crafted(selector, [main, cocktail]) {
  const m = baseEntry().clone();
  m.mem8[SELECTOR] = selector;
  m.mem8[MAIN_PANEL] = main;
  m.mem8[COCKTAIL_PANEL] = cocktail;
  return m;
}

/** The whole crafted space: every selector value against every mirror pair. */
function craftedSweep(candidate) {
  const moved = new Set();
  let trials = 0, caught = 0, returnMismatch = 0;
  for (const pair of MIRROR_PAIRS) {
    for (let selector = 0; selector < 256; selector++) {
      const r = compare(crafted(selector, pair), candidate);
      for (const k of r.differing) moved.add(k);
      if (r.caught) caught++;
      else if (r.returned !== r.got) returnMismatch++;
      trials++;
    }
  }
  return { trials, caught, returnMismatch, moved };
}

/** What a twin SHOULD be caught on, expressed over the same space, and counted independently. */
function predictedCatches(discriminates) {
  let n = 0;
  for (const pair of MIRROR_PAIRS) {
    for (let selector = 0; selector < 256; selector++) {
      if (discriminates(selector, pair, arrivingA())) n++;
    }
  }
  return n;
}

const correctFor = (selector, [main, cocktail]) => (selector !== 0 ? main : cocktail);

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: readPlayerControls == oracle on RAM", { skip }, () => {
  const r = unitEquivalence(makeMachine, TARGET, oracle, readPlayerControls, { maxFrames: ENTRY_FRAMES });
  assert.equal(r.ram, null, `RAM diverged — ${JSON.stringify(r.ram)}`);
  console.log(`  EQUAL: entered within ${ENTRY_FRAMES} frames; RAM identical`);
});

test("BLIND: the RAM diff alone passes a no-op, so it is not the gate", { skip }, () => {
  const r = unitEquivalence(makeMachine, TARGET, oracle, () => {}, { maxFrames: ENTRY_FRAMES });
  assert.equal(
    r.ram,
    null,
    "a no-op made RAM move — then this routine writes memory after all, and every arm below " +
      "rests on a premise that needs re-deriving",
  );
  console.log("  BLIND: confirmed — RAM cannot fail here; the teeth are the live-out arms");
});

test("EQUAL at the real dispatch: the byte the caller reads back matches too", { skip }, () => {
  const r = compare(baseEntry(), readPlayerControls);
  assert.deepEqual(
    r.differing.filter((k) => LIVE_OUT.includes(k)),
    [],
    `the live-out byte diverged: oracle=${r.expected} candidate=${r.got}`,
  );
  assert.equal(r.returned, r.got, "the returned byte must be the byte left for the caller");
  assert.ok(r.pcMoved, "the frozen return moves the program counter; the rewrite returns to JS");
  console.log(`  EQUAL: live-out byte ${r.expected}, returned and left in place`);
});

test("UNIFORM: every dispatch of the shared tape reads the same three bytes", { skip }, () => {
  const s = shared();
  assert.equal(s.stoppedBy, null, `the shared session stopped early: ${s.stoppedBy}`);
  assert.equal(s.frames, ENTRY_FRAMES, "the shared session did not run its full frame count");
  assert.ok(s.classes.length > 0, "vacuous: the shared tape never reached the routine");

  const blindToCell = s.classes.filter((c) => c.main === c.cocktail);
  const blindToBranch = s.classes.filter((c) => c.selector !== 0);
  assert.equal(blindToCell.length, s.classes.length, "a class here CAN tell the mirrors apart");
  assert.equal(blindToBranch.length, s.classes.length, "a class here DOES clear the selector");
  console.log(
    `  UNIFORM: ${s.classes.length} class over ${s.frames} frames — ` +
      s.classes
        .map((c) => `sel=${c.selector} main=${c.main} cocktail=${c.cocktail} x${c.dispatches}`)
        .join("; ") +
      " — so the mirror choice and the branch are both invisible on it",
  );
});

test("DRIVEN: a tape that presses the panels makes the mirrors differ, and both arms agree", { skip }, () => {
  const d = driven();
  assert.equal(d.stoppedBy, null, `the driven session stopped early: ${d.stoppedBy}`);
  assert.equal(d.frames, ENTRY_FRAMES, "the driven session did not run its full frame count");

  const discriminating = d.classes.filter((c) => c.main !== c.cocktail);
  assert.ok(
    discriminating.length > 0,
    "the control tape produced no dispatch where the two mirrors differ — it discriminates " +
      "nothing and the presses must be re-timed",
  );
  const pressed = d.classes.filter((c) => c.main !== 0);
  assert.ok(pressed.length > 0, "no dispatch saw panel 1 pressed, so a press never landed");

  for (const c of d.classes) {
    const r = compare(c.entry, readPlayerControls);
    assert.equal(r.caught, false, `class sel=${c.selector} main=${c.main}: ${JSON.stringify(r)}`);
  }
  console.log(
    `  DRIVEN: ${d.classes.length} classes over ${d.frames} frames — ` +
      d.classes
        .map((c) => `sel=${c.selector} main=${c.main} cocktail=${c.cocktail} x${c.dispatches}`)
        .join("; "),
  );
});

test("CRAFTED: every selector value against every mirror pair matches the oracle", { skip }, () => {
  const r = craftedSweep(readPlayerControls);
  assert.equal(r.caught, 0, `${r.caught} of ${r.trials} crafted trials diverged`);
  assert.equal(r.returnMismatch, 0, "the returned byte must be the byte left for the caller");
  assert.equal(r.trials, MIRROR_PAIRS.length * 256, "the sweep shrank");
  console.log(`  CRAFTED: ${r.trials} trials identical on RAM and on the live-out byte`);
});

test("EXCLUDED, deliberately: only the flag byte, the address pair and the stack move", { skip }, () => {
  const r = craftedSweep(readPlayerControls);
  const widened = [...r.moved].filter((k) => !EXCLUDED.includes(k));
  assert.deepEqual(widened, [], `the excluded set widened to include ${widened.join(", ")}`);
  assert.ok(r.moved.size > 0, "nothing moved at all, which the frozen return alone rules out");
  console.log(`  EXCLUDED: ${[...r.moved].join(", ")} — and nothing else, over ${r.trials} trials`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────────
// Six plausible ways to get a two-way selector wrong. Each is asserted caught on EXACTLY the
// trials it can differ on — a count re-derived from the corpus, never written down — and each
// has its blindness at the real dispatch pinned, because three of them have one.

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: hands the byte back as a return value only, leaving the register a caller reads stale. */
function brokenReturnOnly(m) {
  const { mem8 } = m;
  return mem8[mem8[SELECTOR] !== 0 ? MAIN_PANEL : COCKTAIL_PANEL];
}

/** BUG: reads the other panel's mirror on both arms of the branch. */
function brokenPanelsSwapped(m) {
  const { regs, mem8 } = m;
  regs.a = mem8[mem8[SELECTOR] !== 0 ? COCKTAIL_PANEL : MAIN_PANEL];
  return regs.a;
}

/** BUG: ignores the selector and always takes the near panel. */
function brokenAlwaysMain(m) {
  const { regs, mem8 } = m;
  regs.a = mem8[MAIN_PANEL];
  return regs.a;
}

/** BUG: ignores the selector and always takes the far panel. */
function brokenAlwaysCocktail(m) {
  const { regs, mem8 } = m;
  regs.a = mem8[COCKTAIL_PANEL];
  return regs.a;
}

/** BUG: tests the selector's low bit rather than the whole byte, so even values invert. */
function brokenLowBitSelector(m) {
  const { regs, mem8 } = m;
  regs.a = mem8[(mem8[SELECTOR] & 1) !== 0 ? MAIN_PANEL : COCKTAIL_PANEL];
  return regs.a;
}

const staleAccumulator = (s, pair, arriving) => correctFor(s, pair) !== arriving;
const mirrorsDiffer = (s, [main, cocktail]) => main !== cocktail;

// label -> [twin, what it can differ on, whether the real dispatch catches it]
const TWINS = [
  ["no-op", brokenNoOp, staleAccumulator, true],
  ["return-only", brokenReturnOnly, staleAccumulator, true],
  ["panels-swapped", brokenPanelsSwapped, mirrorsDiffer, false],
  ["always-main", brokenAlwaysMain, (s, p) => s === 0 && mirrorsDiffer(s, p), false],
  ["always-cocktail", brokenAlwaysCocktail, (s, p) => s !== 0 && mirrorsDiffer(s, p), false],
  [
    "low-bit-selector",
    brokenLowBitSelector,
    (s, p) => s !== 0 && (s & 1) === 0 && mirrorsDiffer(s, p),
    false,
  ],
];

for (const [label, twin, discriminates, caughtAtDispatch] of TWINS) {
  test(`TEETH: the ${label} twin is caught on exactly the crafted trials that can tell`, { skip }, () => {
    const want = predictedCatches(discriminates);
    assert.ok(want > 0, `no crafted trial can discriminate the ${label} twin`);
    const r = craftedSweep(twin);
    assert.equal(r.caught, want, `the ${label} twin was caught on ${r.caught}, wanted ${want}`);
    console.log(`  TEETH/${label}: caught ${r.caught} of ${r.trials} crafted trials, exactly`);
  });

  test(`TEETH: the ${label} twin against the driven tape, hole pinned`, { skip }, () => {
    const d = driven();
    const want = d.classes.filter((c) => discriminates(c.selector, [c.main, c.cocktail], c.arriving));
    const got = d.classes.filter((c) => compare(c.entry, twin).caught);
    assert.deepEqual(
      got.map((c) => c.key).sort(),
      want.map((c) => c.key).sort(),
      `the ${label} twin's catch set on the driven tape is not the one the corpus predicts`,
    );
    const n = want.reduce((t, c) => t + c.dispatches, 0);
    console.log(`  TEETH/${label}: ${want.length} of ${d.classes.length} driven classes catch ` +
      `it, ${n} dispatches`);
  });

  test(`TEETH: the ${label} twin at the real dispatch, blindness recorded`, { skip }, () => {
    const r = compare(baseEntry(), twin);
    assert.equal(
      r.caught,
      caughtAtDispatch,
      `the shared tape's blindness to the ${label} twin changed — re-derive the holes`,
    );
    console.log(
      `  TEETH/${label}: real dispatch ${r.caught ? "caught" : "BLIND, as recorded"}`,
    );
  });
}
