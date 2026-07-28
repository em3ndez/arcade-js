// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for stepMoverMirrored (ROM 0x347d, The Pit) — one of the four
 * fixed-velocity entries into the shared object-mover body. This entry carries a zero
 * horizontal step, direction index 1, and refreshes the walk sprite (always mirrored).
 *
 * Every call ticks the object's per-step cadence counter (0x808b). On the beat it
 * reaches zero the routine reloads the counter from its period (0x8091), publishes the
 * direction index (0x8092 = 1), advances the orientation accumulator (0x8083), picks one
 * of four walk-frame sprite codes and mirrors it into the walk sprite byte (0x8084). Its
 * horizontal position byte (0x8086) is deliberately untouched — the horizontal step is
 * zero — which the oracle confirms by writing the same value back (no net change).
 *
 * WHY THIS ISN'T unitEquivalence, and why it is CRAFTED. Two facts shape the gate:
 *   1. UNREACHED IN ATTRACT. stepMoverMirrored is dispatched only from the gameplay mover
 *      dispatcher (stepEnemyMover tail-jumps here); hooking 0x347d over 2500 attract frames
 *      yields zero dispatches. So there is no natural entry for the shared harness to
 *      snapshot — the gate instead captures real attract machine states and pokes the
 *      mover inputs identically on both sides (the crafted-entry method).
 *   2. NEAR-LEAF WITH DEAD WORKING REGISTERS. The routine's declared live-out is memory
 *      only; the accumulator the oracle leaves behind is the object's unchanged position
 *      value, dead ABI. So the contract is a RAM-only diff (dumpState) — pc, SP and the
 *      value registers/flags are excluded, exactly the case the pipeline calls for. The
 *      oracle returns by popping the stack (a read, no RAM write), so there is no dead
 *      stack-push window to exclude either.
 *
 * FIVE checks:
 *   0. HARNESS — capture real attract states and confirm the oracle run is deterministic.
 *   1. EQUAL + SCOPE (real attract states) — stepMoverMirrored == oracle over RAM, and the oracle
 *      writes only within {0x808b, 0x8092, 0x8083, 0x8084}.
 *   2. EQUAL (crafted, both counter paths) — with the counter forced still-counting and
 *      forced to expire, both sides leave identical RAM; the positive values (reload,
 *      published direction, mirrored sprite) land as expected.
 *   3. EQUAL (crafted orientation sweep 0..255) — on the cadence beat, over every
 *      orientation-accumulator value the written bytes match the oracle (all four walk
 *      frames + the accumulator wrap).
 *   4. TEETH — a twin that drops the sprite mirror and a twin that publishes the wrong
 *      direction index MUST both be caught, at their exact addresses.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-347d.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_347d as oracle } from "../../translated/loc_347d.js";
import { stepMoverMirrored } from "../stepMoverMirrored.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { MOVER_CADENCE, ACTOR_STATE } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const RELOAD_PERIOD = 0x8091; // cadence-reload value (read only)
const DIR_INDEX = 0x8092; // published direction index (this entry = 1)
const ORIENT_ACC = 0x8083; // orientation/walk-phase accumulator
const POSITION = 0x8086; // horizontal position (untouched — zero step)
const EXPECTED_WRITES = new Set([MOVER_CADENCE, DIR_INDEX, ORIENT_ACC, ACTOR_STATE]);
// The stored walk sprite code for a given (post-increment) accumulator value: pick one
// of four frames by bits 1-2 of (acc+4), then mirror (high bit).
const WALK_FRAMES = [0x17, 0x14, 0x15, 0x16];
const expectedSprite = (acc) => WALK_FRAMES[(((acc + 1) & 0xff) + 4 & 6) >> 1] ^ 0x80;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Real attract machine states: run the game and clone it at a spread of frames. Each
 * clone is a genuine in-play machine (valid stack + registers) safe to run the oracle on.
 */
function captureStates(count, stride, startFrame) {
  const m = makeMachine();
  m.runFrames(startFrame);
  const caps = [];
  for (let i = 0; i < count; i++) {
    m.runFrames(stride);
    caps.push(m.clone());
  }
  return caps;
}

/** RAM-only contract diff (dumpState). Registers/pc/SP are the dropped ABI. */
function ramDiff(oracleM, otherM) {
  return firstStateDiff(oracleM.dumpState(), otherM.dumpState(), (off) => oracleM.stateOffsetToAddr(off));
}

