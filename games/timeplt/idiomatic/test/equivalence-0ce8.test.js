// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0ce8 — memory-equivalent to the frozen oracle at ROM 0x0CE8.
 *
 * WHAT IT IS. One byte, 0xC9: a bare `ret`, and the shared exit of the routine that awards points.
 * The rewrite is an empty function, because the idiomatic layer models no stack and a return is
 * the host language's. The work is not writing that function, it is proving it is RIGHT rather
 * than merely green — that the routine is genuinely reached, and that the instruments could see it
 * if it did anything.
 *
 * WHO REACHES IT. Three paths, all inside the award routine that begins at 0x0C90 and all present
 * in this corpus: the early-out `jp z,0x0ce8` taken at 0x0C97 when the play flag is clear, the
 * `jr 0x0ce8` at 0x0CE3 that follows the one-player score redraw, and the fall-through past the
 * two-player redraw called at 0x0CE5. A whole-image scan for the little-endian word 0x0CE8 finds
 * exactly one occurrence, at 0x0C98 behind opcode 0xCA (`jp z,nn`); a scan of every relative-jump
 * opcode within displacement range finds exactly one more, the 0x18 at 0x0CE3. Nothing else in the
 * image refers to this address.
 *
 * ★ THE SHARED DRIVEN TAPE PRESSES ONLY COIN 1 AND 1 PLAYER START — IT NEVER FIRES AND NEVER
 *   CHANGES DIRECTION, AND THIS ROUTINE SITS ON THE SCORING PATH, WHICH IS EXACTLY WHERE THAT
 *   BLINDNESS BITES. It reaches the award routine a bare handful of times in a whole session. The
 *   attract demo runs real game logic and reaches it far more often — but with the play flag
 *   clear, so every one of those dispatches takes the early-out and arrives with the accumulator
 *   at zero. THAT IS THE UNIFORM CORPUS TRAP IN THE FLESH, AND THIS GATE MEASURES IT RATHER THAN
 *   ARGUING ABOUT IT: the one-byte extent twin below is caught on every driven dispatch and on
 *   NONE of the attract ones, and the run prints that split. A gate built on the demo alone would
 *   have shipped it.
 *   Three tapes are therefore run — attract, the shared driven tape, and a two-player tape that is
 *   the only one reaching the third arrival path.
 *
 * GATE: unit capture at the real dispatch, a pass-through sweep over every dispatch of three
 *   sessions, a crafted hostile-register arm, a measured live-out probe, and two whole-machine
 *   replays. What it exercises, holes stated:
 *
 *   1. EQUAL at the real dispatch — RAM byte-identical, and the stack pointer is the only register
 *      that moves. It must MOVE, too: a rewrite that popped the stack the way the frozen return
 *      does would leave every register equal, and this arm fails on exactly that.
 *   2. RAM IS BLIND, BUT IT IS NOT DEAD. A candidate that writes nothing passes the RAM diff, and
 *      the correct routine is such a candidate, so RAM cannot be the whole gate. The arm MEASURES
 *      the diff's sensitivity instead of assuming it: a twin that writes one byte fails at this
 *      same dispatch.
 *   3. DEAD FIRST DISPATCH — the capture is the first entry, so the run is repeated at a doubled
 *      frame budget and the two entry states are asserted byte-identical.
 *   4. DEGENERATE ENTRY — named, not hoped away. Across the attract session the accumulator is
 *      zero at EVERY dispatch and five shadow halves are zero throughout; IX, IY and SP never vary
 *      at all. The run prints both sets and the crafted arm covers them.
 *   5. ALL THREE ARRIVAL PATHS — the corpus is classified by the two cells the caller's branches
 *      test, and each of the three classes is asserted non-empty. Without the two-player tape the
 *      third class is empty.
 *   6. PASS-THROUGH — the real content of the claim. RAM and every register except SP must come
 *      out of the candidate exactly as they came out of the oracle, and the returned value must be
 *      nothing on both sides.
 *   7. SP IS EXCLUDED, DELIBERATELY, and pinned: the oracle's return advances it by exactly two
 *      and the rewrite leaves it alone, which is the no-stack model stated as an assertion. That
 *      pin is what catches a rewrite modelling the stack — the pass-through sweep cannot, because
 *      such a rewrite lands on the oracle's own stack pointer.
 *   8. LIVE-OUT IS MEASURED. Forcing one register hostile after EVERY dispatch of a whole session
 *      forks that session for most of them, so preserving those is load-bearing and arm 6 is not
 *      decoration. It does NOT fork for the accumulator or for either half of HL: the caller chain
 *      reloads those before anything reads them, and no tape here can punish clobbering them. The
 *      same probe run one flag BIT at a time splits the flag byte too — sign, zero and parity are
 *      read back, carry and half-carry are not. Arm 6 rejects a clobber of any of them anyway, and
 *      the two flag twins are built on exactly this split.
 *   9. WHOLE-MACHINE, SHIMMED — ★ VACUOUS FOR THE REAL CANDIDATE AND SAID SO OUT LOUD. The host
 *      engine is stack-driven, so the shim pays the return the rewrite no longer takes; applied to
 *      an empty function the shim IS the oracle instruction for instruction, and this arm could
 *      not fail. It earns its place by counting dispatches and by carrying the twins.
 *  10. WHOLE-MACHINE IS SENSITIVE — the unshimmed empty candidate destroys the session, which is
 *      what licenses reading arm 9's twins as evidence rather than as noise.
 *  11. TEETH — a twin per resource the routine could touch, scored on two instruments with a
 *      declared split, and the extent twin scored per session rather than in one total, because
 *      the total is the thing that would lie.
 *
 * ★ HOLES. The extent twin is the only twin whose visibility depends on the tape, and the driven
 * tapes supply just six dispatches between them, so that arm rests on a thin corpus even though
 * every one of the six catches it. The award routine's own arithmetic is not exercised here at
 * all — nothing in this file drives a score across the high-score compare or the rollover, because
 * this byte runs after all of that has happened. And the two driven tapes never reach a score
 * large enough for the extra-life ladder, so the states that reach this routine are early-game
 * ones.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0ce8.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, COIN_START_TAPE, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_0ce8 } from "../loc_0ce8.js";
