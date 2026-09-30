// SPDX-License-Identifier: GPL-3.0-only
/**
 * chaseOneAimPointAndRetireAtTheLine — memory-equivalent to the frozen oracle at ROM 0x4117.
 *
 * Strict unit-capture over every dispatch of a long undriven attract session, one measured stack
 * exclusion, crafted sweeps over both branch tests, and teeth. The session is LONG because the
 * shared gates' frame budget never reaches this entry — the era its objects belong to has not
 * begun; six thousand frames of undriven attract do reach it, and nothing is poked to get there.
 *
 * WHERE THE LIVE-OUT WENT. The caller is 0x40EA, and both exits — the `ret nc` and the tail jump
 * to the retire routine — land on 0x4106, which does `jr 0x410B` at once. 0x410B reads exactly
 * three things: the object record pointer, the sprite entry pointer, and the loop counter (ix, iy,
 * b). The oracle hands all three back UNCHANGED — it never moves the pointers and it brackets its
 * calls with a save and restore of the counter pair — and the HANDED BACK arm measures that on the
 * oracle over the whole sweep. So the caller's own copies ARE the live-out: the rewrite's caller
 * holds the record, the entry and the count as locals and hands them to the turn-closer itself, and
 * this routine takes the record and the entry as arguments and leaves no register behind. That the
 * caller's copies are right is gated where the caller is (0x40EA, chased arm, ending and looping).
 *
 * EVERYTHING ELSE IS DEAD, measured on the ORACLE: wrapped in the all-frozen game with every other
 * register it can leave complemented on the way out (assertDeadAtExit), nothing differs over the
 * era-2 session, the stack page included; complementing the counter on the way out IS heard in game
 * data, so the instrument is not deaf.
 *
 * Six callees reached through the registry leave dead scratch below the seat; the window is
 * MEASURED, not assumed.
 *
 * HOLE: the six callees are gated by their own files; this file gates that all six are reached, in
 * order, under the right conditions.
 * HOLE: the retire arm fires on ONE captured dispatch; the crafted sweep does not force it.
 * HOLE: nothing here establishes what the point being aimed at IS.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-4117.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { chaseOneAimPointAndRetireAtTheLine } from "../chaseOneAimPointAndRetireAtTheLine.js";
import { headingToward } from "../headingToward.js";
import { steerTowardAimOneUnitAFrame } from "../steerTowardAimOneUnitAFrame.js";
import { loc_58aa } from "../loc_58aa.js";
import { dressSpriteShapeAndAttributeForHeadingSector } from "../dressSpriteShapeAndAttributeForHeadingSector.js";
import { hasReachedRetireLine } from "../hasReachedRetireLine.js";
import { retireSlot } from "../retireSlot.js";
import { loc_4117 as oracle } from "../../translated/loc_4117.js";
import { ERA_INDEX, FRAME_TICK, ROUTINES } from "../names.js";
import { assertDeadAtExit } from "./_deadAtExit.js";

const TARGET = 0x4117;
const FRAMES = 6000;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const TURN_PHASE = 15;
const AIM_HEADING = 1;
const PHASE_WHEEL = 15;
const ONE_AIM_POINT = 0xac7f;

/** Measured by the WINDOW arm: the deepest the oracle's own pushes reach below the entry seat. */
const SCRATCH_BYTES = 6;

/** What ROM 0x410B reads out of this routine: handed back exactly as they were handed in. */
const HANDED_BACK = ["ix", "iy", "b"];

/** Every other register the oracle can leave behind, the stack pointer apart. */
const LEFT_BEHIND = ["a", "f", "c", "d", "e", "h", "l", "a_", "f_", "b_", "c_", "d_", "e_", "h_", "l_"];

/** The session DEAD AT EXIT poisons over: the era-2 poke the sweep gates use (JS frames). */
const SESSION = [{ addr: ERA_INDEX, val: 2, frame: 900, dur: null }];
const SESSION_FRAMES = 2400;

const PHASES = Array.from({ length: 16 }, (_unused, p) => p);

/**
 * A stored aim the geometry at the crafted entry does NOT produce. Without it the sweep is blind
 * to both re-aim twins: at that entry the stored aim already equals what the computation returns,
 * so re-aiming writes the byte that is there and skipping it changes nothing. The PHASE arm
 * asserts the marker is overwritten, so the discrimination is measured rather than intended.
 */
