// SPDX-License-Identifier: GPL-3.0-only
/**
 * closeOneTurnOfTheFreeSlotSearch — a captured corpus, crafted sweeps over the count and over slot
 * occupancy, a whole-game arm for the register pair the rewrite drops, and a MASKED diff.
 *
 * This entry is the bottom of a loop: while the count holds it transfers back to the body, which
 * reads a slot, may draw the random register and spawn an object, and comes back for the next turn.
 * So one comparison is the whole remainder of the pass, on both sides; whichever side is under way
 * is what the loop's own re-entries run.
 *
 * The dissolved body drops its tail return and never writes the stack scratch the frozen side
 * leaves below its seat, so that window is masked (floor watched off the oracle's pushes, proved
 * above the data) and the two-byte drift is asserted. The registers the body leaves differ and are
 * excluded as a ceiling; the LIVE-REGISTERS arm settles that they are dead where the pass ENDS by
 * running the whole game with each scribbled, carrying a memory control and a register control so an
 * absence cannot look like a blind instrument. Whether the pair is read INSIDE the loop is the
 * corpus and sweep arms' question, since they run every remaining turn and compare all of RAM.
 *
 * HOLE: the sweeps vary the count and the slot heads only; the rest is whatever the frame left.
 * HOLE: the whole-game arm is one tape of 1400 frames.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-3847.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { closeOneTurnOfTheFreeSlotSearch } from "../closeOneTurnOfTheFreeSlotSearch.js";
import { loc_3847 as oracle } from "../../translated/loc_3847.js";
// The neighbouring routine whose product IS a register: it hands a value back that its caller
// stores. It is the LIVE-REGISTERS arm's second positive control and nothing else.
import { loc_382d as registerProducer } from "../../translated/loc_382d.js";
import { wholeMachineEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x3847;
const REGISTER_PRODUCER = 0x382d;
const SLOT_BODY = 0x37d6;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const RECORD_STRIDE = 16;
const ENTRY_STRIDE = 2;

/** The lowest record a five-slot walk reaches, how many slots it covers, and where it is seated. */
const BANK_FLOOR = 0xa850;
const BANK_SLOTS = 5;
const BANK_SEAT = BANK_FLOOR + BANK_SLOTS * RECORD_STRIDE;
const BANK_ENTRY_SEAT = 0xaa24;
const OCCUPANCY_PATTERNS = 1 << BANK_SLOTS;
/** A head byte that marks a slot busy; the body only fills a slot whose head reads zero. */
const BUSY = 0xff;

/** Counts that keep the walk inside its bank from the highest seat the corpus shows. */
const COUNT_VALUES = 8;

/** Every data write lands at or below here; the stack seats far above it, so the mask is safe. */
const DATA_TOP = 0xadff;

/**
 * The ceiling on divergence, measured: the flag byte and the register pair the oracle stages its
 * backward step in, the accumulator and shadow set the dissolved body leaves differently, and the
 * stack pointer it moves by taking the return the rewrite leaves. Checked as a SUBSET, so a rewrite
 * that diverged on fewer would still pass and this can never refuse a fix.
 */
const EXCLUDED = ["f", "d", "e", "sp", "a", "a_", "f_", "b_", "c_", "d_", "e_", "h_", "l_"];

/** Registers the LIVE-REGISTERS arm scribbles, one game each; a flip not an assignment, so it can
 * never land on the value already held and read as tested when it was not. */
const SCRIBBLED = ["de", "hl", "a", "f", "b", "ix", "iy"];
const FLIP = 0xffff;
/** A cell the walk reads, flipped the same way as the memory positive control for that arm. */
const CONTROL_CELL = BANK_FLOOR;

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) =>
  d ? `${d.addr == null ? "registers" : hex4(d.addr)}: frozen=${d.a} rewrite=${d.b}` : "identical";

// ── the captured corpus ─────────────────────────────────────────────────────────────────

let corpus = null;

