// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for runAttractState (ROM 0x073C) — the attract game-state handler.
 *
 * runAttractState WRITES memory (GAME_SUBSTATE / GAME_STATE) and, on the no-credit
 * branch, DISPATCHES a sub-state handler (up to the whole demo-gameplay cascade), so it
 * is gated by capture / clone / replay (docs/decompiler-pipeline), NOT an exhaustive-leaf sweep:
 *
 *   1. EQUAL (real captured dispatches) — hook 0x073C in a real attract run and clone
 *      the machine at a strided set of true dispatches (a FRESH clone per case, since
 *      the routine and its callees mutate RAM). Over a full attract loop the demo plays
 *      a whole game, so this naturally covers sub-states 0-4,6,7 including the heavy
 *      slot-3 cascade (handler_1977). For each, run the ORACLE on one clone and
 *      runAttractState on another and confirm IDENTICAL game-visible RAM (the diff is
 *      confined to STACK_SCRATCH — the oracle models the rst-0x28 `push16(0x0748)` /
 *      the callee `ret`; runAttractState uses a JS function table and JS calls). All
 *      captured dispatches are no-credit, so their SP/pc are set by the dispatched
 *      callee's own `ret` — which MATCHES the oracle; that is asserted too.
 *
 *   2. EQUAL (crafted arms) — attract never inserts a coin, and slot 5 is rare, so a
 *      deterministic crafted sweep forces CREDIT and EVERY sub-state 0-7 on one real
 *      captured entry, IDENTICALLY on both sides (the crafted entry: a real state with
 *      a one-byte poke, docs/decompiler-pipeline). The CREDIT arm additionally asserts runAttractState
 *      leaves SP/pc UNCHANGED from entry — its `ret` is a JS return, no stack modelling
 *      (the oracle's `ret` moves them; we compare RAM, not SP, on that branch).
 *
 *   3. TEETH — a deliberately-broken twin that reads the dispatch index from GAME_STATE
 *      (0x6005) instead of GAME_SUBSTATE (0x600A), a plausible wrong-selector-address
 *      bug, MUST be caught by the captured sweep. A gate a real misdispatch slips
 *      through is worthless.
 *
 * TWO HOLES, both about the SP assertion that decides whether a sub-state handler may be
 * swapped for an idiomatic twin. They are stated because runAttractState's table deliberately
 * routes most slots to the frozen translated handler, and this gate is the instrument that
 * decision rests on:
 *
 *   * THE CAPTURED SWEEP SAMPLES. `captureDispatches(300, 4000, 16)` keeps every 16th real
 *     dispatch, so a divergence confined to a SINGLE frame is stepped over. That is not
 *     hypothetical: slot 6's idiomatic twin is stack-neutral on all but one frame of a full
 *     attract loop, and the stride-16 sample missed exactly that frame. Any future
 *     interchangeability claim decided by this sweep must be re-run at stride 1.
 *   * SLOT 5's SP IS ASSERTED NOWHERE. Attract's real captures cover sub-states 0-4, 6 and 7,
 *     so slot 5 is never captured. Job 2's crafted sub-state loop forces 0-7 but compares RAM
 *     only — the SP/pc assertions in job 2 are on the CREDIT arm alone. A two-byte stack delta
 *     injected at slot 5 therefore passes this whole file.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-073c.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_073c as oracle } from "../../translated/loc_073c.js";
import { runAttractState } from "../runAttractState.js";
import { Machine } from "../../machine.js";
import { STACK_SCRATCH, CREDITS, GAME_STATE, GAME_SUBSTATE } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x073c;
const hx = (v) => "0x" + (v & 0xffff).toString(16);
const inStack = (a) => a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;

/**
 * Diff two machines' RAM. Returns the first difference OUTSIDE STACK_SCRATCH
 * (game-visible — a real failure) or null, plus how many bytes differed inside the
 * dead stack scratch (the tolerated rst-push / ret residue).
 */
function ramDiffMinusStack(a, b) {
  const da = a.dumpState(), db = b.dumpState();
  const n = Math.min(da.length, db.length);
  let stackDiffs = 0;
  let bad = null;
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (inStack(addr)) { stackDiffs++; continue; }
    if (!bad) bad = { addr, a: da[i], b: db[i] };
  }
  return { bad, stackDiffs };
}

