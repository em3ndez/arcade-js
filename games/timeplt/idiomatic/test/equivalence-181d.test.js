// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_181d — memory-equivalent to the frozen oracle at ROM 0x181D.
 *
 * WHAT IT IS. One byte, 0xC9: a bare `ret`. The rewrite is therefore an empty function, because
 * the idiomatic layer models no stack and a return is the host language's. Everything hard about
 * this file is proving that the empty function is RIGHT rather than merely green, and the two
 * halves of that are (a) the routine really is reached, and (b) the instruments really can see a
 * routine that does something.
 *
 * WHO REACHES IT — the question a mnemonic grep answers wrongly. No `call 0x181d`, `jp 0x181d` or
 * `jr 0x181d` exists anywhere in the image, yet the routine executes on every driven run. The
 * whole reference set is one `ld hl,0x181d` / `push hl` at 0x17FE, which parks this address as the
 * place the RST 0x30 jump-table dispatch three instructions later should come back to; every arm
 * of that table returns THROUGH this byte, and its `ret` carries control on to 0x17FE's caller.
 * `translated/loc_17fe.js` transcribes that as `m.call(0x181d)`, which is exactly why the address
 * scores zero by one grep form and thousands by the other.
 *   Two scans of the ROM image back this up, and neither is a grep of our own prose. Searching the
 * whole image for the little-endian word 0x181D finds two occurrences: 0x17FF, preceded by opcode
 * 0x21 (`ld hl,nn`), and 0x02D2, which lies inside a run of (0x1D, n) byte pairs and is preceded by
 * 0x17 — not an nn-operand opcode, so it is table data and not a reference. Searching every
 * relative-jump opcode within displacement range finds nothing landing on 0x181D. The corpus arm
 * below asserts the shape a single caller implies: every dispatch arrives with the SAME return
 * address on top of the stack, so there is one way in and one way out and the run prints it.
 *
 * ★ THE SHARED DRIVEN TAPE PRESSES ONLY COIN 1 AND 1 PLAYER START — IT NEVER FIRES AND NEVER
 *   CHANGES DIRECTION. ★ AND THE UNDRIVEN ATTRACT DEMO, WHICH RUNS REAL GAME LOGIC, NEVER REACHES
 *   THIS ROUTINE AT ALL — zero dispatches over the whole attract run, asserted below. So the
 *   corpus is driven-only by necessity, and a second two-player tape runs beside the shared one
 *   for no reason but to widen the register spread at entry. Neither limitation binds on behaviour here:
 *   the routine reads no input, no coordinate and no heading, and the crafted arm drives the whole
 *   register file to values no tape produces.
 *
 * GATE: unit capture at the real dispatch, a pass-through sweep over every dispatch of two driven
 *   tapes, a crafted hostile-register arm, a measured live-out probe, and two whole-machine
 *   replays. What it exercises, holes stated:
 *
 *   1. EQUAL at the real dispatch — RAM byte-identical, and the stack pointer is the only register
 *      that moves. It must MOVE, too: a rewrite that popped the stack the way the frozen return
 *      does would leave every register equal, and this arm fails on exactly that.
 *   2. RAM IS BLIND, BUT IT IS NOT DEAD. A candidate that writes nothing passes the RAM diff, and
 *      the correct routine is such a candidate, so RAM cannot be the whole gate. The arm therefore
 *      MEASURES the diff's sensitivity instead of assuming it: a twin that writes one byte fails
 *      at this same dispatch.
 *   3. DEAD FIRST DISPATCH — the capture is the first entry, so the run is repeated at a doubled
 *      frame budget and the two entry states are asserted byte-identical.
 *   4. DEGENERATE ENTRY — named, not hoped away. B is zero at every dispatch of both tapes, and B,
 *      IX and one shadow half never vary at all, so a twin zeroing B or nudging IX by nothing is
 *      invisible in the captured corpus; the run prints both sets, and the crafted arm covers them
 *      by driving every register to four fills including zero.
 *   5. UNIFORM CORPUS — two tapes, every dispatch of each replayed rather than a sample, plus the
 *      crafted arm. The attract case is not a third corpus but a zero, and is asserted as one.
 *   6. PASS-THROUGH — the real content of the claim. RAM and every register except SP must come
 *      out of the candidate exactly as they came out of the oracle, and the returned value must be
 *      nothing on both sides.
 *   7. SP IS EXCLUDED, DELIBERATELY, and pinned: the oracle's return advances it by exactly two
 *      and the rewrite leaves it alone, which is the no-stack model stated as an assertion. That
 *      pin is what catches a rewrite modelling the stack — the pass-through sweep cannot, because
 *      such a rewrite lands on the oracle's own stack pointer.
 *   8. LIVE-OUT IS MEASURED, AND THE MEASUREMENT IS NEGATIVE. Forcing any single register hostile
 *      after EVERY dispatch of a whole driven session leaves the session bit-identical — for all
 *      eighteen of them. Nothing this routine passes through is consumed downstream on either
 *      tape, so arm 6 is CONSERVATIVE and the corpus cannot punish a register clobber. The arm
 *      asserts the instrument is not simply blind by doing the same to the stack pointer, which
 *      does break the session.
 *   9. WHOLE-MACHINE, SHIMMED — ★ VACUOUS FOR THE REAL CANDIDATE AND SAID SO OUT LOUD. The host
 *      engine is stack-driven, so the shim pays the return the rewrite no longer takes; applied to
 *      an empty function the shim IS the oracle instruction for instruction, and this arm could
 *      not fail. It earns its place by counting dispatches and by carrying the twins.
 *  10. WHOLE-MACHINE IS SENSITIVE — the unshimmed empty candidate destroys the session, which is
 *      what licenses reading arm 9's twins as evidence rather than as noise.
 *  11. TEETH — a twin per resource the routine could touch, scored on two instruments with a
 *      declared split. No single instrument catches them all, and the file says which catches
 *      which rather than reporting one total.
 *
 * ★ HOLE, and it is the important one: this routine's register pass-through is UNFALSIFIABLE on
 * the corpus. Arm 8 shows the game does not read back a single register this routine crosses, so a
 * rewrite that clobbered any of them would still play the game correctly; arm 6 rejects one
 * anyway, because "leaves the machine as it found it" is what the byte means. A second hole: the
 * captured entries all share one stack pointer and one IX, so the crafted arm rather than the tape
 * is what varies those.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-181d.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, COIN_START_TAPE, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_181d } from "../loc_181d.js";
