// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_316f (ROM 0x316f) — the object-2 half of the two-object
 * mover pass: stage object 2's record into the shared mover scratch, step the mover on it,
 * copy it back, stage object 2's sprite (three bytes verbatim + a coordinate-biased fourth),
 * then tail into the shared per-frame actor update.
 *
 * CONTRACT. The routine's declared live-out is MEMORY-ONLY — object 2's record, the mover's
 * writes, and the four staged sprite bytes. It is reached by tail-jump and continues by
 * tail-jump, so no caller reads a value register back; the gate compares work RAM (dumpState)
 * and excludes the Z80 pc/SP/value-registers the honest-signature rewrite does not preserve.
 *
 * THE TAIL IS STUBBED IDENTICALLY. loc_316f's last act is a tail-jump into the shared actor
 * update 0x3748, which — for the phase object 2 always runs at — drives a long round-boundary
 * chain that resets the stack. That chain is 0x3748's job, not loc_316f's, and it leaves the
 * four staged sprite bytes untouched, so the gate replaces 0x3748 with an identical no-op on
 * BOTH clones (the blessed tail-stub technique) to isolate the mover's own work. The mover
 * (loc_319d) itself runs for real on both sides — it is loc_316f's direct callee, part of the
 * work under test — the oracle arm through the frozen registry copy, the idiomatic arm through
 * the imported idiomatic function; they are memory-equivalent.
 *
 * ONE WRINKLE — the oracle marshals its mover call through the Z80 stack, parking a couple of
 * dead return/save bytes just below the entry stack pointer that the stack-free idiomatic JS
 * does not reproduce (measured: three bytes at entrySP-4..entrySP-2, nothing in the observable
 * work-RAM region below 0x8300). Those are classic dead stack scratch, so the RAM diff excludes
 * a window just below the entry stack pointer and compares everything else byte-for-byte.
 *
 * THE BIAS IS ZERO IN ATTRACT, so the coordinate-bias arm of the fourth sprite byte is exercised
 * by a crafted entry that pokes a nonzero SPRITE_COORD_BIAS identically on both sides.
 *
 * Checks:
 *   0. HARNESS — capture real 0x316f attract dispatches; the oracle run is deterministic.
 *   1. EQUAL (real dispatches) — loc_316f == oracle over RAM on every captured entry, with a
 *      positive check that the staged sprite is object 2's record bytes (+ zero bias).
 *   2. EQUAL (crafted nonzero bias) — with SPRITE_COORD_BIAS poked nonzero the fourth sprite
 *      byte still matches the oracle, and equals record[3] + bias.
 *   3. TEETH (corrupted sprite byte) — a twin that flips a staged sprite byte is CAUGHT.
 *   4. TEETH (dropped coordinate bias) — from the nonzero-bias entry, a twin that stages the
 *      fourth byte without the bias is CAUGHT at that byte.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-316f.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_316f as oracle } from "../../translated/loc_316f.js";
import { loc_316f as idiomatic } from "../loc_316f.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { OBJ2_X, SPRITE_COORD_BIAS, SPRITE_STAGING_BASE } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x316f;
const ACTOR_UPDATE_TAIL = 0x3748; // the shared actor update loc_316f tail-jumps into
const OBJ2_SPRITE_RECORD = SPRITE_STAGING_BASE + 20; // object 2's slot in the sprite staging buffer
// The oracle's mover call parks dead return/save bytes just below the entry stack pointer; the
// stack-free idiomatic JS does not. Nothing observable lives in this window (all work RAM the
// routine touches is below 0x8300; the stack is at 0x83xx).
const DEAD_STACK_DEPTH = 128;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/** Hook 0x316f in a real attract run and clone the machine at each dispatch (up to `limit`) —
 *  genuine in-play object-2 mover states. The wrapper runs the oracle so attract proceeds. */
function captureRealEntries(maxFrames, limit) {
  const caps = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (caps.length < limit) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return caps;
}

/** Clone `entry`, replace the tail actor-update with an identical no-op, run `fn`, and return
 *  the resulting machine — so loc_316f's own work is compared without dragging in 0x3748. */
function runStubbed(entry, fn) {
  const c = entry.clone();
  c.routines.set(ACTOR_UPDATE_TAIL, () => {});
  fn(c);
  return c;
}

/** First differing RAM byte between two machines (full dumpState), EXCLUDING the dead stack
 *  scratch just below the entry stack pointer. Null when otherwise identical. */
function ramDiff(a, b, entrySP) {
  const da = a.dumpState();
  const db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= entrySP - DEAD_STACK_DEPTH && addr < entrySP) continue; // dead stack scratch
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/** RAM diff between the oracle run and `fn`'s run from `entry` (tail stubbed on both), or null. */
function ramDiffVsOracle(entry, fn) {
  const sp = entry.regs.sp;
  const o = runStubbed(entry, oracle);
  const c = runStubbed(entry, fn);
  return ramDiff(o, c, sp);
}

// -- 0. HARNESS (reachability + determinism) ---------------------------------

test("HARNESS: real 0x316f attract dispatches are captured and the oracle run is deterministic", () => {
  const caps = captureRealEntries(4000, 40);
  assert.ok(caps.length >= 1, "expected 0x316f (object 2) to be dispatched during attract");

  for (const cap of caps.slice(0, 8)) {
    const a = runStubbed(cap, oracle);
    const b = runStubbed(cap, oracle);
    const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(d, null, d && `oracle run not deterministic: diff at ${hx(d.addr ?? 0)}`);
  }
  console.log(
    `  HARNESS: captured ${caps.length} real 0x316f entries (first SP=${hx(caps[0].regs.sp)}); oracle run deterministic`,
  );
});

