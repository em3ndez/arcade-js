// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for requestSound12 (ROM 0x4c7f) — the sound-trigger stub that
 * requests sound-command 12 by handing it to the shared sound-ring enqueue.
 *
 * The stub's whole effect is memory: the command (high bit set to mark it pending) lands
 * in the ring slot at SOUND_HEAD and the write pointer advances to the next of 8 slots,
 * wrapping after the eighth. Its declared live-out is MEMORY-ONLY — the filled slot and
 * the advanced pointer — so the gate compares exactly that OBSERVABLE effect (the sound
 * ring + its write pointer). It does NOT compare pc/SP or the value registers the oracle
 * leaves behind: the idiomatic path is a plain JS call that never runs the Z80 ret, so
 * those are dead scratch the honest-signature contract deliberately ignores.
 *
 * WHY A CRAFTED ENTRY. Attract requests other sound commands but never command 12, so
 * 0x4c7f is never dispatched — the capture/replay harness cannot hook it directly. Per
 * the crafted-entry method the gate instead runs the stub from a REAL captured sound-
 * request state: the sibling stub 0x4c57 (command 2) IS reached during attract, and every
 * sibling shares the same call convention, so its entry state is a faithful state for
 * command 12 too. Crucially 0x4c7f never calls 0x4c57, so cloning that entry introduces no
 * registry recursion. The one input that shapes the output — the ring write pointer — is
 * then swept across all of 0..7 by poking SOUND_HEAD identically on both sides, which also
 * pins the 7 -> 0 wrap.
 *
 * Five checks:
 *   0. HARNESS — capture a real 0x4c57 sound-request entry and confirm the oracle run of
 *      0x4c7f produces a deterministic observable effect (oracle vs oracle -> identical
 *      ring + pointer). Proves the capture/clone/diff plumbing reaches a real state.
 *   1. EQUAL (real sound-request entry) — requestSound12 == oracle over the ring slot and
 *      the advanced write pointer, and that slot holds the pending command.
 *   2. EQUAL (crafted pointer sweep 0..7) — with SOUND_HEAD forced to each of 0..7, both
 *      write that slot with the pending command and advance/wrap the pointer, identical.
 *   3. TEETH (wrong command) — a twin that requests command 13 instead of 12 is CAUGHT at
 *      the ring slot (this stub's payload is the index, exactly what the mutation attacks).
 *   4. TEETH (missing pending bit) — a twin that queues 12 without the pending high bit is
 *      CAUGHT at the ring slot (an unmarked slot reads as empty to the driver).
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4c7f.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4c7f as oracle } from "../../translated/loc_4c7f.js";
import { requestSound12 as idiomatic } from "../requestSound12.js";
import { loc_4c57 as siblingStub } from "../../translated/loc_4c57.js";
import { makeMachineFactory } from "../../machine.js";
import { SOUND_HEAD, SOUND_RING } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const CAPTURE_AT = 0x4c57; // sibling sound stub — a real sound-request entry, reached in attract
const COMMAND = 12; // the sound-command index this stub requests (oracle: ld a,0x0c)
const PENDING = COMMAND | 0x80; // 0x8c — the byte queued (high bit marks the slot pending)
const RING_SLOTS = 8;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/**
 * Hook the sibling sound stub 0x4c57 in a real attract run and clone the machine at its
 * first dispatch — a genuine sound-request state (valid stack with a return address, an
 * in-play ring pointer). The wrapper snapshots then runs the oracle so attract proceeds.
 */
