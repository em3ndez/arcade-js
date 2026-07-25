// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for marioActiveGuard (ROM 0x0010) — the `rst 0x10` player-alive
 * caller-skip guard.
 *
 * sub_0010 reads MARIO_ACTIVE (0x6200), rotates bit 0 into carry, and returns a SKIP
 * BOOLEAN: bit 0 SET -> `ret c` returns NORMALLY (caller resumes); bit 0 CLEAR ->
 * `inc sp / inc sp / ret` splices two levels up (caller skipped). So its whole output
 * is that one boolean and it writes NO memory. That makes it a PURE PREDICATE of a
 * single byte, validated the strongest way — EXHAUSTIVELY over all 256 MARIO_ACTIVE
 * values against the frozen oracle's decision — not by a whole-machine trace:
 *
 *   1. EQUAL (exhaustive) — marioActiveGuard's boolean == oracle's boolean over all
 *      256 MARIO_ACTIVE byte values. The oracle returns its skip decision directly
 *      (true = normal return, false = splice), so the two booleans are compared head
 *      to head. The full 256-value domain is the routine's entire input space.
 *
 *   2. PURITY (exhaustive) — for every one of those 256 values, running the oracle
 *      writes NO work RAM (dumpState identical before/after). This is what licenses
 *      the memory-only contract: the guard's only live output is the boolean; the
 *      A/F/SP/PC the oracle leaves are dead ABI (every caller reloads A on return).
 *
 *   3. TEETH (exhaustive) — the POLARITY TRAP: a twin that copies sub_0008's mirror
 *      polarity (proceeds on bit CLEAR instead of SET) MUST be caught by the sweep.
 *      This is the representative real bug — sub_0010 is sub_0008 one opcode apart.
 *
 *   4. REALISM + PURITY (captured dispatches) — hook 0x0010 in a real attract run,
 *      capture the true machine states the game feeds it, and for each confirm (a) the
 *      oracle writes NO memory and (b) marioActiveGuard reproduces the oracle's boolean.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-0010.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_0010 as oracle } from "../../translated/sub_0010.js";
import { marioActiveGuard } from "../marioActiveGuard.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0010;
const MARIO_ACTIVE = 0x6200; // the player-alive byte the guard reads (MARIO_ACTIVE in ram.js)

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * Compare a candidate predicate against the oracle's skip decision over all 256
 * MARIO_ACTIVE byte values. Returns the first mismatch (or null) and the count.
 *
 * The machine is reused across every value: the oracle writes NO memory, so nothing
 * accumulates (job 2 proves this). It is a clone() so its frame machinery is
 * neutralised (nextNmi / nextBoundary = Infinity) — otherwise an m.step during the
 * call could trip the boundary/NMI at cycle 0. SP is reset into work RAM each call so
 * the trailing `ret`'s stack pop reads valid bytes and never drifts into I/O space.
 */
function sweep(candidate) {
  const m = new Machine(ROM).clone();
  let count = 0;
  for (let v = 0; v < 256; v++) {
    m.mem.write8(MARIO_ACTIVE, v);
    m.regs.sp = 0x6b00;
    const got = candidate(m); // read-only predicate on MARIO_ACTIVE = v
    const want = oracle(m); // oracle's boolean on the same byte (mutates regs only)
    count++;
    if (got !== want) return { mismatch: { v, want, got }, count };
  }
  return { mismatch: null, count };
}

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): marioActiveGuard == oracle over all 256 MARIO_ACTIVE values", () => {
  const { mismatch, count } = sweep(marioActiveGuard);
  assert.equal(
    mismatch,
    null,
    mismatch &&
      `mismatch at MARIO_ACTIVE=${hx(mismatch.v)}: oracle=${mismatch.want} guard=${mismatch.got}`,
  );
  assert.equal(count, 256, "must have compared the full 256-value domain");
  console.log(`  EQUAL/exhaustive: ${count} MARIO_ACTIVE values identical to the oracle's decision`);
});

// -- 2. PURITY (exhaustive) ---------------------------------------------------

