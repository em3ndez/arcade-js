// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for stepMoverUp (ROM 0x3476, The Pit) — the "direction 0"
 * preset move-step the per-object move driver (stepEnemyMover) tail-jumps into. It
 * decreases the object's X position (0x8086) by one every call, ticks the movement-
 * cadence countdown (0x808b), and on the frame that countdown expires reloads it
 * from the period byte (0x8091) and republishes the travel-direction index (0x8092)
 * to 0. From this entry the shared body's sprite-orientation branch is unreachable
 * (this preset carries no orientation flag), so it is not modelled.
 *
 * THE CONTRACT IS RAM-ONLY. The idiomatic routine is a plain JS function — it does
 * not model the Z80 return, so its pc/SP differ from the oracle (which rets), and
 * the accumulator the oracle leaves (the new X) is dead ABI (the driver reaches
 * here by tail-jump and reads no register back). So, like its mover-region siblings
 * reseedMoverCadenceAndRearmState/advanceDormantMover, the gate compares the declared live-out — work RAM
 * via dumpState — and excludes pc/SP/registers. This routine has NO stack push (a
 * pure leaf with a single ret), so there is no dead stack-scratch window to skip
 * either; the whole RAM dump is compared byte-for-byte.
 *
 * FIVE checks:
 *   1. EQUAL + SCOPE (real captured attract dispatches) — this entry IS dispatched
 *      in attract (always on the running path); clone the machine at each real
 *      entry, run the oracle and stepMoverUp on independent clones, confirm identical
 *      work RAM, and confirm the oracle only ever writes {0x808b, 0x8086, 0x8092}.
 *   2. EXHAUSTIVE (cadence x position) — over all 65,536 (countdown, X) pairs with a
 *      fixed reload period, poked identically on both sides, work RAM matches the
 *      oracle. This sweeps the running tick, the countdown wrap (0 -> 255), the
 *      expire beat (countdown == 1 -> reload + publish direction), and the X wrap.
 *   3. RELOAD SWEEP — forcing the expire beat, over all 256 reload-period values the
 *      reloaded countdown equals the period and work RAM matches the oracle.
 *   4/5. TEETH — three broken twins (wrong X delta, skipped reload on expire, wrong
 *      published direction) MUST each be caught, at the byte they corrupt.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3476.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3476 as oracle } from "../../translated/loc_3476.js";
import { stepMoverUp } from "../stepMoverUp.js";
import { makeMachineFactory } from "../../machine.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x3476;
const CADENCE = 0x808b; // movement-cadence countdown (MOVER_CADENCE), ticked every call
const RELOAD = 0x8091; // period the countdown is reloaded from on expiry
const DIRECTION = 0x8092; // published travel-direction index (this preset stamps 0)
const POSITION = 0x8086; // the object's X position, stepped -1 every call
const EXPECTED_WRITES = new Set([CADENCE, POSITION, DIRECTION]);
// A fixed SP high in scratch so the oracle's ret reads a stable (harmless) cell as
// it is re-run in place across a sweep. Nothing writes the stack here.
const SP_ANCHOR = 0x8780;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Clone the running attract machine each time it enters 0x3476 — a genuine in-play
 * entry state. The wrapper snapshots, then runs the oracle so attract proceeds.
 */
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

/** A base attract machine to craft sweep entries from. */
function baseAttractState(startFrame) {
  const m = makeMachine();
  m.runFrames(startFrame);
  return m.clone();
}

/** The declared contract: work RAM via dumpState. First difference, or null. */
function contractDiff(oracleM, otherM) {
  const da = oracleM.dumpState();
  const db = otherM.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = oracleM.stateOffsetToAddr(i);
    return `RAM@${hx(addr ?? 0)} oracle=${da[i]} other=${db[i]}`;
  }
  return null;
}

/** Poke the three input bytes (and a stable SP) that fully determine this entry. */
function prime(m, cadence, reload, position) {
  m.mem.write8(CADENCE, cadence);
  m.mem.write8(RELOAD, reload);
  m.mem.write8(POSITION, position);
  m.regs.sp = SP_ANCHOR;
}

// -- 1. EQUAL + SCOPE on real captured attract dispatches ---------------------

