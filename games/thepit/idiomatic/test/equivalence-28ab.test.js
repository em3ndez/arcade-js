// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for spawnDigEntity (ROM 0x28ab) — stage-and-commit a dig entity at
 * the actor's aligned tilemap cell.
 *
 * The routine's whole effect is memory: it stashes the cell pointer, and (for a
 * recognised tile pair) stages a placement scratch block, bumps the spawn counter and
 * either commits the entity into the dig-object record + tilemap or just re-arms the dig
 * timer. Its declared live-out is MEMORY-ONLY, so the gate compares RAM (work + colour +
 * video/tilemap + sprite, via dumpState) and EXCLUDES pc/SP/registers: the oracle rets
 * internally and this routine models its return as a plain JS return, so a pc/SP contract
 * would false-fail, and would break again the day its commit tail is dissolved. The
 * routine pushes nothing, so there is no dead stack window to exclude — full RAM matches.
 *
 * spawnDigEntity IS dispatched in a plain attract run (from the carve handler loc_24f3), so the
 * gate runs the candidate against the oracle on every real captured dispatch. Those cover
 * the early-return and the idle-slot commit paths; a crafted sweep then forces each
 * classification arm crossed with an idle (commit) vs busy (arm-timer) spawn slot, by
 * poking the three tilemap cells under the actor and the spawn counter identically on
 * both sides. The sweep also drives every arm of the delegated commit tail (sub-type 0/1/2
 * and the neighbour-tile keep/remap classes).
 *
 * Checks:
 *   0. HARNESS  — capture real 0x28ab dispatches and confirm the oracle run is
 *      deterministic (oracle vs oracle -> identical RAM).
 *   1. EQUAL (real dispatches) — spawnDigEntity == oracle over RAM on every captured dispatch.
 *   2. EQUAL (crafted arm x spawn-slot sweep) — every classification arm, with the spawn
 *      slot idle and busy, is identical to the oracle; a positive check confirms the idle
 *      arms really commit (dig-object state armed to the carving code).
 *   3. TEETH (busy path) — a twin that arms the dig timer to the wrong value is CAUGHT.
 *   4. TEETH (commit path) — a twin that stamps the wrong sprite id is CAUGHT in the tilemap.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-28ab.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_28ab as oracle } from "../../translated/loc_28ab.js";
import { spawnDigEntity as idiomatic } from "../spawnDigEntity.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import {
  ACTOR_CELL_PTR,
  SPAWN_STATE,
  DIG_OBJ_TIMER,
  DIG_OBJ_STATE,
} from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x28ab;
const CARVING_STATE = 48; // dig-object state code the commit tail writes (loc_2934)
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is async,
// so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/**
 * Hook 0x28ab in a real attract run and clone the machine at each of its first `limit`
 * dispatches — genuine setup states (a valid cell pointer into the tilemap, real staging
 * RAM). The wrapper snapshots then runs the oracle so attract proceeds undisturbed.
 */
function captureRealEntries(maxFrames, limit) {
  const entries = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (entries.length < limit) entries.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return entries;
}