import { loc_0ce8 as oracle } from "../../translated/loc_0ce8.js";
import { PLAY_ACTIVE, PLAYER_STATE, ACTIVE_PLAYER } from "../names.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x0ce8;

/** The cell the byte after this one loads, for the twin that gets the extent wrong. */
const PLAYER_COUNT = 0xad31;

/** The stack the frozen return pops is the one thing the no-stack model drops. */
const EXCLUDED = "sp";
const KEPT = REG_FIELDS.filter((k) => k !== EXCLUDED);

/** T-states of the frozen return, which the host engine still has to be charged. */
const RET_TSTATES = 10;

const IN0 = 0xc300;
const IN1 = 0xc320;
const COIN = 0x01;
const START_2P = 0x10;
const LEFT = 0x01;
const RIGHT = 0x02;
const FIRE = 0x10;
const HOLD = 8;

/** Two coins and the two-player button; the stick and the trigger keep the second game alive. */
const TWO_PLAYER_TAPE = [
  { frame: 401, port: IN0, bits: COIN, dur: HOLD },
  { frame: 450, port: IN0, bits: COIN, dur: HOLD },
  { frame: 501, port: IN0, bits: START_2P, dur: HOLD },
  { frame: 600, port: IN1, bits: FIRE, dur: null },
  { frame: 700, port: IN1, bits: LEFT, dur: 40 },
  { frame: 900, port: IN1, bits: RIGHT, dur: 40 },
];

/** Long enough that the demo awards points repeatedly; the first dispatch is past frame 1000. */
const CORPUS_FRAMES = 2500;

/** Register patterns for the crafted arm: all clear, all set, and two alternating fills. */
const HOSTILE_FILLS = [0x00, 0xff, 0x5a, 0xa5];
const HOSTILE_SP = 0xafc0;

/** Z80 flag bits, for the per-bit half of the live-out measurement. */
const CARRY = 0x01;
const PARITY = 0x04;
const HALF_CARRY = 0x10;
const ZERO = 0x40;
const SIGN = 0x80;
const FLAG_BITS = [["carry", CARRY], ["parity", PARITY], ["half-carry", HALF_CARRY],
  ["zero", ZERO], ["sign", SIGN]];

const skip = romsPresent() ? false : "ROM images are gitignored and absent";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

