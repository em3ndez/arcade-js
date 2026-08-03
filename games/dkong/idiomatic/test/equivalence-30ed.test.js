// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_30ed (ROM 0x30ED) — one frame of the five-slot object pass: the
 * difficulty frame gate, the record census, the per-object state-machine walk, the sprite gather.
 *
 * The routine's own control flow is three arms — bail at the gate, bail at the census, or run
 * the whole pass — and PLAIN ATTRACT REACHES ALL THREE, so nothing here is crafted. What the
 * routine itself contributes is the sequencing and the two guards; the arithmetic all belongs to
 * the four callees, each of which has its own gate (0x30FA / 0x313C / 0x34F3 are idiomatic and
 * gated; 0x31B1 is still the frozen oracle on both sides here and is therefore not under test).
 *
 *   1. CAPTURE + REPLAY — a 4000-frame attract run with 0x30ED hooked. Every dispatch is cloned
 *      at entry and classified by which addresses the ORACLE goes on to call (0x313C absent →
 *      gate-skip; 0x31B1 absent → census-skip; present → full), so the arm labels come from the
 *      oracle's behaviour and not from the candidate's. SAMPLING: every 20th dispatch plus the
 *      first of each arm; the test asserts the sample covers every arm the run produced, and
 *      prints how many of how many were replayed. Each sampled entry is replayed on two
 *      byte-identical clones — oracle on one, loc_30ed on the other — and compared on
 *      RAM − STACK_SCRATCH and the RETURN VALUE. pc/SP are deliberately not compared: the
 *      rewrite has no stack dance to preserve, and the test measures where both sides' stack
 *      traffic landed instead, asserting it stayed inside the excluded region.
 *
 *   2. LIVE-WIRE — loc_30ed drives a whole 2000-frame attract run as a registered override, and
 *      every frame of the state trace must be byte-identical to the all-oracle baseline, the
 *      stack region INCLUDED (this arm compares the full dump, not RAM − STACK_SCRATCH).
 *      THE CYCLE RESTORATION IS NOT COSMETIC. The rewrite charges no T-states for the three
 *      idiomatic callees, and Donkey Kong seeds its RNG from timing (SPIN_COUNT 0x6019 counts
 *      main-loop passes per frame), so an under-charged routine reseeds the PRNG and the run
 *      forks for reasons that have nothing to do with the rewrite. The harness therefore
 *      measures what the oracle would have spent — by running it on a clone of the entry state —
 *      and charges exactly that. The CONTROL test below wires the same rewrite WITHOUT the
 *      restoration and asserts the trace does fork, which is what shows this arm is sensitive
 *      rather than lenient.
 *
 *   3. TEETH — five broken twins. Three are caught by arm 1's RAM diff (a dropped gate guard, a
 *      dropped census guard, gather-before-update). One is invisible to the RAM diff and caught
 *      only by the RETURN assertion (propagating a callee's boolean instead of returning
 *      nothing — a real hazard here, since 0x30ED is not in machine.js's SEAM_CALLER_SKIP and a
 *      `false` would make the seam consume a stack word the routine does not owe). One is
 *      invisible to BOTH and caught only by arm 2 (dropping the oracle-boundary return bracket
 *      before the frozen 0x31B1: the missing word is inside STACK_SCRATCH, so only a whole-run
 *      trace sees the damage).
 *
 * Isolated replays use clone(), whose frame machinery is neutralised (nextNmi / nextBoundary =
 * Infinity), so an m.step inside the oracle cannot trip a live NMI whose handler would write RAM
 * and masquerade as an oracle side effect.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-30ed.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_30ed as oracle } from "../../translated/loc_30ed.js";
import { loc_30ed } from "../loc_30ed.js";
import { gateObjectUpdateByDifficulty } from "../gateObjectUpdateByDifficulty.js";
import { loc_313c } from "../loc_313c.js";
import { loc_34f3 } from "../loc_34f3.js";
import { Machine } from "../../machine.js";
import { STACK_SCRATCH } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x30ed;
const CAPTURE_FRAMES = 4000; // the capture run
const LIVE_FRAMES = 2000; // the live-wire run and its baseline
const SAMPLE_EVERY = 20; // keep every Nth dispatch, plus the first of each arm
const ARMS = ["gate-skip", "census-skip", "full"];

const hx = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const inStack = (addr) => addr >= STACK_SCRATCH.lo && addr < STACK_SCRATCH.hi;

/** First differing RAM byte OUTSIDE the dead stack scratch, or null. Also counts the excluded bytes. */
function ramDiffExStack(a, b, offToAddr) {
  let excluded = 0;
  let diff = null;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) continue;
    const addr = offToAddr(i);
    if (inStack(addr)) { excluded++; continue; }
    if (diff === null) diff = { addr, a: a[i], b: b[i] };
  }
  return { diff, excluded };
}