test("EQUAL + SCOPE: stepMoverUp == oracle on real attract dispatches; oracle writes only its three bytes", () => {
  const caps = captureRealEntries(3000, 12);
  assert.ok(caps.length >= 1, "expected 0x3476 to be dispatched during attract");

  for (const cap of caps) {
    // SCOPE: the oracle only ever writes the cadence / position / direction bytes.
    const oracleM = cap.clone();
    const before = oracleM.dumpState();
    oracle(oracleM);
    const after = oracleM.dumpState();
    for (let i = 0; i < before.length; i++) {
      if (before[i] === after[i]) continue;
      const addr = oracleM.stateOffsetToAddr(i);
      assert.ok(
        EXPECTED_WRITES.has(addr),
        `oracle wrote an unexpected address ${hx(addr ?? 0)} (${before[i]}->${after[i]})`,
      );
    }

    // EQUAL: idiomatic reproduces the oracle over work RAM.
    const idioM = cap.clone();
    stepMoverUp(idioM);
    const diff = contractDiff(oracleM, idioM);
    assert.equal(diff, null, diff && `contract mismatch on a real attract dispatch: ${diff}`);
  }
  console.log(`  EQUAL/scope: ${caps.length} real attract dispatches — work RAM identical, oracle wrote only its three bytes`);
});

// -- 2. EXHAUSTIVE over (cadence countdown, X position) -----------------------

test("EXHAUSTIVE: over all 65,536 (countdown, X) pairs the touched work RAM matches the oracle", () => {
  const entry = baseAttractState(200);
  const oracleM = entry.clone();
  const idioM = entry.clone();
  const FIXED_RELOAD = 0x50;

  let checked = 0;
  let sawRun = false; // countdown does not expire this call
  let sawExpire = false; // countdown reaches zero -> reload + publish direction
  let sawCountdownWrap = false; // countdown was 0 -> wraps to 255, still running
  let sawPosWrap = false; // X was 0 -> wraps to 255

  for (let cadence = 0; cadence < 256; cadence++) {
    for (let position = 0; position < 256; position++) {
      prime(oracleM, cadence, FIXED_RELOAD, position);
      prime(idioM, cadence, FIXED_RELOAD, position);
      oracle(oracleM);
      stepMoverUp(idioM);

      const diff = contractDiff(oracleM, idioM);
      if (diff) assert.fail(`(countdown=${hx(cadence)}, X=${hx(position)}): ${diff}`);

      if (cadence === 1) {
        sawExpire = true;
        assert.equal(idioM.mem.read8(CADENCE), FIXED_RELOAD, "expire must reload the countdown from the period");
        assert.equal(idioM.mem.read8(DIRECTION), 0, "expire must publish direction index 0");
      } else {
        sawRun = true;
      }
      if (cadence === 0) sawCountdownWrap = true;
      if (position === 0) sawPosWrap = true;
      assert.equal(idioM.mem.read8(POSITION), (position - 1) & 0xff, "X must step down one pixel every call");
      checked++;
    }
  }

  assert.equal(checked, 65536, "must have swept the full (countdown, X) domain");
  assert.ok(sawRun, "the running (non-expire) tick must have been exercised");
  assert.ok(sawExpire, "the expire -> reload + publish path must have been exercised");
  assert.ok(sawCountdownWrap, "the countdown 0 -> 255 wrap must have been exercised");
  assert.ok(sawPosWrap, "the X 0 -> 255 wrap must have been exercised");
  console.log(`  EXHAUSTIVE: all ${checked} (countdown, X) pairs agree across the running, wrap, and expire paths`);
});

// -- 3. RELOAD SWEEP: the expire beat copies every period value ---------------

test("RELOAD: on the expire beat, over all 256 period values the reloaded countdown matches the oracle", () => {
  const entry = baseAttractState(220);
  const oracleM = entry.clone();
  const idioM = entry.clone();
  const FIXED_POS = 0x40;

  let checked = 0;
  for (let reload = 0; reload < 256; reload++) {
    prime(oracleM, 1, reload, FIXED_POS); // countdown == 1 forces the expire beat
    prime(idioM, 1, reload, FIXED_POS);
    oracle(oracleM);
    stepMoverUp(idioM);

    const diff = contractDiff(oracleM, idioM);
    assert.equal(diff, null, diff && `reload=${hx(reload)}: ${diff}`);
    assert.equal(idioM.mem.read8(CADENCE), reload, `reload=${hx(reload)}: countdown not reloaded to the period`);
    checked++;
  }
  assert.equal(checked, 256, "must have swept every reload-period value");
  console.log(`  RELOAD: all ${checked} period values copied into the countdown, identical to the oracle`);
});

