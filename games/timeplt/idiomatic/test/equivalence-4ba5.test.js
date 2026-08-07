// SPDX-License-Identifier: GPL-3.0-only
/**
 * loadDefaultHighScores — memory-equivalent to the frozen oracle at ROM 0x4BA5.
 *
 * GATE: strict unit-capture on the coin-and-start tape, a crafted sweep over the destination's
 *   prior contents and its two neighbours, a whole-machine replay, and teeth. RAM IS A REAL GATE:
 *   the routine writes forty bytes and the NOT VACUOUS arm proves a do-nothing candidate fails on
 *   RAM at the real dispatch.
 *   1. EQUAL at the real dispatch — the whole state dump identical, stack scratch included,
 *      because this routine pushes nothing and the arm asserts that rather than masking for it.
 *   2. NOT VACUOUS — a no-op candidate fails the same diff.
 *   3. EXCLUDED, deliberately, pinned to an exact set.
 *   4. CORPUS — the single dispatch the boot sequence produces.
 *   5. CRAFTED — the destination and the byte either side of it forced to eight prior patterns,
 *      which is what makes "wrote the right bytes" separable from "found them already right".
 *   6. THE COPY IS FAITHFUL — the destination is compared against the source range read back out
 *      of program space at run time, so the expected bytes are never written down here.
 *   7. WHOLE-MACHINE — the session replayed with the rewrite wired through a measured shim.
 *   8. TEETH — six twins, each caught on an exact declared count.
 *
 * HOLE: THE CORPUS IS ONE DISPATCH. This runs once, in the boot sequence, so there is no variety
 *   in real data at all and the crafted sweep is doing all the discriminating.
 * HOLE: the SOURCE cannot be varied. It lives in program space, which the address space refuses
 *   to write, so every arm here varies the destination and reads the source as it is.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-4ba5.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loadDefaultHighScores } from "../loadDefaultHighScores.js";
import { loc_4ba5 as oracle } from "../../translated/loc_4ba5.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x4ba5;

const SOURCE = 0x4bb1;
const DESTINATION = 0xab08;
const BYTES = 40;

const MOVED = ["f", "e", "h", "l", "sp"];
const CORPUS_FRAMES = 1400;
const WHOLE_FRAMES = 1400;
const RET_TSTATES = 10;

/** Measured over the corpus below; a move is a finding. */
const DISPATCHES = 1;

const PRIORS = [0x00, 0xff, 0x55, 0xaa, 0x01, 0x80, 0x7f, 0xf0];

const skip = romsPresent() ? false : "ROM images are not assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

const factory = (overrides) => makeMachine(overrides);

// ── the entry ───────────────────────────────────────────────────────────────────────────

let entry = null;

function gate(candidate) {
  return unitEquivalence(factory, TARGET, oracle, (m) => {
    if (entry === null) entry = m.clone();
    return candidate(m);
  }, { maxFrames: ENTRY_FRAMES });
}

function entryState() {
  if (entry === null) gate(loadDefaultHighScores);
  return entry;
}

function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

// ── the corpus ──────────────────────────────────────────────────────────────────────────

let corpus = null;
function captureCorpus() {
  if (corpus) return corpus;
  const entries = [];
  const m = factory(new Map([[TARGET, (mm) => {
    entries.push(mm.clone());
    return oracle(mm);
  }]]));
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `corpus run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "corpus run ran short");
  corpus = entries;
  return corpus;
}

/** A real captured machine with the destination and both neighbours filled with one byte. */
function craft(prior) {
  const m = entryState().clone();
  m.mem8[DESTINATION - 1] = prior;
  for (let i = 0; i < BYTES; i++) m.mem8[DESTINATION + i] = prior;
  m.mem8[DESTINATION + BYTES] = prior;
  return m;
}

const craftedCaught = (candidate) =>
  PRIORS.filter((p) => unitDiff(candidate, craft(p)) !== null).length;

// ── the shim, measured rather than asserted ─────────────────────────────────────────────

function hosted(candidate) {
  return (mm) => {
    const probe = mm.clone();
    const before = probe.cycles;
    oracle(probe);
    const total = probe.cycles - before;
    candidate(mm);
    mm.tick(total - RET_TSTATES);
    mm.ret(RET_TSTATES);
  };
}

const replay = (candidate) =>
  wholeMachineEquivalence(factory, WHOLE_FRAMES, new Map([[TARGET, hosted(candidate)]]));

// ── the twins ───────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: stops one byte short, so the last record of the block is stale. */
function brokenOneShort(m) {
  for (let i = 0; i < BYTES - 1; i++) m.mem8[DESTINATION + i] = m.mem8[SOURCE + i];
}

/** BUG: runs one byte long, so a byte beyond the block is trampled. */
function brokenOneLong(m) {
  for (let i = 0; i < BYTES + 1; i++) m.mem8[DESTINATION + i] = m.mem8[SOURCE + i];
}

/** BUG: lands one byte low, so every record is shifted and the one before is trampled. */
function brokenOffsetDestination(m) {
  for (let i = 0; i < BYTES; i++) m.mem8[DESTINATION - 1 + i] = m.mem8[SOURCE + i];
}

/** BUG: takes the block from one byte on, so every record is read off its boundary. */
function brokenOffsetSource(m) {
  for (let i = 0; i < BYTES; i++) m.mem8[DESTINATION + i] = m.mem8[SOURCE + 1 + i];
}

/** BUG: copies the block backwards, which reverses records that are not symmetric. */
function brokenReversed(m) {
  for (let i = 0; i < BYTES; i++) m.mem8[DESTINATION + i] = m.mem8[SOURCE + BYTES - 1 - i];
}

/** Per twin: exact catch count over the crafted priors, and whether the real dispatch sees it. */
const TWINS = [
  ["no-op", brokenNoOp, 8, true],
  ["one-short", brokenOneShort, 8, true],
  ["one-long", brokenOneLong, 8, true],
  ["offset-destination", brokenOffsetDestination, 8, true],
  ["offset-source", brokenOffsetSource, 8, true],
  ["reversed", brokenReversed, 8, true],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: loadDefaultHighScores == oracle on the whole dump", { skip }, () => {
  const r = gate(loadDefaultHighScores);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  console.log("  EQUAL: every byte identical, the stack scratch included");
});

test("NOT VACUOUS: a no-op candidate FAILS the same diff", { skip }, () => {
  const d = unitDiff(brokenNoOp, entryState());
  assert.notEqual(d, null, "the diff passed a candidate that does nothing, so RAM is NOT this gate");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("EXCLUDED, deliberately: scratch registers, the stack pointer and pc", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  loadDefaultHighScores(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    MOVED,
    "the excluded set changed shape",
  );
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${MOVED.join(", ")} and pc`);
});

