// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for stepMoverUnmirrored (ROM 0x348b, The Pit) — one of the four
 * fixed-velocity entries into the shared object-mover body. This entry carries a zero
 * horizontal step, direction index 3, and refreshes the walk sprite un-mirrored.
 *
 * Every call ticks the object's per-step cadence counter (0x808b). On the beat it
 * reaches zero the routine reloads the counter from its period (0x8091), publishes the
 * direction index (0x8092 = 3), steps the orientation accumulator backward (0x8083),
 * picks one of four walk-frame sprite codes and stores it — with no horizontal flip —
 * into the walk sprite byte (0x8084). Its horizontal position byte (0x8086) is
 * deliberately untouched (zero step), which the oracle confirms by writing the same
 * value back (no net change).
 *
 * THE CONTRACT IS A RAM-ONLY DIFF. stepMoverUnmirrored's declared live-out is memory only: the
 * accumulator the oracle leaves behind is the object's unchanged position value, dead
 * ABI. So the gate compares RAM (dumpState) — pc, SP and the value registers/flags are
 * excluded, exactly the case the pipeline calls for. The oracle returns by popping the
 * stack (a read, no RAM write), so there is no dead stack-push window to exclude either.
 * And the routine takes no register live-in — it overwrites its own velocity/direction
 * on entry — so any real captured machine state is a valid entry for it.
 *
 * SIX checks:
 *   0. HARNESS — capture the routine's real attract dispatches and confirm the oracle
 *      run is deterministic; confirm both counter paths are exercised.
 *   1. EQUAL + SCOPE (real attract dispatches) — stepMoverUnmirrored == oracle on every real
 *      captured entry, and the oracle writes only within {0x808b, 0x8092, 0x8083, 0x8084}.
 *   2. EQUAL (crafted, both counter paths) — with the counter forced still-counting and
 *      forced to expire, both sides leave identical RAM; the positive values (reload,
 *      published direction 3, un-mirrored sprite) land as expected.
 *   3. EQUAL (crafted orientation sweep 0..255) — on the cadence beat, over every
 *      orientation-accumulator value the written bytes match the oracle (all four walk
 *      frames + the accumulator wrap).
 *   4. TEETH (added mirror) — a twin that flips the sprite's high bit MUST be caught at 0x8084.
 *   5. TEETH (wrong direction) — a twin that publishes direction 2 MUST be caught at 0x8092.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-348b.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_348b as oracle } from "../../translated/loc_348b.js";
import { stepMoverUnmirrored } from "../stepMoverUnmirrored.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { ENEMY_ACTION_TIMER, ENEMY_WORK_SPRITE } from "../names.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x348b; // this mover entry, reached in attract via stepEnemyMover's tail-jump
const RELOAD_PERIOD = 0x8091; // cadence-reload value (read only)
const DIR_INDEX = 0x8092; // published direction index (this entry = 3)
const ORIENT_ACC = 0x8083; // orientation/walk-phase accumulator (steps backward here)
const POSITION = 0x8086; // horizontal position (untouched — zero step)
const EXPECTED_WRITES = new Set([ENEMY_ACTION_TIMER, DIR_INDEX, ORIENT_ACC, ENEMY_WORK_SPRITE]);
// The stored walk sprite code for a given (pre-step) accumulator value: step the
// accumulator backward, then pick one of four frames by bits 1-2 of (acc+4); no mirror.
const WALK_FRAMES = [0x17, 0x14, 0x15, 0x16];
const expectedSprite = (acc) => WALK_FRAMES[((((acc - 1) & 0xff) + 4) & 6) >> 1];
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Real captured entries: hook 0x348b in an attract run and clone the machine at each
 * dispatch (before the oracle runs, so the game proceeds undisturbed). Every clone is
 * the precise state the mover is actually invoked with mid-play.
 */
