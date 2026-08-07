// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepSequenceUnderChecksum — memory-equivalent to the frozen oracle at ROM 0x4B19.
 *
 * ★ ONE OF ITS TWO ARMS IS DEAD ON AN UNALTERED IMAGE, AND THAT IS THE HARD PART OF GATING IT.
 *   The check adds a fixed block of the image to a fixed starting value and compares the total
 *   with a byte held elsewhere in the image; on a genuine image those agree, so the mismatch arm
 *   never runs and a candidate that OMITS THE CHECK ENTIRELY is byte-identical to the real one.
 *   A gate resting on real dispatches alone therefore proves nothing about the check. So arm 4
 *   pokes one byte of the summed block and re-runs both sides: the routine must now disturb a
 *   second cell and the no-check twin must not. The twin's blindness WITHOUT the poke is
 *   asserted, so its agreement on a genuine image is never read as reassurance.
 *
 * GATE: the one real dispatch attract produces, plus poked-image arms for the dead branch.
 *
 *   1. REACH — the shared coin -> start tape never gets here and undriven attract does, once.
 *      Both asserted as counts.
 *   2. CORPUS — that dispatch replayed over the whole state dump. ONE exclusion, [SP-2, SP): the
 *      oracle pushes a return address when it takes the mismatch arm, and the rewrite models no
 *      stack. On the PASSING arm nothing is pushed, and arm 2a asserts the window is clean there
 *      rather than letting the exclusion cover a branch it is not needed on.
 *   3. THE CHECK PASSES ON A GENUINE IMAGE — measured, by summing the block here and comparing
 *      it with the byte the routine compares against. If this ever fails, the image is wrong.
 *   4. THE MISMATCH ARM IS REACHABLE AND CORRECT — a SAMPLE of the block poked one byte at a
 *      time (every sixteenth offset, plus the last), the rewrite following the oracle on each.
 *      A sample and not the whole block, which is the hole: a rewrite whose summing loop skipped
 *      an unsampled byte would only be caught by arm 3.
 *   5. THE TWO CELLS ARE DISTINCT — the arm that fires on a mismatch writes a DIFFERENT cell from
 *      the one that always fires, which is what makes "derails rather than halts" checkable.
 *   6. WHAT THE TWO ARMS LEAVE — the passing arm steps the sub-step on from whatever it held;
 *      the mismatch arm RESTARTS it from zero first, so it comes out at one however far along the
 *      sequence was. Both measured off the oracle, and the difference is the derailment.
 *   7. TEETH — six twins caught at the real dispatch, plus the no-check one, which is pinned
 *      blind-without-the-poke and caught with it.
 *
 * HOLE: what a derailed sequence does next is not covered here at all — this file gates the two
 * cells and the branch between them, and nothing downstream of either.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-4b19.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { stepSequenceUnderChecksum } from "../stepSequenceUnderChecksum.js";
import { loc_4b19 as oracle } from "../../translated/loc_4b19.js";
import { advanceSequencePhase } from "../advanceSequencePhase.js";
import { advanceSequenceSubStep } from "../advanceSequenceSubStep.js";
import { SEQUENCE_PHASE, SEQUENCE_SUBSTEP } from "../names.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u8, u16 } from "../../../../core/int.js";

const TARGET = 0x4b19;

const BLOCK_START = 0x0bcc;
const BLOCK_BYTES = 256;
const STARTING_TOTAL = 137;
const EXPECTED_TOTAL = 0x1a50;

const DISPATCHES = { shared: 0, attract: 1 };
const TAPES = [["shared", {}], ["attract", { tape: [] }]];

/** Which bytes of the block get poked. Every sixteenth, plus the two ends. */
const POKE_STEP = 16;
const POKE_OFFSETS = [
  ...Array.from({ length: BLOCK_BYTES / POKE_STEP }, (_unused, i) => i * POKE_STEP),
  BLOCK_BYTES - 1,
];

/** The oracle's push on the mismatch arm; on the passing arm nothing is pushed. */
const SCRATCH_BYTES = 2;