// -- 0. HARNESS (reachability + determinism) ---------------------------------

test("HARNESS: real attract states captured and the oracle run of stepMoverMirrored is deterministic", () => {
  const caps = captureStates(4, 120, 120);
  assert.ok(caps.length >= 1, "expected at least one captured attract state");
  const a = caps[0].clone();
  oracle(a);
  const b = caps[0].clone();
  oracle(b);
  const d = ramDiff(a, b);
  assert.equal(d, null, d && `oracle run not deterministic: diff at ${hx(d.addr ?? 0)}`);
  console.log(`  HARNESS: ${caps.length} real attract states; oracle run of 0x347d deterministic`);
});

// -- 1. EQUAL + SCOPE on real captured attract states ------------------------

test("EQUAL + SCOPE: stepMoverMirrored == oracle on real attract states; oracle writes only its four bytes", () => {
  const caps = captureStates(8, 90, 90);
  assert.ok(caps.length >= 1, "expected captured attract states");

  for (const cap of caps) {
    // SCOPE: the oracle writes only within the declared set.
    const oracleClone = cap.clone();
    const before = oracleClone.dumpState();
    oracle(oracleClone);
    const after = oracleClone.dumpState();
    for (let i = 0; i < before.length; i++) {
      if (before[i] === after[i]) continue;
      const addr = oracleClone.stateOffsetToAddr(i);
      assert.ok(
        EXPECTED_WRITES.has(addr),
        `oracle wrote an unexpected address ${hx(addr ?? 0)} (${before[i]}->${after[i]})`,
      );
    }

    // EQUAL: idiomatic reproduces the oracle over RAM.
    const idioClone = cap.clone();
    stepMoverMirrored(idioClone);
    const diff = ramDiff(oracleClone, idioClone);
    assert.equal(diff, null, diff && `contract mismatch on a real attract state: RAM@${hx(diff.addr ?? 0)} oracle=${diff.a} idiomatic=${diff.b}`);
  }
  console.log(`  EQUAL/scope: ${caps.length} real attract states — RAM identical, oracle wrote only its four bytes`);
});

// -- 2. EQUAL across both counter paths (crafted) ----------------------------

test("EQUAL (both counter paths): still-counting and cadence-beat leave identical RAM", () => {
  const [base] = captureStates(1, 1, 200);
  assert.ok(base, "need a base attract state");

  // Still-counting path: counter well above 1, only the counter changes.
  {
    const seed = base.clone();
    seed.mem.write8(MOVER_CADENCE, 40);
    seed.mem.write8(POSITION, 0x44);
    const o = seed.clone(); oracle(o);
    const c = seed.clone(); stepMoverMirrored(c);
    const diff = ramDiff(o, c);
    assert.equal(diff, null, diff && `still-counting mismatch: RAM@${hx(diff.addr ?? 0)} oracle=${diff.a} idiomatic=${diff.b}`);
    assert.equal(c.mem.read8(MOVER_CADENCE), 39, "counter must tick down by one");
    assert.equal(c.mem.read8(POSITION), 0x44, "position must be untouched (zero horizontal step)");
  }

  // Cadence-beat path: counter at 1 -> expires; reload + publish + refresh the sprite.
  {
    const seed = base.clone();
    seed.mem.write8(MOVER_CADENCE, 1);
    seed.mem.write8(RELOAD_PERIOD, 0x37);
    seed.mem.write8(ORIENT_ACC, 0x05);
    seed.mem.write8(POSITION, 0x44);
    const o = seed.clone(); oracle(o);
    const c = seed.clone(); stepMoverMirrored(c);
    const diff = ramDiff(o, c);
    assert.equal(diff, null, diff && `cadence-beat mismatch: RAM@${hx(diff.addr ?? 0)} oracle=${diff.a} idiomatic=${diff.b}`);
    assert.equal(c.mem.read8(MOVER_CADENCE), 0x37, "counter must reload from its period");
    assert.equal(c.mem.read8(DIR_INDEX), 1, "direction index 1 must be published");
    assert.equal(c.mem.read8(ORIENT_ACC), 0x06, "orientation accumulator must advance");
    assert.equal(c.mem.read8(ACTOR_STATE), expectedSprite(0x05), "walk sprite must be the mirrored frame for this phase");
    assert.equal(c.mem.read8(POSITION), 0x44, "position must be untouched (zero horizontal step)");
  }
  console.log("  EQUAL/paths: still-counting and cadence-beat both identical to the oracle");
});

