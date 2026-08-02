// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for snapYToGirder (ROM 0x2333) — the 25m girder-slope Y snap.
 *
 * entry_2333 is a PURE LEAF and a TOTAL function of its three register-byte inputs
 * (x = H, y = L, step = B): it reads no memory, writes no memory, and calls nothing,
 * returning a corrected Y in L. So it is validated the strongest way a leaf can be —
 * EXHAUSTIVELY against the frozen oracle — not by a whole-machine trace:
 *
 *   1. EQUAL (exhaustive) — snapYToGirder == oracle over all 131,072 (x,y,step)
 *      combos: the full 256x256 (x,y) grid for BOTH step classes ({1} = the `dec b`
 *      zero arm, {0} = the non-zero arm, at its dec-underflow edge). step's value
 *      only reaches behaviour through `step == 1`, so two classes cover the (x,y) grid.
 *
 *   2. EQUAL (step breadth) — because claim above must be PROVEN, not assumed: sweep
 *      ALL 256 step bytes over a curated (x,y) edge set (every low-nibble boundary,
 *      the 0x80 / 0x98 x-seams, and the y == 0xF0 / 0x4C rails + bit-5 samples), each
 *      compared to the oracle. Confirms no step value beyond `== 1` changes the output.
 *
 *   3. TEETH (exhaustive) — a deliberately-broken twin (reads bit 4 of y instead of
 *      bit 5 for the slope direction) MUST be caught by the same exhaustive sweep.
 *
 *   4. REALISM + PURITY (captured dispatches) — hook 0x2333 in a real attract run,
 *      capture the true (H,L,B) states the game feeds it on 25m, and for each confirm
 *      (a) the oracle writes NO memory (justifying the pure signature) and (b)
 *      snapYToGirder reproduces the oracle's returned L.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2333.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2333 as oracle } from "../../translated/loc_2333.js";
import { snapYToGirder } from "../snapYToGirder.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2333;

/**
 * Run the frozen oracle for one (x,y,step) and return its corrected Y.
 *
 * The machine is reused across every combo: the oracle writes NO memory, so nothing
 * accumulates. It is a clone() so its frame machinery is neutralised (nextNmi /
 * nextBoundary = Infinity) — otherwise an m.step during the call could trip the
 * boundary/NMI at cycle 0. SP is reset into work RAM each call so the trailing
 * `ret`'s stack pop reads valid bytes and never drifts into I/O space.
 */
function runOracleY(m, x, y, step) {
  const { regs } = m;
  regs.h = x;
  regs.l = y;
  regs.b = step;
  regs.sp = 0x6bfe;
  oracle(m);
  return regs.l & 0xff;
}

/**
 * Compare a candidate against the oracle over the full 256x256 (x,y) grid for each
 * `step` in `steps`. Returns the first mismatch (or null) and the combo count.
 */
function sweep(candidate, steps) {
  const m = new Machine(ROM).clone();
  let count = 0;
  for (const step of steps) {
    for (let x = 0; x < 256; x++) {
      for (let y = 0; y < 256; y++) {
        const want = runOracleY(m, x, y, step);
        const got = candidate(x, y, step) & 0xff;
        count++;
        if (got !== want) return { mismatch: { x, y, step, want, got }, count };
      }
    }
  }
  return { mismatch: null, count };
}

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): snapYToGirder == oracle over all 131,072 (x,y,step) combos", () => {
  const { mismatch, count } = sweep(snapYToGirder, [1, 0]);
  assert.equal(
    mismatch,
    null,
    mismatch &&
      `mismatch at x=${hx(mismatch.x)} y=${hx(mismatch.y)} step=${hx(mismatch.step)}: ` +
        `oracle=${hx(mismatch.want)} snap=${hx(mismatch.got)}`,
  );
  assert.equal(count, 256 * 256 * 2, "must have compared the full 131,072-combo grid");
  console.log(`  EQUAL/exhaustive: ${count} (x,y,step) combos identical to the oracle`);
});

// -- 2. EQUAL (step breadth) --------------------------------------------------