const STALE_AIM = 0x5a;

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => {
  if (!d) return "identical";
  return d.addr === null
    ? `${d.reg}: oracle=${d.a} candidate=${d.b}`
    : `${hex4(d.addr)}: oracle=${d.a} candidate=${d.b}`;
};

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
 * Oracle vs candidate on clones of `machine`: the whole dump masked to the measured window. Only the
 * candidate's side is wrapped, because a raise from the oracle is a harness fault and must not be
 * swallowed.
 */
function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, reg: "raised", a: "returned", b: String(e).slice(0, 40) };
  }
  return allDiffs(a, b).find((d) => !inScratch(d.addr, sp)) ?? null;
}

/** How far below its seat the oracle's own pushes take the stack pointer, on one entry state. */
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

// ── the captured corpus ─────────────────────────────────────────────────────────────────

let corpus = null;

/** One pristine machine per dispatch of an undriven attract session. Nothing is poked. */
function captureCorpus() {
  if (corpus) return corpus;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    entries.push(mm.clone());
    return oracle(mm);
  }]]), { tape: [] });
  const frames = m.runFrames(FRAMES);
  assert.equal(m.stoppedBy, null, `corpus run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, FRAMES, "corpus run ran short");
  assert.ok(entries.length > 0, "vacuous: attract never reached the routine");
  corpus = entries;
  return corpus;
}

const reAims = (mm) =>
  (mm.mem8[FRAME_TICK] & PHASE_WHEEL) === mm.mem8[(mm.regs.ix + TURN_PHASE) & 0xffff];

/** Whether the oracle retires the slot from this state: the record byte goes to zero. */
function retires(mm) {
  const probe = mm.clone();
  const before = probe.mem8[probe.regs.ix];
  oracle(probe);
  return before !== 0 && probe.mem8[probe.regs.ix] === 0;
}

/** A real machine with the object's phase byte forced, so both sides of the re-aim test are hit. */
function withPhase(phase) {
  const mm = captureCorpus()[0].clone();
  mm.mem8[(mm.regs.ix + TURN_PHASE) & 0xffff] = phase;
  mm.mem8[(mm.regs.ix + AIM_HEADING) & 0xffff] = STALE_AIM;
  return mm;
}

/** Every machine this file compares on. What the WINDOW arm measures the oracle over. */
function sweep() {
  return [...captureCorpus(), ...PHASES.map(withPhase)];
}

// ── broken twins ────────────────────────────────────────────────────────────────────────
// Each is the module with one thing wrong, built the way the module is built — direct calls to
// the six callees. A twin reaching them through the registry would match the oracle's stack
// traffic and so would never be masked, which would let the teeth pass without exercising the
// exclusion.

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: re-aims on every frame instead of on the object's own share of them. */
function brokenAlwaysReAims(m) {
  const { regs, mem8 } = m;
  const held = regs.bc;
  const object = regs.ix;
  mem8[(object + AIM_HEADING) & 0xffff] = headingToward(m, ONE_AIM_POINT);
  steerTowardAimOneUnitAFrame(m);
  loc_58aa(m);
  dressSpriteShapeAndAttributeForHeadingSector(m);
  regs.bc = held;
  if (!hasReachedRetireLine(m)) return;
  retireSlot(m);
}

/** BUG: never re-aims, so an object keeps whatever heading it started with. */
function brokenNeverReAims(m) {
  const { regs } = m;
  const held = regs.bc;
  steerTowardAimOneUnitAFrame(m);
  loc_58aa(m);
  dressSpriteShapeAndAttributeForHeadingSector(m);
  regs.bc = held;
  if (!hasReachedRetireLine(m)) return;
  retireSlot(m);
}

/** BUG: skips the mover, so the object turns and is dressed but stands still. */
function brokenNoMove(m) {
  const { regs, mem8 } = m;
  const held = regs.bc;
  const object = regs.ix;
  if ((mem8[FRAME_TICK] & PHASE_WHEEL) === mem8[(object + TURN_PHASE) & 0xffff]) {
    mem8[(object + AIM_HEADING) & 0xffff] = headingToward(m, ONE_AIM_POINT);
  }
  steerTowardAimOneUnitAFrame(m);
  dressSpriteShapeAndAttributeForHeadingSector(m);
  regs.bc = held;
  if (!hasReachedRetireLine(m)) return;
  retireSlot(m);
}

/** BUG: retires on the opposite verdict, so live slots go and dead ones stay. */
function brokenInvertedRetire(m) {
  const { regs, mem8 } = m;
  const held = regs.bc;
  const object = regs.ix;
  if ((mem8[FRAME_TICK] & PHASE_WHEEL) === mem8[(object + TURN_PHASE) & 0xffff]) {
    mem8[(object + AIM_HEADING) & 0xffff] = headingToward(m, ONE_AIM_POINT);
  }
  steerTowardAimOneUnitAFrame(m);
  loc_58aa(m);
  dressSpriteShapeAndAttributeForHeadingSector(m);
  regs.bc = held;
  if (hasReachedRetireLine(m)) return;
  retireSlot(m);
}

/** BUG: writes the fresh aim one byte along, over the heading motion follows. */
function brokenAimToWrongCell(m) {
  const { regs, mem8 } = m;
  const held = regs.bc;
  const object = regs.ix;
  if ((mem8[FRAME_TICK] & PHASE_WHEEL) === mem8[(object + TURN_PHASE) & 0xffff]) {
    mem8[(object + AIM_HEADING + 1) & 0xffff] = headingToward(m, ONE_AIM_POINT);
  }
  steerTowardAimOneUnitAFrame(m);
  loc_58aa(m);
  dressSpriteShapeAndAttributeForHeadingSector(m);
  regs.bc = held;
  if (!hasReachedRetireLine(m)) return;
  retireSlot(m);
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["always-re-aims", brokenAlwaysReAims],
  ["never-re-aims", brokenNeverReAims],
  ["no-move", brokenNoMove],
  ["inverted-retire", brokenInvertedRetire],
  ["aim-to-wrong-cell", brokenAimToWrongCell],
];

/**
 * The BOUNDARY arm's probe: the ORACLE ITSELF, plus one byte flipped at `sp + offset`. Built on
 * the oracle so what the arm reports is a property of the MASK alone.
 */
function scribbler(offset) {
  return (m) => {
    const at = (m.regs.sp + offset) & 0xffff;
    oracle(m);
    m.mem8[at] ^= 0xff;
  };
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the first real dispatch: identical outside the measured window", { skip }, () => {
  const e = captureCorpus()[0];
  const sp = e.regs.sp;
  const a = e.clone();
  const b = e.clone();
  oracle(a);
  chaseOneAimPointAndRetireAtTheLine(b);
  const all = allDiffs(a, b);
  const strays = all.filter((d) => !inScratch(d.addr, sp));
  console.log(
    `  EQUAL: seat ${hex4(sp)}; ${all.length} differing bytes, ${strays.length} outside the window`,
  );
  assert.deepEqual(strays, [], `a divergence escaped the scratch window: ${show(strays[0])}`);
  assert.ok(all.length <= SCRATCH_BYTES, "more bytes differ than the window is wide");
  assert.notEqual(unitDiff(brokenNoOp, e), null, "a no-op PASSES the first dispatch, so that " +
    "entry is one the routine has nothing to do at and this arm is measuring nothing");
});

test("WINDOW: the oracle's own deepest push, measured over the whole sweep", { skip }, () => {
  let deepest = 0;
  for (const m of sweep()) deepest = Math.max(deepest, oracleDepth(m));
  console.log(`  WINDOW (measured): the oracle reaches ${deepest} bytes below its seat`);
  assert.equal(deepest, SCRATCH_BYTES, "the oracle's stack footprint moved, so the masked window " +
    "is no longer the measured one and every arm below is masking the wrong bytes");
});

test("BOUNDARY: the exclusion is exactly as wide as it declares", { skip }, () => {
  const e = captureCorpus()[0];
  const sp = e.regs.sp;
  const below = unitDiff(scribbler(-SCRATCH_BYTES - 1), e);
  const seat = unitDiff(scribbler(0), e);
  const inside = unitDiff(scribbler(-1), e);
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

test("CORPUS: every captured dispatch replays identically", { skip }, () => {
  const entries = captureCorpus();
  const aiming = entries.filter(reAims).length;
  const retiring = entries.filter(retires).length;
  assert.ok(aiming > 0, "no captured dispatch re-aimed, so that arm is uncovered by real states");
  assert.ok(aiming < entries.length, "every captured dispatch re-aimed, so the skip arm is " +
    "uncovered by real states");
  assert.ok(retiring > 0, "no captured dispatch retired its slot, so the tail transfer is never " +
    "taken and the inverted-retire twin below rests on nothing");
  for (const e of entries) {
    const d = unitDiff(chaseOneAimPointAndRetireAtTheLine, e);
    assert.equal(d, null, `${reAims(e) ? "re-aiming" : "skipping"}: ${show(d)}`);
  }
  console.log(
    `  CORPUS: ${entries.length} dispatches — ${aiming} re-aimed, ${entries.length - aiming} did ` +
      `not, ${retiring} retired`,
  );
});

test("PHASE: both sides of the re-aim test, over all sixteen phases", { skip }, () => {
  let matched = 0;
  for (const phase of PHASES) {
    const m = withPhase(phase);
    if (reAims(m)) matched++;
    const d = unitDiff(chaseOneAimPointAndRetireAtTheLine, m);
    assert.equal(d, null, `phase=${phase}: ${show(d)}`);
  }
  assert.equal(matched, 1, "exactly one of the sixteen phases must match a fixed frame counter; " +
    `${matched} did, so the crafted machine is not varying what this arm thinks it varies`);

  // The stale aim must actually be replaced on the matching phase and left alone on another, or
  // the two re-aim twins below are invisible here for a reason that has nothing to do with them.
  const aiming = PHASES.map(withPhase).find(reAims);
  const skipping = PHASES.map(withPhase).find((mm) => !reAims(mm));
  oracle(aiming);
  oracle(skipping);
  assert.notEqual(aiming.mem8[(aiming.regs.ix + AIM_HEADING) & 0xffff], STALE_AIM,
    "the matching phase left the stale aim standing, so nothing here can tell a re-aim from a skip");
  assert.equal(skipping.mem8[(skipping.regs.ix + AIM_HEADING) & 0xffff], STALE_AIM,
    "a non-matching phase overwrote the aim, so the rationing is not what this arm believes");
  console.log(`  PHASE: 16 phases identical outside the window, exactly ${matched} of them aiming; ` +
    `the stale aim ${STALE_AIM} is replaced on that one and stands on the others`);
});

test("HANDED BACK: the oracle returns the three registers its caller reads exactly as it got them", { skip }, () => {
  const moved = [];
  for (const m of sweep()) {
    const a = m.clone();
    oracle(a);
    for (const k of HANDED_BACK) if (a.regs[k] !== m.regs[k]) moved.push(k);
  }
  assert.deepEqual([...new Set(moved)], [], "the oracle hands back a pointer or the counter changed, so " +
    "the caller's own copies are not its live-out and the rewrite's caller is wrong to keep them");
  // The same measurement on the rewrite, which leaves the counter pair wherever its callees did: the
  // reading above is evidence only because this one can see a register that was not handed back.
  const control = [];
  for (const m of sweep()) {
    const b = m.clone();
    chaseOneAimPointAndRetireAtTheLine(b);
    for (const k of HANDED_BACK) if (b.regs[k] !== m.regs[k]) control.push(k);
  }
  assert.ok(control.length > 0, "the measurement sees nothing even on a routine that does not restore " +
    "the counter pair, so the clean oracle reading proves nothing");
  // The hand-back is safe only while its frozen readers never run: the caller 0x40EA and the loop tail
  // 0x410B it jumps to must both be replaced by overrides that take the registers as arguments.
  for (const reader of [0x40ea, 0x410b]) {
    assert.ok(ROUTINES[reader] !== undefined, `${hex4(reader)} reads the handed-back registers and is frozen, so the ` +
      "rewrite's moved counter would reach it");
  }
  console.log(`  HANDED BACK: ${HANDED_BACK.join(", ")} unchanged by the oracle over the whole sweep; ` +
    `the rewrite, which keeps no counter, moves ${[...new Set(control)].join(", ")}`);
});

test("DEAD AT EXIT: no other register the oracle leaves is heard; the counter is", { skip }, () => {
  // assertDeadAtExit: nothing differs, the stack page included; the counter, poisoned at the same
  // exit, must be heard in game data (dataOnly), not only as pushed scratch on the stack page.
  assertDeadAtExit({
    at: TARGET, poison: LEFT_BEHIND, frames: SESSION_FRAMES, reachEvery: true,
    sessions: [{ label: "era 2", pokes: SESSION }],
    controls: [{ label: "counter", poison: ["b"], expect: "heard", every: true, dataOnly: true }],
  });
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const entries = captureCorpus();
    let onCorpus = 0;
    let firstAt = null;
    for (const e of entries) {
      const d = unitDiff(twin, e);
      if (d === null) continue;
      onCorpus++;
      if (firstAt === null) firstAt = show(d);
    }
    let onPhases = 0;
    for (const phase of PHASES) if (unitDiff(twin, withPhase(phase)) !== null) onPhases++;
    console.log(`  TEETH/${label}: caught at ${onCorpus} of ${entries.length} captured states ` +
      `and ${onPhases} of ${PHASES.length} crafted phases — ${firstAt}`);
    assert.ok(onCorpus > 0, `the masked comparison PASSED the ${label} twin at every real state`);
  });
}