/**
 * Run a 4000-frame attract run with 0x30ED hooked, cloning each dispatch's entry state and
 * classifying the arm from the ORACLE's own outgoing calls. Returns the sampled entries plus
 * the full per-arm totals, so the sample's coverage can be checked against what really happened.
 */
function captureDispatches() {
  const kept = [];
  const armTotals = new Map(ARMS.map((a) => [a, 0]));
  const firstOfArm = new Set();
  let n = 0;
  let firstFrame = null;

  const snap = new Map([[TARGET, (mm) => {
    if (firstFrame === null) firstFrame = mm.frames.length;
    const entry = mm.clone();
    // Watch which addresses the oracle dispatches on this pass. Restored immediately; the host
    // run is driven by the oracle exactly as it would be with no hook at all.
    const dispatch = mm.call;
    const called = [];
    mm.call = (addr, ...rest) => { called.push(addr); return dispatch(addr, ...rest); };
    let r;
    try { r = oracle(mm); } finally { mm.call = dispatch; }

    const arm = !called.includes(0x313c) ? "gate-skip" : !called.includes(0x31b1) ? "census-skip" : "full";
    armTotals.set(arm, armTotals.get(arm) + 1);
    if (n % SAMPLE_EVERY === 0 || !firstOfArm.has(arm)) {
      firstOfArm.add(arm);
      kept.push({ entry, arm, index: n });
    }
    n++;
    return r;
  }]]);

  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(CAPTURE_FRAMES);
  return { kept, total: n, armTotals, firstFrame };
}

/**
 * Replay every sampled entry: oracle on one clone, `candidate` on another. Returns the first
 * failure (RAM outside the stack scratch, or a return value that is not undefined) or null,
 * plus the measured stack low-water mark and excluded-byte count.
 */
function replaySamples(kept, candidate) {
  let failure = null;
  let excluded = 0;
  let lowWater = 0x10000;
  for (const cap of kept) {
    const a = cap.entry.clone();
    const b = cap.entry.clone();
    const wantRet = oracle(a);
    const gotRet = candidate(b);
    lowWater = Math.min(lowWater, a.regs.sp, b.regs.sp);
    if (failure === null && gotRet !== wantRet) {
      failure = { kind: "return", cap, want: wantRet, got: gotRet };
    }
    const { diff, excluded: ex } = ramDiffExStack(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
    excluded += ex;
    if (failure === null && diff !== null) failure = { kind: "ram", cap, diff };
  }
  return { failure, excluded, lowWater };
}

/**
 * A one-line summary of a replay failure. Assertions compare THIS rather than the failure
 * object, because the object holds a captured Machine and node's assertion diff would print the
 * whole emulator instead of the finding.
 */
const describe = (f) =>
  f === null
    ? null
    : f.kind === "return"
      ? `[${f.cap.arm} #${f.cap.index}] return value ${String(f.got)} — the oracle returns ${String(f.want)}`
      : `[${f.cap.arm} #${f.cap.index}] RAM at ${hx(f.diff.addr)}: oracle=${f.diff.a} candidate=${f.diff.b}`;

// -- 1. CAPTURE + REPLAY ------------------------------------------------------

test("CAPTURED DISPATCHES: loc_30ed matches the oracle on RAM − STACK_SCRATCH and on its return value", () => {
  const { kept, total, armTotals, firstFrame } = captureDispatches();

  assert.ok(total > 0, "0x30ED is dispatched every frame the object pass runs (handler_1977 → loc_197a → here); none means the live chain regressed");
  const armsSeen = ARMS.filter((a) => armTotals.get(a) > 0);
  assert.deepEqual(armsSeen, ARMS, `plain attract is expected to reach all three arms; saw ${armsSeen.join(",")}`);
  // The sample must cover every arm the run produced, or the replay below is partial coverage
  // reported as full coverage.
  assert.deepEqual(
    [...new Set(kept.map((k) => k.arm))].sort(),
    [...armsSeen].sort(),
    "the sampled entries must cover every arm the capture run actually produced",
  );

  const { failure, excluded, lowWater } = replaySamples(kept, loc_30ed);
  assert.equal(describe(failure), null, "loc_30ed diverged from the oracle on a real captured dispatch");
  // The excluded region has to actually cover both sides' stack traffic, or the exclusion is
  // hiding a difference rather than tolerating a known-dead one.
  assert.ok(
    lowWater >= STACK_SCRATCH.lo,
    `stack traffic reached ${hx(lowWater)}, below STACK_SCRATCH ${hx(STACK_SCRATCH.lo)} — the exclusion no longer covers it`,
  );

  console.log(
    `  CAPTURED: ${kept.length} of ${total} natural dispatches replayed over ${CAPTURE_FRAMES} attract frames ` +
      `(first at frame ${firstFrame}; arms: ${ARMS.map((a) => `${a}=${armTotals.get(a)}`).join(" ")}); ` +
      `RAM − STACK_SCRATCH and return value identical; ${excluded} byte(s) of excluded stack scratch, ` +
      `low-water SP ${hx(lowWater)}`,
  );
});

// -- 2. LIVE-WIRE -------------------------------------------------------------

/**
 * Run `frames` of attract with `candidate` wired live at 0x30ED (loc_30ed itself, or a broken twin).
 *
 * `restoreCycles` charges the T-states the oracle would have spent on this dispatch, measured by
 * running the oracle on a clone of the entry state. Without it the rewrite under-charges, which
 * moves the vblank NMI and reseeds the timing-driven PRNG — a divergence the routine did not
 * cause. The measurement device is the oracle's CLOCK only; every byte the run produces comes
 * from the rewrite.
 */
function liveWire(frames, candidate, restoreCycles) {
  let dispatches = 0;
  const fn = (mm) => {
    dispatches++;
    const c0 = mm.cycles;
    let cost = 0;
    if (restoreCycles) {
      const probe = mm.clone();
      oracle(probe);
      cost = probe.cycles - c0;
    }
    candidate(mm);
    if (restoreCycles) mm.step(0x30f9, cost - (mm.cycles - c0));
  };
  const m = new Machine(ROM, { overrides: new Map([[TARGET, fn]]) });
  const frameDumps = m.runFrames(frames);
  return { m, frameDumps, dispatches };
}

/** First frame+byte where two traces differ, or null. */
function firstTraceDiff(base, other, offToAddr) {
  for (let f = 0; f < Math.min(base.length, other.length); f++) {
    const a = base[f], b = other[f];
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] !== b[i]) return { frame: f, addr: offToAddr(i), a: a[i], b: b[i] };
    }
  }
  return null;
}

