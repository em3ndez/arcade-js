// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_181d — the frozen routine at ROM 0x181D is one byte, 0xC9: a bare `ret`. The rewrite is an
 * empty function, because the idiomatic layer models no stack and the return is the host language's.
 * The work is proving that empty function RIGHT, not merely green: that the routine really is
 * reached, and that the instruments can see a routine that does something.
 *
 * WHO REACHES IT. No `call`, `jp` or `jr 0x181d` exists in the image, yet the routine runs on every
 * driven pass. The whole reference set is one `ld hl,0x181d` / `push hl` at 0x17FE, parking this as
 * the address the RST 0x30 jump-table returns THROUGH: every arm returns through this byte, and its
 * `ret` carries control on to 0x17FE's caller. One reference means one way in and one way out —
 * every dispatch arrives with the SAME return address on the stack, and the CORPUS arm asserts it.
 *
 * The shared driven tape presses only COIN 1 and 1-PLAYER START; it never fires and never turns, and
 * the undriven attract demo never reaches this routine at all (zero dispatches, asserted below). So
 * the corpus is driven-only by necessity, with a second two-player tape beside it only to widen the
 * register spread. Neither limit binds behaviour here: the routine reads no input, and the crafted
 * arm drives the whole register file to values no tape produces.
 *
 * GATE: a unit capture at the real dispatch, a pass-through sweep over every dispatch of two driven
 * tapes, a crafted hostile-register arm, a measured live-out probe, and two whole-machine replays.
 * Each arm names itself below and states its own hole in its assertions. SP is excluded and pinned:
 * the frozen return advances it by two and the rewrite leaves it alone — the no-stack model as an
 * assertion, and what catches a rewrite that models the stack (the pass-through sweep cannot, since
 * such a rewrite lands on the oracle's own stack pointer). Two arms turn on a measurement: the RAM
 * diff is BLIND but not DEAD — a no-op passes it, so the arm measures the diff's sensitivity (a twin
 * writing one byte fails) rather than assuming it; and LIVE-OUT is MEASURED and NEGATIVE — forcing
 * any register hostile after every dispatch leaves a driven session bit-identical, so the
 * pass-through claim is CONSERVATIVE, while the same done to SP does break it, proving the
 * instrument is not simply blind.
 *
 * ★ HOLE, the important one: the register pass-through is UNFALSIFIABLE on the corpus. The game
 * reads back none of the registers this routine crosses, so a rewrite clobbering any of them would
 * still play correctly; the pass-through arm rejects one anyway, because "leaves the machine as it
 * found it" is what the byte means. A second hole: the captured entries share one stack pointer and
 * one IX, so the crafted arm, not the tape, is what varies those.
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