const attractMachine = (overrides) => makeMachine(overrides, { tape: [] });
const drivenMachine = (overrides) => makeMachine(overrides, { tape: COIN_START_TAPE });
const twoPlayerMachine = (overrides) => makeMachine(overrides, { tape: TWO_PLAYER_TAPE });
const TAPES = [
  ["attract", attractMachine],
  ["shared", drivenMachine],
  ["two-player", twoPlayerMachine],
];

// ── the corpus ──────────────────────────────────────────────────────────────────────────────
// One emulated run per tape, a pristine clone at EVERY dispatch. Nothing below deduplicates: two
// dispatches with the same registers still differ in the RAM the diff walks.

function captureFrom(factory, frames) {
  const entries = [];
  const tap = new Map([[TARGET, (m) => {
    entries.push(m.clone());
    return oracle(m);
  }]]);
  factory(tap).runFrames(frames);
  return entries;
}

let corpus = null;
function entries() {
  if (corpus === null) {
    corpus = TAPES.map(([name, factory]) => [name, captureFrom(factory, CORPUS_FRAMES)]);
  }
  return corpus;
}

const allEntries = () => entries().flatMap(([, list]) => list);

/** Which of the caller's three exits an entry came through, read off the cells they branch on. */
function arrivalPath(entry) {
  if (entry.mem8[PLAY_ACTIVE] === 0) return "no-award early-out";
  return entry.mem8[ACTIVE_PLAYER] === 0 ? "after the 1UP redraw" : "after the 2UP redraw";
}

/**
 * Run oracle and candidate on two clones of every captured entry and tally. A trial is CAUGHT
 * when the state dump moved or when any register outside the excluded set did; a candidate that
 * throws is caught too, since the host would have died there.
 */
function sweep(candidate, list = allEntries()) {
  let trials = 0, caught = 0, byRam = 0, byReg = 0, threw = 0, returned = 0;
  const moved = new Set();
  for (const captured of list) {
    const a = captured.clone();
    const b = captured.clone();
    const oracleReturn = oracle(a);
    trials++;
    let candidateReturn;
    try {
      candidateReturn = candidate(b);
    } catch {
      threw++;
      caught++;
      continue;
    }
    if (oracleReturn !== undefined || candidateReturn !== undefined) returned++;
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
    const differing = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
    for (const k of differing) moved.add(k);
    const regBad = differing.some((k) => KEPT.includes(k));
    if (ram) byRam++;
    if (regBad) byReg++;
    if (ram || regBad) caught++;
  }
  return { trials, caught, byRam, byReg, threw, returned, moved };
}

// ── the twins ───────────────────────────────────────────────────────────────────────────────
// Ways to get a routine that does nothing wrong. Most break the "touches nothing" claim one
// resource at a time; one models the stack the layer has abolished; one gets the routine's extent
// wrong by a single byte, which for a one-byte routine is the whole of it.

/** BUG: writes a byte. The only twin the RAM diff can see, and the proof that it can see one. */
function brokenWritesOneCell(m) {
  m.mem8[PLAYER_STATE] ^= 0xff;
}

/** BUG: leaves a value in the accumulator, as a routine that computed something would. */
function brokenClobbersAccumulator(m) {
  m.regs.a ^= 0xff;
}

/** BUG: reports a condition in the carry flag, which a pass-through must not disturb. */
function brokenTouchesTheCarryFlag(m) {
  m.regs.f ^= CARRY;
}

/** BUG: the same defect in the flag the caller chain does read back, so the pair splits the arms. */
function brokenTouchesTheZeroFlag(m) {
  m.regs.f ^= ZERO;
}

/** BUG: moves the object-record pointer on, as a per-slot routine would. */
function brokenClobbersIndexRegister(m) {
  m.regs.ix ^= 0x0101;
}

/** BUG: models the stack — the mistake of copying the frozen return into a layer without one. */
function brokenPopsTheStack(m) {
  m.pop16();
}

/** BUG: swallows the instruction the next byte begins, which loads the player count and tests it. */
function brokenRunsOnByOneInstruction(m) {
  m.regs.a = m.mem8[PLAYER_COUNT];
  m.regs.and(m.regs.a);
}

// ── the whole-machine instrument ────────────────────────────────────────────────────────────

