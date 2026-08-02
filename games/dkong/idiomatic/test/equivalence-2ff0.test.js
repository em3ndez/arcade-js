// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for tileAddrForPixel (ROM 0x2FF0) — the pixel -> tilemap address map.
 *
 * sub_2ff0 is a PURE LEAF and a TOTAL function of its two register-byte inputs
 * (y = H, x = L): it reads no memory, writes no memory, and calls nothing, returning
 * a VRAM tile address in HL. So it is validated the strongest way a leaf can be —
 * EXHAUSTIVELY against the frozen oracle — not by a whole-machine trace:
 *
 *   1. EQUAL (exhaustive) — tileAddrForPixel == oracle HL over all 65,536 (y,x)
 *      combos: the full 256x256 grid. Nothing else is an input, so the grid is total.
 *
 *   2. TEETH (exhaustive) — a deliberately-broken twin (four `rrca` instead of three
 *      on the x divide — the exact latent bug the oracle's own header records) MUST be
 *      caught by the same exhaustive sweep. It agrees with the oracle on a subset of x,
 *      so only a real sweep catches it.
 *
 *   3. REALISM + PURITY (captured dispatches) — hook 0x2ff0 in a real attract run,
 *      capture the true (H,L) states the game feeds it, and for each confirm
 *      (a) the oracle writes NO memory (justifying the pure signature) and (b)
 *      tileAddrForPixel reproduces the oracle's returned HL.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2ff0.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2ff0 as oracle } from "../../translated/loc_2ff0.js";
import { tileAddrForPixel } from "../tileAddrForPixel.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2ff0;

/**
 * Run the frozen oracle for one (y,x) and return its computed HL (0x7400-page addr).
 *
 * The machine is reused across every combo: the oracle writes NO memory, so nothing
 * accumulates. It is a clone() so its frame machinery is neutralised (nextNmi /
 * nextBoundary = Infinity) — otherwise an m.step during the call could trip the
 * boundary/NMI at cycle 0. SP is reset into work RAM each call so the trailing
 * `ret`'s stack pop reads valid bytes and never drifts into I/O space.
 */
function runOracleHL(m, y, x) {
  const { regs } = m;
  regs.h = y;
  regs.l = x;
  regs.sp = 0x6bfe;
  oracle(m);
  return regs.hl & 0xffff;
}

/**
 * Compare a candidate against the oracle over the full 256x256 (y,x) grid.
 * Returns the first mismatch (or null) and the combo count.
 */
function sweep(candidate) {
  const m = new Machine(ROM).clone();
  let count = 0;
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const want = runOracleHL(m, y, x);
      const got = candidate(y, x) & 0xffff;
      count++;
      if (got !== want) return { mismatch: { y, x, want, got }, count };
    }
  }
  return { mismatch: null, count };
}

const hb = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");
const hw = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): tileAddrForPixel == oracle over all 65,536 (y,x) combos", () => {
  const { mismatch, count } = sweep(tileAddrForPixel);
  assert.equal(
    mismatch,
    null,
    mismatch &&
      `mismatch at y=${hb(mismatch.y)} x=${hb(mismatch.x)}: ` +
        `oracle=${hw(mismatch.want)} tile=${hw(mismatch.got)}`,
  );
  assert.equal(count, 256 * 256, "must have compared the full 65,536-combo grid");
  console.log(`  EQUAL/exhaustive: ${count} (y,x) combos identical to the oracle`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/**
 * Broken twin: does FOUR `rrca` on x instead of three before `and 0x1f` — exactly the
 * latent bug the oracle's header records ("emitting four was the bug being fixed").
 * That divides x by 16 (with the wrapped bit) instead of 8, so the column is wrong on
 * a large subset of x while still agreeing on some — only a real sweep catches it.
 */
function brokenTileAddrForPixel(y, x) {
  const rot4 = ((x >> 4) | (x << 4)) & 0xff; // four rrca on the x byte
  const col = rot4 & 0x1f; // BUG: four rotations, not three
  const row = ((~y) & 0xff) >> 3;
  return (0x7400 + row * 32 + col) & 0xffff;
}

test("TEETH (exhaustive): the four-rrca twin is CAUGHT by the sweep", () => {
  const { mismatch, count } = sweep(brokenTileAddrForPixel);
  assert.notEqual(mismatch, null, "the exhaustive sweep FAILED to catch a wrong x-divide — it is worthless");
  console.log(
    `  TEETH/exhaustive: caught after ${count} combos at y=${hb(mismatch.y)} x=${hb(mismatch.x)} ` +
      `(oracle=${hw(mismatch.want)} broken=${hw(mismatch.got)})`,
  );
});

// -- 3. REALISM + PURITY (captured dispatches) --------------------------------

/**
 * Hook 0x2ff0 in a real attract run and clone the machine at up to K real dispatches.
 * The board-setup and gameplay tile-probe helpers dispatch it while attract plays 25m.
 * The wrapper clones the entry state, then runs the oracle so the host game proceeds
 * undisturbed to a clean stop.
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

test("REALISM + PURITY: real captured dispatches — oracle writes no memory, tile matches", () => {
  const caps = captureDispatches(96, 1200);
  assert.ok(caps.length >= 1, "expected at least one real 0x2ff0 dispatch during attract");

  for (const cap of caps) {
    const y = cap.regs.h;
    const x = cap.regs.l;

    // PURITY: run the oracle on a clone and confirm it mutated no RAM — this is what
    // licenses the pure `(y,x) -> HL` signature (no memory in the contract).
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

    // REALISM: tileAddrForPixel reproduces the oracle's returned HL on this real state.
    assert.equal(
      tileAddrForPixel(y, x) & 0xffff,
      oc.regs.hl & 0xffff,
      `mismatch on real dispatch y=${hb(y)} x=${hb(x)}`,
    );
  }
  console.log(`  REALISM/purity: ${caps.length} real dispatches — no memory written, tile == oracle HL`);
});
