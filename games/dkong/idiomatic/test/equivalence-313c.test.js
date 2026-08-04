// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for spawnRequestedFireAndRecolorLiveFires (ROM 0x313C) — the 0x6400 object-slot scan / INSERT / caller-skip.
 *
 * spawnRequestedFireAndRecolorLiveFires scans the five OBJ_ARRAY_64 records (stride 0x20), tallies the live ones into the
 * OBJ_LIVE_COUNT, flags each live record's OBJ_SPRITE_ATTR field (off while a hammer swings), services
 * at most one pending object-INSERT request (EVENT_REQ_313C) into a free slot, and finally decides
 * a CALLER-SKIP: a non-zero count returns normally (true); a zero count splices past the caller
 * (false). On 50m it can also return early-normal the instant DIFFICULTY equals the running count.
 *
 * The routine IS on a live dispatch path: its caller 0x30ED is idiomatic (updateFires) and calls
 * spawnRequestedFireAndRecolorLiveFires directly, and REACHABILITY IS GROUNDED on the real ROM
 * under MAME 0.288 (understanding pass 12). In PURE ATTRACT with zero pokes and no coin, caller
 * 0x30ED executed 1220x and this routine 610x over 4243 frames (6329x / 3189x over a 14546-frame
 * attract run), and it ran 1069 / 3214 / 2417 / 2291x in the credited 1P / 50m / 75m / 100m runs.
 * Every arm fires naturally there: the live-record store (0x315A) wrote OBJ_SPRITE_ATTR := 1
 * 2477x; the HAMMER store (0x3167) wrote OBJ_SPRITE_ATTR := 0 768x, every one with
 * MARIO_HAMMER_ACTIVE == 1 during a hammer grab the attract demo performs unaided; the INSERT arm
 * (0x319D) fetched 2-13x per run and left OBJ_INSERT_REQUESTED at 1 for 310 / 186 / 70 frames;
 * and the zero-count SPLICE (0x3179) fetched 126-707x per run. Those numbers are from that MAME
 * grounding run, NOT produced by this file. (An earlier version of this header said
 * it was "on NO live dispatch path" behind "the untranslated orchestrator 0x30ED"; that was
 * stale.) The gate below is still CRAFTED rather than captured, and deliberately so: the input
 * space (5 slot flags × BOARD × DIFFICULTY × request × hammer) is too large to sweep whole, so
 * entries are crafted to cover every branch and arm — including arms no attract capture reaches.
 * Both the memory contract (RAM minus the isolated stack, which the routine never writes) AND
 * the boolean return are compared against the frozen oracle.
 *
 *   1. EQUAL — over crafted entries (each hitting a named arm) and a cross-product sweep of the
 *      relevant inputs, spawnRequestedFireAndRecolorLiveFires leaves RAM byte-identical to the oracle (firstStateDiff == null)
 *      AND returns the same boolean. Non-vacuity: the crafted entries assert the oracle really took
 *      the intended arm (specific memory effect + specific return value).
 *
 *   2. TEETH — four deliberately-broken twins the gate MUST catch:
 *        (a) inverted skip decision (return count===0) — caught only by the BOOLEAN compare
 *            (RAM is identical), proving the return assertion bites.
 *        (b) insert forgets to consume the request — caught by RAM (extra slots activated).
 *        (c) hammer ignored (+8 always 1) — caught by RAM on a hammer-held entry.
 *        (d) wrong board constant (=== 3) — caught by RAM + return on a 50m early-exit entry.
 *
 * The counter==5 empty-slot arm is UNREACHABLE from the entry (count resets to 0 and rises at most
 * once per the five records, so it is <= 4 at any empty slot); it is dead on both sides.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-313c.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { OBJ_INSERT_REQUESTED, OBJ_LIVE_COUNT } from "../names.js";
import { loc_313c as oracle } from "../../translated/loc_313c.js";
import { spawnRequestedFireAndRecolorLiveFires } from "../spawnRequestedFireAndRecolorLiveFires.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

// -- addresses ---------------------------------------------------------------
const SLOT = [0x6400, 0x6420, 0x6440, 0x6460, 0x6480]; // the five stride-0x20 record bases
const ATTR = SLOT.map((s) => s + 0x08); // per-record +8 field (OBJ_SPRITE_ATTR)
const INS = SLOT.map((s) => s + OBJ_INSERT_REQUESTED); // per-record OBJ_INSERT_REQUESTED field (set on insert)
const BOARD = 0x6227;
const DIFFICULTY = 0x6380;
const EVENT_REQ = 0x63a0;
const HAMMER = 0x6217;
const SENTINEL = 0xaa; // marks the +8/+0x18 fields so a write of the expected value is provable
// The oracle's terminal `ret` (and the splice's inc-sp ×2 then ret) only READ the stack — never a
// RAM write — so point SP at valid work RAM and the compared memory is unaffected.
const SAFE_SP = 0x6bf8;

