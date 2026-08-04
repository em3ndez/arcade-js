// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for serviceVblankNmi (ROM 0x0066) — the per-frame vblank
 * interrupt service (acknowledge, credit watchdog, sound-ring dequeue, sprite blit,
 * frame timers, input debounce, coin/credit banking).
 *
 * CONTRACT. The routine's whole effect is memory: the dequeued/cleared sound-ring slot,
 * the 32-byte hardware sprite RAM blit (0x9840..), the frame timers, the debounced input
 * latches, and the coin/credit bytes. It swaps to the Z80 shadow register set on entry
 * and swaps back on exit, so it restores every caller register — nothing is live out to
 * the interrupted code. The gate therefore diffs OBSERVABLE RAM only (dumpState), never
 * the value registers, pc or SP. The idiomatic routine models the handler's return as a
 * plain JS return (no stack pop); the oracle pops the NMI return address the machine
 * pushed before entry, but a pop writes no memory and both sides leave that pushed
 * address in place, so the RAM diff needs no stack-scratch exclusion here.
 *
 * REACHABILITY. The vblank NMI is dispatched every frame, so its entry is captured
 * directly from a real attract run (the override hook clones the machine at each 0x0066
 * dispatch). The coin-edge tail paths (cold reset 0x01a4, credit screen 0x021c, start
 * game 0x022d) are never reached in attract — no coin is ever inserted — and hand off to
 * routines with their own gates, so they are not exercised here. The two arms attract may
 * not naturally hit on the captured frames — a pending sound in the ring, and a frame
 * timer at 1 about to reload — are covered with crafted entries poked identically on both
 * sides.
 *
 * Checks:
 *   0. HARNESS — capture real 0x0066 entries and confirm the oracle run is deterministic.
 *   1. EQUAL (real entries) — serviceVblankNmi == oracle over dumpState across every
 *      captured attract entry, plus positive checks (sprite blit, timer tick, input roll).
 *   2. EQUAL (crafted pending sound) — a queued command is dequeued, the slot cleared and
 *      the read index advanced, identically.
 *   3. EQUAL (crafted timer reload) — a divider at 1 rolls over, reloads 60 and moves its
 *      paired counter, identically.
 *   4. TEETH (sprite blit) — a twin that mis-writes hardware sprite RAM is CAUGHT.
 *   5. TEETH (frame timer) — a twin that mis-writes the frame-wait countdown is CAUGHT.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-0066.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0066 as oracle } from "../../translated/loc_0066.js";
import { serviceVblankNmi as idiomatic } from "../serviceVblankNmi.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import {
  FRAME_WAIT_COUNTDOWN,
  PLAY_PHASE_COUNTER,
  IN1_PREV,
  SOUND_HEAD,
  SOUND_RING,
  SPRITE_STAGING_BASE,
} from "../names.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x0066;
const READ_INDEX = 0x801f; // sound-ring consume index (no names.js name yet)
const DIVIDER_A = 0x8006; // 60-frame divider that borrows from 0x800f
const DIVIDER_B = 0x8007; // 60-frame divider that bumps PLAY_PHASE_COUNTER
const SPRITE_RAM = 0x9840; // hardware sprite RAM (blit destination)
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/**
 * Hook the vblank NMI (0x0066) in a real attract run and clone the machine at spaced
 * dispatches — genuine per-frame entry states (valid stack with the pushed NMI return
 * address, in-play timers, ring pointers and coin accumulators). The wrapper snapshots
 * then runs the oracle so attract proceeds undisturbed.
 */
