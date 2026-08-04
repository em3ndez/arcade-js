// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_1977 (ROM 0x1977) — the attract demo's per-frame entry: issue the
 * scripted input, then run the shared per-frame update cascade at 0x197A.
 *
 * The rewrite replaces exactly one thing — the oracle's bracketed `call` to ROM 0x21EE — with a
 * direct JS call to the already-idiomatic advanceAttractDemoInput, and keeps the tail into the
 * still-frozen 0x197A as an m.call. So the whole burden of this gate is that the replaced
 * fragment behaves identically INCLUDING everything the shared cascade does afterwards with the
 * state it left. That cascade is large, so the gate leans on real dispatches and a whole-run
 * live trace rather than on crafted inputs.
 *
 * What actually runs here, and nothing more:
 *
 *   1. REAL CAPTURES — hook 0x1977 in a 2000-frame attract run and, at EVERY dispatch, clone the
 *      entry state twice and run oracle vs rewrite on the two clones before letting the host
 *      proceed on the oracle. No sampling: the test asserts the number replayed equals the
 *      number dispatched. The contract checked is RAM − STACK_SCRATCH plus the declared live-out
 *      (memory-only + the returned value). It ALSO checks the full state dump, SP and the whole
 *      register file, which are stronger than the contract and hold here because the shared
 *      0x197A tail rewrites everything the replaced call left; that stronger check is what would
 *      notice the rewrite drifting into a merely-memory-equivalent shape.
 *      Coverage is reported honestly: the number of distinct entry shapes seen, and how many
 *      dispatches took the demo script's advance branch as opposed to holding a step.
 *
 *   2. REACH — the same probe under a coin+start tape that really starts a game. This is what
 *      backs the routine header's "attract demo" reading: it could have come out the other way.
 *
 *   3. LIVE-WIRE — wire the rewrite live for a 1200-frame run and require the per-frame trace to
 *      equal the all-oracle baseline on RAM − STACK_SCRATCH. Cycle-free idiomatic code
 *      under-charges the frame, which shifts the NMI and forks the timing-seeded spin counter, so
 *      the harness restores the replaced fragment's cycle cost by measuring it on a throwaway
 *      clone. That restoration is test-only scaffolding: the shipped layer runs frame-stepped and
 *      has no cycle model. The test proves the trace is SENSITIVE by re-running without the
 *      restoration and requiring divergence.
 *
 *   4. TEETH — three deliberately broken twins of the real routine. Two (no demo input, double
 *      demo input) are caught by the unit replay on every single entry. The third — running the
 *      demo input AFTER the cascade instead of before — surfaces on only about 1% of single
 *      dispatches, because a lone frame rarely consumes the input it was handed: the 120-entry
 *      sample used here catches it once, and it is the LIVE trace that catches it outright, at the
 *      demo's very first frame. That split is the reason the live-wire arm exists. (The
 *      no-sampling replay in test 1 does catch it too, several times over its 1416 dispatches —
 *      which is what a fixed-stride sample would have thrown away.)
 *
 * WHY NOT pc: the rewrite models the Z80 `ret` as a JS return, so pc is not part of the contract.
 * SP is compared only because it happens to be preserved exactly (the frozen 0x197A tail performs
 * the same single `ret` on both sides).
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-1977.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1977 as oracle } from "../../translated/loc_1977.js";
import { loc_1977 } from "../loc_1977.js";
import { advanceAttractDemoInput } from "../advanceAttractDemoInput.js"; // reused to build faithful twins
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import {
  STACK_SCRATCH,
  GAME_STATE,
  GAME_SUBSTATE,
  P1_INPUT,
  DEMO_SCRIPT_INDEX,
  DEMO_SCRIPT_COUNTDOWN,
} from "../names.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/dkong/rom/maincpu.bin" }, fn);

const TARGET = 0x1977;
const CASCADE = 0x197a; // the shared per-frame update cascade the oracle falls through into
const DEMO_INPUT = 0x21ee; // the scripted-input step the rewrite replaces with a direct call

const ATTRACT_FRAMES = 2000; // the demo's first dispatch lands around frame 586
const LIVE_FRAMES = 1200;
const GAMEPLAY_FRAMES = 1600;
const TWIN_CAPTURES = 120;

