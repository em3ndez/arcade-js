// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_127c (ROM 0x127C) — attract sub-state 4: service the
 * effect-sprite state machine (loc_1dbd, EFFECT_STATE 0x6340) then fall through into the
 * blink-animation dispatch (loc_127f, BLINK_ANIM_PHASE 0x639D).
 *
 * The oracle brackets the first call in the Z80 stack (`call 0x1dbd`, then falls through
 * its return into entry_127f: `return m.call(0x127f)`); the idiomatic routine drops that
 * stack model and simply calls the two already-idiomatic callees directly. So the compared
 * contract is MEMORY-equivalence on RAM − STACK_SCRATCH (never the full register file,
 * never cycles, never SP/pc — the oracle's push/pop churn moves SP/pc within the dead
 * STACK_SCRATCH and the caller reads neither), plus the propagated return value. A FRESH
 * clone per case because both callees write memory and advance sub-state.
 *
 * loc_127c IS dispatched in attract (unlike its fall-through target loc_127f, which is
 * never entered as its own dispatch): 888 real dispatches over a long attract run, covering
 * EFFECT_STATE {0,2} and BLINK_ANIM_PHASE {0,1,2}. So:
 *
 *   1. REALISM (captured) — hook 0x127C in a real attract run, clone at each dispatch, and
 *      confirm idiomatic loc_127c == oracle over RAM − STACK_SCRATCH (+ identical return) on
 *      every real state the game actually produces. Entry SP is asserted to sit inside
 *      STACK_SCRATCH, so excluding that region cannot mask a real game-visible diff.
 *
 *   2. CRAFTED (EFFECT_STATE sweep) — attract never produces EFFECT_STATE 1 (the arm
 *      one-shot), so on a real base with a LIVE effect-param pointer (0x6343, the state-1
 *      handler dereferences it) poke EFFECT_STATE to {0,1,2} identically on both sides and
 *      compare. Drives every reachable arm of the effect router deterministically.
 *
 *   3. CRAFTED (blink-phase sweep) — poke BLINK_ANIM_PHASE to {0,1,2} with the SUBSTATE_TIMER
 *      tick gate opened (so the arm body actually runs, not just the gate check) identically
 *      on both sides and compare. Non-vacuity: each arm mutates RAM vs the untouched base.
 *
 *   4. TEETH — two deliberately-broken twins, each caught by RAM − STACK_SCRATCH:
 *      (a) drops the effect-router call (only dispatches the blink) — caught on a state-2
 *          countdown entry at EFFECT_TIMER (0x6341);
 *      (b) drops the blink dispatch (only routes the effect) — caught on a phase-0 gate-open
 *          entry at SUBSTATE_TIMER (0x6009).
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-127c.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_127c as oracle } from "../../translated/loc_127c.js";
import { loc_127c as idiomatic } from "../loc_127c.js";
import { loc_1dbd } from "../loc_1dbd.js"; // idiomatic callee, for the teeth twins
import { loc_127f } from "../loc_127f.js"; // idiomatic callee, for the teeth twins
import { Machine } from "../../machine.js";
import {
  EFFECT_STATE,
  EFFECT_TIMER,
  BLINK_ANIM_PHASE,
  SUBSTATE_TIMER,
  STACK_SCRATCH,
} from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x127c;
const EFFECT_PARAM_PTR = 0x6343; // word the state-1 effect handler dereferences
const hx = (v) => "0x" + (v & 0xffff).toString(16);
const inStack = (a) => a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;

/**
 * First game-visible RAM difference between two machines, EXCLUDING the dead STACK_SCRATCH
 * region (the memory-equivalence contract is RAM − STACK_SCRATCH). Also counts the stack
 * diffs so a case can confirm the exclusion is actually doing something.
 * Returns { bad: {addr,a,b}|null, stackDiffs }.
 */
function ramDiffMinusStack(a, b) {
  const da = a.dumpState(), db = b.dumpState();
  const n = Math.min(da.length, db.length);
  let stackDiffs = 0, bad = null;
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (inStack(addr)) { stackDiffs++; continue; }
    if (!bad) bad = { addr, a: da[i], b: db[i] };
  }
  return { bad, stackDiffs };
}

/** Did any non-stack RAM byte change between a `before` snapshot and machine `m` now? */
function mutatedNonStack(before, m) {
  const after = m.dumpState();
  const n = Math.min(before.length, after.length);
  for (let i = 0; i < n; i++) {
    if (before[i] === after[i]) continue;
    if (!inStack(m.stateOffsetToAddr(i))) return true;
  }
  return false;
}

/** Replay one entry through the oracle and a candidate on independent FRESH clones. */
function replay(entry, candidate) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  const ra = oracle(a);
  const rb = candidate(b);
  return { a, b, ra, rb, ...ramDiffMinusStack(a, b) };
}