/** WHICH SIDE THE LOOP RUNS. Every turn after the first re-enters through the registry, so the
 * body under test is wired for those re-entries too — exercised on every turn, not just the first. */
let dispatchBody = oracle;

/** Run `body` on `machine` with the same body wired for the loop's own re-entries. */
function runAs(body, machine) {
  dispatchBody = body;
  try {
    body(machine);
  } finally {
    dispatchBody = oracle;
  }
}

/** Machines at every real dispatch. The guard matters: replaying re-enters this address, and
 * without it the list would fill with states minted by the replay, not the game. */
function capture() {
  if (corpus) return corpus;
  let collecting = true;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (collecting) entries.push(mm.clone());
    return dispatchBody(mm);
  }]]));
  const frames = m.runFrames(ENTRY_FRAMES);
  collecting = false;
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the capture run ran short");
  corpus = entries;
  return corpus;
}

function anEntry() {
  const entries = capture();
  assert.notEqual(entries[0] ?? null, null, "vacuous: the tape never reached the routine");
  return entries[0];
}

/**
 * Oracle vs candidate on independent clones: the whole dump outside the dead stack scratch, then
 * the registers outside the ceiling. The frozen body pushes below its seat and takes a return the
 * rewrite leaves; [low, seat) is masked, low watched off the oracle's own pushes.
 */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  try {
    runAs(oracle, a);
  } catch (e) {
    return { addr: null, a: `the frozen side threw: ${String(e).slice(0, 40)}`, b: "not run" };
  }
  try {
    runAs(candidate, b);
  } catch (e) {
    return { addr: null, a: "returned", b: String(e).slice(0, 40) };
  }
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    return { addr, a: da[i], b: db[i] };
  }
  for (const k of REG_FIELDS) {
    if (EXCLUDED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) return { addr: null, a: `${k}=${a.regs[k]}`, b: `${k}=${b.regs[k]}` };
  }
  return null;
}

/** The mask floor and the sp drift, watched off the frozen side's own pushes. */
function maskProbe(machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  runAs(oracle, a);
  runAs(closeOneTurnOfTheFreeSlotSearch, b);
  return { low, seat, spDiff: a.regs.sp - b.regs.sp };
}

/** How many bytes of the whole dump the oracle moves from this entry. */
function oracleFootprint(machine) {
  const before = machine.dumpState().slice();
  const after = machine.clone();
  oracle(after);
  const now = after.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) if (now[i] !== before[i]) n++;
  return n;
}

// ── the crafted sweeps ──────────────────────────────────────────────────────────────────

/** The captured entry with the count set by hand. */
function craftCount(count) {
  const m = anEntry().clone();
  m.regs.b = count;
  return m;
}

/**
 * The captured entry re-seated on the five-slot bank, with each head free or busy by the mask.
 * The seat is one record ABOVE the top slot because the first thing a turn does is step down.
 */
function craftOccupancy(mask, count = BANK_SLOTS) {
  const m = anEntry().clone();
  m.regs.b = count;
  m.regs.ix = BANK_SEAT;
  m.regs.iy = BANK_ENTRY_SEAT;
  for (let i = 0; i < BANK_SLOTS; i++) {
    m.mem8[BANK_FLOOR + i * RECORD_STRIDE] = (mask >> i) & 1 ? BUSY : 0;
  }
  return m;
}

function sweepCounts(candidate) {
  let caught = 0;
  for (let count = 1; count <= COUNT_VALUES; count++) {
    if (unitDiff(candidate, craftCount(count))) caught++;
  }
  return caught;
}

function sweepOccupancy(candidate) {
  let caught = 0;
  for (let mask = 0; mask < OCCUPANCY_PATTERNS; mask++) {
    if (unitDiff(candidate, craftOccupancy(mask))) caught++;
  }
  return caught;
}

function sweepCorpus(candidate) {
  let caught = 0;
  for (const e of capture()) if (unitDiff(candidate, e)) caught++;
  return caught;
}

// ── broken twins ────────────────────────────────────────────────────────────────────────

