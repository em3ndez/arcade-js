// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for spawnBoardObject (ROM 0x27DA) — the cadence-gated board-object
 * spawn allocator.
 *
 * sub_27da is a periodic allocator: while SPAWN_TIMER (0x62A7) is nonzero it just ticks
 * the timer down; on the beat (timer == 0) it scans the six records of OBJ_ARRAY_66
 * (0x6600, stride 0x10) for the first whose active bit is clear, seeds it (active flag,
 * X, Y, and the +0x0D state field), reloads the timer to 0x34, and ticks it once — while
 * if every slot is busy it gives up WITHOUT touching the timer. Its whole memory-
 * observable effect is those cells; nothing a caller consumes is returned.
 *
 * The oracle only POPS the stack on every path (the `jp`/fall-through into the ROM 0x2806
 * decrement tail, and the no-slot `ret`, all pop the caller's return address; nothing is
 * ever pushed). So no stack byte is written differently between the two sides and NO
 * stack-scratch exclusion is needed — the diff is the whole RAM dump (work + sprite +
 * video). The idiomatic routine models no stack (a plain return + a direct decrementByteAt
 * call), so pc/SP are not compared; the memory-equivalence contract is memory-only.
 *
 * The one register live-in is the record stride `de`; the sole caller (ROM 0x2722) passes
 * the array's stride 0x10, so the crafted entries pin `de = 0x10` on the oracle side to
 * match the idiomatic routine's fixed stride.
 *
 * This cascade is never reached in plain attract (ROM 0x2722 / 0x27DA / 0x2806 dispatch 0
 * times across thousands of attract frames), so validation is EXHAUSTIVE-over-input +
 * CRAFTED rather than captured dispatches:
 *
 *   1. EQUAL (exhaustive occupancy) — timer 0, five slots busy, the first slot's active
 *      byte swept over all 256 values: even (bit0 clear) seeds it, odd skips to a full
 *      array (no spawn). Oracle vs candidate, RAM identical. A proof over the free-test.
 *   2. EQUAL (exhaustive timer) — all six slots busy, the timer swept over all 256 values:
 *      nonzero ticks down, zero is the no-free-slot no-op (timer untouched). RAM identical.
 *   3. EQUAL (crafted) — seed each of the six slot positions in turn (first-free wins,
 *      proving the scan order and that occupied slots are skipped), the all-busy give-up,
 *      a free slot carrying stray high bits (bit0 clear still frees it, and the seed sets
 *      the byte to exactly 0x01), and two free slots (the lower index wins). Non-vacuity:
 *      each spawn case is asserted (via the oracle) to have actually seeded the slot and
 *      landed the timer at 0x33; the give-up case to have left everything untouched.
 *   4. TEETH — three broken twins the SAME sweeps must catch:
 *        (a) wrong reload (0x33 not 0x34) — caught on a spawn case at SPAWN_TIMER.
 *        (b) inverted free-test (treats busy as free) — caught by the occupancy sweep.
 *        (c) dropped +0x0D seed — caught on a spawn case at the slot's +0x0D field.
 *   5. REACHABILITY — a real attract run, confirming 0x27DA is not naturally dispatched
 *      (documenting why we rely on exhaustive+crafted) and validating any dispatch that
 *      does occur, so the gate stays honest if the game ever reaches it.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-27da.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_27da as oracle } from "../../translated/loc_27da.js";