import { loc_181d as oracle } from "../../translated/loc_181d.js";
import { PLAYER_STATE } from "../names.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x181d;

/** The routine the byte after this one begins, for the twin that gets the extent wrong. */
const NEXT_ROUTINE = 0x181e;

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

/** Two coins and the two-player button, then a stick that moves, purely to spread the registers. */
const TWO_PLAYER_TAPE = [
  { frame: 401, port: IN0, bits: COIN, dur: HOLD },
  { frame: 450, port: IN0, bits: COIN, dur: HOLD },
  { frame: 501, port: IN0, bits: START_2P, dur: HOLD },
  { frame: 600, port: IN1, bits: FIRE, dur: null },
  { frame: 700, port: IN1, bits: LEFT, dur: 40 },
  { frame: 900, port: IN1, bits: RIGHT, dur: 40 },
];

const CORPUS_FRAMES = 900;
const WHOLE_FRAMES = 1400;
const ATTRACT_FRAMES = 2500;

/** Every dispatch falls inside one push-start window, one per frame, so the count is exact. */
const DISPATCHES_PER_DRIVEN_TAPE = 100;

/** Register patterns for the crafted arm: all clear, all set, and two alternating fills. */
const HOSTILE_FILLS = [0x00, 0xff, 0x5a, 0xa5];
const HOSTILE_SP = 0xafc0;

const skip = romsPresent() ? false : "ROM images are gitignored and absent";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

const drivenMachine = (overrides) => makeMachine(overrides, { tape: COIN_START_TAPE });
const twoPlayerMachine = (overrides) => makeMachine(overrides, { tape: TWO_PLAYER_TAPE });
const TAPES = [["shared", drivenMachine], ["two-player", twoPlayerMachine]];

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
function brokenTouchesTheFlags(m) {
  m.regs.f ^= 0x01;
}

