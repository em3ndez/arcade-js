// SPDX-License-Identifier: GPL-3.0-only
/**
 * chaseOneAimPointAndRetireAtTheLine — memory-equivalent to the frozen oracle at ROM 0x4117.
 *
 * Strict unit-capture over every dispatch of a long undriven attract session, one measured stack
 * exclusion, crafted sweeps over both branch tests, and teeth. The session is LONG because the
 * shared gates' frame budget never reaches this entry — the era its objects belong to has not
 * begun; six thousand frames of undriven attract do reach it, and nothing is poked to get there.
 *
 * WHERE THE LIVE-OUT COMES FROM. The caller is 0x40EA, and both exits — the `ret nc` and the tail
 * jump to the retire routine — land on 0x4106, which does `jr 0x410B` at once. 0x410B reads exactly
 * three things: the object record pointer, the sprite entry pointer, and the loop counter (ix, iy,
 * b). Those are the LIVE_OUT, and the rewrite AGREES on all three — measured, not asserted — which
 * is why none appears in the ceiling. Everything else 0x410B leaves is overwritten or re-read from
 * memory, so a, f, the two scratch pairs and the alternate accumulator are dead across the boundary.
 *
 * THE COUNTER PAIR IS PART OF THE CONTRACT. The oracle brackets three calls with a save and restore
 * of the counter pair, and the rewrite does the same with a local. The counter is OUTSIDE the
 * ceiling, so the `counter-not-restored` twin is caught by the EXCLUDED arm — a gated property, not
 * a coincidence.
 *
 * Six callees reached through the registry leave dead scratch below the seat; the window is
 * MEASURED, not assumed. Every register in the ceiling already sits in the declared moved set of a
 * callee's own landed gate (0x3FAF's {a,f,d,e,l,sp} and 0x33B8's {f,b,c,d,e,sp,a_}), so this
 * routine introduces no divergence of its own and the INHERITED arm asserts that containment.
 *
 * HOLE: the six callees are gated by their own files; this file gates that all six are reached, in
 * order, under the right conditions, and that the counter pair survives them.
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
import { loc_3faf } from "../loc_3faf.js";
import { hasReachedRetireLine } from "../hasReachedRetireLine.js";
import { retireSlot } from "../retireSlot.js";
import { loc_4117 as oracle } from "../../translated/loc_4117.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { FRAME_TICK } from "../names.js";

const TARGET = 0x4117;
const FRAMES = 6000;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const TURN_PHASE = 15;
const AIM_HEADING = 1;
const PHASE_WHEEL = 15;
const ONE_AIM_POINT = 0xac7f;

/** Measured by the WINDOW arm: the deepest the oracle's own pushes reach below the entry seat. */
const SCRATCH_BYTES = 6;

/**
 * The ceiling on divergence, and the whole of it. Derived from the exit successors, none of which
 * reads any of these before overwriting it — not from the rewrite. Not a set the rewrite is
 * required to fill: one that diverged on fewer still passes, so this can never refuse a fix.
 */
const MOVED = ["a", "f", "d", "e", "l", "sp", "a_"];

/** What ROM 0x410B reads out of this routine, and therefore what must agree exactly. */
const LIVE_OUT = ["ix", "iy", "b"];

/**
 * The two callees whose own landed gates already declare every register in the ceiling. Copied
 * here as a claim this file CHECKS against those files' text, not as a note.
 */
const INHERITED_FROM = [
  ["equivalence-3faf.test.js", ["a", "f", "d", "e", "l", "sp"]],
  ["equivalence-33b8.test.js", ["f", "b", "c", "d", "e", "sp", "a_"]],
];

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
 * Oracle vs candidate on clones of `machine`: the whole dump masked to the measured window, then
 * every register outside the ceiling. Only the candidate's side is wrapped, because a raise from
 * the oracle is a harness fault and must not be swallowed.
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
  const ram = allDiffs(a, b).find((d) => !inScratch(d.addr, sp));
  if (ram) return ram;
  for (const k of REG_FIELDS) {
    if (MOVED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) return { addr: null, reg: k, a: a.regs[k], b: b.regs[k] };
  }
  return null;
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
  loc_3faf(m);
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
  loc_3faf(m);
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
  loc_3faf(m);
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
  loc_3faf(m);
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
  loc_3faf(m);
  regs.bc = held;
  if (!hasReachedRetireLine(m)) return;
  retireSlot(m);
}

