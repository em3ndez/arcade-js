// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_3484 (ROM 0x3484) — one fixed-direction preset of
 * the patrol mover: advance the position one unit forward each frame and, on the
 * cadence tick, re-arm the cadence and publish this preset's facing index (2).
 *
 * The routine is a LEAF whose whole effect is memory: the cadence countdown byte
 * (ANIM_RAND 0x808b), the published facing byte (0x8092), and the advanced position
 * byte (0x8086). It reads no register input (its first act is to load its own fixed
 * direction constants, overwriting whatever the dispatcher left in the registers) and
 * calls nothing — so its result is a pure function of the countdown, reload (0x8091)
 * and position bytes. Its declared live-out is MEMORY-ONLY: the dispatcher's caller
 * copies the mover record out of memory and overwrites the registers before reading
 * any, so the gate diffs RAM (the full state dump) and ignores pc/SP/value registers,
 * per the honest-signature contract.
 *
 * loc_3484 does no stack pushes (it only returns), so there is no dead stack scratch
 * to exclude — the RAM dumps compare byte-for-byte directly.
 *
 * Checks:
 *   0. HARNESS — 0x3484 is dispatched during attract (reached by tail-jump from the
 *      mover dispatch); capture real entries and confirm they span BOTH the tick-only
 *      branch (countdown > 1) and the cadence-reload branch (countdown == 1), and that
 *      the oracle run is deterministic.
 *   1. EQUAL (real entries) — over every captured attract entry, loc_3484 leaves the
 *      same RAM as the oracle; plus positive checks that the position advanced by one
 *      and, on reload-branch entries, the facing became 2 and the countdown reloaded.
 *   2. EQUAL (crafted countdown sweep 0..7) — force the countdown to each value on
 *      identical states both sides; both take the matching branch, identical, covering
 *      the reload (== 1) and the 0 -> 255 wrap boundary.
 *   3. TEETH (wrong position delta) — a twin that advances the position by 2 is CAUGHT
 *      at 0x8086.
 *   4. TEETH (wrong facing) — a twin that publishes facing 3 instead of 2 on the reload
 *      branch is CAUGHT at 0x8092.
 *   5. TEETH (skipped reload) — a twin that does not re-arm the countdown on the reload
 *      branch is CAUGHT at 0x808b.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3484.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3484 as oracle } from "../../translated/loc_3484.js";
import { loc_3484 as idiomatic } from "../loc_3484.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { ANIM_RAND } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x3484;
const RELOAD = 0x8091; // where the countdown reloads from on the cadence tick
const FACING = 0x8092; // the facing index published on the cadence tick
const POS = 0x8086; // the position byte advanced +1 every frame
const FACING_INDEX = 2; // this preset's facing index
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/**
 * Hook 0x3484 in a real attract run and clone the machine at each dispatch (up to
 * `cap`). The wrapper snapshots then runs the oracle so attract proceeds normally.
 * Returns [{ entry, countdown }] — countdown is the pre-run cadence byte, so callers
 * can pick tick-only vs reload-branch entries.
 */