/**
 * Replay one entry state through the oracle and a candidate on independent clones
 * (FRESH per side — the routine and its callees write RAM), and return the diff.
 */
function replay(entry, candidate) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  oracle(a);
  candidate(b);
  return { a, b, ...ramDiffMinusStack(a, b) };
}

/**
 * Hook 0x073C in a real attract run and clone the machine at every `stride`-th true
 * dispatch (up to K). The stride spreads the sample across a full attract loop so it
 * reaches the later sub-states, not just the sub-1 attract-screen wait. Each clone is
 * one real captured entry; the wrapper delegates to the oracle so the host run
 * proceeds to a clean stop.
 */
function captureDispatches(K, maxFrames, stride = 1) {
  const caps = [];
  let n = 0;
  const snapshot = new Map([[TARGET, (mm) => {
    if (n % stride === 0 && caps.length < K) caps.push(mm.clone());
    n++;
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snapshot });
  host.runFrames(maxFrames);
  return caps;
}

/** One early real entry, to craft the unreached arms from. */
function captureFirst(maxFrames) {
  let first = null;
  const snapshot = new Map([[TARGET, (mm) => {
    if (!first) first = mm.clone();
    return oracle(mm);
  }]]);
  new Machine(ROM, { overrides: snapshot }).runFrames(maxFrames);
  return first;
}

// -- 1. EQUAL (real captured dispatches) --------------------------------------

test("EQUAL (captured): runAttractState == oracle on real attract dispatches (diff confined to stack)", () => {
  const caps = captureDispatches(300, 4000, 16);
  assert.ok(caps.length >= 8, "expected many real 0x073C dispatches across an attract loop");

  const seen = new Set();
  for (const entry of caps) {
    seen.add(entry.mem.read8(GAME_SUBSTATE));

    // All captured dispatches are no-credit (attract inserts no coin).
    assert.equal(entry.mem.read8(CREDITS), 0, "captured attract dispatch must have no credit");

    const { a, b, bad } = replay(entry, runAttractState);
    assert.equal(
      bad,
      null,
      bad && `game-visible RAM diff at ${hx(bad.addr)} (oracle=${bad.a} idiomatic=${bad.b}) ` +
        `on sub-state ${entry.mem.read8(GAME_SUBSTATE)}`,
    );
    // No-credit is a TAIL dispatch: the callee's own `ret` sets SP/pc identically on
    // both sides, so the dispatch branch's SP/pc MATCH the oracle exactly.
    assert.equal(b.regs.sp, a.regs.sp, `SP must match the oracle on the dispatch branch (${hx(b.regs.sp)} vs ${hx(a.regs.sp)})`);
    assert.equal(b.pc, a.pc, `pc must match the oracle on the dispatch branch (${hx(b.pc)} vs ${hx(a.pc)})`);

    // The oracle's stack activity must land inside STACK_SCRATCH, so excluding it
    // cannot mask a real diff (its rst push16(0x0748) writes just below entry SP).
    assert.ok(
      entry.regs.sp > STACK_SCRATCH.lo && entry.regs.sp <= STACK_SCRATCH.hi,
      `oracle's push target must sit inside STACK_SCRATCH (SP=${hx(entry.regs.sp)})`,
    );
  }
  assert.ok(seen.size >= 4, `captured sweep should span several sub-states, saw ${[...seen].sort((x, y) => x - y).join(",")}`);
  console.log(
    `  EQUAL/captured: ${caps.length} real dispatches over sub-states {${[...seen].sort((x, y) => x - y).join(",")}} — ` +
      "game-visible RAM identical, SP/pc match the oracle",
  );
});

// -- 2. EQUAL (crafted arms) --------------------------------------------------

test("EQUAL (crafted): CREDIT and every sub-state 0-7 forced on a real entry match the oracle", () => {
  const entry = captureFirst(200);
  assert.ok(entry, "need a real entry to craft from");

  // CREDIT: poke a credit; the oracle advances GAME_STATE + resets GAME_SUBSTATE and
  // returns via `ret`, runAttractState via JS return.
  {
    const a = entry.clone(); const b = entry.clone();
    a.mem.write8(CREDITS, 1); b.mem.write8(CREDITS, 1);
    const sp0 = b.regs.sp, pc0 = b.pc;
    oracle(a);
    runAttractState(b);
    const { bad } = ramDiffMinusStack(a, b);
    assert.equal(bad, null, bad && `CREDIT: game-visible RAM diff at ${hx(bad.addr)} (oracle=${bad.a} idiomatic=${bad.b})`);
    assert.equal(b.mem.read8(GAME_SUBSTATE), 0x00, "CREDIT must reset GAME_SUBSTATE to 0");
    assert.equal(b.mem.read8(GAME_STATE), (entry.mem.read8(GAME_STATE) + 1) & 0xff, "CREDIT must advance GAME_STATE by 1");
    // The credit branch's `ret` is a JS return — no stack modelling.
    assert.equal(b.regs.sp, sp0, "CREDIT: runAttractState must leave SP unchanged (no stack modelling)");
    assert.equal(b.pc, pc0, "CREDIT: runAttractState must leave pc unchanged (no ret modelling)");
    console.log(`  EQUAL/crafted CREDIT: GAME_STATE ${entry.mem.read8(GAME_STATE)} -> ${b.mem.read8(GAME_STATE)}, game-visible RAM identical`);
  }

  // Every sub-state 0-7, forced deterministically (some are rare or unreached in a
  // bounded attract run). Both sides call the SAME oracle handler on the SAME poked
  // state, so game-visible RAM must be identical.
  for (let s = 0; s <= 7; s++) {
    const a = entry.clone(); const b = entry.clone();
    a.mem.write8(GAME_SUBSTATE, s); b.mem.write8(GAME_SUBSTATE, s);
    oracle(a);
    runAttractState(b);
    const { bad } = ramDiffMinusStack(a, b);
    assert.equal(
      bad,
      null,
      bad && `sub-state ${s}: game-visible RAM diff at ${hx(bad.addr)} (oracle=${bad.a} idiomatic=${bad.b})`,
    );
  }
  console.log("  EQUAL/crafted sub-states: 0-7 all dispatch to the oracle handler — game-visible RAM identical");
});

// -- 3. TEETH -----------------------------------------------------------------

const ATTRACT_SUBSTATE = [0x0779, 0x0763, 0x123c, 0x1977, 0x127c, 0x07c3, 0x07cb, 0x084b];

/**
 * Broken twin: reads the dispatch index from GAME_STATE (0x6005) instead of
 * GAME_SUBSTATE (0x600A) — a plausible wrong-selector-address bug. It shares the
 * credit branch, so it only diverges on the no-credit dispatch, and only when the real
 * sub-state differs from GAME_STATE (== 1 during attract) — i.e. every captured
 * dispatch that is not sub-state 1 misdispatches. Built to mirror runAttractState so
 * the ONLY difference is the selector address; requires a real sweep to catch.
 */
function brokenRunAttractState(m) {
  const { mem } = m;
  if (mem.read8(CREDITS) !== 0) {
    mem.write8(GAME_SUBSTATE, 0x00);
    mem.write8(GAME_STATE, (mem.read8(GAME_STATE) + 1) & 0xff);
    return;
  }
  const substate = mem.read8(GAME_STATE); // BUG: should read GAME_SUBSTATE (0x600A)
  return m.call(ATTRACT_SUBSTATE[substate]); // via the oracle registry, to stay a fair twin
}

test("TEETH (captured): the wrong-selector twin is CAUGHT by the captured sweep", () => {
  const caps = captureDispatches(300, 4000, 16);
  assert.ok(caps.length >= 8, "need real dispatches to test the teeth against");

  let caught = null;
  for (const entry of caps) {
    const { bad } = replay(entry, brokenRunAttractState);
    if (bad) { caught = { ...bad, sub: entry.mem.read8(GAME_SUBSTATE) }; break; }
  }
  assert.notEqual(caught, null, "the captured sweep FAILED to catch a wrong-selector misdispatch — it is worthless");
  console.log(
    `  TEETH/captured: caught at ${hx(caught.addr)} (oracle=${caught.a} broken=${caught.b}) on sub-state ${caught.sub}`,
  );
});