function captureRealSoundRequestEntry(maxFrames) {
  let entry = null;
  const snapshot = new Map([[CAPTURE_AT, (mm) => {
    if (entry === null) entry = mm.clone();
    return siblingStub(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return entry;
}

/**
 * The OBSERVABLE effect of a sound request: the 8 ring slots (SOUND_RING) and the write
 * pointer (SOUND_HEAD). Returns the first differing byte between two machines, or null if
 * their ring + pointer are identical. This is the whole memory-equivalence contract for
 * this stub — pc, SP, and the value registers are excluded, because the idiomatic path is
 * a plain JS call that never runs the Z80 ret and so leaves those as dead scratch.
 */
function ringDiff(a, b) {
  for (let i = 0; i < RING_SLOTS; i++) {
    const addr = SOUND_RING + i;
    const av = a.mem.read8(addr);
    const bv = b.mem.read8(addr);
    if (av !== bv) return { addr, a: av, b: bv };
  }
  const ah = a.mem.read8(SOUND_HEAD);
  const bh = b.mem.read8(SOUND_HEAD);
  if (ah !== bh) return { addr: SOUND_HEAD, a: ah, b: bh };
  return null;
}

/**
 * Run the oracle and a candidate on independent clones of one entry and diff their
 * observable effect (ring + pointer). Returns the first differing byte, or null == EQUAL.
 */
function observableDiff(entry, fn) {
  const o = entry.clone();
  oracle(o);
  const c = entry.clone();
  fn(c);
  return ringDiff(o, c);
}

// -- 0. HARNESS (reachability + determinism) ---------------------------------

test("HARNESS: a real 0x4c57 sound-request entry is captured and the oracle's observable effect is deterministic", () => {
  const entry = captureRealSoundRequestEntry(1500);
  assert.ok(entry, "expected the sibling sound stub 0x4c57 to be dispatched during attract");

  // Two independent oracle runs must leave the same ring + pointer.
  const diff = observableDiff(entry, oracle);
  assert.equal(diff, null, diff && `oracle observable effect not deterministic at ${hx(diff.addr)}`);
  console.log(
    `  HARNESS: captured a real 0x4c57 entry (SP=${hx(entry.regs.sp)}, ` +
      `SOUND_HEAD=${entry.mem.read8(SOUND_HEAD)}); oracle run of 0x4c7f has a deterministic ring effect`,
  );
});

// -- 1. EQUAL on the real captured sound-request entry -----------------------

test("EQUAL (real entry): requestSound12 == oracle over the ring slot + write pointer", () => {
  const entry = captureRealSoundRequestEntry(1500);
  assert.ok(entry, "need a captured 0x4c57 entry");
  const head = entry.mem.read8(SOUND_HEAD);

  const diff = observableDiff(entry, idiomatic);
  assert.equal(diff, null, diff && `RAM@${hx(diff.addr)} oracle=${diff.a} cand=${diff.b}`);

  // Positive checks: the slot really was filled with the pending command and the pointer advanced.
  const c = entry.clone();
  idiomatic(c);
  assert.equal(c.mem.read8(SOUND_RING + head), PENDING, `ring slot ${head} not filled with the pending command`);
  assert.equal(c.mem.read8(SOUND_HEAD), (head + 1) % 8, `write pointer did not advance from ${head}`);
  console.log(`  EQUAL/real: identical over ring+pointer; slot ${head} = ${hx(PENDING)}, pointer -> ${(head + 1) % 8}`);
});

// -- 2. EQUAL across a crafted sweep of every ring write pointer 0..7 ---------

test("EQUAL (pointer sweep 0..7): every slot is written and the pointer advances/wraps, identical", () => {
  const seed = captureRealSoundRequestEntry(1500);
  assert.ok(seed, "need a captured 0x4c57 entry to craft the sweep from");

  for (let head = 0; head < 8; head++) {
    const entry = seed.clone();
    entry.mem.write8(SOUND_HEAD, head); // poke the pointer identically on both sides (observableDiff clones this)

    const diff = observableDiff(entry, idiomatic);
    assert.equal(diff, null, diff && `head=${head}: RAM@${hx(diff.addr)} oracle=${diff.a} cand=${diff.b}`);

    const c = entry.clone(); // c already carries head (cloned from entry after the poke)
    idiomatic(c);
    assert.equal(c.mem.read8(SOUND_RING + head), PENDING, `head=${head}: slot ${head} not filled`);
    assert.equal(c.mem.read8(SOUND_HEAD), (head + 1) % 8, `head=${head}: pointer did not advance/wrap`);
  }
  console.log("  EQUAL/sweep: pointers 0..7 all write the pending command and advance (7 -> 0 wrap), identical to the oracle");
});

// -- 3. TEETH: a wrong-command twin is caught --------------------------------

/** Broken twin: requests command 13 (a neighbour's index) instead of 12. */
function twinWrongCommand(m) {
  const { mem } = m;
  const slot = mem.read8(SOUND_HEAD);
  mem.write8(SOUND_HEAD, (slot + 1) % 8);
  mem.write8(SOUND_RING + slot, 13 | 0x80); // BUG: wrong sound-command index
}

/** Broken twin: queues command 12 but WITHOUT the pending high bit (slot reads as empty). */
function twinNoPendingBit(m) {
  const { mem } = m;
  const slot = mem.read8(SOUND_HEAD);
  mem.write8(SOUND_HEAD, (slot + 1) % 8);
  mem.write8(SOUND_RING + slot, COMMAND); // BUG: high bit not set
}

test("TEETH (wrong command): a twin that requests command 13 is CAUGHT at the ring slot", () => {
  const entry = captureRealSoundRequestEntry(1500);
  assert.ok(entry, "need a captured 0x4c57 entry to seed the teeth check");
  const head = entry.mem.read8(SOUND_HEAD);

  const ram = observableDiff(entry, twinWrongCommand);
  assert.ok(ram, "the gate FAILED to catch the wrong-command twin — it proves nothing");
  assert.equal(
    ram.addr,
    SOUND_RING + head,
    `teeth caught the wrong address ${hx(ram.addr)} (expected ${hx(SOUND_RING + head)})`,
  );
  console.log(`  TEETH/command: wrong-command twin caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

// -- 4. TEETH: a missing-pending-bit twin is caught --------------------------

test("TEETH (missing pending bit): a twin that drops the pending high bit is CAUGHT at the ring slot", () => {
  const entry = captureRealSoundRequestEntry(1500);
  assert.ok(entry, "need a captured 0x4c57 entry to seed the teeth check");
  const head = entry.mem.read8(SOUND_HEAD);

  const ram = observableDiff(entry, twinNoPendingBit);
  assert.ok(ram, "the gate FAILED to catch the missing-high-bit twin — it proves nothing");
  assert.equal(
    ram.addr,
    SOUND_RING + head,
    `teeth caught the wrong address ${hx(ram.addr)} (expected ${hx(SOUND_RING + head)})`,
  );
  console.log(`  TEETH/highbit: missing-high-bit twin caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});