function captureRealDispatches(maxFrames, limit = Infinity) {
  const caps = [];
  const overrides = new Map([[TARGET, (mm) => {
    if (caps.length < limit) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = makeMachine(overrides);
  host.runFrames(maxFrames);
  return caps;
}

/** A base attract state to craft sweeps from (any real machine state is a valid entry). */
function baseState(startFrame) {
  const m = makeMachine();
  m.runFrames(startFrame);
  return m.clone();
}

/** RAM-only contract diff (dumpState). Registers/pc/SP are the dropped ABI. */
function ramDiff(oracleM, otherM) {
  return firstStateDiff(oracleM.dumpState(), otherM.dumpState(), (off) => oracleM.stateOffsetToAddr(off));
}

// -- 0. HARNESS (reachability + determinism) ---------------------------------

test("HARNESS: real 0x348b dispatches captured, oracle run deterministic, both paths seen", () => {
  const caps = captureRealDispatches(1500);
  assert.ok(caps.length >= 1, "expected 0x348b to be dispatched during attract");

  const a = caps[0].clone();
  oracle(a);
  const b = caps[0].clone();
  oracle(b);
  const d = ramDiff(a, b);
  assert.equal(d, null, d && `oracle run not deterministic: diff at ${hx(d.addr ?? 0)}`);

  let stillCounting = 0;
  let cadenceBeat = 0;
  for (const cap of caps) (cap.mem.read8(ENEMY_ACTION_TIMER) === 1 ? cadenceBeat++ : stillCounting++);
  assert.ok(stillCounting > 0, "expected some still-counting dispatches");
  assert.ok(cadenceBeat > 0, "expected some cadence-beat (counter==1) dispatches");
  console.log(
    `  HARNESS: ${caps.length} real 0x348b dispatches (still-counting ${stillCounting}, ` +
      `cadence-beat ${cadenceBeat}); oracle run deterministic`,
  );
});

// -- 1. EQUAL + SCOPE on every real captured dispatch ------------------------

test("EQUAL + SCOPE: stepMoverUnmirrored == oracle on every real dispatch; oracle writes only its four bytes", () => {
  const caps = captureRealDispatches(1500);
  assert.ok(caps.length >= 1, "expected captured 0x348b dispatches");

  for (const cap of caps) {
    // SCOPE: the oracle changes only addresses within the declared set.
    const oracleClone = cap.clone();
    const before = oracleClone.dumpState();
    oracle(oracleClone);
    const after = oracleClone.dumpState();
    for (let i = 0; i < before.length; i++) {
      if (before[i] === after[i]) continue;
      const addr = oracleClone.stateOffsetToAddr(i);
      assert.ok(
        EXPECTED_WRITES.has(addr),
        `oracle changed an unexpected address ${hx(addr ?? 0)} (${before[i]}->${after[i]})`,
      );
    }

    // EQUAL: idiomatic reproduces the oracle over RAM.
    const idioClone = cap.clone();
    stepMoverUnmirrored(idioClone);
    const diff = ramDiff(oracleClone, idioClone);
    assert.equal(diff, null, diff && `contract mismatch on a real dispatch: RAM@${hx(diff.addr ?? 0)} oracle=${diff.a} idiomatic=${diff.b}`);
  }
  console.log(`  EQUAL/scope: ${caps.length} real dispatches — RAM identical, oracle changed only its four bytes`);
});

// -- 2. EQUAL across both counter paths (crafted) ----------------------------

test("EQUAL (both counter paths): still-counting and cadence-beat leave identical RAM", () => {
  const base = baseState(200);

  // Still-counting path: counter well above 1, only the counter changes.
  {
    const seed = base.clone();
    seed.mem.write8(ENEMY_ACTION_TIMER, 40);
    seed.mem.write8(POSITION, 0x44);
    const o = seed.clone(); oracle(o);
    const c = seed.clone(); stepMoverUnmirrored(c);
    const diff = ramDiff(o, c);
    assert.equal(diff, null, diff && `still-counting mismatch: RAM@${hx(diff.addr ?? 0)} oracle=${diff.a} idiomatic=${diff.b}`);
    assert.equal(c.mem.read8(ENEMY_ACTION_TIMER), 39, "counter must tick down by one");
    assert.equal(c.mem.read8(POSITION), 0x44, "position must be untouched (zero horizontal step)");
  }

  // Cadence-beat path: counter at 1 -> expires; reload + publish + refresh the sprite.
  {
    const seed = base.clone();
    seed.mem.write8(ENEMY_ACTION_TIMER, 1);
    seed.mem.write8(RELOAD_PERIOD, 0x37);
    seed.mem.write8(ORIENT_ACC, 0x05);
    seed.mem.write8(POSITION, 0x44);
    const o = seed.clone(); oracle(o);
    const c = seed.clone(); stepMoverUnmirrored(c);
    const diff = ramDiff(o, c);
    assert.equal(diff, null, diff && `cadence-beat mismatch: RAM@${hx(diff.addr ?? 0)} oracle=${diff.a} idiomatic=${diff.b}`);
    assert.equal(c.mem.read8(ENEMY_ACTION_TIMER), 0x37, "counter must reload from its period");
    assert.equal(c.mem.read8(DIR_INDEX), 3, "direction index 3 must be published");
    assert.equal(c.mem.read8(ORIENT_ACC), 0x04, "orientation accumulator must step backward");
    assert.equal(c.mem.read8(ENEMY_WORK_SPRITE), expectedSprite(0x05), "walk sprite must be the un-mirrored frame for this phase");
    assert.equal(c.mem.read8(ENEMY_WORK_SPRITE) & 0x80, 0, "walk sprite must be stored un-mirrored (high bit clear)");
    assert.equal(c.mem.read8(POSITION), 0x44, "position must be untouched (zero horizontal step)");
  }
  console.log("  EQUAL/paths: still-counting and cadence-beat both identical to the oracle");
});

// -- 3. EQUAL across the full orientation-accumulator sweep (crafted) --------

test("EQUAL (orientation sweep 0..255): on the cadence beat every accumulator value matches the oracle", () => {
  const base = baseState(220);

  const framesSeen = new Set();
  for (let acc = 0; acc < 256; acc++) {
    const seed = base.clone();
    seed.mem.write8(ENEMY_ACTION_TIMER, 1); // expire the counter so the walk-frame branch runs
    seed.mem.write8(RELOAD_PERIOD, 0x2a);
    seed.mem.write8(ORIENT_ACC, acc);
    const o = seed.clone(); oracle(o);
    const c = seed.clone(); stepMoverUnmirrored(c);
    const diff = ramDiff(o, c);
    assert.equal(diff, null, diff && `acc=${hx(acc)} mismatch: RAM@${hx(diff.addr ?? 0)} oracle=${diff.a} idiomatic=${diff.b}`);
    framesSeen.add(c.mem.read8(ENEMY_WORK_SPRITE));
  }
  assert.equal(framesSeen.size, 4, `expected all four walk frames across the sweep, saw ${framesSeen.size}`);
  console.log(`  EQUAL/sweep: 256 orientation values identical to the oracle; all four walk frames exercised`);
});

// -- 4/5. TEETH: broken twins the gate MUST catch ----------------------------

/** The cadence-beat effect of stepMoverUnmirrored, with a single injected bug. */
function beatTwin({ mirror = false, dir = 3 } = {}) {
  return (m) => {
    const { mem8 } = m;
    const cadence = mem8[ENEMY_ACTION_TIMER] - 1;
    mem8[ENEMY_ACTION_TIMER] = cadence;
    if (cadence !== 0) return;
    mem8[ENEMY_ACTION_TIMER] = mem8[RELOAD_PERIOD];
    mem8[DIR_INDEX] = dir;
    mem8[ORIENT_ACC] = mem8[ORIENT_ACC] - 1;
    const walkPhase = ((mem8[ORIENT_ACC] + 4) & 6) >> 1;
    mem8[ENEMY_WORK_SPRITE] = WALK_FRAMES[walkPhase] ^ (mirror ? 0x80 : 0x00);
  };
}

test("TEETH (added mirror): a twin that flips the sprite high bit is CAUGHT at 0x8084", () => {
  const base = baseState(200);
  const seed = base.clone();
  seed.mem.write8(ENEMY_ACTION_TIMER, 1);
  seed.mem.write8(ORIENT_ACC, 0x05);
  const a = seed.clone(); oracle(a);
  const b = seed.clone(); beatTwin({ mirror: true })(b);
  const diff = ramDiff(a, b);
  assert.notEqual(diff, null, "the gate FAILED to catch an added sprite mirror — it is worthless");
  assert.equal(diff.addr, ENEMY_WORK_SPRITE, `teeth caught the wrong address ${hx(diff.addr ?? 0)} (expected ${hx(ENEMY_WORK_SPRITE)})`);
  console.log(`  TEETH/mirror: added-mirror twin caught at ${hx(diff.addr)} (oracle=${diff.a} broken=${diff.b})`);
});

test("TEETH (wrong direction): a twin that publishes direction 2 is CAUGHT at 0x8092", () => {
  const base = baseState(200);
  const seed = base.clone();
  seed.mem.write8(ENEMY_ACTION_TIMER, 1);
  seed.mem.write8(ORIENT_ACC, 0x05);
  const a = seed.clone(); oracle(a);
  const b = seed.clone(); beatTwin({ dir: 2 })(b);
  const diff = ramDiff(a, b);
  assert.notEqual(diff, null, "the gate FAILED to catch a wrong direction index — it is worthless");
  assert.equal(diff.addr, DIR_INDEX, `teeth caught the wrong address ${hx(diff.addr ?? 0)} (expected ${hx(DIR_INDEX)})`);
  console.log(`  TEETH/direction: wrong-direction twin caught at ${hx(diff.addr)} (oracle=${diff.a} broken=${diff.b})`);
});
