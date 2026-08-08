// SPDX-License-Identifier: GPL-3.0-only
/**
 * freeAllShotSlots — memory-equivalent to the frozen oracle at ROM 0x2755.
 *
 * ★ THE REAL DISPATCHES ARE VACUOUS AND THIS GATE MEASURES THAT RATHER THAN GLOSSING IT. Both of
 *   the dispatches the tape produces arrive with the whole array already zero, so the routine
 *   writes zeros over zeros and a do-nothing candidate is byte-identical at each. The arm below
 *   asserts exactly that, and every discriminating arm here is a crafted entry.
 *
 * GATE: strict unit-capture, both captured dispatches replayed, a crafted sweep over the array's
 *   prior contents, a crafted sweep over the two PROGRAM-SPACE bytes the routine takes its fill
 *   and its stride from, a whole-machine replay, and teeth.
 *   1. EQUAL at the real dispatch — the whole dump identical, stack scratch included.
 *   2. VACUITY, MEASURED — a no-op passes the RAM half at both real dispatches, and the two arms
 *      that do catch it are named.
 *   3. EXCLUDED, deliberately, BOUNDED by a declared set — nothing outside it may move, and a
 *      rewrite that clobbers fewer of them stays green. The record cursor is NOT in that set: the
 *      rewrite leaves the same value there, which is a live-out claim this arm makes falsifiable,
 *      because a cursor that diverged would be outside the set and would fail the arm.
 *   4. CORPUS — both dispatches.
 *   5. CRAFTED PRIORS — the six slots filled with patterns, so the writes have something to erase.
 *   6. CRAFTED SOURCE BYTES — the fill byte and the stride's low half are read from program space,
 *      and this arm patches a PRIVATE copy of that space to prove the rewrite reads them rather
 *      than carrying them as constants; both arms see the same patch.
 *   7. WHOLE-MACHINE — the session replayed with the rewrite wired through a measured shim.
 *   8. TEETH — seven twins, each with an exact catch count on each crafted sweep.
 *
 * HOLE: only ONE array base is exercised. Both dispatches present the same base, and it is fixed
 *   inside the routine, so nothing here varies it.
 * HOLE: the source sweep uses only fill bytes that keep the six slots inside writable memory.
 *   The stride's HIGH half IS the fill byte, so a large fill throws the writes into program space,
 *   where the address space refuses them — those combinations are outside this sweep.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-2755.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { freeAllShotSlots } from "../freeAllShotSlots.js";
import { loc_2755 as oracle } from "../../translated/loc_2755.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x2755;

const SLOT_ARRAY = 0xaa80;
const SLOTS = 6;
const SECOND_CLEARED_BYTE = 4;
const STRIDE_LOW_SOURCE = 0x0861;
const FILL_SOURCE = 0x5c01;

const MOVED = ["a", "f", "b", "e", "h", "l", "sp"];
const CORPUS_FRAMES = 1400;
const WHOLE_FRAMES = 1400;
const RET_TSTATES = 10;

/** Measured over the corpus below; a move is a finding. */
const DISPATCHES = 2;

const PRIORS = [0x00, 0xff, 0x5a, 0x01];
const FILLS = [0x00, 0x01];
const STRIDES = [0x10, 0x08, 0x20, 0x11];
const SOURCE_COMBINATIONS = FILLS.length * STRIDES.length;

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
  if (entry === null) gate(freeAllShotSlots);
  return entry;
}

function ramDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/** RAM first, then the record cursor, which is the one register this rewrite claims as a result. */
function unitDiff(candidate, machine) {
  const ram = ramDiff(candidate, machine);
  if (ram) return ram;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return a.regs.ix === b.regs.ix ? null : { addr: null, a: a.regs.ix, b: b.regs.ix };
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

/** A real captured machine with the whole array region filled, so the writes have work to do. */
function craftPrior(prior) {
  const m = entryState().clone();
  for (let i = 0; i < SLOTS * 0x20; i++) m.mem8[SLOT_ARRAY + i] = prior;
  return m;
}

/**
 * The same, with the two program-space bytes patched on a PRIVATE copy of that space, so both
 * arms read the patched values and neither can be right by having them baked in.
 */
function craftSource(fill, stride) {
  const m = craftPrior(0xa5);
  const patched = Uint8Array.from(m.rom);
  patched[FILL_SOURCE] = fill;
  patched[STRIDE_LOW_SOURCE] = stride;
  m.rom = patched; // what a clone is rebuilt from
  m.mem.rom = patched; // what a read goes through
  return m;
}

const priorCaught = (candidate) =>
  PRIORS.filter((p) => unitDiff(candidate, craftPrior(p)) !== null).length;

const sourceCaught = (candidate) => {
  let n = 0;
  for (const fill of FILLS) {
    for (const stride of STRIDES) if (unitDiff(candidate, craftSource(fill, stride))) n++;
  }
  return n;
};

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

const readFill = (m) => m.mem8[FILL_SOURCE];
const readStride = (m) => m.mem8[STRIDE_LOW_SOURCE] | (m.mem8[FILL_SOURCE] << 8);

/** BUG: does nothing at all — invisible at every real dispatch, which is the vacuity finding. */
function brokenNoOp() {}

/** BUG: clears the occupancy byte and forgets the second byte of each slot. */
function brokenFirstByteOnly(m) {
  let slot = SLOT_ARRAY;
  for (let i = 0; i < SLOTS; i++) {
    m.mem8[slot] = readFill(m);
    slot = (slot + readStride(m)) & 0xffff;
  }
  m.regs.ix = slot;
}

/** BUG: clears five slots, so the last one keeps whatever it held. */
function brokenOneSlotShort(m) {
  let slot = SLOT_ARRAY;
  for (let i = 0; i < SLOTS - 1; i++) {
    m.mem8[slot] = readFill(m);
    m.mem8[(slot + SECOND_CLEARED_BYTE) & 0xffff] = readFill(m);
    slot = (slot + readStride(m)) & 0xffff;
  }
  m.regs.ix = slot;
}

/** BUG: the fill byte is baked in rather than read, so a patched source byte is ignored. */
function brokenHardcodedFill(m) {
  let slot = SLOT_ARRAY;
  for (let i = 0; i < SLOTS; i++) {
    m.mem8[slot] = 0;
    m.mem8[(slot + SECOND_CLEARED_BYTE) & 0xffff] = 0;
    slot = (slot + readStride(m)) & 0xffff;
  }
  m.regs.ix = slot;
}

/** BUG: the stride is baked in rather than read, so a patched source byte moves nothing. */
function brokenHardcodedStride(m) {
  let slot = SLOT_ARRAY;
  for (let i = 0; i < SLOTS; i++) {
    m.mem8[slot] = readFill(m);
    m.mem8[(slot + SECOND_CLEARED_BYTE) & 0xffff] = readFill(m);
    slot = (slot + 0x10) & 0xffff;
  }
  m.regs.ix = slot;
}

/** BUG: clears the wrong second byte, one place along from the right one. */
function brokenWrongSecondByte(m) {
  let slot = SLOT_ARRAY;
  for (let i = 0; i < SLOTS; i++) {
    m.mem8[slot] = readFill(m);
    m.mem8[(slot + SECOND_CLEARED_BYTE + 1) & 0xffff] = readFill(m);
    slot = (slot + readStride(m)) & 0xffff;
  }
  m.regs.ix = slot;
}

/** BUG: leaves the record cursor where it started, which no RAM comparison can see. */
function brokenCursorNotAdvanced(m) {
  let slot = SLOT_ARRAY;
  for (let i = 0; i < SLOTS; i++) {
    m.mem8[slot] = readFill(m);
    m.mem8[(slot + SECOND_CLEARED_BYTE) & 0xffff] = readFill(m);
    slot = (slot + readStride(m)) & 0xffff;
  }
  m.regs.ix = SLOT_ARRAY;
}

/** Per twin: catches on the prior sweep, on the source sweep, and at the real dispatch. */
const TWINS = [
  ["no-op", brokenNoOp, 4, 8, true],
  ["first-byte-only", brokenFirstByteOnly, 3, 8, false],
  ["one-slot-short", brokenOneSlotShort, 4, 8, true],
  ["hardcoded-fill", brokenHardcodedFill, 0, 4, false],
  ["hardcoded-stride", brokenHardcodedStride, 0, 7, false],
  ["wrong-second-byte", brokenWrongSecondByte, 3, 8, false],
  ["cursor-not-advanced", brokenCursorNotAdvanced, 4, 8, true],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: freeAllShotSlots == oracle on the dump and the cursor", { skip }, () => {
  const r = gate(freeAllShotSlots);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  assert.equal(unitDiff(freeAllShotSlots, entryState()), null, "the record cursor diverged");
  console.log("  EQUAL: every byte identical, the stack scratch included, and the cursor agrees");
});