/** Everything the oracle's own summing loop leaves behind; the tail-jump caller reloads. */
const EXCLUDED = ["a", "f", "b", "c", "d", "e", "h", "l", "sp"];

const skip = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

const inScratch = (addr, sp) => addr >= sp - SCRATCH_BYTES && addr < sp;

function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  const ram = allDiffs(a, b).find((d) => !inScratch(d.addr, sp));
  if (ram) return ram;
  const moved = REG_FIELDS.find((k) => !EXCLUDED.includes(k) && a.regs[k] !== b.regs[k]);
  return moved ? { addr: null, a: a.regs[moved], b: b.regs[moved] } : null;
}

let corpusCache = null;
function corpus() {
  if (corpusCache) return corpusCache;
  corpusCache = TAPES.map(([label, opts]) => {
    const states = [];
    const host = makeMachine(new Map([[TARGET, (mm) => (states.push(mm.clone()), oracle(mm))]]), opts);
    const frames = host.runFrames(ENTRY_FRAMES);
    assert.equal(host.stoppedBy, null, `the ${label} session stopped early: ${host.stoppedBy}`);
    assert.equal(frames.length, ENTRY_FRAMES, `the ${label} session ran short`);
    return { label, states };
  });
  return corpusCache;
}

function theOneEntry() {
  const attract = corpus().find((s) => s.label === "attract");
  assert.ok(attract.states.length > 0, "vacuous: the attract session never reached the routine");
  return attract.states[0];
}

/** The total the routine computes, worked out here rather than taken from either arm. */
function blockTotal(image) {
  let total = STARTING_TOTAL;
  for (let i = 0; i < BLOCK_BYTES; i++) total = u8(total + image[u16(BLOCK_START + i)]);
  return total;
}

/** Run `body` with one program-image byte forced, then put it back whatever happens. */
function withPokedImage(m, addr, value, body) {
  const image = m.mem.rom;
  const was = image[addr];
  image[addr] = value;
  try {
    return body();
  } finally {
    image[addr] = was;
  }
}

