// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_315b — memory-equivalent to the frozen oracle at ROM 0x315B.
 *
 * THE DESTINATION REFUSES TO RUN, so this is a poked dispatch with negative controls, judged by a
 * hand-rolled two-clone run rather than unitEquivalence. 0x315B is three bytes, `jp 0x3176`, and
 * 0x3176 is a data table (seatEraSceneryRowThenClearAndRunScenery loads it `ld hl,0x3176` and indexes it with `rst 0x18`). Its
 * transcription decodes DATA and throws on entry, so BOTH arms throw — unitEquivalence cannot catch.
 *
 * WHY A POKE, AND WHAT IT IS. Two guards jump here (0x30E9, 0x30F5), testing sentinel bytes in work
 * RAM: 0xACC7 against 0x3B and 0xACC8 against 0x05 or 0x10, which routine 0x15FE plants from an
 * (address, value) table at ROM 0x163F — so on an untampered image both tests pass and this arm is
 * dead. Reaching the guards also needs the era index at or above four (0x30E0 diverts a lower one to
 * 0x3117). The poke is therefore two cells: ERA_INDEX held at four, and one sentinel byte zeroed.
 *
 * HOLE: this proves the rewrite arrives where the original arrives, and nothing more. It does not
 * execute the destination — the destination is not code — and it does not claim what a cabinet does
 * on arrival, where those bytes would be fetched as instructions.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-315b.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_315b } from "../loc_315b.js";
import { loc_315b as oracle } from "../../translated/loc_315b.js";
import { ERA_INDEX } from "../names.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const TARGET = 0x315b;

const SENTINEL = 0xacc7;
const ERA_THAT_REACHES_THE_GUARD = 4;
const POKE_FROM_FRAME = 260;

const SOMEWHERE_ELSE = 0x309b;

const SKIP = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

const poke = (addr, val) => ({ addr, val, frame: POKE_FROM_FRAME, dur: null });

function attract(pokes, overrides) {
  const m = makeMachine(overrides, { tape: [] });
  if (pokes.length) m.pokes = pokes;
  return m;
}

const ERA_ONLY = [poke(ERA_INDEX, ERA_THAT_REACHES_THE_GUARD)];
const ERA_AND_CORRUPT = [...ERA_ONLY, poke(SENTINEL, 0x00)];

function session(pokes) {
  let entry = null;
  let hits = 0;
  const m = attract(pokes, new Map([[TARGET, (mm) => {
    hits += 1;
    if (entry === null) entry = mm.clone();
    return oracle(mm);
  }]]));
  let threw = null;
  try {
    m.runFrames(ENTRY_FRAMES);
  } catch (e) {
    threw = e;
  }
  return { hits, entry, threw };
}

let captured = null;
function entryState() {
  if (captured === null) captured = session(ERA_AND_CORRUPT).entry;
  assert.notEqual(captured, null, "vacuous: the poked run never dispatched the routine");
  return captured;
}

/**
 * The refusal names the cycle it happened on, and CYCLES ARE OUTSIDE THE CONTRACT: the frozen
 * original charges for its jump and the rewrite charges nothing, so the counts differ by exactly that.
 * Masking it drops the cycle proxy, not the comparison — every other word of the message must match.
 */
const withoutTheCycle = (s) => (s === null ? null : s.replace(/at cycle \d+/, "at cycle <dropped>"));

function attempt(fn) {
  const m = entryState().clone();
  let message = null;
  try {
    fn(m);
  } catch (e) {
    message = withoutTheCycle(e.message);
  }
  return { message, dump: m.dumpState(), machine: m };
}

test("NEGATIVE CONTROL: untouched attract never dispatches it", { skip: SKIP }, () => {
  const s = session([]);
  assert.equal(s.hits, 0, "an untampered attract run must not reach this arm");
  console.log("  CONTROL: zero dispatches with nothing poked");
});

test("NEGATIVE CONTROL: era four with the sentinels intact never dispatches it", { skip: SKIP }, () => {
  const s = session(ERA_ONLY);
  assert.equal(s.hits, 0, "reaching the guard is not enough — the guard must also fail");
  console.log("  CONTROL: zero dispatches with the era poked but the sentinel intact");
});

test("DISPATCHED once the sentinel is corrupt", { skip: SKIP }, () => {
  const s = session(ERA_AND_CORRUPT);
  assert.ok(s.hits > 0, "the poked run must reach the arm, or every arm below is vacuous");
  assert.notEqual(s.entry, null, "an entry must have been captured");
  console.log(`  DISPATCHED: ${s.hits} time(s) with ${hex4(SENTINEL)} zeroed`);
});

test("IDENTICAL REFUSAL: both arms throw the same thing and neither writes", { skip: SKIP }, () => {
  const a = attempt(oracle);
  const b = attempt(loc_315b);
  assert.notEqual(a.message, null, "the frozen original must refuse to enter the data table");
  assert.equal(b.message, a.message, "the rewrite must refuse in exactly the same way");
  const d = firstStateDiff(a.dump, b.dump, (off) => a.machine.stateOffsetToAddr(off));
  assert.equal(d, null, `state diverged before the refusal — ${hex4(d?.addr ?? 0)}`);
  console.log(`  REFUSAL: both arms threw the same message; state identical`);
});

/** BUG: swallows the transfer, so nothing refuses. */
function brokenNoOp() {}

/** BUG: transfers into real code instead of the data table. */
function brokenElsewhere(m) {
  return m.call(SOMEWHERE_ELSE);
}

/** BUG: refuses, but for a reason of its own rather than by arriving where it should. */
function brokenOwnError() {
  throw new Error("a refusal this routine did not earn");
}

for (const [label, twin] of [
  ["no-op", brokenNoOp],
  ["transfers-elsewhere", brokenElsewhere],
  ["invents-its-own-refusal", brokenOwnError],
]) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip: SKIP }, () => {
    const a = attempt(oracle);
    const b = attempt(twin);
    const sameMessage = a.message === b.message;
    const d = firstStateDiff(a.dump, b.dump, (off) => a.machine.stateOffsetToAddr(off));
    assert.ok(!sameMessage || d !== null, `the gate PASSED the ${label} twin — it has no teeth`);
    console.log(`  TEETH/${label}: caught — message ${sameMessage ? "matched" : "differed"}, ` +
      `state ${d ? "differed at " + hex4(d.addr ?? 0) : "identical"}`);
  });
}