test("CORPUS: the boot dispatch replays identically", { skip }, () => {
  const entries = captureCorpus();
  assert.equal(entries.length, DISPATCHES, "the dispatch count moved");
  for (const captured of entries) {
    assert.equal(unitDiff(loadDefaultHighScores, captured), null, "the captured dispatch diverged");
  }
  console.log(`  CORPUS: ${entries.length} dispatch, identical`);
});

test("CRAFTED: every prior pattern of the destination is identical", { skip }, () => {
  for (const p of PRIORS) {
    const d = unitDiff(loadDefaultHighScores, craft(p));
    assert.equal(d, null, `prior ${p}: ${show(d)}`);
  }
  console.log(`  CRAFTED: ${PRIORS.length} destination patterns identical`);
});

test("THE COPY IS FAITHFUL: the destination equals the source, read back at run time", { skip }, () => {
  const m = craft(0x5a);
  loadDefaultHighScores(m);
  const wrong = [];
  for (let i = 0; i < BYTES; i++) {
    if (m.mem8[DESTINATION + i] !== m.mem8[SOURCE + i]) wrong.push(i);
  }
  assert.deepEqual(wrong, [], "the copy did not reproduce the source range");
  assert.equal(m.mem8[DESTINATION - 1], 0x5a, "the byte before the block must be left alone");
  assert.equal(m.mem8[DESTINATION + BYTES], 0x5a, "and so must the byte after it");
  console.log(`  FAITHFUL: ${BYTES} bytes match the source, neither neighbour touched`);
});

test("WHOLE-MACHINE: the session is byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(loadDefaultHighScores);
  assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the override never dispatched");
  assert.equal(w.framesCompared, WHOLE_FRAMES, "the replay ran short");
  assert.equal(w.equal, true, `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  console.log(`  WHOLE-MACHINE: ${w.framesCompared} frames, ${w.invocations.get(TARGET)} dispatches`);
});

test("TEETH: removing the shim's return kills the run, so the shim is load-bearing", { skip }, () => {
  let died = null;
  try {
    const w = wholeMachineEquivalence(factory, WHOLE_FRAMES, new Map([[TARGET, loadDefaultHighScores]]));
    died = w.equal ? null : "forked";
  } catch (e) {
    died = String(e).slice(0, 80);
  }
  assert.notEqual(died, null, "the unshimmed rewrite ran clean, so the shim proves nothing");
  console.log(`  TEETH/shim: the unshimmed rewrite dies — ${died}`);
});

for (const [label, twin, crafted, seenAtDispatch] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted priors`, { skip }, () => {
    assert.equal(craftedCaught(twin), crafted, `the ${label} twin's crafted catch count moved`);
    console.log(`  TEETH/${label}: caught on ${crafted} of ${PRIORS.length} crafted priors`);
  });

  test(`TEETH: the ${label} twin at the real dispatch, hole pinned`, { skip }, () => {
    const d = unitDiff(twin, entryState());
    assert.equal(d !== null, seenAtDispatch, `the real dispatch's view of the ${label} twin moved`);
    console.log(`  TEETH/${label}: real dispatch ${d ? `caught — ${show(d)}` : "BLIND, as recorded"}`);
  });
}