test("LIVE-WIRE: loc_30ed drives a whole attract run frame-identical to the all-oracle baseline", () => {
  const base = new Machine(ROM);
  const baseFrames = base.runFrames(LIVE_FRAMES);
  assert.equal(base.stoppedBy ?? null, null, `baseline run stopped early: ${base.stoppedBy}`);
  assert.equal(baseFrames.length, LIVE_FRAMES, "baseline did not reach every frame");

  const { m, frameDumps, dispatches } = liveWire(LIVE_FRAMES, loc_30ed, true);
  assert.equal(m.stoppedBy ?? null, null, `live-wire run stopped early: ${m.stoppedBy}`);
  assert.equal(frameDumps.length, LIVE_FRAMES, "live-wire run did not reach every frame");
  assert.ok(dispatches > 0, "the override must actually have been dispatched, or this arm is vacuous");

  const d = firstTraceDiff(baseFrames, frameDumps, (o) => base.stateOffsetToAddr(o));
  assert.equal(
    d,
    null,
    d && `frame ${d.frame} diverged at ${hx(d.addr)}: baseline=${d.a} live-wire=${d.b}` +
      (inStack(d.addr) ? " (inside STACK_SCRATCH — this arm compares the full dump on purpose)" : ""),
  );
  console.log(
    `  LIVE-WIRE: ${dispatches} dispatches over ${LIVE_FRAMES} attract frames — all ${frameDumps.length} ` +
      "frames byte-identical to the all-oracle baseline, stack region included",
  );
});

test("LIVE-WIRE CONTROL: without the cycle restoration the same wiring DOES fork — the arm above is sensitive", () => {
  const base = new Machine(ROM);
  const baseFrames = base.runFrames(LIVE_FRAMES);
  const { frameDumps } = liveWire(LIVE_FRAMES, loc_30ed, false);
  const d = firstTraceDiff(baseFrames, frameDumps, (o) => base.stateOffsetToAddr(o));
  assert.notEqual(
    d,
    null,
    "the un-restored run matched the baseline, so the live-wire arm cannot be distinguishing anything",
  );
  console.log(
    `  CONTROL: un-restored cycles fork the trace at frame ${d.frame}, ${hx(d.addr)} ` +
      `(baseline=${d.a} candidate=${d.b}) — the timing-seeded PRNG, not the rewrite`,
  );
});

// -- 3. TEETH -----------------------------------------------------------------

/** Broken twin (a): the difficulty gate's decision is ignored — the pass runs every frame. */
function brokenNoGateGuard(m) {
  gateObjectUpdateByDifficulty(m);
  if (!loc_313c(m)) return;
  m.push16(0x30f6);
  m.call(0x31b1);
  loc_34f3(m);
}