test("PURITY (exhaustive): the oracle writes NO work RAM for any MARIO_ACTIVE value", () => {
  const m = new Machine(ROM).clone();
  let count = 0;
  let wrote = null;
  for (let v = 0; v < 256 && !wrote; v++) {
    m.mem.write8(MARIO_ACTIVE, v);
    m.regs.sp = 0x6b00;
    const before = m.dumpState();
    oracle(m);
    const after = m.dumpState();
    const d = firstStateDiff(before, after, (off) => m.stateOffsetToAddr(off));
    count++;
    if (d) wrote = { v, d };
  }
  assert.equal(
    wrote,
    null,
    wrote && `oracle wrote RAM at 0x${(wrote.d.addr ?? 0).toString(16)} (${wrote.d.a}->${wrote.d.b}) ` +
      `on MARIO_ACTIVE=${hx(wrote.v)} — the memory-only contract is false`,
  );
  console.log(`  PURITY/exhaustive: ${count} oracle runs, no work RAM written — memory-only confirmed`);
});

// -- 3. TEETH (exhaustive) ----------------------------------------------------

/**
 * Broken twin: the POLARITY TRAP. sub_0010 is the exact mirror of sub_0008 one opcode
 * apart — sub_0008 returns normally on `ret nc` (bit CLEAR), sub_0010 on `ret c` (bit
 * SET). This twin copies sub_0008's carry-clear polarity onto rst 0x10, so it proceeds
 * exactly when the oracle skips and vice versa. The representative real bug.
 */
function polarityBroken(m) {
  return (m.mem.read8(MARIO_ACTIVE) & 0x01) === 0; // BUG: bit CLEAR, sub_0008's polarity
}

test("TEETH (exhaustive): the polarity-flipped twin is CAUGHT by the sweep", () => {
  const { mismatch, count } = sweep(polarityBroken);
  assert.notEqual(mismatch, null, "the exhaustive sweep FAILED to catch a flipped skip polarity — it is worthless");
  console.log(
    `  TEETH/exhaustive: caught after ${count} value(s) at MARIO_ACTIVE=${hx(mismatch.v)} ` +
      `(oracle=${mismatch.want} broken=${mismatch.got})`,
  );
});

// -- 4. REALISM + PURITY (captured dispatches) --------------------------------

/**
 * Hook 0x0010 in a real attract run and clone the machine at up to K real dispatches.
 * sub_0010 is a leaf reached only via m.call, but constructing the machine WITH the
 * override wires it into the routine registry, so `m.call(0x0010)` resolves to the
 * wrapper. The wrapper clones the entry state, then runs the oracle (returning its
 * boolean) so the host game proceeds undisturbed to a clean stop.
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

test("REALISM + PURITY: real captured dispatches — oracle writes no memory, guard matches", () => {
  const caps = captureDispatches(64, 1200);
  assert.ok(caps.length >= 1, "expected at least one real 0x0010 dispatch during attract");

  for (const cap of caps) {
    // PURITY: run the oracle on a fresh clone and confirm it mutated no RAM — this is
    // what licenses the memory-only signature. `want` is the oracle's real decision.
    const oc = cap.clone();
    const before = oc.dumpState();
    const want = oracle(oc);
    const after = oc.dumpState();
    const d = firstStateDiff(before, after, (off) => oc.stateOffsetToAddr(off));
    assert.equal(
      d,
      null,
      d && `oracle wrote RAM at 0x${(d.addr ?? 0).toString(16)} (${d.a}->${d.b}) — signature is not pure`,
    );

    // REALISM: marioActiveGuard reproduces the oracle's boolean on this real state
    // (read-only, so `cap` stays pristine and the two read the same MARIO_ACTIVE byte).
    assert.equal(
      marioActiveGuard(cap),
      want,
      `mismatch on real dispatch MARIO_ACTIVE=${hx(cap.mem.read8(MARIO_ACTIVE))}`,
    );
  }
  console.log(`  REALISM/purity: ${caps.length} real dispatches — no memory written, guard == oracle decision`);
});