function captureNmiEntries(maxFrames, count, stride) {
  const entries = [];
  let seen = 0;
  const snapshot = new Map([[TARGET, (mm) => {
    if (entries.length < count && seen % stride === 0) entries.push(mm.clone());
    seen += 1;
    return oracle(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return entries;
}

/** First differing observable-RAM byte between two machines (dumpState), or null. */
function ramDiff(a, b) {
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/** Run the oracle and the candidate on independent clones of `entry`; return their RAM diff. */
function diffAgainstOracle(entry, candidate) {
  const o = entry.clone();
  oracle(o);
  const c = entry.clone();
  candidate(c);
  return ramDiff(o, c);
}

// -- 0. HARNESS (reachability + determinism) ---------------------------------

test("HARNESS: real 0x0066 entries are captured and the oracle run is deterministic", () => {
  const entries = captureNmiEntries(1500, 30, 37);
  assert.ok(entries.length > 0, "expected the vblank NMI 0x0066 to be dispatched during attract");

  const first = entries[0];
  const a = first.clone();
  oracle(a);
  const b = first.clone();
  oracle(b);
  const d = ramDiff(a, b);
  assert.equal(d, null, d && `oracle run not deterministic: diff at ${hx(d.addr ?? 0)}`);
  console.log(
    `  HARNESS: captured ${entries.length} real 0x0066 entries ` +
      `(SP=${hx(first.regs.sp)}); oracle run deterministic`,
  );
});

// -- 1. EQUAL over every captured attract entry ------------------------------

test("EQUAL (real entries): serviceVblankNmi == oracle over observable RAM", () => {
  const entries = captureNmiEntries(1500, 30, 37);
  assert.ok(entries.length > 0, "need captured 0x0066 entries");

  for (let i = 0; i < entries.length; i++) {
    const d = diffAgainstOracle(entries[i], idiomatic);
    assert.equal(d, null, d && `entry ${i}: RAM diff at ${hx(d.addr ?? 0)} oracle=${d.a} cand=${d.b}`);
  }

  // Positive checks on the first entry: the routine really did its per-frame work.
  const entry = entries[0];
  const c = entry.clone();
  idiomatic(c);
  // The sprite staging buffer was blitted into hardware sprite RAM (32 bytes).
  for (let i = 0; i < 32; i++) {
    assert.equal(
      c.mem.read8(SPRITE_RAM + i),
      entry.mem.read8(SPRITE_STAGING_BASE + i),
      `sprite blit byte ${i} not copied`,
    );
  }
  // The per-frame busy-wait countdown ticked down by one (mod 256).
  assert.equal(
    c.mem.read8(FRAME_WAIT_COUNTDOWN),
    (entry.mem.read8(FRAME_WAIT_COUNTDOWN) - 1) & 0xff,
    "frame-wait countdown did not tick",
  );
  // The coin/start port's previous sample was rolled forward.
  assert.equal(c.mem.read8(IN1_PREV), entry.mem.read8(0xa800), "IN1 previous sample not rolled");
  console.log(`  EQUAL/real: ${entries.length} captured entries identical over observable RAM`);
});

// -- 2. EQUAL: crafted pending sound in the ring -----------------------------

test("EQUAL (crafted pending sound): the queued command is dequeued and cleared, identically", () => {
  const [seed] = captureNmiEntries(1500, 1, 1);
  assert.ok(seed, "need a captured 0x0066 entry to craft from");

  const readIndex = 2;
  const slotAddr = SOUND_RING + readIndex;
  const command = 0x80 | 5; // pending marker + command index

  const entry = seed.clone();
  entry.mem.write8(READ_INDEX, readIndex);
  entry.mem.write8(SOUND_HEAD, (readIndex + 3) & 7); // head != read index -> ring not empty
  entry.mem.write8(slotAddr, command);

  const d = diffAgainstOracle(entry, idiomatic);
  assert.equal(d, null, d && `crafted-sound RAM diff at ${hx(d.addr ?? 0)} oracle=${d.a} cand=${d.b}`);

  const c = entry.clone();
  idiomatic(c);
  assert.equal(c.mem.read8(slotAddr), 0, "consumed ring slot not cleared");
  assert.equal(c.mem.read8(READ_INDEX), (readIndex + 1) & 7, "read index not advanced");
  console.log(`  EQUAL/pending-sound: slot ${readIndex} cleared, read index -> ${(readIndex + 1) & 7}`);
});

// -- 3. EQUAL: crafted timer rollover ----------------------------------------

test("EQUAL (crafted timer reload): both dividers roll over, reload 60 and move their counters, identically", () => {
  const [seed] = captureNmiEntries(1500, 1, 1);
  assert.ok(seed, "need a captured 0x0066 entry to craft from");

  const entry = seed.clone();
  entry.mem.write8(DIVIDER_A, 1); // about to expire -> reload + decrement 0x800f
  entry.mem.write8(DIVIDER_B, 1); // about to expire -> reload + increment PLAY_PHASE_COUNTER

  const d = diffAgainstOracle(entry, idiomatic);
  assert.equal(d, null, d && `crafted-timer RAM diff at ${hx(d.addr ?? 0)} oracle=${d.a} cand=${d.b}`);

  const c = entry.clone();
  idiomatic(c);
  assert.equal(c.mem.read8(DIVIDER_A), 60, "divider A did not reload");
  assert.equal(c.mem.read8(DIVIDER_B), 60, "divider B did not reload");
  assert.equal(c.mem.read8(0x800f), (entry.mem.read8(0x800f) - 1) & 0xff, "0x800f not decremented on rollover");
  assert.equal(c.mem.read8(PLAY_PHASE_COUNTER), (entry.mem.read8(PLAY_PHASE_COUNTER) + 1) & 0xff, "PLAY_PHASE_COUNTER not incremented");
  console.log("  EQUAL/timer-reload: both 60-frame dividers reloaded and moved their paired counters");
});

// -- 4. TEETH: a wrong sprite blit is caught ---------------------------------

/** Broken twin: the correct routine, then one WRONG store into hardware sprite RAM. */
function twinBadSpriteBlit(m) {
  idiomatic(m);
  m.mem.write8(SPRITE_RAM, m.mem.read8(SPRITE_RAM) ^ 0xff);
}

test("TEETH (sprite blit): a twin that mis-writes hardware sprite RAM is CAUGHT", () => {
  const [entry] = captureNmiEntries(1500, 1, 1);
  assert.ok(entry, "need a captured 0x0066 entry for the teeth check");

  const d = diffAgainstOracle(entry, twinBadSpriteBlit);
  assert.ok(d, "the gate FAILED to catch a wrong sprite blit — it proves nothing");
  assert.equal(d.addr, SPRITE_RAM, `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(SPRITE_RAM)})`);
  console.log(`  TEETH/sprite: wrong sprite blit caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

// -- 5. TEETH: a wrong frame timer is caught ---------------------------------

/** Broken twin: the correct routine, then one WRONG store into the frame-wait countdown. */
function twinBadFrameTimer(m) {
  idiomatic(m);
  m.mem.write8(FRAME_WAIT_COUNTDOWN, m.mem.read8(FRAME_WAIT_COUNTDOWN) ^ 0xff);
}

test("TEETH (frame timer): a twin that mis-writes the frame-wait countdown is CAUGHT", () => {
  const [entry] = captureNmiEntries(1500, 1, 1);
  assert.ok(entry, "need a captured 0x0066 entry for the teeth check");

  const d = diffAgainstOracle(entry, twinBadFrameTimer);
  assert.ok(d, "the gate FAILED to catch a wrong frame timer — it proves nothing");
  assert.equal(d.addr, FRAME_WAIT_COUNTDOWN, `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(FRAME_WAIT_COUNTDOWN)})`);
  console.log(`  TEETH/timer: wrong frame-wait countdown caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});