test("EQUAL (step breadth): all 256 step bytes match the oracle on curated (x,y) edges", () => {
  // x edges: every low-nibble boundary value, the 0x80 (bit 7) and 0x98 x-seams.
  const XS = [0x00, 0x01, 0x0e, 0x0f, 0x10, 0x40, 0x7f, 0x80, 0x8f, 0x90, 0x97, 0x98, 0x99, 0xb3, 0xff];
  // y edges: the two band-seam rails, plus bit-5 clear/set samples and the extremes.
  const YS = [0x00, 0x1f, 0x20, 0x2a, 0x4b, 0x4c, 0x4d, 0x6b, 0x6f, 0x7f, 0x80, 0xdf, 0xef, 0xf0, 0xf1, 0xff];

  const m = new Machine(ROM).clone();
  let count = 0;
  let mismatch = null;
  for (let step = 0; step < 256 && !mismatch; step++) {
    for (const x of XS) {
      for (const y of YS) {
        const want = runOracleY(m, x, y, step);
        const got = snapYToGirder(x, y, step) & 0xff;
        count++;
        if (got !== want) {
          mismatch = { x, y, step, want, got };
          break;
        }
      }
      if (mismatch) break;
    }
  }
  assert.equal(
    mismatch,
    null,
    mismatch &&
      `mismatch at x=${hx(mismatch.x)} y=${hx(mismatch.y)} step=${hx(mismatch.step)}: ` +
        `oracle=${hx(mismatch.want)} snap=${hx(mismatch.got)}`,
  );
  console.log(`  EQUAL/step-breadth: ${count} combos over all 256 step values identical to the oracle`);
});

// -- 3. TEETH (exhaustive) ----------------------------------------------------

/**
 * Broken twin: reads bit 4 of y (mask 0x10) instead of bit 5 (0x20) for the general
 * slope direction — a plausible off-by-one-bit bug. It agrees with the oracle on many
 * inputs, so only a real sweep catches it.
 */
function brokenSnapYToGirder(x, y, step) {
  const stepIsOne = ((step - 1) & 0xff) === 0;
  const lowNibble = x & 0x0f;
  let d;
  if (stepIsOne) {
    if (lowNibble >= 0x01) return y;
    d = 0x01;
  } else {
    if (lowNibble < 0x0f) return y;
    d = 0xff;
  }
  if (y === 0xf0) return (x & 0x80) ? (y - d) & 0xff : y;
  if (y === 0x4c) return x < 0x98 ? y : (y + d) & 0xff;
  return (y & 0x10) === 0 ? (y + d) & 0xff : (y - d) & 0xff; // BUG: 0x10 should be 0x20
}

test("TEETH (exhaustive): the wrong-bit twin is CAUGHT by the sweep", () => {
  const { mismatch, count } = sweep(brokenSnapYToGirder, [1, 0]);
  assert.notEqual(mismatch, null, "the exhaustive sweep FAILED to catch a wrong slope-direction bit — it is worthless");
  console.log(
    `  TEETH/exhaustive: caught after ${count} combos at x=${hx(mismatch.x)} y=${hx(mismatch.y)} ` +
      `step=${hx(mismatch.step)} (oracle=${hx(mismatch.want)} broken=${hx(mismatch.got)})`,
  );
});

// -- 4. REALISM + PURITY (captured dispatches) --------------------------------

/**
 * Hook 0x2333 in a real attract run and clone the machine at up to K real dispatches.
 * Attract plays 25m, so loc_1cd2 (and the object steppers) dispatch it while Mario
 * walks. The wrapper clones the entry state, then runs the oracle so the host game
 * proceeds undisturbed to a clean stop.
 */
function captureDispatches(K, maxFrames) {
  const caps = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snapshot });
  host.runFrames(maxFrames);
  return caps;
}

test("REALISM + PURITY: real captured 25m dispatches — oracle writes no memory, snap matches", () => {
  const caps = captureDispatches(64, 1200);
  assert.ok(caps.length >= 1, "expected at least one real 0x2333 dispatch during 25m attract");

  for (const cap of caps) {
    const x = cap.regs.h;
    const y = cap.regs.l;
    const step = cap.regs.b;

    // PURITY: run the oracle on a clone and confirm it mutated no RAM — this is what
    // licenses the pure `(x,y,step) -> newY` signature (no memory in the contract).
    const oc = cap.clone();
    const before = oc.dumpState();
    oracle(oc);
    const after = oc.dumpState();
    const d = firstStateDiff(before, after, (off) => oc.stateOffsetToAddr(off));
    assert.equal(
      d,
      null,
      d && `oracle wrote RAM at 0x${(d.addr ?? 0).toString(16)} (${d.a}->${d.b}) — signature is not pure`,
    );

    // REALISM: snapYToGirder reproduces the oracle's returned L on this real state.
    assert.equal(
      snapYToGirder(x, y, step) & 0xff,
      oc.regs.l & 0xff,
      `mismatch on real dispatch x=${hx(x)} y=${hx(y)} step=${hx(step)}`,
    );
  }
  console.log(`  REALISM/purity: ${caps.length} real 25m dispatches — no memory written, snap == oracle L`);
});
