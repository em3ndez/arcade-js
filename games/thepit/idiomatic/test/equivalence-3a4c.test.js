// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for stageActorSpriteRecords (ROM 0x3a4c) — the shared
 * tail of every object mover that stages the current actor's two sprite records
 * (main body + shadow twin) into the sprite buffer.
 *
 * Its whole memory effect is a function of fixed work RAM: it copies three bytes of
 * each object record (0x810a primary, 0x811b twin) verbatim into the two sprite
 * slots (0x8238, 0x823c) and adds the shared vertical offset (0x8051) to each
 * record's fourth byte. No register live-ins, no register live-out anything reads —
 * the contract is RAM only.
 *
 * THREE checks:
 *   1. EQUAL — over the real dispatches captured from attract (the demo movers reach
 *      it from ~frame 675), idiomatic leaves RAM identical to the oracle. The source
 *      records vary widely across captures (two dozen distinct Y values), so the
 *      verbatim copy and the fourth-byte add are both exercised on real data.
 *   2. EQUAL (crafted) — attract only ever runs this with the offset (0x8051) == 0,
 *      so the real captures never exercise the bias. Poke the offset nonzero on BOTH
 *      sides and re-run: idiomatic still matches, proving the add and its byte wrap.
 *   3. TEETH — two deliberately-broken twins the gate MUST catch:
 *        (a) a wrong verbatim byte (actor slot 0x8238 XOR'd) — caught on the first
 *            real capture, naming 0x8238.
 *        (b) a bias-DROPPING twin (fourth byte copied without the offset). With the
 *            real offset 0, it is byte-identical to the correct routine, so the plain
 *            real-capture sweep does NOT catch it — that is asserted, proving the
 *            crafted entry is load-bearing — and the crafted nonzero-offset sweep
 *            DOES catch it, naming the fourth byte 0x823b.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3a4c.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3a4c as oracle } from "../../translated/loc_3a4c.js";
import { stageActorSpriteRecords } from "../stageActorSpriteRecords.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x3a4c;
const ACTOR_SLOT = 0x8238; // primary sprite record (buffer entry 6)
const TWIN_SLOT = 0x823c; // twin/shadow sprite record (buffer entry 7)
const ACTOR_SRC = 0x810a; // primary object record base
const TWIN_SRC = 0x811b; // twin object record base
const Y_OFFSET = 0x8051; // the shared vertical offset (dip-switch param)
const CAPTURE_FRAMES = 1000; // first dispatch is ~frame 675 in a plain attract run
const CAPTURE_LIMIT = 200;
const POKED_OFFSET = 0xf0; // nonzero, and large enough that (Y + offset) wraps a byte

const hx = (v) => "0x" + (v & 0xffff).toString(16);

// Async registry -> a synchronous machine factory (built once, closed over).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture the pristine machine state at each real entry of 0x3a4c during attract.
 * The hook clones the entry BEFORE the oracle runs, then delegates to the oracle so
 * the host attract loop continues undisturbed and keeps producing more dispatches.
 * 0x3a4c is reached only by tail-jumps (m.call), so the construction-time override
 * registry is what reaches it.
 */
function captureEntries(limit) {
  const entries = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (entries.length < limit) entries.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(CAPTURE_FRAMES);
  if (entries.length === 0) {
    throw new Error(`0x3a4c never entered within ${CAPTURE_FRAMES} frames`);
  }
  return entries;
}

// Captured once and reused (each run re-clones, so the captures stay pristine).
const ENTRIES = ROM_PRESENT ? captureEntries(CAPTURE_LIMIT) : [];

/** Full-RAM difference between two machines (the memory-equivalence contract). */
function ramDiff(a, b) {
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/**
 * Run the oracle and `candidate` on two fresh clones of `entry` and return the first
 * RAM difference (or null). `pokeOffset`, when given, is written to 0x8051 on BOTH
 * sides first — the crafted-entry lever that forces the bias path attract never runs.
 */
function runPair(entry, candidate, pokeOffset) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  if (pokeOffset !== undefined) {
    a.mem.write8(Y_OFFSET, pokeOffset);
    b.mem.write8(Y_OFFSET, pokeOffset);
  }
  oracle(a);
  candidate(b);
  return ramDiff(a, b);
}

/** Sweep a candidate over every captured entry; first mismatch (or null). */
function sweep(candidate, pokeOffset) {
  for (let i = 0; i < ENTRIES.length; i++) {
    const d = runPair(ENTRIES[i], candidate, pokeOffset);
    if (d) return { mismatch: d, index: i };
  }
  return { mismatch: null, index: -1 };
}

