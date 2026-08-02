// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for gameActiveGuard (ROM 0x0008) — the `rst 0x08` caller-skip guard.
 *
 * sub_0008 is a LEAF that reads exactly one byte — ATTRACT (0x6007) — and returns a
 * boolean: true when it returns normally (bit 0 CLEAR, caller proceeds), false when it
 * splices two levels up (bit 0 SET, caller's remainder skipped). It writes no memory and
 * calls nothing, and its only live output is that control-flow boolean (SP/PC/A/F are the
 * Z80 return mechanism the idiomatic layer replaces with a JS return). So it is validated
 * the strongest way a leaf predicate can be — EXHAUSTIVELY against the frozen oracle over
 * every possible ATTRACT byte — not by a whole-machine trace:
 *
 *   1. EQUAL + PURITY (exhaustive) — for all 256 ATTRACT byte values, the oracle writes
 *      NO RAM (licensing the memory-only contract) and gameActiveGuard reproduces its
 *      boolean skip decision. Both arms are covered (bit 0 clear -> proceed, set -> skip).
 *
 *   2. TEETH (exhaustive) — a deliberately-broken twin (reads bit 1 of ATTRACT instead of
 *      bit 0 — a plausible off-by-one-bit bug that still agrees on many values) MUST be
 *      caught by the same 256-byte sweep. (The even blunter carry-clear/carry-set polarity
 *      inversion — the marioActiveGuard mirror trap — is caught at the very first value.)
 *
 *   3. REALISM + PURITY (captured dispatches) — hook 0x0008 in a real attract run, capture
 *      the true machine states the game feeds it (SP pointing at real return frames), and
 *      for each confirm (a) the oracle writes NO memory and (b) gameActiveGuard reproduces
 *      the oracle's boolean. Attract dispatches it thousands of times and exercises BOTH
 *      arms, so these are in-distribution states, not synthetic ones.
 *
 * The oracle must be run on a clone() (frame machinery neutralised: nextNmi/nextBoundary
 * = Infinity) — otherwise an m.step inside the call could trip a live NMI, whose handler
 * writes RAM and would masquerade as an oracle side effect.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-0008.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_0008 as oracle } from "../../translated/sub_0008.js";
import { gameActiveGuard } from "../gameActiveGuard.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { ATTRACT } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0008;
const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * Run the frozen oracle for one ATTRACT byte and return its boolean skip decision.
 *
 * The machine is reused across every value: the oracle writes NO memory, so nothing
 * accumulates (a pure/read-only leaf may share one clone). It is a clone() so its frame
 * machinery is neutralised — an m.step during the call would otherwise trip an NMI at
 * cycle 0. SP is parked in STACK_SCRATCH each call so the trailing `ret` (and, on the
 * skip arm, the two `inc sp` first) pops valid bytes and never drifts into I/O space.
 */
function runOracleBool(m, attractVal) {
  const { regs, mem } = m;
  mem.write8(ATTRACT, attractVal & 0xff);
  regs.sp = 0x6bf0; // STACK_SCRATCH [0x6be0,0x6c00): inc-sp+inc-sp+ret stays in RAM
  return oracle(m);
}

// -- 1. EQUAL + PURITY (exhaustive) -------------------------------------------

test("EQUAL + PURITY (exhaustive): gameActiveGuard == oracle over all 256 ATTRACT bytes; oracle writes no RAM", () => {
  const m = new Machine(ROM).clone();
  let count = 0;
  for (let v = 0; v < 256; v++) {
    m.mem.write8(ATTRACT, v);
    m.regs.sp = 0x6bf0;

    // PURITY: the oracle mutates no RAM (this is what licenses the memory-only contract).
    const before = m.dumpState();
    const want = oracle(m);
    const after = m.dumpState();
    const d = firstStateDiff(before, after, (off) => m.stateOffsetToAddr(off));
    assert.equal(
      d,
      null,
      d && `oracle wrote RAM at 0x${(d.addr ?? 0).toString(16)} (${d.a}->${d.b}) for ATTRACT=${hx(v)}`,
    );

    // EQUAL: gameActiveGuard reproduces the oracle's boolean skip decision.
    const got = gameActiveGuard(m);
    count++;
    assert.equal(got, want, `mismatch at ATTRACT=${hx(v)}: oracle=${want} guard=${got}`);
  }
  assert.equal(count, 256, "must have compared all 256 ATTRACT byte values");
  console.log(`  EQUAL+PURITY/exhaustive: ${count} ATTRACT values identical to the oracle, no RAM written`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/**
 * Broken twin: reads bit 1 of ATTRACT (mask 0x02) instead of bit 0 (0x01) — a plausible
 * off-by-one-bit bug. It agrees with the oracle whenever bits 0 and 1 match (e.g. 0x00,
 * 0x03), so only a real sweep over the differing values catches it.
 */
function brokenGameActiveGuard(m) {
  return (m.mem.read8(ATTRACT) & 0x02) === 0; // BUG: 0x02 should be 0x01
}

test("TEETH (exhaustive): the wrong-bit twin is CAUGHT by the 256-byte sweep", () => {
  const m = new Machine(ROM).clone();
  let caught = null;
  for (let v = 0; v < 256 && !caught; v++) {
    const want = runOracleBool(m, v);
    const got = brokenGameActiveGuard(m);
    if (got !== want) caught = { v, want, got };
  }
  assert.notEqual(
    caught,
    null,
    "the exhaustive sweep FAILED to catch a wrong-bit twin — it proves nothing",
  );
  console.log(
    `  TEETH/exhaustive: caught at ATTRACT=${hx(caught.v)} (oracle=${caught.want} broken=${caught.got})`,
  );
});

// -- 3. REALISM + PURITY (captured dispatches) --------------------------------

/**
 * Hook 0x0008 in a real attract run and clone the machine at up to K real dispatches.
 * `rst 0x08` fires thousands of times per run (the main loop and its tasks lean on it),
 * so this captures the true states the game feeds the guard — including both arms. The
 * wrapper clones the entry state, then runs the oracle so the host game proceeds
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

test("REALISM + PURITY: real captured 0x0008 dispatches — oracle writes no memory, guard matches", () => {
  const caps = captureDispatches(96, 1200);
  assert.ok(caps.length >= 1, "expected at least one real 0x0008 dispatch during attract");

  let proceed = 0;
  let skip = 0;
  for (const cap of caps) {
    // Run the oracle on a fresh clone of this real state: SP points at the true return
    // frames, so `ret` pops real addresses. PURITY: confirm it mutated no RAM.
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
    if (want) proceed++;
    else skip++;

    // REALISM: gameActiveGuard reproduces the oracle's boolean on this real state.
    assert.equal(
      gameActiveGuard(cap),
      want,
      `mismatch on real dispatch ATTRACT=${hx(cap.mem.read8(ATTRACT))}`,
    );
  }
  console.log(
    `  REALISM/purity: ${caps.length} real dispatches (${proceed} proceed, ${skip} skip) — no RAM written, guard == oracle`,
  );
});