test("VACUITY, MEASURED: RAM sees nothing at any real dispatch", { skip }, () => {
  const entries = captureCorpus();
  const seen = entries.filter((e) => ramDiff(brokenNoOp, e) !== null).length;
  assert.equal(
    seen,
    0,
    "a real dispatch caught a do-nothing candidate ON RAM, so the array is NOT already clear " +
      "when this runs and the framing of this file has to be re-derived",
  );
  assert.notEqual(
    unitDiff(brokenNoOp, entryState()),
    null,
    "with RAM blind, the record cursor is the only thing left holding this entry to anything",
  );
  assert.notEqual(
    ramDiff(brokenNoOp, craftPrior(0xff)),
    null,
    "and a crafted prior must put the writes back inside RAM's view",
  );
  console.log(
    `  VACUITY: RAM sees a no-op at 0 of ${entries.length} real dispatches; the cursor and the ` +
      "crafted priors are what catch it",
  );
});

test("EXCLUDED, deliberately: scratch registers and pc, but NOT the record cursor", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  freeAllShotSlots(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  const unexpected = moved.filter((k) => !MOVED.includes(k));
  assert.deepEqual(
    unexpected,
    [],
    "a register diverged outside the excluded set: the record cursor must agree on both arms",
  );
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${MOVED.join(", ")} and pc — the record cursor is a live-out`);
});

test("CORPUS: every captured dispatch replays identically", { skip }, () => {
  const entries = captureCorpus();
  assert.equal(entries.length, DISPATCHES, "the dispatch count moved");
  for (const captured of entries) {
    assert.equal(unitDiff(freeAllShotSlots, captured), null, "a captured dispatch diverged");
  }
  console.log(`  CORPUS: ${entries.length} dispatches, identical`);
});

test("CRAFTED PRIORS: the array filled with patterns is cleared identically", { skip }, () => {
  for (const p of PRIORS) {
    const d = unitDiff(freeAllShotSlots, craftPrior(p));
    assert.equal(d, null, `prior ${p}: ${show(d)}`);
  }
  console.log(`  CRAFTED PRIORS: ${PRIORS.length} fill patterns identical`);
});

test("CRAFTED SOURCE: a patched fill and stride move both arms the same way", { skip }, () => {
  for (const fill of FILLS) {
    for (const stride of STRIDES) {
      const d = unitDiff(freeAllShotSlots, craftSource(fill, stride));
      assert.equal(d, null, `fill ${fill} stride ${stride}: ${show(d)}`);
    }
  }
  const patched = craftSource(0x01, 0x08);
  freeAllShotSlots(patched);
  assert.equal(patched.mem8[SLOT_ARRAY], 0x01, "the patched fill byte must be what gets written");
  assert.equal(
    patched.mem8[SLOT_ARRAY + 0x0108],
    0x01,
    "and the patched stride, whose high half is that same fill byte, must place the next slot",
  );
  console.log(`  CRAFTED SOURCE: ${SOURCE_COMBINATIONS} patched combinations identical`);
});

test("WHOLE-MACHINE: the session is byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(freeAllShotSlots);
  assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the override never dispatched");
  assert.equal(w.framesCompared, WHOLE_FRAMES, "the replay ran short");
  assert.equal(w.equal, true, `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  console.log(`  WHOLE-MACHINE: ${w.framesCompared} frames, ${w.invocations.get(TARGET)} dispatches`);
});

test("TEETH: removing the shim's return kills the run, so the shim is load-bearing", { skip }, () => {
  let died = null;
  try {
    const w = wholeMachineEquivalence(factory, WHOLE_FRAMES, new Map([[TARGET, freeAllShotSlots]]));
    died = w.equal ? null : "forked";
  } catch (e) {
    died = String(e).slice(0, 80);
  }
  assert.notEqual(died, null, "the unshimmed rewrite ran clean, so the shim proves nothing");
  console.log(`  TEETH/shim: the unshimmed rewrite dies — ${died}`);
});

for (const [label, twin, priors, sources, seenAtDispatch] of TWINS) {
  test(`TEETH: the ${label} twin is caught on exact counts of both crafted sweeps`, { skip }, () => {
    assert.equal(priorCaught(twin), priors, `the ${label} twin's prior catch count moved`);
    assert.equal(sourceCaught(twin), sources, `the ${label} twin's source catch count moved`);
    console.log(`  TEETH/${label}: priors ${priors}/${PRIORS.length}, sources ${sources}/${SOURCE_COMBINATIONS}`);
  });

  test(`TEETH: the ${label} twin at the real dispatch, hole pinned`, { skip }, () => {
    const d = unitDiff(twin, entryState());
    assert.equal(d !== null, seenAtDispatch, `the real dispatch's view of the ${label} twin moved`);
    console.log(`  TEETH/${label}: real dispatch ${d ? "catches it" : "is BLIND, as recorded"}`);
  });
}