/** BUG: moves the object-record pointer on, as a per-slot routine would. */
function brokenClobbersIndexRegister(m) {
  m.regs.ix ^= 0x0101;
}

/** BUG: models the stack — the mistake of copying the frozen return into a layer without one. */
function brokenPopsTheStack(m) {
  m.pop16();
}

/** BUG: runs on into the routine the next byte begins, which is the extent error for one byte. */
function brokenRunsOnIntoTheNextRoutine(m) {
  m.call(NEXT_ROUTINE);
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
function replay(factory, override, frames = WHOLE_FRAMES) {
  try {
    const w = wholeMachineEquivalence(factory, frames, new Map([[TARGET, override]]));
    return { forked: !w.equal, frame: w.frame ?? null, dispatches: w.invocations.get(TARGET) };
  } catch (e) {
    return { forked: true, frame: null, dispatches: null, died: e.message };
  }
}

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: the rewrite matches the frozen routine", { skip }, () => {
  const r = unitEquivalence(makeMachine, TARGET, oracle, loc_181d, { maxFrames: ENTRY_FRAMES });
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

test("CORPUS: both driven tapes dispatch, and undriven attract never does", { skip }, () => {
  for (const [name, list] of entries()) {
    assert.equal(list.length, DISPATCHES_PER_DRIVEN_TAPE, `${name} tape dispatch count moved`);
  }
  const attract = captureFrom((ov) => makeMachine(ov, { tape: [] }), ATTRACT_FRAMES);
  assert.equal(attract.length, 0, "attract reached the routine — the header's premise is wrong");
  // One reference in the image means one way out: the word the frozen return pops is the caller's
  // caller, and it is the same word at every dispatch of both tapes.
  const returns = new Set(allEntries().map((e) => e.mem16[e.regs.sp]));
  assert.equal(returns.size, 1, `${returns.size} distinct return addresses — a second caller?`);
  console.log(
    `  CORPUS: ${entries().map(([n, l]) => `${n}=${l.length}`).join(" ")}, ` +
      `attract=0 over ${ATTRACT_FRAMES} frames, every one returning to ${hex4([...returns][0])}`,
  );
});

test("DEGENERATE ENTRY: the captured spread is reported, not assumed away", { skip }, () => {
  const list = allEntries();
  const zero = REG_FIELDS.filter((k) => list.every((e) => e.regs[k] === 0));
  const fixed = REG_FIELDS.filter((k) => new Set(list.map((e) => e.regs[k])).size === 1);
  const varying = REG_FIELDS.filter((k) => !fixed.includes(k));
  assert.ok(varying.length > 0, "every register was constant — the corpus is one entry repeated");
  assert.ok(HOSTILE_FILLS.includes(0x00), "the crafted arm must cover the always-zero registers");
  console.log(
    `  DEGENERATE: always zero [${zero.join(" ") || "none"}], never varying ` +
      `[${fixed.join(" ")}], varying [${varying.join(" ")}]`,
  );
});

test("PASS-THROUGH: every dispatch of both tapes comes out identical", { skip }, () => {
  for (const [name, list] of entries()) {
    const r = sweep(loc_181d, list);
    assert.ok(r.trials > 0, `vacuous: the ${name} tape captured nothing`);
    assert.equal(r.caught, 0, `${name}: ${r.caught} of ${r.trials} dispatches diverged`);
    assert.equal(r.returned, 0, `${name}: something was handed back`);
    console.log(`  PASS-THROUGH/${name}: ${r.trials} dispatches identical, nothing returned`);
  }
});

test("EXCLUDED: the stack pointer moves by two, and nothing else moves at all", { skip }, () => {
  const r = sweep(loc_181d);
  assert.deepEqual([...r.moved], [EXCLUDED], `the excluded set widened to ${[...r.moved]}`);
  for (const captured of allEntries()) {
    const a = captured.clone();
    const b = captured.clone();
    oracle(a);
    loc_181d(b);
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
      loc_181d(b);
      assert.equal(firstStateDiff(a.dumpState(), b.dumpState()), null, `fill ${fill}: RAM moved`);
      for (const k of KEPT) assert.equal(b.regs[k], a.regs[k], `fill ${fill}: ${k} moved`);
      trials++;
    }
  }
  assert.ok(trials > 0, "vacuous: nothing was crafted");
  console.log(`  CRAFTED: ${trials} hostile register files, all four fills, all identical`);
});