/** A synthetic entry: a clone of `base` with the five slot flags + inputs set and a safe stack. */
function makeEntry(base, cfg) {
  const e = base.clone();
  for (let i = 0; i < 5; i++) {
    e.mem.write8(SLOT[i], cfg.slots[i] & 0xff);
    e.mem.write8(ATTR[i], SENTINEL); // known start so a real write to +8 is observable
    e.mem.write8(INS[i], SENTINEL); // known start so a real write to OBJ_INSERT_REQUESTED is observable
  }
  e.mem.write8(BOARD, cfg.board & 0xff);
  e.mem.write8(DIFFICULTY, cfg.diff & 0xff);
  e.mem.write8(EVENT_REQ, cfg.req & 0xff);
  e.mem.write8(HAMMER, cfg.hammer & 0xff);
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and the candidate on two FRESH, byte-identical entries and compare BOTH the
 * memory-equivalence contract (RAM over the whole dump) AND the boolean return.
 */
function runPair(base, cfg, candidate) {
  const a = makeEntry(base, cfg); // oracle
  const b = makeEntry(base, cfg); // candidate
  const retA = oracle(a);
  const retB = candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { ram, retA, retB, oracleMachine: a };
}

/** True mismatch = RAM diverges OR the boolean returns disagree. */
const mismatched = (r) => r.ram !== null || r.retA !== r.retB;

/** First entry (of `entries`) on which `candidate` diverges from the oracle, else null. */
function firstMismatch(base, entries, candidate) {
  for (const cfg of entries) {
    const r = runPair(base, cfg, candidate);
    if (mismatched(r)) return { cfg, r };
  }
  return null;
}

// -- crafted entries: one per reachable arm ----------------------------------
// expect = the oracle's documented boolean return (validates our understanding, then the gate
// separately asserts the candidate reproduces whatever the oracle actually does).
const CRAFTED = [
  // A2 SPLICE: all empty, off 50m, no request -> count stays 0 -> false.
  { name: "all-empty/no-request -> SPLICE(false)", slots: [0, 0, 0, 0, 0], board: 1, diff: 0, req: 0, hammer: 0, expect: false },
  // E2b then E2a: all empty, off 50m, request raised -> insert at slot0 only -> count 1 -> true.
  { name: "all-empty/request -> insert slot0, true", slots: [0, 0, 0, 0, 0], board: 1, diff: 0, req: 1, hammer: 0, expect: true },
  // N1 + A1: one live object, no hammer -> +8:=1, count 1 -> true.
  { name: "one-live/no-hammer -> +8=1, true", slots: [0x01, 0, 0, 0, 0], board: 1, diff: 5, req: 0, hammer: 0, expect: true },
  // N2: one live object, hammer held (==1) -> +8:=0.
  { name: "one-live/hammer -> +8=0, true", slots: [0x01, 0, 0, 0, 0], board: 1, diff: 5, req: 0, hammer: 1, expect: true },
  // E3 early-normal: 50m, difficulty already equals count(0) -> true, request NOT cleared.
  { name: "50m/diff==0 -> early true, req kept", slots: [0, 0, 0, 0, 0], board: 2, diff: 0, req: 1, hammer: 0, expect: true },
  // E4b: 50m, difficulty(5) never equals count -> insert path.
  { name: "50m/diff!=count -> insert, true", slots: [0, 0, 0, 0, 0], board: 2, diff: 5, req: 1, hammer: 0, expect: true },
  // E4b then E3: 50m, insert bumps count to 1, then diff(1)==count -> early true mid-scan.
  { name: "50m/insert-then-diff-match -> early true", slots: [0, 0, 0, 0, 0], board: 2, diff: 1, req: 1, hammer: 0, expect: true },
  // All live: count -> 5, every +8:=1 (confirms empty-slot/count==5 arm never entered).
  { name: "all-live -> count 5, true", slots: [1, 1, 1, 1, 1], board: 1, diff: 5, req: 1, hammer: 0, expect: true },
  // Mixed live/empty with hammer + one insert.
  { name: "mixed live/empty + hammer + insert", slots: [1, 0, 1, 0, 1], board: 1, diff: 5, req: 1, hammer: 1, expect: true },
  // "Non-empty" means != 0, not == 1 (odd active values still counted).
  { name: "nonzero-active values counted", slots: [2, 0xff, 0, 0, 0], board: 1, diff: 5, req: 0, hammer: 0, expect: true },
  // Hammer forces +8=0 ONLY when exactly 1 (hammer==2 keeps +8=1).
  { name: "hammer==2 keeps +8=1", slots: [0x01, 0, 0, 0, 0], board: 1, diff: 5, req: 0, hammer: 2, expect: true },
  // Request honoured ONLY when exactly 1 (req==2 inserts nothing) -> count 0 -> false.
  { name: "req==2 no insert -> SPLICE(false)", slots: [0, 0, 0, 0, 0], board: 1, diff: 5, req: 2, hammer: 0, expect: false },
  // BOARD==2 guard is exact: board==3 with diff==count does NOT early-return.
  { name: "board==3/diff==count -> no early exit, false", slots: [0, 0, 0, 0, 0], board: 3, diff: 0, req: 0, hammer: 0, expect: false },
];

// -- structured cross-product sweep ------------------------------------------
function* sweepEntries() {
  const boards = [0, 1, 2, 3];
  const diffs = [0, 1, 2, 5, 6];
  const reqs = [0, 1, 2];
  const hammers = [0, 1, 2];
  for (let mask = 0; mask < 32; mask++) {
    const slots = [0, 1, 2, 3, 4].map((i) => (mask >> i) & 1); // each slot empty(0) or live(1)
    for (const board of boards) {
      for (const diff of diffs) {
        for (const req of reqs) {
          for (const hammer of hammers) {
            yield { slots, board, diff, req, hammer };
          }
        }
      }
    }
  }
}

const describe = (cfg) =>
  `slots=[${cfg.slots}] board=${cfg.board} diff=${cfg.diff} req=${cfg.req} hammer=${cfg.hammer}`;

// -- 1. EQUAL ----------------------------------------------------------------

test("EQUAL (crafted): spawnRequestedFireAndRecolorLiveFires == oracle on RAM + return over every reachable arm", () => {
  const base = new Machine(ROM).clone();
  for (const cfg of CRAFTED) {
    const r = runPair(base, cfg, spawnRequestedFireAndRecolorLiveFires);
    assert.equal(
      r.ram,
      null,
      r.ram && `${cfg.name}: RAM diverges at 0x${(r.ram.addr ?? 0).toString(16)} (${r.ram.a}->${r.ram.b})`,
    );
    assert.equal(r.retA, r.retB, `${cfg.name}: return disagrees (oracle ${r.retA}, spawnRequestedFireAndRecolorLiveFires ${r.retB})`);
    // Non-vacuity: the oracle actually took the arm this entry targets.
    assert.equal(r.retA, cfg.expect, `${cfg.name}: oracle return ${r.retA} != documented ${cfg.expect}`);
  }
  console.log(`  EQUAL/crafted: ${CRAFTED.length} arm-covering entries — RAM + return identical`);
});

test("EQUAL (crafted): the arm-specific memory effects are the expected ones", () => {
  const base = new Machine(ROM).clone();
  const run = (cfg) => runPair(base, cfg, spawnRequestedFireAndRecolorLiveFires).oracleMachine;

  // insert lands in slot0 only (request consumed), later empties untouched
  let m = run({ slots: [0, 0, 0, 0, 0], board: 1, diff: 0, req: 1, hammer: 0 });
  assert.equal(m.mem.read8(SLOT[0]), 0x01, "insert must activate slot0 (+0=1)");
  assert.equal(m.mem.read8(INS[0]), 0x01, "insert must set slot0 OBJ_INSERT_REQUESTED=1");
  assert.equal(m.mem.read8(EVENT_REQ), 0x00, "insert must consume the request");
  assert.equal(m.mem.read8(SLOT[1]), 0x00, "slot1 must stay empty (request already consumed)");
  assert.equal(m.mem.read8(OBJ_LIVE_COUNT), 0x01, "count must be 1 after a single insert");

  // hammer held -> +8=0; hammer==2 -> +8=1
  m = run({ slots: [0x01, 0, 0, 0, 0], board: 1, diff: 5, req: 0, hammer: 1 });
  assert.equal(m.mem.read8(ATTR[0]), 0x00, "hammer held must force +8=0");
  m = run({ slots: [0x01, 0, 0, 0, 0], board: 1, diff: 5, req: 0, hammer: 2 });
  assert.equal(m.mem.read8(ATTR[0]), 0x01, "hammer!=1 must leave +8=1");

  // 50m early exit keeps the request (post-loop clear is skipped)
  m = run({ slots: [0, 0, 0, 0, 0], board: 2, diff: 0, req: 1, hammer: 0 });
  assert.equal(m.mem.read8(EVENT_REQ), 0x01, "50m early-normal exit must NOT clear the request");
  assert.equal(m.mem.read8(OBJ_LIVE_COUNT), 0x00, "50m early exit at count 0 leaves counter 0");

  // all empty, no request -> request cleared by the post-loop clear, count 0
  m = run({ slots: [0, 0, 0, 0, 0], board: 1, diff: 0, req: 1, hammer: 0 });
  assert.equal(m.mem.read8(EVENT_REQ), 0x00, "post-loop clear must zero the request");
  console.log("  EQUAL/effects: insert / hammer / 50m-early-exit / post-clear all as expected");
});

test("EQUAL (sweep): spawnRequestedFireAndRecolorLiveFires == oracle on RAM + return across the cross-product", () => {
  const base = new Machine(ROM).clone();
  let n = 0;
  let sawTrue = false;
  let sawFalse = false;
  for (const cfg of sweepEntries()) {
    const r = runPair(base, cfg, spawnRequestedFireAndRecolorLiveFires);
    assert.equal(
      r.ram,
      null,
      r.ram && `${describe(cfg)}: RAM diverges at 0x${(r.ram.addr ?? 0).toString(16)} (${r.ram.a}->${r.ram.b})`,
    );
    assert.equal(r.retA, r.retB, `${describe(cfg)}: return disagrees (oracle ${r.retA}, spawnRequestedFireAndRecolorLiveFires ${r.retB})`);
    sawTrue ||= r.retA === true;
    sawFalse ||= r.retA === false;
    n++;
  }
  assert.ok(sawTrue && sawFalse, "the sweep must exercise BOTH the normal-return and the SPLICE paths");
  console.log(`  EQUAL/sweep: ${n} entries — RAM + return identical (both true and false returns seen)`);
});

// -- 2. TEETH ----------------------------------------------------------------

/** BUG (a): inverted skip decision. RAM is identical; only the BOOLEAN diverges. */
function brokenReturn(m) {
  const r = spawnRequestedFireAndRecolorLiveFires(m);
  return !r; // invert the caller-skip decision
}

/** BUG (b): insert forgets to consume the request, so every empty slot inserts. */
function brokenNoConsume(m) {
  const { mem } = m;
  const OBJ_ARRAY_64 = 0x6400;
  let count = 0;
  mem.write8(OBJ_LIVE_COUNT, count);
  let ix = OBJ_ARRAY_64;
  for (let i = 0; i < 5; i++, ix = (ix + 0x20) & 0xffff) {
    if (mem.read8(ix) !== 0) {
      count = (count + 1) & 0xff;
      mem.write8(OBJ_LIVE_COUNT, count);
      mem.write8((ix + 0x08) & 0xffff, mem.read8(HAMMER) === 0x01 ? 0x00 : 0x01);
      continue;
    }
    if (count === 0x05) continue;
    if (mem.read8(BOARD) === 0x02 && mem.read8(DIFFICULTY) === count) return true;
    if (mem.read8(EVENT_REQ) === 0x01) {
      mem.write8(ix, 0x01);
      mem.write8((ix + 0x18) & 0xffff, 0x01);
      // BUG: no `mem.write8(EVENT_REQ, 0)` — the request is never consumed.
      count = (count + 1) & 0xff;
      mem.write8(OBJ_LIVE_COUNT, count);
    }
  }
  mem.write8(EVENT_REQ, 0x00);
  return count !== 0;
}

/** BUG (c): +8 is always 1 — the hammer branch is dropped. */
function brokenHammer(m) {
  const { mem } = m;
  let count = 0;
  mem.write8(OBJ_LIVE_COUNT, count);
  let ix = 0x6400;
  for (let i = 0; i < 5; i++, ix = (ix + 0x20) & 0xffff) {
    if (mem.read8(ix) !== 0) {
      count = (count + 1) & 0xff;
      mem.write8(OBJ_LIVE_COUNT, count);
      mem.write8((ix + 0x08) & 0xffff, 0x01); // BUG: ignores MARIO_HAMMER_ACTIVE
      continue;
    }
    if (count === 0x05) continue;
    if (mem.read8(BOARD) === 0x02 && mem.read8(DIFFICULTY) === count) return true;
    if (mem.read8(EVENT_REQ) === 0x01) {
      mem.write8(ix, 0x01);
      mem.write8((ix + 0x18) & 0xffff, 0x01);
      mem.write8(EVENT_REQ, 0x00);
      count = (count + 1) & 0xff;
      mem.write8(OBJ_LIVE_COUNT, count);
    }
  }
  mem.write8(EVENT_REQ, 0x00);
  return count !== 0;
}

/** BUG (d): wrong board constant — the 50m early-exit fires on board 3, not board 2. */
function brokenBoard(m) {
  const { mem } = m;
  let count = 0;
  mem.write8(OBJ_LIVE_COUNT, count);
  let ix = 0x6400;
  for (let i = 0; i < 5; i++, ix = (ix + 0x20) & 0xffff) {
    if (mem.read8(ix) !== 0) {
      count = (count + 1) & 0xff;
      mem.write8(OBJ_LIVE_COUNT, count);
      mem.write8((ix + 0x08) & 0xffff, mem.read8(HAMMER) === 0x01 ? 0x00 : 0x01);
      continue;
    }
    if (count === 0x05) continue;
    if (mem.read8(BOARD) === 0x03 && mem.read8(DIFFICULTY) === count) return true; // BUG: 3, not 2
    if (mem.read8(EVENT_REQ) === 0x01) {
      mem.write8(ix, 0x01);
      mem.write8((ix + 0x18) & 0xffff, 0x01);
      mem.write8(EVENT_REQ, 0x00);
      count = (count + 1) & 0xff;
      mem.write8(OBJ_LIVE_COUNT, count);
    }
  }
  mem.write8(EVENT_REQ, 0x00);
  return count !== 0;
}

const ALL_ENTRIES = [...CRAFTED, ...sweepEntries()];

test("TEETH: inverted skip decision is CAUGHT (boolean compare bites)", () => {
  const base = new Machine(ROM).clone();
  const hit = firstMismatch(base, ALL_ENTRIES, brokenReturn);
  assert.notEqual(hit, null, "the gate FAILED to catch an inverted return — the boolean compare is worthless");
  // Prove it is the BOOLEAN, not RAM, that catches this twin.
  assert.equal(hit.r.ram, null, "inverted-return twin should diverge on the return only, not RAM");
  assert.notEqual(hit.r.retA, hit.r.retB, "the caught divergence must be the boolean return");
  console.log(`  TEETH/return: caught on {${describe(hit.cfg)}} (oracle ${hit.r.retA} vs ${hit.r.retB})`);
});

test("TEETH: request-not-consumed twin is CAUGHT (RAM diverges)", () => {
  const base = new Machine(ROM).clone();
  const hit = firstMismatch(base, ALL_ENTRIES, brokenNoConsume);
  assert.notEqual(hit, null, "the gate FAILED to catch a request that is never consumed");
  assert.notEqual(hit.r.ram, null, "the request-not-consumed twin must diverge in RAM (extra slots activated)");
  console.log(`  TEETH/no-consume: caught on {${describe(hit.cfg)}} at 0x${(hit.r.ram.addr ?? 0).toString(16)}`);
});

test("TEETH: hammer-ignored twin is CAUGHT (RAM diverges)", () => {
  const base = new Machine(ROM).clone();
  const hit = firstMismatch(base, ALL_ENTRIES, brokenHammer);
  assert.notEqual(hit, null, "the gate FAILED to catch a dropped hammer branch");
  assert.notEqual(hit.r.ram, null, "the hammer-ignored twin must diverge in RAM (+8 field)");
  console.log(`  TEETH/hammer: caught on {${describe(hit.cfg)}} at 0x${(hit.r.ram.addr ?? 0).toString(16)}`);
});

test("TEETH: wrong-board-constant twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const hit = firstMismatch(base, ALL_ENTRIES, brokenBoard);
  assert.notEqual(hit, null, "the gate FAILED to catch the wrong board constant");
  console.log(`  TEETH/board: caught on {${describe(hit.cfg)}} (ram ${hit.r.ram ? "diverged" : "ok"}, ret ${hit.r.retA} vs ${hit.r.retB})`);
});