// -- 1. EQUAL over real captured dispatches -----------------------------------

test("EQUAL: stageActorSpriteRecords == oracle over every real captured dispatch", () => {
  const { mismatch } = sweep(stageActorSpriteRecords);
  assert.equal(
    mismatch,
    null,
    mismatch &&
      `RAM diverges at ${hx(mismatch.mismatch.addr ?? 0)} on capture #${mismatch.index} ` +
        `(oracle ${mismatch.mismatch.a} -> idiomatic ${mismatch.mismatch.b})`,
  );
  console.log(`  EQUAL: ${ENTRIES.length} real dispatches — RAM identical to the oracle`);
});

// -- 2. EQUAL with the offset poked nonzero (exercises the bias + byte wrap) ---

test("EQUAL (crafted): with the vertical offset poked nonzero on both sides, idiomatic == oracle", () => {
  const { mismatch } = sweep(stageActorSpriteRecords, POKED_OFFSET);
  assert.equal(
    mismatch,
    null,
    mismatch &&
      `RAM diverges at ${hx(mismatch.mismatch.addr ?? 0)} with offset ${hx(POKED_OFFSET)} ` +
        `(oracle ${mismatch.mismatch.a} -> idiomatic ${mismatch.mismatch.b})`,
  );
  console.log(`  EQUAL/crafted: offset=${hx(POKED_OFFSET)} on ${ENTRIES.length} captures — idiomatic == oracle`);
});

// -- 3. TEETH: broken twins the gate must catch -------------------------------

/** BUG (a): stages correctly, then corrupts the actor slot's first byte. */
function brokenVerbatim(m) {
  stageActorSpriteRecords(m);
  m.mem.write8(ACTOR_SLOT, m.mem.read8(ACTOR_SLOT) ^ 0xff);
}

/** BUG (b): copies each record's fourth byte WITHOUT the shared offset. Identical to
 *  the correct routine whenever the offset is 0 (all of attract). */
function brokenNoBias(m) {
  const { mem } = m;
  for (const [src, dest] of [[ACTOR_SRC, ACTOR_SLOT], [TWIN_SRC, TWIN_SLOT]]) {
    mem.write8(dest, mem.read8(src));
    mem.write8(dest + 1, mem.read8(src + 1));
    mem.write8(dest + 2, mem.read8(src + 2));
    mem.write8(dest + 3, mem.read8(src + 3)); // BUG: the offset is dropped
  }
}

test("TEETH: a wrong verbatim byte is CAUGHT and names 0x8238", () => {
  const { mismatch, index } = sweep(brokenVerbatim);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong verbatim store — it is worthless");
  assert.equal(
    mismatch.addr,
    ACTOR_SLOT,
    `expected first diff at ${hx(ACTOR_SLOT)}, got ${hx(mismatch.addr ?? 0)}`,
  );
  console.log(`  TEETH/verbatim: caught on capture #${index} at ${hx(mismatch.addr)} (oracle ${mismatch.a} vs ${mismatch.b})`);
});

test("TEETH: the bias-dropping twin HIDES at offset 0 but is CAUGHT when poked nonzero (the crafted entry is load-bearing)", () => {
  // With the real offset (0 everywhere in attract), dropping the bias is invisible —
  // this asserts the plain real-capture sweep genuinely cannot see it.
  const plain = sweep(brokenNoBias);
  assert.equal(
    plain.mismatch,
    null,
    "the bias-dropping twin should be invisible at offset 0 — if this fails the captures are not offset-0 and the point is moot",
  );

  // Poke the offset nonzero on both sides and the twin diverges at the fourth byte.
  const crafted = sweep(brokenNoBias, POKED_OFFSET);
  assert.notEqual(crafted.mismatch, null, "the crafted-offset sweep FAILED to catch the dropped bias — the crafted entry proves nothing");
  assert.equal(
    crafted.mismatch.addr,
    ACTOR_SLOT + 3,
    `expected the dropped bias caught at ${hx(ACTOR_SLOT + 3)}, got ${hx(crafted.mismatch.addr ?? 0)}`,
  );
  console.log(
    `  TEETH/bias: hidden at offset 0, caught at offset ${hx(POKED_OFFSET)} — ${hx(crafted.mismatch.addr)} ` +
      `(oracle ${crafted.mismatch.a} vs ${crafted.mismatch.b})`,
  );
});