/** Adapt a candidate to the stack-driven host: take the return the rewrite no longer takes. */
function hosted(candidate) {
  return (mm) => {
    candidate(mm);
    mm.ret(RET_TSTATES);
  };
}

/** A whole session with `override` wired. A run that died counts as forked, not as an error. */
function replay(factory, override, frames = CORPUS_FRAMES) {
  try {
    const w = wholeMachineEquivalence(factory, frames, new Map([[TARGET, override]]));
    return { forked: !w.equal, frame: w.frame ?? null, dispatches: w.invocations.get(TARGET) };
  } catch (e) {
    return { forked: true, frame: null, dispatches: null, died: e.message };
  }
}

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: the rewrite matches the frozen routine", { skip }, () => {
  const r = unitEquivalence(makeMachine, TARGET, oracle, loc_0ce8, { maxFrames: ENTRY_FRAMES });
  assert.equal(r.ram, null, `RAM diverged — ${JSON.stringify(r.ram)}`);
  assert.notEqual(r.regs, null, "nothing moved at all — the rewrite took the frozen return");
  assert.equal(r.regs.reg, EXCLUDED, "a register other than the stack pointer moved");
  console.log(`  EQUAL: entered within ${ENTRY_FRAMES} frames; RAM identical, only SP moved`);
});

test("RAM IS BLIND, BUT NOT DEAD: it passes a no-op and fails one written byte", { skip }, () => {
  const blind = unitEquivalence(makeMachine, TARGET, oracle, () => {}, {
    maxFrames: ENTRY_FRAMES,
  });
  assert.equal(blind.ram, null, "a no-op moved RAM, so this routine writes after all");
  const live = unitEquivalence(makeMachine, TARGET, oracle, brokenWritesOneCell, {
    maxFrames: ENTRY_FRAMES,
  });
  assert.notEqual(live.ram, null, "one written byte slipped past the RAM diff at the dispatch");
  console.log(`  BLIND/LIVE: no-op passes; one byte fails at ${hex4(live.ram.addr)}`);
});

test("DEAD FIRST DISPATCH: a doubled budget captures the identical entry", { skip }, () => {
  const near = captureFrom(drivenMachine, ENTRY_FRAMES)[0];
  const far = captureFrom(drivenMachine, ENTRY_FRAMES * 2)[0];
  assert.ok(near && far, "vacuous: the tape never reached the routine");
  assert.equal(firstStateDiff(near.dumpState(), far.dumpState()), null, "the entry state moved");
  for (const k of REG_FIELDS) assert.equal(near.regs[k], far.regs[k], `${k} moved`);
  console.log("  FIRST DISPATCH: stable under a doubled frame budget");
});

test("CORPUS: all three tapes dispatch, and all three arrival paths appear", { skip }, () => {
  const seen = new Map();
  for (const [name, list] of entries()) {
    assert.ok(list.length > 0, `the ${name} tape never reached the routine`);
    for (const e of list) {
      const path = arrivalPath(e);
      seen.set(path, (seen.get(path) ?? 0) + 1);
    }
  }
  assert.equal(seen.size, 3, `only ${seen.size} of the caller's three exits were taken`);
  console.log(
    `  CORPUS: ${entries().map(([n, l]) => `${n}=${l.length}`).join(" ")} — ` +
      [...seen].map(([p, n]) => `${p}:${n}`).join(", "),
  );
});

test("DEGENERATE ENTRY: the captured spread is reported, not assumed away", { skip }, () => {
  const list = allEntries();
  const zero = REG_FIELDS.filter((k) => list.every((e) => e.regs[k] === 0));
  const fixed = REG_FIELDS.filter((k) => new Set(list.map((e) => e.regs[k])).size === 1);
  const attract = entries()[0][1];
  assert.ok(attract.every((e) => e.regs.a === 0), "attract no longer pins the accumulator at zero");
  assert.ok(REG_FIELDS.some((k) => !fixed.includes(k)), "every register was constant");
  assert.ok(HOSTILE_FILLS.includes(0x00), "the crafted arm must cover the always-zero registers");
  console.log(
    `  DEGENERATE: always zero [${zero.join(" ") || "none"}], never varying [${fixed.join(" ")}]; ` +
      `the accumulator is zero at all ${attract.length} attract dispatches`,
  );
});