// -- 3. EQUAL across the full orientation-accumulator sweep (crafted) --------

test("EQUAL (orientation sweep 0..255): on the cadence beat every accumulator value matches the oracle", () => {
  const [base] = captureStates(1, 1, 220);
  assert.ok(base, "need a base attract state to sweep from");

  const framesSeen = new Set();
  for (let acc = 0; acc < 256; acc++) {
    const seed = base.clone();
    seed.mem.write8(MOVER_CADENCE, 1); // expire the counter so the walk-frame branch runs
    seed.mem.write8(RELOAD_PERIOD, 0x2a);
    seed.mem.write8(ORIENT_ACC, acc);
    const o = seed.clone(); oracle(o);
    const c = seed.clone(); stepMoverMirrored(c);
    const diff = ramDiff(o, c);
    assert.equal(diff, null, diff && `acc=${hx(acc)} mismatch: RAM@${hx(diff.addr ?? 0)} oracle=${diff.a} idiomatic=${diff.b}`);
    framesSeen.add(c.mem.read8(ACTOR_STATE));
  }
  assert.equal(framesSeen.size, 4, `expected all four walk frames across the sweep, saw ${framesSeen.size}`);
  console.log(`  EQUAL/sweep: 256 orientation values identical to the oracle; all four walk frames exercised`);
});

// -- 4. TEETH: broken twins the gate MUST catch ------------------------------

/** The generator of the cadence-beat effect, with a single injected bug. */
function beatTwin({ mirror = true, dir = 1 } = {}) {
  return (m) => {
    const { mem8 } = m;
    const cadence = mem8[MOVER_CADENCE] - 1;
    mem8[MOVER_CADENCE] = cadence;
    if (cadence !== 0) return;
    mem8[MOVER_CADENCE] = mem8[RELOAD_PERIOD];
    mem8[DIR_INDEX] = dir;
    mem8[ORIENT_ACC] = mem8[ORIENT_ACC] + 1;
    const walkPhase = ((mem8[ORIENT_ACC] + 4) & 6) >> 1;
    mem8[ACTOR_STATE] = WALK_FRAMES[walkPhase] ^ (mirror ? 0x80 : 0x00);
  };
}

test("TEETH (dropped mirror): a twin that stores the un-mirrored sprite is CAUGHT at 0x8084", () => {
  const [base] = captureStates(1, 1, 200);
  const seed = base.clone();
  seed.mem.write8(MOVER_CADENCE, 1);
  seed.mem.write8(ORIENT_ACC, 0x05);
  const a = seed.clone(); oracle(a);
  const b = seed.clone(); beatTwin({ mirror: false })(b);
  const diff = ramDiff(a, b);
  assert.notEqual(diff, null, "the gate FAILED to catch a dropped sprite mirror — it is worthless");
  assert.equal(diff.addr, ACTOR_STATE, `teeth caught the wrong address ${hx(diff.addr ?? 0)} (expected ${hx(ACTOR_STATE)})`);
  console.log(`  TEETH/mirror: dropped-mirror twin caught at ${hx(diff.addr)} (oracle=${diff.a} broken=${diff.b})`);
});

test("TEETH (wrong direction): a twin that publishes direction 2 is CAUGHT at 0x8092", () => {
  const [base] = captureStates(1, 1, 200);
  const seed = base.clone();
  seed.mem.write8(MOVER_CADENCE, 1);
  seed.mem.write8(ORIENT_ACC, 0x05);
  const a = seed.clone(); oracle(a);
  const b = seed.clone(); beatTwin({ dir: 2 })(b);
  const diff = ramDiff(a, b);
  assert.notEqual(diff, null, "the gate FAILED to catch a wrong direction index — it is worthless");
  assert.equal(diff.addr, DIR_INDEX, `teeth caught the wrong address ${hx(diff.addr ?? 0)} (expected ${hx(DIR_INDEX)})`);
  console.log(`  TEETH/direction: wrong-direction twin caught at ${hx(diff.addr)} (oracle=${diff.a} broken=${diff.b})`);
});