test("LIVE-OUT IS MEASURED, AND IT IS EMPTY", { skip }, () => {
  const surviving = [];
  for (const k of KEPT) {
    const wide = k === "ix" || k === "iy";
    const wreck = (mm) => {
      oracle(mm);
      mm.regs[k] = (mm.regs[k] ^ 0x5a) & (wide ? 0xffff : 0xff);
    };
    if (!replay(drivenMachine, wreck).forked) surviving.push(k);
  }
  const stack = replay(drivenMachine, (mm) => {
    oracle(mm);
    mm.regs.sp = (mm.regs.sp + 2) & 0xffff;
  });
  assert.ok(stack.forked, "wrecking the stack pointer did not break the session — instrument dead");
  assert.deepEqual(surviving, KEPT, "a register IS consumed downstream; the stated hole is wrong");
  console.log(
    `  LIVE-OUT: ${surviving.length} registers forced hostile after every dispatch, ` +
      "session unchanged for all of them; the stack pointer breaks it",
  );
});

test("WHOLE-MACHINE, SHIMMED: identical — and vacuous for the real candidate", { skip }, () => {
  for (const [name, factory] of TAPES) {
    const r = replay(factory, hosted(loc_181d));
    assert.equal(r.forked, false, `${name}: the session forked at frame ${r.frame}`);
    assert.equal(r.dispatches, DISPATCHES_PER_DRIVEN_TAPE, `${name}: dispatch count moved`);
    console.log(`  WHOLE-MACHINE/${name}: ${r.dispatches} dispatches, session identical`);
  }
});

test("WHOLE-MACHINE IS SENSITIVE: unshimmed, the empty rewrite wrecks the host", { skip }, () => {
  const r = replay(drivenMachine, loc_181d);
  assert.ok(r.forked, "leaking two stack bytes per dispatch left the session intact — impossible");
  console.log(`  SENSITIVE: unshimmed run ${r.died ? `died — ${r.died}` : `forked at ${r.frame}`}`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────────
// Each twin is asserted caught on an EXACT set, and the two instruments are scored separately so
// a twin only one of them sees cannot be reported as covered by both.

test("TEETH: the touch-something twins die on every captured dispatch", { skip }, () => {
  const cases = [
    ["writes a cell", brokenWritesOneCell, "ram"],
    ["clobbers A", brokenClobbersAccumulator, "reg"],
    ["touches the flags", brokenTouchesTheFlags, "reg"],
    ["clobbers IX", brokenClobbersIndexRegister, "reg"],
  ];
  for (const [label, twin, by] of cases) {
    const r = sweep(twin);
    assert.equal(r.caught, r.trials, `${label}: survived ${r.trials - r.caught} dispatches`);
    assert.equal(by === "ram" ? r.byRam : r.byReg, r.trials, `${label}: caught by the wrong arm`);
    console.log(`  TEETH/${label}: ${r.caught} of ${r.trials}, all by the ${by} comparison`);
  }
});

test("TEETH: the extent twin dies on every captured dispatch", { skip }, () => {
  const r = sweep(brokenRunsOnIntoTheNextRoutine);
  assert.equal(r.caught, r.trials, `the one-byte extent error survived ${r.trials - r.caught}`);
  const w = replay(drivenMachine, hosted(brokenRunsOnIntoTheNextRoutine));
  assert.ok(w.forked, "and the whole-machine replay let the extent error through");
  console.log(`  TEETH/extent: ${r.caught} of ${r.trials} dispatches, and the session too`);
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

test("TEETH: the register twins are INVISIBLE to the whole machine, as arm 8 says", { skip }, () => {
  const registerTwins = [
    ["clobbers A", brokenClobbersAccumulator],
    ["touches the flags", brokenTouchesTheFlags],
    ["clobbers IX", brokenClobbersIndexRegister],
  ];
  for (const [label, twin] of registerTwins) {
    const w = replay(drivenMachine, hosted(twin));
    assert.equal(w.forked, false, `${label}: the session forked, so a register IS read back`);
  }
  console.log("  TEETH/registers: all three survive the whole machine; only the sweep kills them");
});