// Canonical coin+start tape (tapes/coin_start.lua contract): pulse the coin input, then start-1,
// so the ROM's own credit/start logic begins a real game.
const COIN_START_TAPE = [
  { port: 0x7d00, bits: 0x80, frame: 90, dur: 6 },
  { port: 0x7d00, bits: 0x04, frame: 150, dur: 6 },
];

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const inStack = (addr) => addr !== null && addr !== undefined && addr >= STACK_SCRATCH.lo && addr < STACK_SCRATCH.hi;

/** First differing RAM byte outside the dead stack scratch — the memory-equivalence contract. */
function ramDiff(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (inStack(addr)) continue;
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/** First differing entry between two frame traces, outside the dead stack scratch. */
function traceDiff(baseline, live, mapper) {
  for (let f = 0; f < Math.min(baseline.length, live.length); f++) {
    const a = baseline[f];
    const b = live[f];
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] === b[i]) continue;
      const addr = mapper(i);
      if (inStack(addr)) continue;
      return { frame: f, addr, a: a[i], b: b[i] };
    }
  }
  return null;
}

/** First differing CPU register, or null. Stronger than the contract; see the header. */
function regDiff(a, b) {
  for (const k of REG_FIELDS) {
    if (a.regs[k] !== b.regs[k]) return { reg: k, a: a.regs[k], b: b.regs[k] };
  }
  return null;
}

/**
 * Cycle cost of the fragment the rewrite replaced — the `call` instruction plus the scripted-input
 * routine it dispatches — measured on a throwaway clone of this exact machine state, because the
 * cost differs between the script's hold and advance branches. Test-only: the shipped idiomatic
 * layer is cycle-free and runs under the frame-stepped engine.
 */
function replacedFragmentCycles(m) {
  const probe = m.clone();
  const before = probe.cycles;
  probe.push16(CASCADE); // the return address the oracle's `call` pushes
  probe.step(DEMO_INPUT, 17); // the `call` instruction itself
  probe.call(DEMO_INPUT);
  return probe.cycles - before;
}

/** Wrap a candidate so it charges what the oracle charged for the fragment it replaced. */
const cycleRestored = (fn) => (m) => {
  m.tick(replacedFragmentCycles(m));
  return fn(m);
};

// -- 1. REAL CAPTURES ---------------------------------------------------------

test("REAL CAPTURES: every 0x1977 dispatch in a 2000-frame attract run == oracle", () => {
  const shapes = new Map();
  const states = new Set();
  let dispatched = 0;
  let replayed = 0;
  let advanceBranch = 0; // dispatches where the demo script steps to its next pair
  let inputChanges = 0; // dispatches where the oracle left a different cooked control word
  let firstFrame = -1;
  const failures = [];

  const host = new Machine(ROM, {
    overrides: new Map([[TARGET, (mm) => {
      dispatched++;
      if (firstFrame < 0) firstFrame = mm.frames.length;
      // The entry shape that matters: which script step is selected, and whether this frame holds
      // it or advances to the next one. (The raw countdown is excluded on purpose — it changes
      // every frame, so keying on it would report one "shape" per dispatch and mean nothing.)
      const advances = mm.mem8[DEMO_SCRIPT_COUNTDOWN] === 0;
      const shape = `step ${mm.mem8[DEMO_SCRIPT_INDEX]}, ${advances ? "advance" : "hold"}`;
      shapes.set(shape, (shapes.get(shape) ?? 0) + 1);
      states.add(`${mm.mem8[GAME_STATE]}/${mm.mem8[GAME_SUBSTATE]}`);
      if (advances) advanceBranch++;

      const before = mm.mem8[P1_INPUT];
      const a = mm.clone();
      const b = mm.clone();
      const oracleReturn = oracle(a);
      const candidateReturn = loc_1977(b);
      replayed++;
      if (a.mem8[P1_INPUT] !== before) inputChanges++;

      const ram = ramDiff(a, b);
      const reg = regDiff(a, b);
      const state = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
      if (ram || reg || state || oracleReturn !== candidateReturn) {
        if (failures.length < 5) {
          failures.push(
            `dispatch #${dispatched} [${shape}]: ` +
              (ram ? `RAM ${hx(ram.addr)} ${ram.a}->${ram.b}; ` : "") +
              (state ? `state dump ${hx(state.addr ?? 0)} ${state.a}->${state.b}; ` : "") +
              (reg ? `register ${reg.reg} ${reg.a}->${reg.b}; ` : "") +
              (oracleReturn !== candidateReturn ? `return ${oracleReturn} vs ${candidateReturn}; ` : ""),
          );
        }
      }
      return oracle(mm); // let the host run on the oracle, undisturbed
    }]]),
  });
  host.runFrames(ATTRACT_FRAMES);

  assert.deepEqual(failures, [], failures.join("\n"));
  assert.ok(dispatched >= 1400, `expected the attract demo to dispatch 0x1977 many times, got ${dispatched}`);
  assert.equal(replayed, dispatched, "every dispatch must be replayed — this gate does not sample");
  assert.ok(shapes.size >= 20, `expected many distinct entry shapes, got ${shapes.size}`);
  // The routine header reads this as the attract demo's entry; that rests on the state every
  // dispatch arrives in, so pin it here rather than leaving it as prose.
  assert.deepEqual([...states], ["1/3"], `dispatched from unexpected states: ${[...states].join(" ")}`);
  // Non-vacuity: the replayed fragment must really be doing something on these entries.
  assert.ok(advanceBranch > 0, "no dispatch took the demo script's advance branch — coverage is vacuous");
  assert.ok(inputChanges > 0, "the oracle never changed the cooked control word — the replay is vacuous");

  console.log(
    `  REAL CAPTURES: ${replayed}/${dispatched} dispatches replayed (first at frame ${firstFrame}), ` +
      `all from GAME_STATE/GAME_SUBSTATE ${[...states].join(" ")}, ${shapes.size} distinct entry shapes ` +
      `(script step × hold/advance), ${advanceBranch} on the advance branch, ${inputChanges} that left a ` +
      `changed control word — RAM − STACK_SCRATCH, full dump, SP, every register and the return value ` +
      `all == oracle`,
  );
});