import { spawnBoardObject } from "../spawnBoardObject.js";
import { decrementByteAt } from "../decrementByteAt.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { SPAWN_TIMER, OBJ_ARRAY_66, OBJ_ACTIVE, OBJ_X, OBJ_Y } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x27da;
// The oracle's terminal `ret`/tail pops the stack; point SP at work RAM so those pops read
// valid bytes (never I/O). The oracle writes no RAM through the stack (only pops), and this
// address is away from every cell the sweeps touch, so it never affects the compared RAM.
const SAFE_SP = 0x6bf8;
// The record stride the real caller (ROM 0x2722) passes in `de` — the array's stride.
const STRIDE = 0x10;
// Seed constants the oracle stamps into a claimed slot (kept here to assert non-vacuity).
const OBJ_INIT_STATE = 0x0d;
const SEED_X = 0x37;
const SEED_Y = 0xf8;
const SEED_STATE = 0x08;
const TIMER_RELOAD = 0x34;      // reloaded on spawn, then ticked once -> 0x33
const TIMER_AFTER_SPAWN = 0x33;
const OCCUPIED = 0x01;          // an active byte with bit0 set = slot busy
const FREE = 0x00;              // bit0 clear = slot free
const ACTIVE_ONE = 0x01;        // value a freshly-claimed slot's active byte is set to (bit0, others cleared)

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const slotBase = (i) => OBJ_ARRAY_66 + i * STRIDE;

// A real, self-consistent machine: boot + a stretch of attract so RAM holds realistic
// values. The spawn body is never reached here; the entries are crafted by poking.
function attractBase(frames = 180) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone(); // clone neutralises the frame machinery (nextNmi/nextBoundary = Infinity)
}

/**
 * A crafted entry: a clone of `base` with the spawn timer set, the six slots' active bytes
 * set, the stride live-in pinned, a safe stack, and the frame machinery neutralised so the
 * oracle's `m.step` cannot fire an NMI or push a frame while running in isolation. When
 * `noiseSlot` is given, that slot's X/Y/+0x0D fields are pre-filled with 0xAA so a correct
 * seed (which overwrites them) is visible in the diff.
 */