/** Broken twin (b): the census's empty-array decision is ignored. */
function brokenNoCensusGuard(m) {
  if (!gateObjectUpdateByDifficulty(m)) return;
  loc_313c(m);
  m.push16(0x30f6);
  m.call(0x31b1);
  loc_34f3(m);
}

/** Broken twin (c): the sprite gather runs BEFORE the state-machine walk, so it publishes last
 *  frame's object fields. */
function brokenGatherBeforeUpdate(m) {
  if (!gateObjectUpdateByDifficulty(m)) return;
  if (!loc_313c(m)) return;
  loc_34f3(m);
  m.push16(0x30f6);
  m.call(0x31b1);
}

/** Broken twin (d): propagates a callee's boolean instead of returning nothing. RAM is IDENTICAL
 *  — at the seam this would make 0x30ED look caller-skip-capable and consume a stack word it
 *  does not owe. Only the return assertion can see it. */
function brokenReturnsBoolean(m) {
  if (!gateObjectUpdateByDifficulty(m)) return false;
  if (!loc_313c(m)) return false;
  m.push16(0x30f6);
  m.call(0x31b1);
  loc_34f3(m);
  return true;
}

/** Broken twin (e): the oracle-boundary return bracket is dropped, so the frozen 0x31B1's own
 *  `ret` eats the CALLER's return address instead. The missing word is inside STACK_SCRATCH and
 *  the return value is still undefined, so neither the RAM diff nor the return assertion sees
 *  it — only a whole-run trace does. */
function brokenNoReturnBracket(m) {
  if (!gateObjectUpdateByDifficulty(m)) return;
  if (!loc_313c(m)) return;
  m.call(0x31b1);
  loc_34f3(m);
}

test("TEETH: the captured-replay arm catches a dropped gate guard, a dropped census guard, and gather-before-update", () => {
  const { kept } = captureDispatches();
  for (const [name, twin] of [
    ["dropped gate guard", brokenNoGateGuard],
    ["dropped census guard", brokenNoCensusGuard],
    ["gather before update", brokenGatherBeforeUpdate],
  ]) {
    const { failure } = replaySamples(kept, twin);
    assert.notEqual(describe(failure), null, `the replay FAILED to catch "${name}" — worthless`);
    console.log(`  TEETH/${name}: caught — ${describe(failure)}`);
  }
});

test("TEETH: a returned boolean is invisible to the RAM diff and caught ONLY by the return assertion", () => {
  const { kept } = captureDispatches();
  const { failure } = replaySamples(kept, brokenReturnsBoolean);
  assert.notEqual(describe(failure), null, "the replay FAILED to catch a propagated boolean — worthless");
  assert.equal(
    failure.kind,
    "return",
    `expected the RETURN assertion to be what catches this twin, not the RAM diff (${describe(failure)})`,
  );
  // And state the other half plainly: with the return check removed, this twin passes.
  let ramOnly = null;
  for (const cap of kept) {
    const a = cap.entry.clone();
    const b = cap.entry.clone();
    oracle(a);
    brokenReturnsBoolean(b);
    const { diff } = ramDiffExStack(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
    if (diff !== null) { ramOnly = `[${cap.arm} #${cap.index}] RAM at ${hx(diff.addr)}: oracle=${diff.a} candidate=${diff.b}`; break; }
  }
  assert.equal(ramOnly, null, "this twin was supposed to be RAM-identical; if the RAM diff sees it, the claim above is wrong");
  console.log(`  TEETH/returned boolean: caught — ${describe(failure)} (RAM identical on all ${kept.length} samples)`);
});

test("TEETH: a dropped oracle-boundary bracket is invisible to the replay and caught ONLY by the live-wire run", () => {
  // Invisible to arm 1: the missing stack word is inside STACK_SCRATCH, and the return is still
  // undefined.
  const { kept } = captureDispatches();
  const { failure } = replaySamples(kept, brokenNoReturnBracket);
  assert.equal(describe(failure), null, "the replay was expected NOT to see this twin");

  // Caught by arm 2.
  const base = new Machine(ROM);
  const baseFrames = base.runFrames(LIVE_FRAMES);
  const { frameDumps } = liveWire(LIVE_FRAMES, brokenNoReturnBracket, true);
  const d = firstTraceDiff(baseFrames, frameDumps, (o) => base.stateOffsetToAddr(o));
  assert.notEqual(d, null, "the live-wire arm FAILED to catch a dropped return bracket — worthless");
  console.log(
    `  TEETH/dropped bracket: invisible to the replay (${kept.length} samples clean), caught by the ` +
      `live-wire run at frame ${d.frame}, ${hx(d.addr)} (baseline=${d.a} broken=${d.b})`,
  );
});