/** BUG: does nothing, so the walk never steps and never ends. */
function brokenNoOp() {}

/** BUG: steps the record cursor forward instead of back, so the walk climbs out of its bank. */
function brokenWalksForward(m) {
  const { regs } = m;
  regs.ix = regs.ix + RECORD_STRIDE;
  regs.iy = regs.iy - ENTRY_STRIDE;
  regs.b = regs.b - 1;
  if (regs.b !== 0) return m.call(SLOT_BODY);
}

/** BUG: steps the record cursor by an entry stride rather than a record stride. */
function brokenRecordStride(m) {
  const { regs } = m;
  regs.ix = regs.ix - ENTRY_STRIDE;
  regs.iy = regs.iy - ENTRY_STRIDE;
  regs.b = regs.b - 1;
  if (regs.b !== 0) return m.call(SLOT_BODY);
}

/** BUG: leaves the entry cursor where it is, so every turn paints the same entry. */
function brokenEntryCursorStuck(m) {
  const { regs } = m;
  regs.ix = regs.ix - RECORD_STRIDE;
  regs.b = regs.b - 1;
  if (regs.b !== 0) return m.call(SLOT_BODY);
}

/** BUG: gives up while one turn is still owed, so the last slot of the bank is never worked. */
function brokenOneTurnShort(m) {
  const { regs } = m;
  regs.ix = regs.ix - RECORD_STRIDE;
  regs.iy = regs.iy - ENTRY_STRIDE;
  regs.b = regs.b - 1;
  if (regs.b > 1) return m.call(SLOT_BODY);
}

/** BUG: ends the walk unconditionally, so only the first turn ever runs. */
function brokenNeverTurnsAgain(m) {
  const { regs } = m;
  regs.ix = regs.ix - RECORD_STRIDE;
  regs.iy = regs.iy - ENTRY_STRIDE;
  regs.b = regs.b - 1;
}

/** BUG: scribbles on a register outside the ceiling; the in-arm control for EXCLUDED. */
function brokenMovesTheCursor(m) {
  closeOneTurnOfTheFreeSlotSearch(m);
  m.regs.iy = m.regs.iy + 1;
}