test("PASS-THROUGH: every dispatch of all three sessions comes out identical", { skip }, () => {
  for (const [name, list] of entries()) {
    const r = sweep(loc_0ce8, list);
    assert.ok(r.trials > 0, `vacuous: the ${name} tape captured nothing`);
    assert.equal(r.caught, 0, `${name}: ${r.caught} of ${r.trials} dispatches diverged`);
    assert.equal(r.returned, 0, `${name}: something was handed back`);
    console.log(`  PASS-THROUGH/${name}: ${r.trials} dispatches identical, nothing returned`);
  }
});

test("EXCLUDED: the stack pointer moves by two, and nothing else moves at all", { skip }, () => {
  const r = sweep(loc_0ce8);
  assert.deepEqual([...r.moved], [EXCLUDED], `the excluded set widened to ${[...r.moved]}`);
  for (const captured of allEntries()) {
    const a = captured.clone();
    const b = captured.clone();
    oracle(a);
    loc_0ce8(b);
    assert.equal(a.regs.sp, (captured.regs.sp + 2) & 0xffff, "the frozen return popped no word");
    assert.equal(b.regs.sp, captured.regs.sp, "the rewrite touched the stack");
  }
  console.log(`  EXCLUDED: SP only, +2 oracle-side and +0 here, over ${r.trials} dispatches`);
});

test("CRAFTED: a hostile register file still comes out untouched", { skip }, () => {
  let trials = 0;
  for (const captured of allEntries().slice(0, 8)) {
    for (const fill of HOSTILE_FILLS) {
      const a = captured.clone();
      for (const k of REG_FIELDS) a.regs[k] = fill;
      a.regs.ix = (fill << 8) | fill;
      a.regs.iy = (fill << 8) | fill;
      a.regs.sp = HOSTILE_SP;
      const b = a.clone();
      oracle(a);
      loc_0ce8(b);
      assert.equal(firstStateDiff(a.dumpState(), b.dumpState()), null, `fill ${fill}: RAM moved`);
      for (const k of KEPT) assert.equal(b.regs[k], a.regs[k], `fill ${fill}: ${k} moved`);
      trials++;
    }
  }
  assert.ok(trials > 0, "vacuous: nothing was crafted");
  console.log(`  CRAFTED: ${trials} hostile register files, all four fills, all identical`);
});

test("LIVE-OUT IS MEASURED: most registers are read back, three are not", { skip }, () => {
  const surviving = [];
  for (const k of KEPT) {
    const wide = k === "ix" || k === "iy";
    const wreck = (mm) => {
      oracle(mm);
      mm.regs[k] = (mm.regs[k] ^ 0x5a) & (wide ? 0xffff : 0xff);
    };
    if (!replay(drivenMachine, wreck).forked) surviving.push(k);
  }
  assert.ok(surviving.length < KEPT.length, "nothing is read back — the claim is unfalsifiable");
  assert.deepEqual(surviving, ["a", "h", "l"], "the set of unmeasurable registers moved");
  // The flag byte counts as read back on the whole-register probe above, but not every bit of it
  // does, and the two flag twins below are split on exactly this measurement.
  const deadBits = FLAG_BITS.filter(
    ([, bit]) => !replay(drivenMachine, (mm) => {
      oracle(mm);
      mm.regs.f ^= bit;
    }).forked,
  ).map(([name]) => name);
  assert.deepEqual(deadBits, ["carry", "half-carry"], "which flag bits are read back has moved");
  console.log(
    `  LIVE-OUT: ${KEPT.length - surviving.length} of ${KEPT.length} registers fork the session ` +
      `when forced hostile after every dispatch; [${surviving.join(" ")}] do not, ` +
      `and of the flag bits [${deadBits.join(" ")}] do not`,
  );
});

test("WHOLE-MACHINE, SHIMMED: identical — and vacuous for the real candidate", { skip }, () => {
  for (const [name, factory] of TAPES) {
    const r = replay(factory, hosted(loc_0ce8));
    assert.equal(r.forked, false, `${name}: the session forked at frame ${r.frame}`);
    assert.ok(r.dispatches > 0, `${name}: the override never fired, so this proves nothing`);
    console.log(`  WHOLE-MACHINE/${name}: ${r.dispatches} dispatches, session identical`);
  }
});