// -- 2. REACH -----------------------------------------------------------------

test("REACH: a coin+start tape that reaches gameplay never dispatches 0x1977", () => {
  let attractDispatches = 0;
  const attract = new Machine(ROM, {
    overrides: new Map([[TARGET, (mm) => { attractDispatches++; return oracle(mm); }]]),
  });
  attract.runFrames(LIVE_FRAMES);

  let gameplayDispatches = 0;
  const played = new Machine(ROM, {
    overrides: new Map([[TARGET, (mm) => { gameplayDispatches++; return oracle(mm); }]]),
  });
  played.inputTape = COIN_START_TAPE;
  played.runFrames(GAMEPLAY_FRAMES);

  assert.equal(played.mem8[GAME_STATE], 3, "the coin+start tape must actually have started a game");
  assert.ok(attractDispatches > 0, "the attract run must dispatch 0x1977, or this comparison says nothing");
  assert.equal(
    gameplayDispatches, 0,
    `0x1977 was dispatched ${gameplayDispatches}× during play — the routine is not attract-only`,
  );
  console.log(
    `  REACH: ${attractDispatches} dispatches in ${LIVE_FRAMES} attract frames vs ` +
      `${gameplayDispatches} in ${GAMEPLAY_FRAMES} frames of a started game`,
  );
});

// -- 3. LIVE-WIRE -------------------------------------------------------------

let cachedBaseline = null;
const oracleBaseline = () => (cachedBaseline ??= new Machine(ROM).runFrames(LIVE_FRAMES));
const liveTrace = (fn) => new Machine(ROM, { overrides: new Map([[TARGET, fn]]) }).runFrames(LIVE_FRAMES);

test("LIVE-WIRE: the rewrite wired live for 1200 frames reproduces the all-oracle trace", () => {
  const mapper = new Machine(ROM);
  const baseline = oracleBaseline();

  const wired = liveTrace(cycleRestored(loc_1977));
  const diff = traceDiff(baseline, wired, (off) => mapper.stateOffsetToAddr(off));
  assert.equal(
    diff, null,
    diff && `live trace diverges at frame ${diff.frame}, ${hx(diff.addr)}: ${diff.a} -> ${diff.b}`,
  );
  assert.equal(wired.length, baseline.length, "the live run must have completed the same number of frames");

  // The trace is only worth anything if it can fail. Dropping the fragment's cycle charge is the
  // known way to make cycle-free code fork a timing-seeded run; it must be caught.
  const uncharged = traceDiff(baseline, liveTrace(loc_1977), (off) => mapper.stateOffsetToAddr(off));
  assert.notEqual(uncharged, null, "the live trace FAILED to notice the missing cycle charge — it is blind");

  console.log(
    `  LIVE-WIRE: ${baseline.length} frames identical on RAM − STACK_SCRATCH with the fragment's ` +
      `cycles restored; without them the same trace forks at frame ${uncharged.frame}, ${hx(uncharged.addr)}`,
  );
});