/** The cells the ORACLE moves, from the captured entry, outside the dead stack window. */
function oracleCells(machine) {
  const sp = machine.regs.sp;
  const before = machine.clone();
  const after = machine.clone();
  oracle(after);
  return allDiffs(before, after).filter((d) => !inScratch(d.addr, sp)).map((d) => d.addr);
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("REACH: the shared tape never gets here; attract does, once", { skip }, () => {
  for (const s of corpus()) {
    assert.equal(s.states.length, DISPATCHES[s.label], `the ${s.label} dispatch count moved`);
  }
  console.log(`  REACH: shared ${DISPATCHES.shared}, attract ${DISPATCHES.attract} dispatches`);
});

test("CORPUS: the real dispatch replays identically", { skip }, () => {
  const d = unitDiff(stepSequenceUnderChecksum, theOneEntry());
  assert.equal(d, null, `the rewrite diverged at the real dispatch — ${show(d)}`);
  console.log("  CORPUS: the one real dispatch is identical outside the dead stack window");
});

test("THE EXCLUSION IS NOT NEEDED ON THE PASSING ARM: nothing is pushed there", { skip }, () => {
  const entry = theOneEntry();
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  stepSequenceUnderChecksum(b);
  assert.deepEqual(allDiffs(a, b), [],
    "the passing arm dirtied the stack window, so the oracle pushes on a branch this file says " +
      "it does not");
  console.log("  PASSING ARM: identical on EVERY byte, the stack window included");
});

test("NOT VACUOUS: a no-op candidate FAILS the same comparison", { skip }, () => {
  const d = unitDiff(brokenNoOp, theOneEntry());
  assert.notEqual(d, null, "the comparison passed a candidate that does nothing");
  assert.notEqual(d.addr, null, "the no-op must be caught on a real cell, not on a register");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("EXCLUDED, deliberately: the summing loop's registers, sp and pc", { skip }, () => {
  const a = theOneEntry().clone();
  const b = theOneEntry().clone();
  oracle(a);
  stepSequenceUnderChecksum(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.ok(moved.every((k) => EXCLUDED.includes(k)), `a register outside the set moved: ${moved}`);
  assert.notEqual(a.pc, b.pc, "the oracle's tail transfer moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${moved.join(", ")} and pc`);
});

test("THE CHECK PASSES ON A GENUINE IMAGE: the block adds up to the byte it is compared with", { skip }, () => {
  const image = theOneEntry().mem.rom;
  assert.equal(blockTotal(image), image[EXPECTED_TOTAL],
    "the block no longer adds up on this image, so the mismatch arm is LIVE and every claim in " +
      "this file about it being dead has to be re-derived");
  console.log(`  GENUINE: the block totals ${hex4(blockTotal(image))}, matching the stored byte`);
});

test("THE TWO CELLS ARE DISTINCT: the mismatch arm writes one the passing arm does not", { skip }, () => {
  const entry = theOneEntry();
  const passing = oracleCells(entry);
  assert.deepEqual(passing, [SEQUENCE_SUBSTEP], "the passing arm moves a cell other than the step");

  const failing = withPokedImage(entry, BLOCK_START, u8(entry.mem.rom[BLOCK_START] + 1), () =>
    oracleCells(entry));
  assert.deepEqual(failing.sort((x, y) => x - y), [SEQUENCE_PHASE, SEQUENCE_SUBSTEP].sort((x, y) => x - y),
    "the mismatch arm does not disturb exactly the phase alongside the step");
  assert.notEqual(SEQUENCE_PHASE, SEQUENCE_SUBSTEP, "the two cells must actually be different");
  console.log(
    `  DISTINCT: passing moves ${passing.map(hex4).join(" ")}; a mismatch moves ` +
      `${failing.map(hex4).join(" ")}`,
  );
});

test("WHAT THE TWO ARMS LEAVE: one steps the sub-step on, the other restarts it", { skip }, () => {
  const entry = theOneEntry();
  const before = entry.mem8[SEQUENCE_SUBSTEP];
  const phaseBefore = entry.mem8[SEQUENCE_PHASE];
  assert.ok(before > 1, "the captured sub-step is too low for the two arms to be told apart here");

  const passing = entry.clone();
  oracle(passing);
  assert.equal(passing.mem8[SEQUENCE_SUBSTEP], u8(before + 1), "the passing arm did not step");
  assert.equal(passing.mem8[SEQUENCE_PHASE], phaseBefore, "the passing arm moved the phase");

  withPokedImage(entry, BLOCK_START, u8(entry.mem.rom[BLOCK_START] + 1), () => {
    const failing = entry.clone();
    oracle(failing);
    assert.equal(failing.mem8[SEQUENCE_PHASE], u8(phaseBefore + 1), "the mismatch arm did not advance the phase");
    assert.equal(failing.mem8[SEQUENCE_SUBSTEP], 1,
      "the mismatch arm did not restart the sub-step before stepping it, so the derailment is " +
        "not the one this file describes");
  });
  console.log(
    `  TWO ARMS: passing leaves the sub-step at ${u8(before + 1)}; a mismatch leaves it at 1 and ` +
      `the phase at ${u8(phaseBefore + 1)}`,
  );
});

test("THE MISMATCH ARM IS REACHABLE AND CORRECT: every poked block byte agrees", { skip }, () => {
  const entry = theOneEntry();
  let reached = 0;
  for (const offset of POKE_OFFSETS) {
    const addr = u16(BLOCK_START + offset);
    withPokedImage(entry, addr, u8(entry.mem.rom[addr] + 1), () => {
      assert.notEqual(blockTotal(entry.mem.rom), entry.mem.rom[EXPECTED_TOTAL],
        `poking ${hex4(addr)} did not change the total, so this case proves nothing`);
      const d = unitDiff(stepSequenceUnderChecksum, entry);
      assert.equal(d, null, `poked at ${hex4(addr)}: ${show(d)}`);
      reached++;
    });
  }
  assert.equal(reached, POKE_OFFSETS.length, "not every poked case ran");
  console.log(`  MISMATCH ARM: ${reached} poked block bytes, the rewrite identical on each`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: skips the check entirely and only steps — invisible on an unaltered image. */
function brokenNoCheck(m) {
  advanceSequenceSubStep(m);
}

/** BUG: derails on a MATCH instead of a mismatch. */
function brokenInverted(m) {
  const { mem8 } = m;
  let total = STARTING_TOTAL;
  for (let i = 0; i < BLOCK_BYTES; i++) total = u8(total + mem8[u16(BLOCK_START + i)]);
  if (total === mem8[EXPECTED_TOTAL]) advanceSequencePhase(m);
  advanceSequenceSubStep(m);
}

/** BUG: the running total starts from zero rather than the value this entry fixes. */
function brokenSeed(m) {
  const { mem8 } = m;
  let total = 0;
  for (let i = 0; i < BLOCK_BYTES; i++) total = u8(total + mem8[u16(BLOCK_START + i)]);
  if (total !== mem8[EXPECTED_TOTAL]) advanceSequencePhase(m);
  advanceSequenceSubStep(m);
}

/** BUG: the block starts one byte along, so the last byte is missed and one extra is taken. */
function brokenBlockStart(m) {
  const { mem8 } = m;
  let total = STARTING_TOTAL;
  for (let i = 0; i < BLOCK_BYTES; i++) total = u8(total + mem8[u16(BLOCK_START + 1 + i)]);
  if (total !== mem8[EXPECTED_TOTAL]) advanceSequencePhase(m);
  advanceSequenceSubStep(m);
}

/** BUG: the block is one byte short. */
function brokenBlockLength(m) {
  const { mem8 } = m;
  let total = STARTING_TOTAL;
  for (let i = 0; i < BLOCK_BYTES - 1; i++) total = u8(total + mem8[u16(BLOCK_START + i)]);
  if (total !== mem8[EXPECTED_TOTAL]) advanceSequencePhase(m);
  advanceSequenceSubStep(m);
}

/** BUG: checks correctly and forgets to step. */
function brokenNoStep(m) {
  const { mem8 } = m;
  let total = STARTING_TOTAL;
  for (let i = 0; i < BLOCK_BYTES; i++) total = u8(total + mem8[u16(BLOCK_START + i)]);
  if (total !== mem8[EXPECTED_TOTAL]) advanceSequencePhase(m);
}

/** Twins visible without any poke, because they disturb the passing arm as well. */
for (const [label, twin] of [
  ["no-op", brokenNoOp],
  ["inverted-check", brokenInverted],
  ["wrong-starting-total", brokenSeed],
  ["block-start-off-by-one", brokenBlockStart],
  ["block-one-byte-short", brokenBlockLength],
  ["no-step", brokenNoStep],
]) {
  test(`TEETH: the ${label} twin is CAUGHT at the real dispatch`, { skip }, () => {
    const d = unitDiff(twin, theOneEntry());
    assert.notEqual(d, null, `the comparison PASSED the ${label} twin — it has no teeth`);
    console.log(`  TEETH/${label}: caught — ${show(d)}`);
  });
}

test("TEETH: the no-check twin is BLIND on a genuine image and caught under the poke", { skip }, () => {
  const entry = theOneEntry();
  assert.equal(unitDiff(brokenNoCheck, entry), null,
    "a genuine image was expected to be blind to it; if it is not, the poked arm proves nothing");
  const caught = withPokedImage(entry, BLOCK_START, u8(entry.mem.rom[BLOCK_START] + 1), () =>
    unitDiff(brokenNoCheck, entry));
  assert.notEqual(caught, null, "the poked comparison ALSO passed it — the check is untested");
  assert.equal(caught.addr, SEQUENCE_PHASE, "the no-check twin must be caught on the phase cell");
  console.log(`  TEETH/no-check: blind on a genuine image, caught under the poke at ${show(caught)}`);
});