test("WHOLE-MACHINE IS SENSITIVE: unshimmed, the empty rewrite wrecks the host", { skip }, () => {
  const r = replay(drivenMachine, loc_0ce8);
  assert.ok(r.forked, "leaking two stack bytes per dispatch left the session intact — impossible");
  console.log(`  SENSITIVE: unshimmed run ${r.died ? `died — ${r.died}` : `forked at ${r.frame}`}`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────────
// Each twin is asserted caught on an EXACT set, and the two instruments are scored separately so
// a twin only one of them sees cannot be reported as covered by both.

test("TEETH: the five touch-something twins die on every captured dispatch", { skip }, () => {
  const cases = [
    ["writes a cell", brokenWritesOneCell, "ram"],
    ["clobbers A", brokenClobbersAccumulator, "reg"],
    ["touches the carry flag", brokenTouchesTheCarryFlag, "reg"],
    ["touches the zero flag", brokenTouchesTheZeroFlag, "reg"],
    ["clobbers IX", brokenClobbersIndexRegister, "reg"],
  ];
  for (const [label, twin, by] of cases) {
    const r = sweep(twin);
    assert.equal(r.caught, r.trials, `${label}: survived ${r.trials - r.caught} dispatches`);
    assert.equal(by === "ram" ? r.byRam : r.byReg, r.trials, `${label}: caught by the wrong arm`);
    console.log(`  TEETH/${label}: ${r.caught} of ${r.trials}, all by the ${by} comparison`);
  }
});

test("TEETH: the extent twin dies on the driven tapes and on NO attract dispatch", { skip }, () => {
  const perTape = entries().map(([name, list]) => [name, sweep(brokenRunsOnByOneInstruction, list)]);
  const [, attract] = perTape[0];
  assert.equal(attract.caught, 0, "attract caught it after all — then re-derive the header's claim");
  let driven = 0, drivenTrials = 0;
  for (const [name, r] of perTape.slice(1)) {
    assert.equal(r.caught, r.trials, `${name}: the one-byte extent error survived ${r.trials}`);
    driven += r.caught;
    drivenTrials += r.trials;
  }
  assert.ok(driven > 0, "vacuous: no driven dispatch to catch it on");
  console.log(
    `  TEETH/extent: ${driven} of ${drivenTrials} driven dispatches, ` +
      `0 of ${attract.trials} attract ones — the demo alone would ship this bug`,
  );
});

test("TEETH: the stack twin escapes the sweep, and the SP pin is what kills it", { skip }, () => {
  const r = sweep(brokenPopsTheStack);
  assert.equal(r.caught, 0, "the pass-through sweep caught it — then re-derive what SP excludes");
  const captured = allEntries()[0].clone();
  brokenPopsTheStack(captured);
  assert.notEqual(captured.regs.sp, allEntries()[0].regs.sp, "the twin did not move SP at all");
  const w = replay(drivenMachine, hosted(brokenPopsTheStack));
  assert.ok(w.forked, "the shimmed session survived a double return, which is not possible");
  console.log(
    `  TEETH/stack: 0 of ${r.trials} caught by the sweep, which excludes SP; the arms that do ` +
      `catch it are the SP pin and the whole machine, which ` +
      `${w.died ? `died — ${w.died}` : `forked at ${w.frame}`}`,
  );
});

test("TEETH: the whole machine kills exactly the twins arm 8 says it can see", { skip }, () => {
  const cases = [
    ["writes a cell", brokenWritesOneCell, true],
    ["touches the zero flag", brokenTouchesTheZeroFlag, true],
    ["clobbers IX", brokenClobbersIndexRegister, true],
    ["clobbers A", brokenClobbersAccumulator, false],
    ["touches the carry flag", brokenTouchesTheCarryFlag, false],
  ];
  const survivors = [];
  for (const [label, twin, expected] of cases) {
    const w = replay(drivenMachine, hosted(twin));
    assert.equal(w.forked, expected, `${label}: the whole machine disagreed with the live-out arm`);
    if (!w.forked) survivors.push(label);
  }
  console.log(`  TEETH/whole-machine: it survives [${survivors.join(", ")}] — the sweep kills both`);
});