/** Each twin with the exact number of COUNT and OCCUPANCY sweep points that must catch it. */
const TWINS = [
  ["no-op", brokenNoOp, [8, 32]],
  ["walks-forward", brokenWalksForward, [8, 32]],
  ["record-stepped-by-an-entry", brokenRecordStride, [8, 32]],
  ["entry-cursor-stuck", brokenEntryCursorStuck, [8, 32]],
  ["one-turn-short", brokenOneTurnShort, [1, 4]],
  ["never-turns-again", brokenNeverTurnsAgain, [7, 32]],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("DISPATCHED: the tape reaches the routine, and the oracle does work there", { skip }, () => {
  const entries = capture();
  assert.notEqual(entries[0] ?? null, null, "vacuous: the tape never reached the routine");
  const footprints = entries.map(oracleFootprint);
  const busy = footprints.filter((n) => n > 0).length;
  // Most entries land on a full bank and write nothing -- the routine behaving; but a corpus where
  // NONE wrote would be all no-ops, and every comparison over it would pass a no-op twin.
  assert.ok(busy > 0, "no captured entry makes the oracle write a single byte, so the corpus is " +
    "all no-ops and the arms over it would pass a rewrite that did nothing");
  const counts = [...new Set(entries.map((e) => e.regs.b))].sort((p, q) => p - q);
  assert.ok(counts.includes(1) && counts.length > 1,
    "the corpus does not contain both a last turn and an earlier one, so it covers one arm of " +
      "the split only");
  console.log(`  DISPATCHED: ${entries.length} real entries, counts ${counts.join(", ")}; ` +
    `${busy} of them make the oracle write, up to ${Math.max(...footprints)} bytes`);
});

test("CORPUS: every captured entry replays identically", { skip }, () => {
  for (const e of capture()) {
    const d = unitDiff(closeOneTurnOfTheFreeSlotSearch, e);
    assert.equal(d, null, `count ${e.regs.b} at ${hex4(e.regs.ix)}: ${show(d)}`);
  }
  console.log(`  CORPUS: ${capture().length} captured entries identical`);
});

test("COUNT: every count that keeps the walk in its bank, both arms of the split", { skip }, () => {
  assert.equal(sweepCounts(closeOneTurnOfTheFreeSlotSearch), 0, "a count diverged");
  // The sweep is worth nothing unless the count really decides how many turns run, so measure
  // that instead of assuming it: over an all-busy bank no turn can end the walk early, and the
  // record cursor must come to rest exactly `count` records below its seat.
  const reached = [];
  for (let count = 1; count <= BANK_SLOTS; count++) {
    const c = craftOccupancy(OCCUPANCY_PATTERNS - 1, count);
    oracle(c);
    reached.push(c.regs.ix);
    assert.equal(c.regs.ix, BANK_SEAT - count * RECORD_STRIDE,
      `a count of ${count} did not run ${count} turns, so this arm is not measuring the count`);
  }
  assert.equal(new Set(reached).size, BANK_SLOTS, "two counts stopped the walk in the same place");
  console.log(`  COUNT: ${COUNT_VALUES} counts identical; over a full bank the cursor comes to ` +
    `rest at ${reached.map(hex4).join(", ")}`);
});

test("OCCUPANCY: all 32 free/busy patterns of the reachable slot heads", { skip }, () => {
  assert.equal(sweepOccupancy(closeOneTurnOfTheFreeSlotSearch), 0, "an occupancy pattern diverged");
  const allBusy = oracleFootprint(craftOccupancy(OCCUPANCY_PATTERNS - 1));
  const allFree = oracleFootprint(craftOccupancy(0));
  assert.notEqual(allBusy, allFree,
    "an all-busy bank and an all-free bank move the same number of bytes, so this sweep is not " +
      "reaching the decision the slot heads drive");
  console.log(`  OCCUPANCY: ${OCCUPANCY_PATTERNS} patterns identical; all-free moves ` +
    `${allFree} bytes, all-busy moves ${allBusy}`);
});

test("SP AND SCRATCH: the drift is exactly two bytes and the mask floor sits above the data",
  { skip }, () => {
    // Over the corpus and a crafted all-free bank, the frozen side pops one return the rewrite
    // leaves, and its deepest push stays above every data cell — so the mask can hide nothing real.
    const probes = [...capture(), craftOccupancy(0)];
    for (const e of probes) {
      const r = maskProbe(e);
      assert.equal(r.spDiff, 2, `the frozen side no longer re-seats two bytes higher (${r.spDiff})`);
      assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached down into game data`);
    }
    const r = maskProbe(craftOccupancy(0));
    console.log(`  SP AND SCRATCH: spDiff 2 on ${probes.length} states; window floor ${hex4(r.low)}`);
  });

test("LIVE REGISTERS: nothing reads what the pass leaves, with two positive controls",
  { skip }, () => {
    const game = (addr, spoil) =>
      wholeMachineEquivalence(makeMachine, ENTRY_FRAMES, new Map([[addr, spoil]]));

    // CONTROL ONE: the same instrument, the same instant, a MEMORY scribble. If this passes the
    // instrument cannot see anything and every clean reading below is worthless.
    const memControl = game(TARGET, (m) => {
      const r = oracle(m);
      m.mem8[CONTROL_CELL] = m.mem8[CONTROL_CELL] ^ 0xff;
      return r;
    });
    assert.equal(memControl.equal, false,
      "scribbling on a cell the walk reads changed nothing over the whole run, so this " +
        "instrument is blind and the register readings below mean nothing");

    // CONTROL TWO: a REGISTER scribble, at a neighbouring routine that really does hand a value
    // back in one. Memory sensitivity is not register sensitivity, and only this shows the
    // latter.
    const regControl = game(REGISTER_PRODUCER, (m) => {
      const r = registerProducer(m);
      m.regs.a = m.regs.a ^ FLIP;
      return r;
    });
    assert.equal(regControl.equal, false,
      "scribbling the value a neighbouring routine hands back in a register changed nothing, so " +
        "this instrument cannot see a live register at all");

    const survived = [];
    for (const reg of SCRIBBLED) {
      const r = game(TARGET, (m) => {
        const out = oracle(m);
        m.regs[reg] = m.regs[reg] ^ FLIP;
        return out;
      });
      assert.ok(r.invocations.get(TARGET) > 0, `the ${reg} run never dispatched the routine`);
      if (r.equal) survived.push(reg);
    }
    assert.deepEqual(survived, SCRIBBLED,
      "a register left behind by this pass IS read downstream, so the rewrite may not drop it");
    console.log(`  LIVE REGISTERS: ${SCRIBBLED.join(", ")} all scribbled with no effect over ` +
      `${ENTRY_FRAMES} frames; the memory control failed at ${hex4(memControl.addr ?? 0)} on ` +
      `frame ${memControl.frame} and the register control at ${hex4(regControl.addr ?? 0)} on ` +
      `frame ${regControl.frame}`);
  });

/** Which registers a candidate parts company with the oracle on, over the corpus. */
function movedOver(candidate) {
  const moved = new Set();
  for (const e of capture()) {
    const a = e.clone();
    const b = e.clone();
    runAs(oracle, a);
    try {
      runAs(candidate, b);
    } catch {
      continue;
    }
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

/** The same, over the crafted count sweep, where the last turn's arm is reached from a cold seat. */
function movedOverCounts(candidate) {
  const moved = new Set();
  for (let count = 1; count <= COUNT_VALUES; count++) {
    const a = craftCount(count);
    const b = craftCount(count);
    runAs(oracle, a);
    try {
      runAs(candidate, b);
    } catch {
      continue;
    }
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

test("EXCLUDED, deliberately: the flag byte, the staging pair and the stack pointer",
  { skip }, () => {
    const moved = new Set([...movedOver(closeOneTurnOfTheFreeSlotSearch), ...movedOverCounts(closeOneTurnOfTheFreeSlotSearch)]);
    const control = movedOver(brokenMovesTheCursor);
    assert.ok(REG_FIELDS.some((k) => control.has(k) && !EXCLUDED.includes(k)),
      "the measurement reports nothing outside the ceiling even for a twin that scribbles on a " +
        "cursor, so a clean reading here proves nothing");
    const unexpected = REG_FIELDS.filter((k) => moved.has(k) && !EXCLUDED.includes(k));
    assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
    // Reported and not asserted, on purpose: a member that stopped moving would mean the rewrite
    // got CLOSER to the oracle, and a gate that demanded the divergence would refuse that fix.
    const idle = EXCLUDED.filter((k) => !moved.has(k));
    console.log(`  EXCLUDED (measured): observed moving ` +
      `${EXCLUDED.filter((k) => moved.has(k)).join(", ")}` +
      `${idle.length ? `; declared but never seen moving: ${idle.join(", ")}` : ""}; ` +
      `the control twin also moves ` +
      `${REG_FIELDS.filter((k) => control.has(k) && !EXCLUDED.includes(k)).join(", ")}`);
  });

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const onCorpus = sweepCorpus(twin);
    const fixed = [sweepCounts(twin), sweepOccupancy(twin)];
    console.log(`  TEETH/${label}: caught on ${onCorpus}/${capture().length} corpus, ` +
      `${fixed[0]}/${COUNT_VALUES} counts, ${fixed[1]}/${OCCUPANCY_PATTERNS} patterns`);
    assert.ok(onCorpus + fixed[0] + fixed[1] > 0, `every sweep PASSED the ${label} twin`);
    assert.deepEqual(fixed, expected, `the ${label} twin's catch counts on the fixed sweeps moved`);
  });
}