function captureEntries(maxFrames, cap) {
  const entries = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (entries.length < cap) {
      entries.push({ entry: mm.clone(), countdown: mm.mem.read8(ANIM_RAND) });
    }
    return oracle(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return entries;
}

/**
 * Run the oracle and a candidate on two clones of `entry` and return the first
 * differing RAM byte (the full state dump), or null when identical. pc/SP/value
 * registers are the declared-dead live-out and are not compared.
 */
function ramDiff(entry, fn) {
  const o = entry.clone();
  oracle(o);
  const c = entry.clone();
  fn(c);
  return firstStateDiff(o.dumpState(), c.dumpState(), (off) => o.stateOffsetToAddr(off));
}

// -- 0. HARNESS ---------------------------------------------------------------

test("HARNESS: real 0x3484 attract entries are captured, span both branches, and the oracle is deterministic", () => {
  const entries = captureEntries(3000, 400);
  assert.ok(entries.length > 0, "expected 0x3484 to be dispatched during attract");

  const tickOnly = entries.filter((e) => e.countdown > 1).length;
  const reload = entries.filter((e) => e.countdown === 1).length;
  assert.ok(tickOnly > 0, "expected some tick-only entries (countdown > 1)");
  assert.ok(reload > 0, "expected some cadence-reload entries (countdown == 1)");

  // Determinism: two oracle runs of the same entry leave identical RAM.
  const e0 = entries[0].entry;
  const a = e0.clone();
  oracle(a);
  const b = e0.clone();
  oracle(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `oracle run not deterministic: diff at ${hx(d.addr ?? 0)}`);

  console.log(
    `  HARNESS: captured ${entries.length} real 0x3484 entries ` +
      `(${tickOnly} tick-only, ${reload} cadence-reload); oracle deterministic`,
  );
});

// -- 1. EQUAL on every real captured entry ------------------------------------

test("EQUAL (real entries): loc_3484 == oracle over RAM on every captured attract dispatch", () => {
  const entries = captureEntries(3000, 400);
  assert.ok(entries.length > 0, "need captured 0x3484 entries");

  for (const { entry, countdown } of entries) {
    const diff = ramDiff(entry, idiomatic);
    assert.equal(diff, null, diff && `RAM diff at ${hx(diff.addr ?? 0)} oracle=${diff.a} cand=${diff.b}`);

    // Positive checks: the position advanced by one; on the reload branch the facing
    // became this preset's index and the countdown was re-armed from its reload value.
    const before = entry.clone();
    const pos0 = before.mem.read8(POS);
    const reloadVal = before.mem.read8(RELOAD);
    const c = entry.clone();
    idiomatic(c);
    assert.equal(c.mem.read8(POS), (pos0 + 1) & 0xff, "position did not advance by one");
    if (countdown === 1) {
      assert.equal(c.mem.read8(FACING), FACING_INDEX, "reload branch did not publish facing 2");
      assert.equal(c.mem.read8(ANIM_RAND), reloadVal, "reload branch did not re-arm the countdown");
    }
  }
  console.log(`  EQUAL/real: identical RAM over all ${entries.length} captured entries; position +1 and reload/facing verified`);
});

// -- 2. EQUAL across a crafted sweep of every countdown value 0..7 ------------

test("EQUAL (countdown sweep 0..7): each branch is taken identically, covering reload and the 0 -> 255 wrap", () => {
  const seed = captureEntries(3000, 1)[0];
  assert.ok(seed, "need a captured 0x3484 entry to craft the sweep from");

  const RELOAD_SENTINEL = 42; // a distinctive reload value so the re-arm is observable
  const FACING_SENTINEL = 153; // a distinctive prior facing so the publish is observable

  for (let cd = 0; cd < 8; cd++) {
    const entry = seed.entry.clone();
    entry.mem.write8(ANIM_RAND, cd);
    entry.mem.write8(RELOAD, RELOAD_SENTINEL);
    entry.mem.write8(FACING, FACING_SENTINEL);
    const pos0 = entry.mem.read8(POS);

    const diff = ramDiff(entry, idiomatic);
    assert.equal(diff, null, diff && `cd=${cd}: RAM diff at ${hx(diff.addr ?? 0)} oracle=${diff.a} cand=${diff.b}`);

    const c = entry.clone();
    idiomatic(c);
    assert.equal(c.mem.read8(POS), (pos0 + 1) & 0xff, `cd=${cd}: position did not advance by one`);
    if (cd === 1) {
      // Countdown expires: reload + publish facing 2.
      assert.equal(c.mem.read8(ANIM_RAND), RELOAD_SENTINEL, `cd=1: countdown not reloaded`);
      assert.equal(c.mem.read8(FACING), FACING_INDEX, `cd=1: facing not published`);
    } else {
      // Countdown does not expire: just ticks down (0 wraps to 255), facing untouched.
      assert.equal(c.mem.read8(ANIM_RAND), (cd - 1) & 0xff, `cd=${cd}: countdown not ticked`);
      assert.equal(c.mem.read8(FACING), FACING_SENTINEL, `cd=${cd}: facing changed on a non-reload frame`);
    }
  }
  console.log("  EQUAL/sweep: countdowns 0..7 all match the oracle (reload at 1, 0 -> 255 wrap), and re-arm/facing verified");
});

// -- 3-5. TEETH: broken twins the RAM diff must catch -------------------------

/** Twin: advances the position by two instead of one. */
function twinWrongDelta(m) {
  const { mem8 } = m;
  const countdown = mem8[ANIM_RAND] - 1;
  mem8[ANIM_RAND] = countdown;
  if (countdown === 0) {
    mem8[ANIM_RAND] = mem8[RELOAD];
    mem8[FACING] = FACING_INDEX;
  }
  mem8[POS] = mem8[POS] + 2; // BUG: wrong step size
}

/** Twin: publishes facing 3 (a sibling's index) instead of 2 on the reload branch. */
function twinWrongFacing(m) {
  const { mem8 } = m;
  const countdown = mem8[ANIM_RAND] - 1;
  mem8[ANIM_RAND] = countdown;
  if (countdown === 0) {
    mem8[ANIM_RAND] = mem8[RELOAD];
    mem8[FACING] = 3; // BUG: wrong facing index
  }
  mem8[POS] = mem8[POS] + 1;
}

/** Twin: forgets to re-arm the countdown on the reload branch (leaves it at 0). */
function twinNoReload(m) {
  const { mem8 } = m;
  const countdown = mem8[ANIM_RAND] - 1;
  mem8[ANIM_RAND] = countdown;
  if (countdown === 0) {
    mem8[FACING] = FACING_INDEX; // BUG: countdown not reloaded
  }
  mem8[POS] = mem8[POS] + 1;
}

/** A crafted reload-branch entry (countdown == 1) with distinctive reload/facing bytes. */
function reloadEntry() {
  const seed = captureEntries(3000, 1)[0];
  assert.ok(seed, "need a captured 0x3484 entry to craft the teeth check");
  const entry = seed.entry.clone();
  entry.mem.write8(ANIM_RAND, 1); // countdown expires this frame
  entry.mem.write8(RELOAD, 42);
  entry.mem.write8(FACING, 153);
  return entry;
}

test("TEETH (wrong position delta): a twin advancing the position by two is CAUGHT at 0x8086", () => {
  const entry = reloadEntry();
  const diff = ramDiff(entry, twinWrongDelta);
  assert.ok(diff, "the gate FAILED to catch the wrong-delta twin — it proves nothing");
  assert.equal(diff.addr, POS, `teeth caught the wrong address ${hx(diff.addr ?? 0)} (expected ${hx(POS)})`);
  console.log(`  TEETH/delta: wrong step caught at ${hx(diff.addr)} (oracle=${diff.a} broken=${diff.b})`);
});

test("TEETH (wrong facing): a twin publishing facing 3 on the reload branch is CAUGHT at 0x8092", () => {
  const entry = reloadEntry();
  const diff = ramDiff(entry, twinWrongFacing);
  assert.ok(diff, "the gate FAILED to catch the wrong-facing twin — it proves nothing");
  assert.equal(diff.addr, FACING, `teeth caught the wrong address ${hx(diff.addr ?? 0)} (expected ${hx(FACING)})`);
  console.log(`  TEETH/facing: wrong facing caught at ${hx(diff.addr)} (oracle=${diff.a} broken=${diff.b})`);
});

test("TEETH (skipped reload): a twin that does not re-arm the countdown is CAUGHT at 0x808b", () => {
  const entry = reloadEntry();
  const diff = ramDiff(entry, twinNoReload);
  assert.ok(diff, "the gate FAILED to catch the no-reload twin — it proves nothing");
  assert.equal(diff.addr, ANIM_RAND, `teeth caught the wrong address ${hx(diff.addr ?? 0)} (expected ${hx(ANIM_RAND)})`);
  console.log(`  TEETH/reload: skipped re-arm caught at ${hx(diff.addr)} (oracle=${diff.a} broken=${diff.b})`);
});
