// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for drawActorWalkFrame (ROM 0x19e3) — the tail of the actor-movement
 * continuation: it commits the actor's animation frame into the sprite-code cell and, only
 * during a goal crossing once the actor has reached the far edge, arms the state-lockout timer
 * and clears the object's leading coordinate, before rebuilding the object's record (stageObjectSpriteRecord).
 *
 * Its declared LIVE-OUT is MEMORY-ONLY: everything it produces lands in work RAM (SPRITE_CODE,
 * the STATE_TIMER + OBJ_X far-edge pair, and stageObjectSpriteRecord's record). The oracle's residual registers
 * are dead ABI — and because the idiomatic tail calls the decompiled stageObjectSpriteRecord directly (no Z80
 * ret, no stack pushes) rather than the oracle's stack-threaded tail-jump, comparing the full
 * register file or SP would false-fail an honest rewrite. So the gate is the RAM state dump only
 * (via firstStateDiff). No stack-scratch exclusion is needed: stageObjectSpriteRecord makes no nested call, so
 * the oracle's tail leaves no dead bytes below the entry stack pointer (verified — the dump
 * matches byte-for-byte on every arm).
 *
 * WHY A CRAFTED ENTRY. 0x19e3 is only ever reached inline as the fall-through tail of loc_19d0
 * (confirmed: 0 direct dispatches over 3000 attract frames) — its standalone registry entry is
 * never invoked — so the harness cannot hook it. Per the crafted-entry method it runs from a REAL
 * captured loc_19d0 state instead: loc_19d0 IS dispatched (244 times in attract, the movement
 * continuation reached from the dig classifier), and its entry is a faithful machine state for its
 * own tail. The one register input that shapes the output (the incoming animation frame) and the
 * three work-RAM bytes that pick the branch (the goal-crossing latch, the row accumulator, and the
 * state timer) are then poked identically on both sides. The far-edge latch is never taken in
 * attract (the goal-crossing latch reads 0 there), so that branch is reached only crafted.
 *
 * SIX checks:
 *   0. IDENTITY (harness) — oracle vs oracle on a captured loc_19d0 state; EQUAL proves the
 *      capture/clone/replay plumbing reaches a real actor-movement state.
 *   1. EQUAL (real states) — for every captured state, oracle vs idiomatic leave an identical RAM
 *      dump. Attract's goal-crossing latch is clear, so these exercise the inactive branch live.
 *   2. EQUAL (crafted branch sweep) — force every branch identically on both arms and sweep the
 *      incoming frame: inactive (latch 0), crossing-but-short (row 137), crossing-at-far-edge
 *      (row 138+), the exact >= boundary, and frames {0x34, 0xb4, 0, 0xff}.
 *   3. NON-VACUOUS — pre-set the three written bytes to a sentinel on a far-edge entry; both arms
 *      overwrite all three and agree, so a no-op twin cannot pass.
 *   4. TEETH (frame) — a twin that commits the wrong animation frame is CAUGHT at SPRITE_CODE.
 *   5. TEETH (far-edge latch) — a twin that skips arming the state-lockout timer on the far-edge
 *      branch is CAUGHT at STATE_TIMER (this routine's distinctive one-shot).
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-19e3.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_19e3 as oracle } from "../../translated/loc_19e3.js";
import { drawActorWalkFrame as idiomatic } from "../drawActorWalkFrame.js";
import { loc_19d0 as oracle19d0 } from "../../translated/loc_19d0.js";
import { stageObjectSpriteRecord } from "../stageObjectSpriteRecord.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { SPRITE_CODE, GOAL_CROSSING_LATCH, OBJ_Y, STATE_TIMER, OBJ_X } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const CAPTURE_AT = 0x19d0; // loc_19d0 — 0x19e3's only in-code predecessor, dispatched in attract
const FAR_EDGE = 138; // the row the actor must reach for the far-edge one-shot (oracle cp 0x8a)
const LOCKOUT = 180; // the value armed into STATE_TIMER on the far-edge path (oracle 0xb4)
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is async, so
// build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Hook loc_19d0 in a real attract run and clone up to K real dispatches — each a faithful machine
 * state for its own inline tail 0x19e3. The wrapper snapshots then runs the oracle so attract proceeds.
 */