// -- 4/5. TEETH: broken twins the gate MUST catch -----------------------------

/** Twin A: wrong move delta — steps X UP one instead of down. */
function twinWrongDelta(m) {
  const { mem8 } = m;
  const cadence = mem8[CADENCE] - 1;
  mem8[CADENCE] = cadence;
  if (cadence === 0) {
    mem8[CADENCE] = mem8[RELOAD];
    mem8[DIRECTION] = 0;
  }
  mem8[POSITION] = mem8[POSITION] + 1; // BUG: should be -1
}

/** Twin B: on the expire beat, forgets to reload the countdown (leaves it at 0). */
function twinNoReload(m) {
  const { mem8 } = m;
  const cadence = mem8[CADENCE] - 1;
  mem8[CADENCE] = cadence;
  if (cadence === 0) {
    // BUG: reload of the countdown is missing
    mem8[DIRECTION] = 0;
  }
  mem8[POSITION] = mem8[POSITION] - 1;
}

/** Twin C: on the expire beat, publishes the wrong travel-direction index. */
function twinWrongDirection(m) {
  const { mem8 } = m;
  const cadence = mem8[CADENCE] - 1;
  mem8[CADENCE] = cadence;
  if (cadence === 0) {
    mem8[CADENCE] = mem8[RELOAD];
    mem8[DIRECTION] = 1; // BUG: this preset publishes 0
  }
  mem8[POSITION] = mem8[POSITION] - 1;
}

test("TEETH: a wrong X delta is CAUGHT at the position byte", () => {
  const cap = baseAttractState(200);
  prime(cap, 4, 0x50, 0x40); // running path; X 0x40 -> oracle 0x3f, twin 0x41
  const a = cap.clone();
  const b = cap.clone();
  oracle(a);
  twinWrongDelta(b);
  const diff = contractDiff(a, b);
  assert.notEqual(diff, null, "the gate FAILED to catch a wrong X delta — it is worthless");
  assert.ok(diff.startsWith(`RAM@${hx(POSITION)}`), `teeth caught the wrong thing: ${diff} (expected ${hx(POSITION)})`);
  console.log(`  TEETH: wrong X delta caught (${diff})`);
});

test("TEETH: skipping the reload on the expire beat is CAUGHT at the countdown byte", () => {
  const cap = baseAttractState(200);
  prime(cap, 1, 0x50, 0x40); // expire beat; oracle reloads to 0x50, twin leaves 0
  const a = cap.clone();
  const b = cap.clone();
  oracle(a);
  twinNoReload(b);
  const diff = contractDiff(a, b);
  assert.notEqual(diff, null, "the gate FAILED to catch a skipped reload — it is worthless");
  assert.ok(diff.startsWith(`RAM@${hx(CADENCE)}`), `teeth caught the wrong thing: ${diff} (expected ${hx(CADENCE)})`);
  console.log(`  TEETH: skipped reload caught (${diff})`);
});

test("TEETH: publishing the wrong travel direction is CAUGHT at the direction byte", () => {
  const cap = baseAttractState(200);
  cap.mem.write8(DIRECTION, 7); // ensure the wrong stamp is observable vs the oracle's 0
  prime(cap, 1, 0x50, 0x40); // expire beat -> oracle stamps 0, twin stamps 1
  const a = cap.clone();
  const b = cap.clone();
  oracle(a);
  twinWrongDirection(b);
  const diff = contractDiff(a, b);
  assert.notEqual(diff, null, "the gate FAILED to catch a wrong published direction — it is worthless");
  assert.ok(diff.startsWith(`RAM@${hx(DIRECTION)}`), `teeth caught the wrong thing: ${diff} (expected ${hx(DIRECTION)})`);
  console.log(`  TEETH: wrong published direction caught (${diff})`);
});