function craft(base, { timer, slots, noiseSlot = -1 }) {
  const e = base.clone();
  e.mem.write8(SPAWN_TIMER, timer);
  for (let i = 0; i < 6; i++) e.mem.write8(slotBase(i) + OBJ_ACTIVE, slots[i]);
  if (noiseSlot >= 0) {
    e.mem.write8(slotBase(noiseSlot) + OBJ_X, 0xaa);
    e.mem.write8(slotBase(noiseSlot) + OBJ_Y, 0xaa);
    e.mem.write8(slotBase(noiseSlot) + OBJ_INIT_STATE, 0xaa);
  }
  e.regs.de = STRIDE;
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/** Run the ORACLE on a fresh clone of a crafted entry (a leaf w.r.t. the compared RAM). */
function runOracle(entry) {
  const c = entry.clone();
  oracle(c);
  return c;
}

/**
 * Run the oracle and a candidate on two FRESH, byte-identical clones of `entry` and diff
 * the whole RAM dump (memory-equivalence contract; no stack-scratch exclusion — the oracle
 * writes no stack). A fresh clone per side because the routine WRITES memory.
 */
function diffPair(entry, candidate) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

// -- 1. EQUAL (exhaustive occupancy) ------------------------------------------
//
// timer 0, slots 1..5 busy; slot 0's active byte swept over all 256 values. Even values
// (bit0 clear) free slot 0 and spawn there; odd values leave the whole array busy (no
// spawn). Every value must match the oracle — a proof over the free-test decision.

function occupancySweep(base, candidate) {
  let count = 0;
  for (let byte = 0; byte < 256; byte++) {
    const entry = craft(base, { timer: 0, slots: [byte, OCCUPIED, OCCUPIED, OCCUPIED, OCCUPIED, OCCUPIED] });
    const ram = diffPair(entry, candidate);
    count++;
    if (ram) return { mismatch: { byte, ram }, count };
  }
  return { mismatch: null, count };
}

test("EQUAL (exhaustive occupancy): spawnBoardObject == oracle over all 256 free-test values", () => {
  const base = attractBase();
  const { mismatch, count } = occupancySweep(base, spawnBoardObject);
  assert.equal(
    mismatch,
    null,
    mismatch && `slot0 active=${hx(mismatch.byte)}: RAM diverges at ${hx(mismatch.ram.addr ?? 0)} (${mismatch.ram.a}->${mismatch.ram.b})`,
  );
  assert.equal(count, 256, "must have compared the whole 256-value free-test input space");
  console.log(`  EQUAL/occupancy: ${count} slot0-byte values — RAM identical to the oracle`);
});

// -- 2. EQUAL (exhaustive timer) ----------------------------------------------
//
// all six slots busy; the timer swept over all 256 values. Nonzero -> tick down; zero ->
// the no-free-slot no-op (the timer is deliberately NOT decremented). Every value matches.

function timerSweep(base, candidate) {
  let count = 0;
  const busy = [OCCUPIED, OCCUPIED, OCCUPIED, OCCUPIED, OCCUPIED, OCCUPIED];
  for (let t = 0; t < 256; t++) {
    const entry = craft(base, { timer: t, slots: busy });
    const ram = diffPair(entry, candidate);
    count++;
    if (ram) return { mismatch: { t, ram }, count };
  }
  return { mismatch: null, count };
}

test("EQUAL (exhaustive timer): spawnBoardObject == oracle over all 256 timer values", () => {
  const base = attractBase();
  const { mismatch, count } = timerSweep(base, spawnBoardObject);
  assert.equal(
    mismatch,
    null,
    mismatch && `timer=${hx(mismatch.t)}: RAM diverges at ${hx(mismatch.ram.addr ?? 0)} (${mismatch.ram.a}->${mismatch.ram.b})`,
  );
  assert.equal(count, 256, "must have compared the whole 256-value timer input space");
  // Non-vacuity: the timer==0/all-busy case is the no-op path (timer stays 0).
  const noOp = runOracle(craft(base, { timer: 0, slots: [OCCUPIED, OCCUPIED, OCCUPIED, OCCUPIED, OCCUPIED, OCCUPIED] }));
  assert.equal(noOp.mem.read8(SPAWN_TIMER), 0, "no-free-slot path must leave the timer untouched");
  console.log(`  EQUAL/timer: ${count} timer values — RAM identical (incl. the no-free-slot no-op)`);
});

// -- 3. EQUAL (crafted first-free, give-up, overwrite) ------------------------

test("EQUAL (crafted): first-free scan, all-busy give-up, and the seed overwrite match the oracle", () => {
  const base = attractBase();

  // Seed each of the six positions in turn: slot j free, all others busy -> spawn at j.
  for (let j = 0; j < 6; j++) {
    const slots = [OCCUPIED, OCCUPIED, OCCUPIED, OCCUPIED, OCCUPIED, OCCUPIED];
    slots[j] = FREE;
    const entry = craft(base, { timer: 0, slots, noiseSlot: j });
    const ram = diffPair(entry, spawnBoardObject);
    assert.equal(ram, null, ram && `spawn at slot ${j}: RAM diverges at ${hx(ram.addr ?? 0)} (${ram.a}->${ram.b})`);

    // Non-vacuity: the oracle really seeded slot j and landed the timer at 0x33.
    const after = runOracle(entry);
    assert.equal(after.mem.read8(slotBase(j) + OBJ_ACTIVE), ACTIVE_ONE, `slot ${j}: active flag not set to 0x01`);
    assert.equal(after.mem.read8(slotBase(j) + OBJ_X), SEED_X, `slot ${j}: X not seeded`);
    assert.equal(after.mem.read8(slotBase(j) + OBJ_Y), SEED_Y, `slot ${j}: Y not seeded`);
    assert.equal(after.mem.read8(slotBase(j) + OBJ_INIT_STATE), SEED_STATE, `slot ${j}: +0x0D state not seeded`);
    assert.equal(after.mem.read8(SPAWN_TIMER), TIMER_AFTER_SPAWN, `slot ${j}: timer not reloaded-then-ticked to 0x33`);
  }

  // First-free wins: slots 0 and 3 free -> only slot 0 is claimed.
  {
    const entry = craft(base, { timer: 0, slots: [FREE, OCCUPIED, OCCUPIED, FREE, OCCUPIED, OCCUPIED] });
    const ram = diffPair(entry, spawnBoardObject);
    assert.equal(ram, null, ram && `two-free: RAM diverges at ${hx(ram.addr ?? 0)} (${ram.a}->${ram.b})`);
    const after = runOracle(entry);
    assert.equal(after.mem.read8(slotBase(0) + OBJ_ACTIVE), ACTIVE_ONE, "two-free: slot 0 should be claimed");
    assert.equal(after.mem.read8(slotBase(3) + OBJ_ACTIVE), FREE, "two-free: slot 3 must be left free");
  }

  // Free slot with stray high bits (bit0 clear) is still free, and the seed sets it to 0x01.
  {
    const entry = craft(base, { timer: 0, slots: [0xfe, OCCUPIED, OCCUPIED, OCCUPIED, OCCUPIED, OCCUPIED] });
    const ram = diffPair(entry, spawnBoardObject);
    assert.equal(ram, null, ram && `high-bits-free: RAM diverges at ${hx(ram.addr ?? 0)} (${ram.a}->${ram.b})`);
    assert.equal(runOracle(entry).mem.read8(slotBase(0) + OBJ_ACTIVE), ACTIVE_ONE, "high-bits slot must be seeded to exactly 0x01");
  }

  // All six busy: no spawn, and nothing at all is written (timer stays 0).
  {
    const entry = craft(base, { timer: 0, slots: [OCCUPIED, OCCUPIED, OCCUPIED, OCCUPIED, OCCUPIED, OCCUPIED] });
    const ram = diffPair(entry, spawnBoardObject);
    assert.equal(ram, null, ram && `all-busy: RAM diverges at ${hx(ram.addr ?? 0)} (${ram.a}->${ram.b})`);
    const before = entry.dumpState();
    const after = runOracle(entry).dumpState();
    assert.deepEqual(after, before, "all-busy give-up must write nothing");
  }

  console.log("  EQUAL/crafted: six first-free positions, two-free, high-bits, all-busy give-up — identical to the oracle");
});

// -- 4. TEETH -----------------------------------------------------------------

/** BUG (a): reloads the timer to 0x33 instead of 0x34 (spawn path lands one lower). */
function brokenReload(m) {
  const { mem } = m;
  if (mem.read8(SPAWN_TIMER) !== 0) { decrementByteAt(m, SPAWN_TIMER); return; }
  let slot = OBJ_ARRAY_66, free = false;
  for (let i = 0; i < 6; i++) { if ((mem.read8(slot + OBJ_ACTIVE) & 0x01) === 0) { free = true; break; } slot += STRIDE; }
  if (!free) return;
  mem.write8(slot + OBJ_ACTIVE, 0x01);
  mem.write8(slot + OBJ_X, SEED_X);
  mem.write8(slot + OBJ_Y, SEED_Y);
  mem.write8(slot + OBJ_INIT_STATE, SEED_STATE);
  mem.write8(SPAWN_TIMER, 0x33); // BUG: should reload 0x34
  decrementByteAt(m, SPAWN_TIMER);
}

/** BUG (b): inverts the free-test — treats a busy slot (bit0 set) as free. */
function brokenFreeTest(m) {
  const { mem } = m;
  if (mem.read8(SPAWN_TIMER) !== 0) { decrementByteAt(m, SPAWN_TIMER); return; }
  let slot = OBJ_ARRAY_66, free = false;
  for (let i = 0; i < 6; i++) { if ((mem.read8(slot + OBJ_ACTIVE) & 0x01) !== 0) { free = true; break; } slot += STRIDE; } // BUG
  if (!free) return;
  mem.write8(slot + OBJ_ACTIVE, 0x01);
  mem.write8(slot + OBJ_X, SEED_X);
  mem.write8(slot + OBJ_Y, SEED_Y);
  mem.write8(slot + OBJ_INIT_STATE, SEED_STATE);
  mem.write8(SPAWN_TIMER, TIMER_RELOAD);
  decrementByteAt(m, SPAWN_TIMER);
}

/** BUG (c): drops the +0x0D seed write. */
function brokenDropField(m) {
  const { mem } = m;
  if (mem.read8(SPAWN_TIMER) !== 0) { decrementByteAt(m, SPAWN_TIMER); return; }
  let slot = OBJ_ARRAY_66, free = false;
  for (let i = 0; i < 6; i++) { if ((mem.read8(slot + OBJ_ACTIVE) & 0x01) === 0) { free = true; break; } slot += STRIDE; }
  if (!free) return;
  mem.write8(slot + OBJ_ACTIVE, 0x01);
  mem.write8(slot + OBJ_X, SEED_X);
  mem.write8(slot + OBJ_Y, SEED_Y);
  // BUG: the +0x0D state write is dropped
  mem.write8(SPAWN_TIMER, TIMER_RELOAD);
  decrementByteAt(m, SPAWN_TIMER);
}

test("TEETH: wrong-reload, inverted-free-test, and dropped-seed twins are all CAUGHT", () => {
  const base = attractBase();
  const spawnEntry = () => craft(base, { timer: 0, slots: [FREE, OCCUPIED, OCCUPIED, OCCUPIED, OCCUPIED, OCCUPIED], noiseSlot: 0 });

  // (a) wrong reload -> diverges at SPAWN_TIMER (0x33 vs the correct 0x32... i.e. 0x33 seen).
  const aRam = diffPair(spawnEntry(), brokenReload);
  assert.notEqual(aRam, null, "the wrong-reload twin escaped — the gate is worthless");
  assert.equal(aRam.addr, SPAWN_TIMER, `expected the reload diff at ${hx(SPAWN_TIMER)}, got ${hx(aRam.addr ?? 0)}`);

  // (b) inverted free-test -> caught by the occupancy sweep.
  const { mismatch: bMiss } = occupancySweep(base, brokenFreeTest);
  assert.notEqual(bMiss, null, "the inverted-free-test twin escaped the occupancy sweep — worthless");

  // (c) dropped +0x0D seed -> diverges at the slot's +0x0D field.
  const cRam = diffPair(spawnEntry(), brokenDropField);
  assert.notEqual(cRam, null, "the dropped-seed twin escaped — the gate is worthless");
  assert.equal(cRam.addr, slotBase(0) + OBJ_INIT_STATE, `expected the dropped-seed diff at ${hx(slotBase(0) + OBJ_INIT_STATE)}, got ${hx(cRam.addr ?? 0)}`);

  console.log(`  TEETH: wrong-reload caught @${hx(aRam.addr)}; inverted-free-test caught @slot0-byte ${hx(bMiss.byte)}; dropped-seed caught @${hx(cRam.addr)}`);
});

// -- 5. REACHABILITY (real attract) -------------------------------------------

test("REACHABILITY: 0x27DA in a real attract run — validate any natural dispatch", () => {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => {
    if (caps.length < 64) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(2000);

  for (const cap of caps) {
    const ram = diffPair(cap, spawnBoardObject);
    assert.equal(ram, null, ram && `real dispatch diverges at ${hx(ram.addr ?? 0)} (${ram.a}->${ram.b})`);
  }
  // 0 is expected — the spawn cascade is not exercised in attract; the exhaustive and
  // crafted sweeps carry the proof. Any dispatch that DOES occur is validated above.
  console.log(`  REACHABILITY: ${caps.length} natural 0x27DA dispatches in 2000 attract frames (proof carried by exhaustive+crafted)`);
});