/** BUG: leaves the counter pair wherever the callees left it. The EXCLUDED arm owns this one. */
function brokenCounterNotRestored(m) {
  const { regs, mem8 } = m;
  const object = regs.ix;
  if ((mem8[FRAME_TICK] & PHASE_WHEEL) === mem8[(object + TURN_PHASE) & 0xffff]) {
    mem8[(object + AIM_HEADING) & 0xffff] = headingToward(m, ONE_AIM_POINT);
  }
  steerTowardAimOneUnitAFrame(m);
  loc_58aa(m);
  loc_3faf(m);
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

test("LIVE-OUT: the three registers the caller reads agree exactly", { skip }, () => {
  const disagreed = [];
  for (const m of sweep()) {
    const a = m.clone();
    const b = m.clone();
    oracle(a);
    chaseOneAimPointAndRetireAtTheLine(b);
    for (const k of LIVE_OUT) if (a.regs[k] !== b.regs[k]) disagreed.push(k);
  }
  // A live register live-out is invisible to a memory gate, so the absence above is only evidence
  // if the same measurement can report one. The counter twin drops the loop counter, and that is
  // asserted seen here before the clean reading is believed.
  const control = [];
  for (const m of sweep()) {
    const a = m.clone();
    const b = m.clone();
    oracle(a);
    brokenCounterNotRestored(b);
    for (const k of LIVE_OUT) if (a.regs[k] !== b.regs[k]) control.push(k);
  }
  assert.ok(control.length > 0, "the measurement reports nothing even for a twin that abandons " +
    "the loop counter, so a clean reading proves nothing");
  assert.deepEqual([...new Set(disagreed)], [], "a register the caller reads diverged");
  console.log(`  LIVE-OUT: ${LIVE_OUT.join(", ")} agree over the whole sweep; the control twin ` +
    `disagrees on ${[...new Set(control)].join(", ")}`);
});

test("INHERITED: the ceiling is contained in the callees' own declared sets", { skip }, async () => {
  const union = new Set();
  for (const [file, declared] of INHERITED_FROM) {
    const text = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL(`./${file}`, import.meta.url), "utf8"));
    const line = `const EXCLUDED = [${declared.map((k) => `"${k}"`).join(", ")}];`;
    assert.ok(text.includes(line), `${file} no longer declares ${line} — the containment claim ` +
      "below is quoting a set that file does not have any more");
    for (const k of declared) union.add(k);
  }
  assert.deepEqual(MOVED.filter((k) => !union.has(k)), [], "the ceiling now holds a register no " +
    "callee's own gate declares, so this routine has started diverging on its own account");
  console.log(`  INHERITED: ceiling ${MOVED.join(", ")} ⊆ ${[...union].join(", ")}`);
});

/** Which registers a candidate parts company with the oracle on, over the whole sweep. */
function movedOver(candidate) {
  const moved = new Set();
  for (const m of sweep()) {
    const a = m.clone();
    const b = m.clone();
    oracle(a);
    try {
      candidate(b);
    } catch {
      continue;
    }
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

test("EXCLUDED, deliberately: no register outside the ceiling moves", { skip }, () => {
  const moved = movedOver(chaseOneAimPointAndRetireAtTheLine);
  // The absence below is only evidence if the same measurement CAN report a register outside the
  // ceiling. The counter twin leaves the loop counter where the callees left it, and the control
  // asserts that is seen.
  const control = movedOver(brokenCounterNotRestored);
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !MOVED.includes(k)),
    "the measurement reports nothing outside the ceiling even for a twin that abandons the " +
      "counter pair, so a clean reading below proves nothing");
  console.log(`  EXCLUDED (measured): ${REG_FIELDS.filter((k) => moved.has(k)).join(", ")} — ` +
    `ceiling ${MOVED.join(", ")}; the control twin also moves ` +
    `${REG_FIELDS.filter((k) => control.has(k) && !MOVED.includes(k)).join(", ")}`);
  // MOVED is a CEILING. deepEqual against it would DEMAND the divergence and go RED on a rewrite
  // that became register-exact — a gate that requires a wart refuses the fix.
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k) && !MOVED.includes(k)), [],
    "a register outside the declared ceiling diverged");
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