// -- 1. EQUAL on real captured attract dispatches ----------------------------

test("EQUAL (real dispatches): loc_316f == oracle over RAM on every captured entry", () => {
  const caps = captureRealEntries(4000, 200);
  assert.ok(caps.length >= 1, "need captured 0x316f entries");

  for (const cap of caps) {
    const diff = ramDiffVsOracle(cap, idiomatic);
    assert.equal(diff, null, diff && `real dispatch RAM diff at ${hx(diff.addr ?? 0)} oracle=${diff.a} cand=${diff.b}`);
  }

  // Positive check on the last capture: the staged sprite is object 2's record bytes verbatim,
  // and the fourth byte is record[3] + bias (bias is 0 in attract).
  const cap = caps[caps.length - 1];
  const c = runStubbed(cap, idiomatic);
  const bias = c.mem.read8(SPRITE_COORD_BIAS);
  for (let i = 0; i < 3; i++) {
    assert.equal(
      c.mem.read8(OBJ2_SPRITE_RECORD + i),
      c.mem.read8(OBJ2_X + i),
      `staged sprite byte ${i} must equal object-2 record byte ${i}`,
    );
  }
  assert.equal(
    c.mem.read8(OBJ2_SPRITE_RECORD + 3),
    (c.mem.read8(OBJ2_X + 3) + bias) & 0xff,
    "staged sprite byte 3 must equal record[3] + bias",
  );
  console.log(`  EQUAL/real: ${caps.length} real attract dispatches — work RAM identical to the oracle`);
});

// -- 2. EQUAL with a crafted nonzero coordinate bias -------------------------

test("EQUAL (nonzero bias): the coordinate-biased fourth sprite byte matches the oracle", () => {
  const caps = captureRealEntries(4000, 5);
  assert.ok(caps.length >= 1, "need a captured 0x316f entry to craft the bias case from");

  const BIAS = 5;
  const entry = caps[0].clone();
  entry.mem.write8(SPRITE_COORD_BIAS, BIAS); // upright play uses 0; force the bias arm

  const diff = ramDiffVsOracle(entry, idiomatic);
  assert.equal(diff, null, diff && `nonzero-bias RAM diff at ${hx(diff.addr ?? 0)} oracle=${diff.a} cand=${diff.b}`);

  const c = runStubbed(entry, idiomatic);
  assert.equal(
    c.mem.read8(OBJ2_SPRITE_RECORD + 3),
    (c.mem.read8(OBJ2_X + 3) + BIAS) & 0xff,
    "the fourth sprite byte must carry the nonzero bias",
  );
  console.log(`  EQUAL/bias: fourth sprite byte = record[3] + ${BIAS}, identical to the oracle`);
});

// -- 3. TEETH: a corrupted staged sprite byte is caught ----------------------

/** Broken twin: run the real routine, then flip the first staged sprite byte. */
function twinCorruptSprite(m) {
  idiomatic(m);
  m.mem8[OBJ2_SPRITE_RECORD] = m.mem8[OBJ2_SPRITE_RECORD] ^ 0xff;
}

test("TEETH (corrupted sprite byte): a flipped staged sprite byte is CAUGHT", () => {
  const caps = captureRealEntries(4000, 5);
  assert.ok(caps.length >= 1, "need a captured 0x316f entry to seed the teeth check");
  const entry = caps[0];

  const diff = ramDiffVsOracle(entry, twinCorruptSprite);
  assert.notEqual(diff, null, "the gate FAILED to catch the corrupted sprite byte — it proves nothing");
  assert.equal(
    diff.addr,
    OBJ2_SPRITE_RECORD,
    `teeth caught the wrong address ${hx(diff.addr ?? 0)} (expected ${hx(OBJ2_SPRITE_RECORD)})`,
  );
  console.log(`  TEETH/sprite: corrupted sprite byte caught at ${hx(diff.addr)} (oracle=${diff.a} broken=${diff.b})`);
});

// -- 4. TEETH: a dropped coordinate bias is caught ---------------------------

/** Broken twin: run the real routine, then restage the fourth sprite byte WITHOUT the bias. */
function twinDropBias(m) {
  idiomatic(m);
  m.mem8[OBJ2_SPRITE_RECORD + 3] = m.mem8[OBJ2_X + 3]; // BUG: coordinate bias dropped
}

test("TEETH (dropped bias): with a nonzero bias, an unbiased fourth byte is CAUGHT", () => {
  const caps = captureRealEntries(4000, 5);
  assert.ok(caps.length >= 1, "need a captured 0x316f entry to seed the teeth check");

  const entry = caps[0].clone();
  entry.mem.write8(SPRITE_COORD_BIAS, 5); // make the bias observable

  const diff = ramDiffVsOracle(entry, twinDropBias);
  assert.notEqual(diff, null, "the gate FAILED to catch the dropped-bias twin — it proves nothing");
  assert.equal(
    diff.addr,
    OBJ2_SPRITE_RECORD + 3,
    `teeth caught the wrong address ${hx(diff.addr ?? 0)} (expected ${hx(OBJ2_SPRITE_RECORD + 3)})`,
  );
  console.log(`  TEETH/bias: dropped-bias fourth byte caught at ${hx(diff.addr)} (oracle=${diff.a} broken=${diff.b})`);
});