function captureBaseStates(K, maxFrames) {
  const caps = [];
  const snapshot = new Map([[CAPTURE_AT, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle19d0(mm);
  }]]);
  makeMachine(snapshot).runFrames(maxFrames);
  return caps;
}

/** Run oracle and candidate on independent clones of `entry`; return the first differing RAM
 *  dump byte (or null). The dump is RAM-only, so pc/SP/dead registers are excluded for free. */
function stateDiff(entry, fn) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  oracle(a);
  fn(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/** A fresh entry clone with the incoming frame (register live-in) and the branch-driving work-RAM
 *  bytes forced identically. Any field left undefined keeps the captured state's value. */
function craft(base, { frame, latch, objY, stateTimer, objX } = {}) {
  const e = base.clone();
  if (frame !== undefined) e.regs.a = frame;
  if (latch !== undefined) e.mem.write8(GOAL_CROSSING_LATCH, latch);
  if (objY !== undefined) e.mem.write8(OBJ_Y, objY);
  if (stateTimer !== undefined) e.mem.write8(STATE_TIMER, stateTimer);
  if (objX !== undefined) e.mem.write8(OBJ_X, objX);
  return e;
}

// -- 0. IDENTITY (harness sanity) --------------------------------------------

test("IDENTITY: the harness reaches a real loc_19d0 state and oracle-vs-oracle is EQUAL", () => {
  const [base] = captureBaseStates(1, 3000);
  assert.ok(base, "expected at least one real loc_19d0 dispatch during attract");
  assert.equal(stateDiff(base, oracle), null, "oracle vs oracle must be identical");
  console.log("  IDENTITY: captured a real loc_19d0 state, cloned, ran oracle vs oracle -> EQUAL");
});

// -- 1. EQUAL over real captured attract states ------------------------------

test("EQUAL: drawActorWalkFrame leaves the same RAM as the oracle over every real captured state", () => {
  const caps = captureBaseStates(300, 3000);
  assert.ok(caps.length >= 1, "expected at least one captured state");

  const latchesSeen = new Set();
  for (const cap of caps) {
    latchesSeen.add(cap.mem.read8(GOAL_CROSSING_LATCH));
    const entry = craft(cap, { frame: 0x34 }); // commit a realistic walk frame
    const d = stateDiff(entry, idiomatic);
    assert.equal(d, null, d && `state diff at ${hx(d.addr ?? 0)} oracle=${d.a} idiomatic=${d.b}`);
  }
  console.log(
    `  EQUAL/real: ${caps.length} captured states identical to the oracle; ` +
      `goal-crossing latch seen {${[...latchesSeen].map(hx).join(",")}} (attract keeps it clear)`,
  );
});

// -- 2. EQUAL over a crafted sweep of every branch + every frame -------------

test("EQUAL (crafted): every branch and every incoming frame matches the oracle", () => {
  const [base] = captureBaseStates(1, 3000);
  assert.ok(base, "need a real capture to craft branch entries from");

  const arms = [
    ["inactive (latch 0), any row", { frame: 0x34, latch: 0, objY: 200 }],
    ["crossing, one short of the edge (row 137)", { frame: 0xb4, latch: 1, objY: FAR_EDGE - 1 }],
    ["crossing, exactly at the edge (row 138) -> latch", { frame: 0xb4, latch: 1, objY: FAR_EDGE, stateTimer: 0 }],
    ["crossing, past the edge (row 226) -> latch", { frame: 0x34, latch: 0xff, objY: 226, stateTimer: 5 }],
    ["frame 0 commits", { frame: 0, latch: 0, objY: 10 }],
    ["frame 0xff commits", { frame: 0xff, latch: 0, objY: 10 }],
  ];

  for (const [name, spec] of arms) {
    const d = stateDiff(craft(base, spec), idiomatic);
    assert.equal(d, null, d && `[${name}] state diff at ${hx(d.addr ?? 0)} oracle=${d.a} idiomatic=${d.b}`);
  }

  // Positive confirmation: the far-edge arm really fires the one-shot.
  const fired = craft(base, { frame: 0xb4, latch: 1, objY: FAR_EDGE, stateTimer: 0, objX: 99 });
  const c = fired.clone();
  idiomatic(c);
  assert.equal(c.mem.read8(SPRITE_CODE), 0xb4, "far-edge arm must commit the frame");
  assert.equal(c.mem.read8(STATE_TIMER), LOCKOUT, "far-edge arm must arm the state-lockout timer");
  assert.equal(c.mem.read8(OBJ_X), 0, "far-edge arm must clear the leading coordinate");
  console.log(`  EQUAL/crafted: ${arms.length} branch/frame arms identical; far-edge one-shot fires (timer=${LOCKOUT}, X=0)`);
});

// -- 3. NON-VACUOUS: the written bytes are actually written ------------------

test("NON-VACUOUS: with the written bytes pre-set to a sentinel, both arms overwrite all and agree", () => {
  const [base] = captureBaseStates(1, 3000);
  const SENTINEL = 0x55;
  // Far-edge entry so all three written bytes (frame, timer, leading X) are touched.
  const entry = craft(base, { frame: 0xb4, latch: 1, objY: FAR_EDGE, stateTimer: SENTINEL, objX: SENTINEL });
  entry.mem.write8(SPRITE_CODE, SENTINEL);

  const a = entry.clone(); // oracle
  const b = entry.clone(); // idiomatic
  oracle(a);
  idiomatic(b);

  for (const addr of [SPRITE_CODE, STATE_TIMER, OBJ_X]) {
    assert.notEqual(b.mem.read8(addr), SENTINEL, `idiomatic left ${hx(addr)} unwritten (still the sentinel)`);
  }
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `state diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
  console.log("  NON-VACUOUS: SPRITE_CODE, STATE_TIMER, OBJ_X all overwritten from the sentinel; arms agree");
});

// -- 4. TEETH (frame): a wrong committed frame is CAUGHT ---------------------

/** Broken twin: commits an animation frame one off from the one it was handed. */
function twinWrongFrame(m, spriteCode = m.regs.a) {
  idiomatic(m, (spriteCode + 1) & 0xff); // BUG: wrong frame committed to SPRITE_CODE
}

test("TEETH (frame): a twin that commits the wrong animation frame is CAUGHT at SPRITE_CODE", () => {
  const [base] = captureBaseStates(1, 3000);
  const entry = craft(base, { frame: 0x34, latch: 0, objY: 10 });

  const d = stateDiff(entry, twinWrongFrame);
  assert.notEqual(d, null, "the gate FAILED to catch a wrong-frame twin — it proves nothing");
  assert.equal(d.addr, SPRITE_CODE, `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(SPRITE_CODE)})`);

  assert.equal(stateDiff(entry, idiomatic), null, "idiomatic must pass the entry the twin fails");
  console.log(`  TEETH/frame: wrong-frame twin caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

// -- 5. TEETH (far-edge latch): a skipped state-timer arm is CAUGHT ----------

/** Broken twin: does the routine but forgets to arm the state-lockout timer on the far-edge path. */
function twinSkipLatch(m, spriteCode = m.regs.a) {
  const { mem8 } = m;
  mem8[SPRITE_CODE] = spriteCode;
  if (mem8[GOAL_CROSSING_LATCH] !== 0 && mem8[OBJ_Y] >= FAR_EDGE) {
    mem8[OBJ_X] = 0; // BUG: STATE_TIMER left unarmed
  }
  stageObjectSpriteRecord(m);
}

test("TEETH (far-edge latch): a twin that skips arming the state-lockout timer is CAUGHT at STATE_TIMER", () => {
  const [base] = captureBaseStates(1, 3000);
  const entry = craft(base, { frame: 0xb4, latch: 1, objY: FAR_EDGE, stateTimer: 0 });

  const d = stateDiff(entry, twinSkipLatch);
  assert.notEqual(d, null, "the gate FAILED to catch a skipped far-edge latch — it proves nothing");
  assert.equal(d.addr, STATE_TIMER, `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(STATE_TIMER)})`);

  assert.equal(stateDiff(entry, idiomatic), null, "idiomatic must pass the entry the twin fails");
  console.log(`  TEETH/latch: skipped-latch twin caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});