/**
 * Run attract and clone the machine at each real 0x127C dispatch (runAttractState calls it
 * as sub-state 4). Delegates to the oracle so the host run proceeds undisturbed to a clean
 * stop. Keeps up to `perCombo` per (EFFECT_STATE, BLINK_ANIM_PHASE) key so a single run
 * yields the full spread of combinations without unbounded replay work.
 */
function captureDispatches(perCombo, maxFrames) {
  const caps = [];
  const kept = new Map();
  const snap = new Map([[TARGET, (mm) => {
    const key = (mm.mem.read8(EFFECT_STATE) << 8) | mm.mem.read8(BLINK_ANIM_PHASE);
    const seen = kept.get(key) || 0;
    if (seen < perCombo) { caps.push(mm.clone()); kept.set(key, seen + 1); }
    return oracle(mm);
  }]]);
  new Machine(ROM, { overrides: snap }).runFrames(maxFrames);
  return caps;
}

// -- 0. reachability ----------------------------------------------------------

test("REACHABILITY: 0x127C is dispatched during attract", () => {
  let count = 0;
  const snap = new Map([[TARGET, (mm) => { count++; return oracle(mm); }]]);
  new Machine(ROM, { overrides: snap }).runFrames(9000);
  assert.ok(count > 0, "0x127C should be dispatched — runAttractState reaches sub-state 4 in attract");
  console.log(`  REACHABILITY: ${count} natural 0x127C dispatches in 9000 attract frames`);
});

// -- 1. REALISM (real captured dispatches) ------------------------------------

test("REALISM: real captured 0x127C dispatches — game-visible RAM + return identical to the oracle", () => {
  const caps = captureDispatches(25, 9000);
  assert.ok(caps.length >= 3, "expected several real 0x127C dispatches during attract");

  const states = new Set(), phases = new Set();
  for (const entry of caps) {
    const state = entry.mem.read8(EFFECT_STATE);
    const phase = entry.mem.read8(BLINK_ANIM_PHASE);
    states.add(state); phases.add(phase);

    // Entry SP must sit inside STACK_SCRATCH so excluding that region cannot hide a real diff.
    assert.ok(
      inStack(entry.regs.sp),
      `entry SP must sit inside STACK_SCRATCH (SP=${hx(entry.regs.sp)})`,
    );

    const { bad, ra, rb } = replay(entry, idiomatic);
    assert.equal(
      bad,
      null,
      bad && `game-visible RAM diff at ${hx(bad.addr)} (oracle=${bad.a} idiomatic=${bad.b}) ` +
        `on a real 0x127C entry (EFFECT_STATE=${state} BLINK_ANIM_PHASE=${phase} SP=${hx(entry.regs.sp)})`,
    );
    assert.equal(rb, ra, `return diverged (EFFECT_STATE=${state} BLINK_ANIM_PHASE=${phase}): oracle=${ra} idiomatic=${rb}`);
  }

  // Attract exercises exactly these arms; assert the coverage the gate relies on.
  assert.ok(states.has(0) && states.has(2), `expected EFFECT_STATE {0,2} in attract (saw ${[...states].sort()})`);
  assert.ok(phases.has(0) && phases.has(1) && phases.has(2), `expected BLINK_ANIM_PHASE {0,1,2} (saw ${[...phases].sort()})`);
  console.log(`  REALISM: ${caps.length} real 0x127C dispatches — RAM(−stack)+return identical; ` +
    `EFFECT_STATE {${[...states].sort()}}, BLINK_ANIM_PHASE {${[...phases].sort()}}`);
});

// -- 2. CRAFTED (EFFECT_STATE sweep over the reachable arms) -------------------

/**
 * A real captured base whose effect-param pointer (0x6343) points into work RAM. The
 * state-1 effect handler dereferences it, so a base with a null pointer would fault when the
 * sweep forces EFFECT_STATE 1. Harmless to the state-0 (idle) and state-2 (countdown) arms.
 */
function pointerLiveBase(caps) {
  const base = caps.find((c) => {
    const ptr = c.mem.read8(EFFECT_PARAM_PTR) | (c.mem.read8(EFFECT_PARAM_PTR + 1) << 8);
    return ptr >= 0x6000 && ptr < 0x6c00;
  });
  assert.ok(base, "expected a real 0x127C entry with a live 0x6343 effect-param pointer");
  return base;
}

