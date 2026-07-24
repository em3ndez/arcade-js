// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for tail_05da (the shared two-instruction tail of
 * handler_05c6: `ld de,0x60ba` / `jp 0x0578`, re-render the high score). It is a
 * LEAF reached only via m.call(0x05da) — from handler_05c6's payload-2 arm and
 * from entry_051c's 0x055C tail jump — never a dispatch target, so the whole-
 * machine override fires THROUGH those callers (their oracle bodies call 0x05da).
 *
 * Five jobs:
 *
 *   1. EQUAL -- the idiomatic optimized tail_05da (optimized/tail_05da.js) CONVERGES
 *      against its translated oracle under the CONVERGENT gate (whole-machine,
 *      pixels + persistent non-stack state), and matches unit-EQUAL exactly. tail_05da
 *      is COLLAPSED (its two instructions folded into one m.step) and reached on
 *      every call path from a MAIN-LOOP task (NMI mask ENABLED) -- theoretically
 *      interruptible -- so per the collapse-sweep's blanket rule, ANY routine with a
 *      whole-machine test is gated CONVERGENT, never strict, regardless of whether
 *      the collapse happens to pass strict in a given scenario (that would only be a
 *      property of the tested scenario, not the routine).
 *
 *   2. DISPATCH -- the override must actually run, or EQUAL is vacuous. tail_05da is
 *      entered when handler_05c6 dispatches with payload 2 (the high-score arm),
 *      which happens at frame 5 from boot (plain attract, no credit needed).
 *
 *   3. TEETH (unit) -- tail_05da has NO store of its own; its entire contract is "put
 *      the RIGHT pointer in DE so the RIGHT score renders." So the representative bug
 *      is a WRONG pointer: a broken twin that loads DE=0x60B2 (P1_SCORE) instead of
 *      0x60BA (HIGH_SCORE MSB) makes draw_0578 render the wrong bytes into the
 *      high-score VRAM cells. Caught as a unit RAM diff naming a VRAM address.
 *
 *   4. TEETH (convergent) -- the collapse's load-bearing invariant is the folded 20t
 *      total; a CYCLE-DROP twin (one m.step charge 5t short) forks the main loop's
 *      spin count (0x6019, the PRNG entropy) into a PERSISTENT divergence, which the
 *      convergent gate must catch. (Not a value-corruption twin over the long
 *      convergent run -- that can hang the game, per the collapse-sweep brief.)
 *
 *   5. BRANCH COVERAGE -- tail_05da is STRAIGHT-LINE: no data-dependent branch, no
 *      loop, one exit. The single natural/driven path IS full coverage; there is no
 *      unreached arm to synthesise.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { tail_05da as translated_05da } from "../../translated/mainloop.js";
import { tail_05da as optimized_05da } from "../tail_05da.js";
import { unitEquivalence } from "../harness.js";
import { convergentGate, SCENARIOS } from "./convergent.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x05da;
const VRAM_LO = 0x7400; // tilemap RAM 0x7400-0x77FF — where draw_0578 renders
const VRAM_HI = 0x77ff;

/**
 * Deliberately-broken twin: behaviourally the optimized tail EXCEPT it loads the
 * WRONG pointer into DE (0x60B2 = P1_SCORE) instead of 0x60BA (HIGH_SCORE MSB).
 * The callee draw_0578 then renders from the wrong source region into the high-
 * score display cells — the representative "wrong pointer, wrong render" bug for a
 * routine whose whole job is choosing that pointer. Used for the UNIT teeth only
 * (a single-entry diff, not a long convergent run).
 */
function broken_05da(m) {
  const { regs } = m;
  regs.de = 0x60b2; // WRONG: should be 0x60ba
  m.step(0x0578, 20);
  return m.call(0x0578);
}

/**
 * Cycle-broken twin for the CONVERGENT gate: identical behaviour to the collapsed
 * routine, but the single folded charge is 5 t short (15 instead of 20). A wrong
 * total shifts the main loop's spin count (0x6019, the PRNG entropy), forking the
 * RANDOM stream permanently -- a PERSISTENT non-stack divergence, never a heal.
 */
function cyclebroken_05da(m) {
  const { regs } = m;
  regs.de = 0x60ba;
  m.step(0x0578, 15); // DROPPED: the correct total is 20 t
  return m.call(0x0578);
}

// -- EQUAL --------------------------------------------------------------------

test("CONVERGENT (whole-machine): collapsed tail_05da CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_05da]]), { scenario: SCENARIOS.attract });

  assert.ok(
    r.invocations.get(TARGET) >= 1,
    `override at 0x${TARGET.toString(16)} never dispatched (invocations=${r.invocations.get(TARGET)})`,
  );
  assert.equal(
    r.pass,
    true,
    r.pass ? "" : `NOT convergent: persistent state ${JSON.stringify(r.statePersistent)}, ` +
      `pixelPersistent=${r.pixelPersistent}`,
  );
  console.log(
    `  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x; ` +
      `${r.pixDiffFrames} tear frame(s) (max ${r.maxPixels}px, healed), ` +
      `non-stack state persistent = ${r.statePersistent.length}`,
  );
});

test("EQUAL (unit): idiomatic optimized tail_05da matches translated in RAM + registers", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_05da, optimized_05da);

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_05da]]), { scenario: SCENARIOS.attract });

  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.pass, false, "convergent gate FAILED to catch a wrong cycle total -- it is worthless");
  assert.ok(
    r.statePersistent.length > 0 || r.pixelPersistent,
    "a caught divergence must be persistent (non-stack state or pixels)",
  );
  console.log(
    `  TEETH/convergent: caught -- persistent non-stack addrs ${r.statePersistent.length}, ` +
      `pixelPersistent ${r.pixelPersistent}`,
  );
});

test("TEETH (unit): a wrong DE pointer is CAUGHT and names a VRAM cell", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_05da, broken_05da);

  assert.equal(r.equal, false, "harness FAILED to catch a wrong DE pointer — it is worthless");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  assert.ok(
    r.ram.addr >= VRAM_LO && r.ram.addr <= VRAM_HI,
    `expected the first diff in tilemap VRAM 0x${VRAM_LO.toString(16)}-0x${VRAM_HI.toString(16)}, ` +
      `got 0x${r.ram.addr.toString(16)}`,
  );
  console.log(
    `  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} ` +
      `(translated ${r.ram.a} vs broken ${r.ram.b})`,
  );
});