// -- 4. TEETH -----------------------------------------------------------------

// Faithful re-implementations of the real routine, each with a single switchable defect.
const noDemoInput = (m) => m.call(CASCADE); // BUG: the demo's input is never issued
const doubleDemoInput = (m) => { // BUG: the script is stepped twice per frame
  advanceAttractDemoInput(m);
  advanceAttractDemoInput(m);
  return m.call(CASCADE);
};
const demoInputAfterCascade = (m) => { // BUG: the cascade runs on the previous frame's input
  const r = m.call(CASCADE);
  advanceAttractDemoInput(m);
  return r;
};

/** Capture up to K real entry states from an attract run. */
function captureEntries(k, frames) {
  const caps = [];
  const host = new Machine(ROM, {
    overrides: new Map([[TARGET, (mm) => {
      if (caps.length < k) caps.push(mm.clone());
      return oracle(mm);
    }]]),
  });
  host.runFrames(frames);
  return caps;
}

/** How many of the captured entries the unit replay catches this candidate on. */
function unitCatches(caps, candidate) {
  let caught = 0;
  let first = null;
  for (const cap of caps) {
    const a = cap.clone();
    const b = cap.clone();
    oracle(a);
    candidate(b);
    const ram = ramDiff(a, b);
    if (ram) {
      caught++;
      if (!first) first = ram;
    }
  }
  return { caught, first };
}

test("TEETH: the unit replay catches a dropped and a doubled demo-input step", () => {
  const caps = captureEntries(TWIN_CAPTURES, LIVE_FRAMES);
  assert.ok(caps.length >= 100, `expected plenty of captured entries, got ${caps.length}`);

  // Sanity: the real routine passes the same replay, so a caught twin is a real signal.
  assert.equal(unitCatches(caps, loc_1977).caught, 0, "the correct routine must pass the unit replay");

  const dropped = unitCatches(caps, noDemoInput);
  assert.equal(
    dropped.caught, caps.length,
    "the unit replay FAILED to catch a dropped demo-input step on every entry — it is not pinning the call",
  );
  const doubled = unitCatches(caps, doubleDemoInput);
  assert.equal(
    doubled.caught, caps.length,
    "the unit replay FAILED to catch a doubled demo-input step on every entry — it is not pinning the count",
  );

  console.log(
    `  TEETH/unit: dropped caught ${dropped.caught}/${caps.length} (first at ${hx(dropped.first.addr)}: ` +
      `${dropped.first.a}->${dropped.first.b}); doubled caught ${doubled.caught}/${caps.length} ` +
      `(first at ${hx(doubled.first.addr)}: ${doubled.first.a}->${doubled.first.b})`,
  );
});

test("TEETH: the live trace catches issuing the demo input AFTER the cascade", () => {
  const mapper = new Machine(ROM);
  const caps = captureEntries(TWIN_CAPTURES, LIVE_FRAMES);

  // Stated because it is the reason the live-wire arm exists: a single dispatch almost never
  // consumes the input it was handed, so the unit replay is nearly blind to this ordering defect.
  const unit = unitCatches(caps, demoInputAfterCascade);

  const live = traceDiff(
    oracleBaseline(),
    liveTrace(cycleRestored(demoInputAfterCascade)),
    (off) => mapper.stateOffsetToAddr(off),
  );
  assert.notEqual(
    live, null,
    "the live trace FAILED to catch the demo input being issued after the cascade — ordering is unproven",
  );

  console.log(
    `  TEETH/live: ordering twin caught at frame ${live.frame}, ${hx(live.addr)} (${live.a} -> ${live.b}); ` +
      `the unit replay caught it on only ${unit.caught}/${caps.length} single dispatches`,
  );
});