test("CRAFTED (EFFECT_STATE sweep): loc_127c == oracle over EFFECT_STATE {0,1,2}", () => {
  const base = pointerLiveBase(captureDispatches(25, 9000));

  const armsSeen = new Set();
  for (const state of [0, 1, 2]) {
    const a = base.clone(), b = base.clone();
    a.mem.write8(EFFECT_STATE, state);
    b.mem.write8(EFFECT_STATE, state);
    const ra = oracle(a);
    const rb = idiomatic(b);
    armsSeen.add(state);
    const { bad } = ramDiffMinusStack(a, b);
    assert.equal(
      bad,
      null,
      bad && `EFFECT_STATE=${state}: game-visible RAM diff at ${hx(bad.addr)} (oracle=${bad.a} idiomatic=${bad.b})`,
    );
    assert.equal(rb, ra, `EFFECT_STATE=${state}: return diverged (oracle=${ra} idiomatic=${rb})`);
  }
  assert.ok(armsSeen.has(0) && armsSeen.has(1) && armsSeen.has(2), "sweep must drive all three effect arms");
  console.log(`  CRAFTED/effect: EFFECT_STATE {0,1,2} — RAM(−stack)+return identical on every reachable arm`);
});

// -- 3. CRAFTED (blink-phase sweep with the tick gate open) -------------------

test("CRAFTED (blink-phase sweep): loc_127c == oracle over BLINK_ANIM_PHASE {0,1,2}, gate open", () => {
  const base = pointerLiveBase(captureDispatches(25, 9000));

  let mutatedAny = false;
  for (const phase of [0, 1, 2]) {
    const a = base.clone(), b = base.clone();
    for (const m of [a, b]) {
      m.mem.write8(BLINK_ANIM_PHASE, phase);
      m.mem.write8(SUBSTATE_TIMER, 0x01); // rst 0x18 decrements 1 -> 0 and runs the arm body
    }
    const before = a.dumpState();
    const ra = oracle(a);
    const rb = idiomatic(b);
    const { bad } = ramDiffMinusStack(a, b);
    assert.equal(
      bad,
      null,
      bad && `BLINK_ANIM_PHASE=${phase}: game-visible RAM diff at ${hx(bad.addr)} (oracle=${bad.a} idiomatic=${bad.b})`,
    );
    assert.equal(rb, ra, `BLINK_ANIM_PHASE=${phase}: return diverged (oracle=${ra} idiomatic=${rb})`);
    // Non-vacuous: the arm body actually ran and wrote RAM (else the replay proves nothing).
    if (mutatedNonStack(before, a)) mutatedAny = true;
  }
  assert.ok(mutatedAny, "no blink arm mutated RAM — the tick gate never opened, the replay is vacuous");
  console.log(`  CRAFTED/blink: BLINK_ANIM_PHASE {0,1,2} gate-open — full oracle arm run both sides, RAM(−stack)+return identical`);
});

// -- 4. TEETH -----------------------------------------------------------------

// Twin (a): drops the effect-router call — only dispatches the blink half.
const brokenNoEffectRouter = (m) => loc_127f(m);
// Twin (b): drops the blink dispatch — only routes the effect half.
const brokenNoBlinkDispatch = (m) => { loc_1dbd(m); };

test("TEETH (drop effect-router): the missing effect service is CAUGHT and names EFFECT_TIMER (0x6341)", () => {
  const caps = captureDispatches(25, 9000);
  const state2 = caps.find((c) => c.mem.read8(EFFECT_STATE) === 2);
  assert.ok(state2, "expected a real EFFECT_STATE=2 (countdown) entry");

  const { bad } = replay(state2, brokenNoEffectRouter);
  assert.notEqual(bad, null, "dropping the effect-router escaped the RAM − STACK_SCRATCH gate — it is worthless");
  assert.equal(bad.addr, EFFECT_TIMER, `expected the caught diff at ${hx(EFFECT_TIMER)}, got ${hx(bad.addr)}`);
  console.log(`  TEETH/effect: caught at ${hx(EFFECT_TIMER)} (oracle=${bad.a} broken=${bad.b})`);
});

test("TEETH (drop blink dispatch): the missing blink service is CAUGHT and names SUBSTATE_TIMER (0x6009)", () => {
  const base = captureDispatches(25, 9000)[0];
  assert.ok(base, "expected a real 0x127C entry to craft the phase-0 gate-open case onto");

  const a = base.clone(), b = base.clone();
  for (const m of [a, b]) {
    m.mem.write8(BLINK_ANIM_PHASE, 0x00);
    m.mem.write8(SUBSTATE_TIMER, 0x01); // open the gate so the phase-0 seed body runs
  }
  oracle(a);
  brokenNoBlinkDispatch(b);
  const { bad } = ramDiffMinusStack(a, b);
  assert.notEqual(bad, null, "dropping the blink dispatch escaped the RAM − STACK_SCRATCH gate — it is worthless");
  assert.equal(bad.addr, SUBSTATE_TIMER, `expected the caught diff at ${hx(SUBSTATE_TIMER)}, got ${hx(bad.addr)}`);
  console.log(`  TEETH/blink: caught at ${hx(SUBSTATE_TIMER)} (oracle=${bad.a} broken=${bad.b})`);
});