/** First differing RAM byte between two machines (RAM-only: dumpState), or null. */
function ramDiff(a, b) {
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/** Run the oracle on one clone and `fn` on another; return the first RAM diff (null == EQUAL). */
function compare(entry, fn) {
  const o = entry.clone();
  oracle(o);
  const c = entry.clone();
  fn(c);
  return ramDiff(o, c);
}

/** Poke the three tilemap cells under the actor and the spawn slot, identically per clone. */
function craft(entry, { neigh, cur, twoBack, spawnState }) {
  const c = entry.clone();
  const cellPtr = c.mem.read16(ACTOR_CELL_PTR);
  c.mem.write8((cellPtr - 2) & 0xffff, twoBack);
  c.mem.write8((cellPtr - 1) & 0xffff, neigh);
  c.mem.write8(cellPtr & 0xffff, cur);
  c.mem.write8(SPAWN_STATE, spawnState);
  return c;
}

// -- 0. HARNESS ---------------------------------------------------------------

test("HARNESS: real 0x28ab dispatches are captured and the oracle run is deterministic", () => {
  const entries = captureRealEntries(4000, 60);
  assert.ok(entries.length > 0, "expected 0x28ab to be dispatched during attract");

  const a = entries[0].clone();
  oracle(a);
  const b = entries[0].clone();
  oracle(b);
  assert.equal(ramDiff(a, b), null, "oracle run of 0x28ab is not deterministic");
  console.log(`  HARNESS: captured ${entries.length} real 0x28ab dispatches; oracle run deterministic`);
});

// -- 1. EQUAL on every real captured dispatch --------------------------------

test("EQUAL (real dispatches): spawnDigEntity == oracle over RAM on every captured dispatch", () => {
  const entries = captureRealEntries(4000, 60);
  assert.ok(entries.length > 0, "need captured dispatches");

  let committed = 0;
  for (let i = 0; i < entries.length; i++) {
    const diff = compare(entries[i], idiomatic);
    assert.equal(diff, null, diff && `dispatch ${i}: RAM diff at ${hx(diff.addr)} oracle=${diff.a} cand=${diff.b}`);
    // Note whether this real dispatch reached the commit tail (dig state armed).
    const c = entries[i].clone();
    idiomatic(c);
    if (c.mem.read8(DIG_OBJ_STATE) === CARVING_STATE && entries[i].mem.read8(DIG_OBJ_STATE) !== CARVING_STATE) {
      committed++;
    }
  }
  console.log(`  EQUAL/real: ${entries.length} dispatches identical to the oracle (${committed} exercised the commit tail)`);
});

// -- 2. EQUAL across a crafted classification-arm x spawn-slot sweep ----------

// Each arm names the tile pair (and the tile two back) that selects it; the sweep runs
// every arm with the spawn slot idle (commit) and busy (arm-timer). The `commits` flag
// marks the arms whose tile pair is recognised, so the idle pass really commits.
const ARMS = [
  { name: "cur=112 neigh=193 twoBack=193 (sub-type 2)", neigh: 193, cur: 112, twoBack: 193, commits: true },
  { name: "cur=112 neigh=193 twoBack=0 (sub-type 0)", neigh: 193, cur: 112, twoBack: 0, commits: true },
  { name: "cur=112 neigh=149 (sub-type 0)", neigh: 149, cur: 112, twoBack: 0, commits: true },
  { name: "cur=112 neigh=197 (sub-type 1, lift 21)", neigh: 197, cur: 112, twoBack: 0, commits: true },
  { name: "cur=112 neigh=120 (unrecognised -> early return)", neigh: 120, cur: 112, twoBack: 0, commits: false },
  { name: "cur=197 neigh=193 (sprite 157)", neigh: 193, cur: 197, twoBack: 0, commits: true },
  { name: "cur=197 neigh=42 (sprite 42)", neigh: 42, cur: 197, twoBack: 0, commits: true },
  { name: "cur=197 neigh=152 twoBack=151 (neighbour remap band)", neigh: 152, cur: 197, twoBack: 151, commits: true },
  { name: "cur=197 neigh=80 (neighbour kept)", neigh: 80, cur: 197, twoBack: 0, commits: true },
  { name: "cur=0 (unrecognised -> early return)", neigh: 0, cur: 0, twoBack: 0, commits: false },
];

test("EQUAL (crafted arm x spawn-slot sweep): every arm, idle and busy, matches the oracle", () => {
  const [seed] = captureRealEntries(4000, 1);
  assert.ok(seed, "need a captured 0x28ab entry to craft the sweep from");

  for (const arm of ARMS) {
    for (const spawnState of [0, 5]) {
      const entry = craft(seed, { ...arm, spawnState });
      const diff = compare(entry, idiomatic);
      assert.equal(
        diff,
        null,
        diff && `${arm.name} spawn=${spawnState}: RAM diff at ${hx(diff.addr)} oracle=${diff.a} cand=${diff.b}`,
      );

      // Positive: a recognised arm with an idle slot must actually commit (dig state armed).
      if (arm.commits && spawnState === 0) {
        const c = entry.clone();
        idiomatic(c);
        assert.equal(
          c.mem.read8(DIG_OBJ_STATE),
          CARVING_STATE,
          `${arm.name}: idle slot did not commit the dig object`,
        );
      }
    }
  }
  console.log(`  EQUAL/sweep: ${ARMS.length} arms x {idle, busy} all identical to the oracle, commits verified`);
});

// -- 3. TEETH: a wrong dig-timer arm on the busy path is caught ---------------

/** Broken twin: correct routine, then arm the dig timer to the wrong value (7, not 8). */
function twinWrongTimer(m) {
  idiomatic(m);
  m.mem.write8(DIG_OBJ_TIMER, 7); // BUG: the busy path arms it to 8
}

test("TEETH (busy path): a wrong dig-timer arm is CAUGHT", () => {
  const [seed] = captureRealEntries(4000, 1);
  assert.ok(seed, "need a captured entry to seed the teeth check");
  // A recognised pair with a busy slot -> the arm-timer path (writes DIG_OBJ_TIMER).
  const entry = craft(seed, { neigh: 193, cur: 197, twoBack: 0, spawnState: 5 });

  const diff = compare(entry, twinWrongTimer);
  assert.notEqual(diff, null, "the gate FAILED to catch the wrong dig-timer twin — it proves nothing");
  assert.equal(diff.addr, DIG_OBJ_TIMER, `teeth caught the wrong address ${hx(diff.addr)} (expected ${hx(DIG_OBJ_TIMER)})`);
  console.log(`  TEETH/busy: wrong dig-timer arm caught at ${hx(diff.addr)} (oracle=${diff.a} broken=${diff.b})`);
});

// -- 4. TEETH: a wrong stamped sprite id on the commit path is caught ---------

/** Broken twin: correct routine, then corrupt the sprite id stamped before the cursor. */
function twinWrongStamp(m) {
  idiomatic(m);
  const cellPtr = m.mem.read16(ACTOR_CELL_PTR);
  const before = m.mem.read8((cellPtr - 1) & 0xffff);
  m.mem.write8((cellPtr - 1) & 0xffff, before ^ 0xff); // BUG: wrong tile stamped into the map
}

test("TEETH (commit path): a wrong stamped sprite id is CAUGHT in the tilemap", () => {
  const [seed] = captureRealEntries(4000, 1);
  assert.ok(seed, "need a captured entry to seed the teeth check");
  // A recognised pair with an idle slot -> the commit path stamps the tilemap cell.
  const entry = craft(seed, { neigh: 193, cur: 197, twoBack: 0, spawnState: 0 });
  const cellPtr = entry.mem.read16(ACTOR_CELL_PTR);

  const diff = compare(entry, twinWrongStamp);
  assert.notEqual(diff, null, "the gate FAILED to catch the wrong-stamp twin — it proves nothing");
  assert.equal(
    diff.addr,
    (cellPtr - 1) & 0xffff,
    `teeth caught the wrong address ${hx(diff.addr)} (expected ${hx((cellPtr - 1) & 0xffff)})`,
  );
  console.log(`  TEETH/commit: wrong stamped tile caught at ${hx(diff.addr)} (oracle=${diff.a} broken=${diff.b})`);
});
