// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence gate for loc_20b5 (ROM 0x20B5) — the arm that stamps a −1.0 px/frame horizontal step
 * onto an object record whose whole-pixel step byte is zero, and routes every other record to the
 * mirror arm at ROM 0x20E1. Both exits continue into the still-frozen tail at ROM 0x20C3.
 *
 * WHAT IS COMPARED, and it is MORE than the standard contract. Both continuations are frozen and
 * run identically on both sides, so everything downstream of the two stores is common code and can
 * be asserted rather than excluded:
 *   - the FULL state dump, STACK_SCRATCH INCLUDED. The usual exclusion exists for a rewrite that
 *     dissolves the oracle's call brackets; this one dissolves none — the oracle reaches ROM 0x20E1
 *     by a jump and ROM 0x20C3 by falling through, so neither exit pushes anything and the rewrite
 *     makes exactly the same two registry calls the oracle makes. The stack region therefore has to
 *     match, and asserting it is teeth the exclusion would throw away. Test 1 asserts the dump
 *     really does span that window, so "STACK_SCRATCH included" is not a claim about an empty set.
 *   - the ORACLE's and the CANDIDATE's whole ordered write sequences (address AND value). This is
 *     the only half that can see a value-neutral store — the oracle writes the fraction FIRST and
 *     the whole byte SECOND, and swapping them leaves identical RAM. Carried as a teeth case.
 *   - the entire exit register file (flags and the shadow set included), pc and SP. This routine
 *     writes no register the continuation does not immediately overwrite, so anything visible at
 *     the exit belongs to that common code and must match exactly. There is no dead-register
 *     exclusion to defend.
 *   - the propagated return value, which is `undefined` on every entry reached here — so it is
 *     asserted but carries little on its own, and test 6 manufactures the observable that the weak
 *     return leaves missing.
 * Cycles are NOT compared: they are what cycle-free code gives up. Test 2 measures the difference
 * explicitly and test 3 charges it back.
 *
 *   0/1. REACHABILITY + EQUAL (captured) — 0x20B5 is dispatched naturally during attract, and every
 *        dispatch is replayed INLINE at the dispatch: two clones, oracle on one, candidate on the
 *        other, compare, discard. That is O(1) memory and covers EVERY dispatch, so there is no
 *        sampling policy to be wrong about. The tests assert the dispatch count, that BOTH arms
 *        occur, and that attract delivers only the two whole-pixel bytes 0 and 255 — the honest
 *        hole the crafted sweep in test 5 exists to fill, asserted so it cannot quietly become
 *        coverage.
 *   2. CYCLES — the rewrite spends exactly 71 fewer T-states than the oracle on the local arm and
 *      33 fewer on the mirror arm, at every capture. Both constants are pinned by real captures
 *      because attract exercises both arms. They are what test 3 charges back.
 *   3. LIVE — the live-out measurement: the rewrite wired at 0x20B5 for a whole 4000-frame attract
 *      run, its per-frame trace diffed against the all-oracle baseline on EVERY cell, stack
 *      region included, with the dispatch count asserted non-zero and equal to the oracle run's.
 *      COVERAGE: attract only. Gameplay, the other boards and every crafted shape are not run live.
 *   4. LIVE TEETH — dropping the cycle charge MUST move the trace, so test 3 is sensitive rather
 *      than lenient.
 *   5. EQUAL (crafted) — all 256 whole-pixel step bytes crossed with four fractions (1024 entries),
 *      each a real captured state with two surgical pokes applied identically to both sides, plus
 *      all ten OBJ_ARRAY_67 record bases. This is the only thing that reaches the whole-pixel bytes
 *      1..254 at all.
 *   6. TAIL CHOICE — the manufactured observable. The two continuations are replaced by stubs on a
 *      real captured machine, so which one the routine enters, and with which record pointer,
 *      becomes directly visible instead of being inferred from a 35-write chain. The stubs are
 *      installed on the machine that is actually run (a stub does not survive clone()) and their
 *      liveness is asserted, both from the recorded calls and from a marker byte in RAM.
 *   7. TEETH — seven broken twins, each of which this contract must catch, followed by two tests
 *      that pin WHICH half catches what: a swapped store ORDER, which the state, the registers and
 *      the return are all blind to and only the write sequence sees; and a twin that misreads a
 *      whole-pixel byte attract never delivers, which every one of the 23 real dispatches misses
 *      and only the crafted sweep catches — so neither half of the gate is decorative.
 *
 * ON RE-ENTRY. The tail runs the rest of the object walk, which can dispatch 0x20B5 again for a
 * later slot, and a clone carries the source machine's override map. The hook therefore has two
 * disarms: it delegates straight to the oracle while a replay is in progress, and again once the
 * host run is over. So every comparison runs ONE dispatch of the candidate with the oracle
 * underneath it on both sides, and no replay can recurse into another replay.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-20b5.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine } from "../../machine.js";
import { loc_20b5 as oracle } from "../../translated/loc_20b5.js";
import { loc_20b5 } from "../loc_20b5.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { STACK_SCRATCH, OBJ_ARRAY_67 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x20b5;

// The record fields, mirrored from the routine under test.
const STEP_WHOLE = 16;
const STEP_FRACTION = 17;

// The two continuations, both still frozen and both in this decompile batch.
const MIRROR_ARM = 0x20e1; // reached by a jump when the whole-pixel byte is nonzero
const SHARED_TAIL = 0x20c3; // reached by falling through, after the two stores

// The oracle's T-states the cycle-free rewrite does not spend, per arm. Mirror arm: the load (19),
// the test (4) and the taken jump (10). Local arm: those three plus the two stores (19 each) — the
// jump is not taken there and ROM 0x20C3 is entered by falling through, so there is no jump to pay
// for. Asserted against real captures in test 2 rather than trusted.
const MIRROR_ARM_SKIPPED = 33;
const LOCAL_ARM_SKIPPED = 71;

const ATTRACT_FRAMES = 4000;

// What a 4000-frame attract run does, measured. A change here means the coverage numbers in the
// routine header have to be re-derived, which is why these are asserted and not just printed.
const EXPECTED_DISPATCHES = 23;
const EXPECTED_SHAPES = [0, 255]; // the only whole-pixel step bytes attract delivers

const hx = (v) => "0x" + (v & 0xffff).toString(16);

/** The whole register file as a comparable string — flags and the shadow set included. */
const regSnapshot = (m) => REG_FIELDS.map((k) => `${k}=${m.regs[k]}`).join(" ");

/** Record every (address, value) a machine writes while `fn` runs, in order. */
function recordWrites(m, fn) {
  const writes = [];
  const base = m.mem.write8.bind(m.mem);
  m.mem.write8 = (addr, value) => {
    writes.push(`${addr & 0xffff}:${value & 0xff}`);
    return base(addr, value);
  };
  let ret, threw = null;
  try {
    ret = fn(m);
  } catch (e) {
    threw = e; // a broken twin can FAULT rather than diverge; that is a result, not a crash
  }
  m.mem.write8 = base;
  return { writes, ret, threw };
}

/** First differing byte of the FULL state dump — nothing excluded, stack region included. */
function firstStateDiff(a, b) {
  const da = a.dumpState(), db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] !== db[i]) return { addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] };
  }
  return null;
}

/** Run the oracle and a candidate on two byte-identical clones and report the whole contract. */
function comparePair(entry, fn) {
  const o = entry.clone();
  const c = entry.clone();

  const ro = recordWrites(o, oracle);
  const rc = recordWrites(c, fn);
  if (ro.threw) throw ro.threw; // the oracle faulting is a harness bug, not a result

  const writeDiff = (() => {
    const n = Math.min(ro.writes.length, rc.writes.length);
    for (let i = 0; i < n; i++) if (ro.writes[i] !== rc.writes[i]) return { i, a: ro.writes[i], b: rc.writes[i] };
    if (ro.writes.length !== rc.writes.length) return { i: n, a: ro.writes[n] ?? "(end)", b: rc.writes[n] ?? "(end)" };
    return null;
  })();

  return {
    threw: rc.threw,
    state: rc.threw ? null : firstStateDiff(o, c),
    writeDiff: rc.threw ? null : writeDiff,
    regsO: regSnapshot(o), regsC: rc.threw ? null : regSnapshot(c),
    pcO: o.pc, pcC: rc.threw ? null : c.pc,
    retO: ro.ret, retC: rc.ret,
    oracleMachine: o,
  };
}

const mismatched = (r) =>
  r.threw != null || r.state !== null || r.writeDiff !== null ||
  r.regsO !== r.regsC || r.pcO !== r.pcC || r.retO !== r.retC;

const describeMismatch = (r) =>
  r.threw ? `candidate threw: ${r.threw.message}`
    : r.state ? `state@${hx(r.state.addr)} oracle=${r.state.a} cand=${r.state.b}`
      : r.writeDiff ? `write #${r.writeDiff.i} (addr:value) oracle=${r.writeDiff.a} cand=${r.writeDiff.b}`
        : r.regsO !== r.regsC ? `exit registers differ:\n    oracle=${r.regsO}\n    cand  =${r.regsC}`
          : r.pcO !== r.pcC ? `exit pc oracle=${hx(r.pcO)} cand=${hx(r.pcC)}`
            : `return oracle=${r.retO} cand=${r.retC}`;

// -- 0/1. real dispatches, replayed inline ------------------------------------

// Two disarms, both needed — see the header's re-entry note.
let ARMED = true;
let REPLAYING = false;

/**
 * Drive attract with a hook at 0x20B5 that, at EVERY real dispatch, replays the dispatch both ways
 * on two fresh clones and compares them before letting the host proceed on the oracle. Nothing is
 * sampled and nothing is accumulated but the (small) capture list the later tests reuse.
 */
function attractWithInlineReplay(frames, candidate) {
  const caps = [];
  const shapes = new Map();
  const bases = new Map();
  const mismatches = [];
  let dispatches = 0;

  const ov = new Map([[TARGET, (mm) => {
    if (!ARMED || REPLAYING) return oracle(mm);
    dispatches++;
    const whole = mm.mem.read8((mm.regs.ix + STEP_WHOLE) & 0xffff);
    shapes.set(whole, (shapes.get(whole) ?? 0) + 1);
    bases.set(mm.regs.ix, (bases.get(mm.regs.ix) ?? 0) + 1);
    caps.push(mm.clone());

    REPLAYING = true;
    try {
      const r = comparePair(mm, candidate);
      if (mismatched(r)) mismatches.push({ ix: mm.regs.ix, whole, text: describeMismatch(r) });
    } finally {
      REPLAYING = false;
    }
    return oracle(mm);
  }]]);

  new Machine(ROM, { overrides: ov }).runFrames(frames);
  ARMED = false;
  return { caps, shapes, bases, mismatches, dispatches };
}

let RUN = null;
const run = () => (RUN ??= attractWithInlineReplay(ATTRACT_FRAMES, loc_20b5));

test("REACHABILITY: 0x20b5 is dispatched naturally, on both arms, with only two entry shapes", () => {
  const { dispatches, shapes, bases } = run();
  assert.ok(dispatches > 0, "0x20b5 must be dispatched during attract — otherwise this gate proves nothing");
  assert.equal(dispatches, EXPECTED_DISPATCHES,
    `attract now dispatches 0x20b5 ${dispatches} times in ${ATTRACT_FRAMES} frames, not ${EXPECTED_DISPATCHES} — ` +
    "the coverage numbers in loc_20b5.js's header have to be re-derived");

  // Both arms are genuinely exercised by real dispatches, not only by the crafted sweep.
  assert.ok((shapes.get(0) ?? 0) > 0, "attract must reach the arm this body implements (whole-pixel byte 0)");
  assert.ok([...shapes].some(([k, n]) => k !== 0 && n > 0), "attract must reach the mirror arm too");

  // The honest hole, asserted so it cannot silently become coverage.
  assert.deepEqual([...shapes.keys()].sort((p, q) => p - q), EXPECTED_SHAPES,
    `attract now delivers whole-pixel bytes ${[...shapes.keys()].map(hx).join(",")} — the header's ` +
    "two-shape claim and the crafted sweep need updating");
  assert.ok(bases.size > 1, "the dispatches must span more than one record base for record-relativity");

  console.log(`  REACHABILITY: ${dispatches} natural dispatches in ${ATTRACT_FRAMES} attract frames; ` +
    `arms ${[...shapes].map(([k, n]) => `${hx(k)}x${n}`).join(" ")}; ` +
    `${bases.size} record bases (${[...bases.keys()].map(hx).join(",")})`);
});

test("EQUAL (captured): loc_20b5 == oracle on EVERY real dispatch, replayed inline", () => {
  const { mismatches, dispatches, caps } = run();
  assert.equal(mismatches.length, 0,
    mismatches.length ? `${mismatches.length} of ${dispatches} dispatches breached the contract, first at ` +
      `ix=${hx(mismatches[0].ix)} whole=${hx(mismatches[0].whole)}: ${mismatches[0].text}` : "");
  assert.equal(caps.length, dispatches, "every dispatch must have been replayed — no sampling here");

  // The claim "STACK_SCRATCH included" must not be a claim about an empty set. Array.from, NOT
  // dumpState().map — dumpState returns a Uint8Array whose map would truncate every address.
  const probe = new Machine(ROM);
  const addrOf = Array.from(probe.dumpState(), (_, i) => probe.stateOffsetToAddr(i));
  const inScratch = addrOf.filter((a) => a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi).length;
  assert.equal(inScratch, STACK_SCRATCH.hi - STACK_SCRATCH.lo,
    "the compared state dump does not actually span STACK_SCRATCH, so including it proves nothing");

  // Non-vacuity: the oracle really did change the record, from a value that was not the target.
  const local = caps.find((e) => e.mem.read8((e.regs.ix + STEP_WHOLE) & 0xffff) === 0);
  assert.ok(local, "expected at least one capture on the local arm");
  const after = comparePair(local, loc_20b5).oracleMachine;
  assert.equal(after.mem.read8((local.regs.ix + STEP_WHOLE) & 0xffff), 255, "oracle must leave whole pixels = 255");
  assert.equal(after.mem.read8((local.regs.ix + STEP_FRACTION) & 0xffff), 0, "oracle must leave the fraction = 0");

  console.log(`  EQUAL/captured: ${dispatches} of ${dispatches} real dispatches replayed inline (all of them) — ` +
    `identical on the FULL state dump (${inScratch} STACK_SCRATCH bytes included), the whole write ` +
    "sequence, the exit register file, pc, SP and the return");
});

// -- 2. the cycle difference the live run charges back ------------------------

const skippedFor = (whole) => (whole !== 0 ? MIRROR_ARM_SKIPPED : LOCAL_ARM_SKIPPED);

test("CYCLES: the rewrite spends exactly 71 fewer T-states on the local arm and 33 on the mirror arm", () => {
  const { caps } = run();
  const seen = new Map();
  for (const entry of caps) {
    const whole = entry.mem.read8((entry.regs.ix + STEP_WHOLE) & 0xffff);
    const o = entry.clone(); const co = o.cycles; oracle(o);
    const c = entry.clone(); const cc = c.cycles; loc_20b5(c);
    const delta = (o.cycles - co) - (c.cycles - cc);
    assert.equal(delta, skippedFor(whole),
      `cycle delta at ix=${hx(entry.regs.ix)} whole=${hx(whole)} is ${delta}, not ${skippedFor(whole)}`);
    seen.set(whole !== 0 ? "mirror" : "local", delta);
  }
  assert.equal(seen.size, 2, "both arms must be measured — attract reaches both, so both constants are pinned");
  console.log(`  CYCLES: ${caps.length} captures — local arm ${LOCAL_ARM_SKIPPED}, mirror arm ` +
    `${MIRROR_ARM_SKIPPED}, every time; these are the constants the LIVE run charges back`);
});

// -- 3/4. LIVE (whole attract): the live-out measurement ----------------------

let BASELINE = null;
function baselineFrames() {
  if (!BASELINE) {
    const m = new Machine(ROM);
    m.runFrames(ATTRACT_FRAMES);
    BASELINE = m.frames;
  }
  return BASELINE;
}

/**
 * Run attract with `fn` wired live at 0x20B5. The arm is decided from the record BEFORE `fn` runs,
 * because the local arm overwrites the very byte the arm is chosen from. The charge is applied with
 * step() at the machine's current pc, so it restores T-states without moving the pc and without
 * clearing pcKnown the way tick() would.
 */
function liveRun(fn, { charge = true } = {}) {
  let calls = 0;
  const ov = new Map([[TARGET, (mm) => {
    calls++;
    const skipped = skippedFor(mm.mem.read8((mm.regs.ix + STEP_WHOLE) & 0xffff));
    const r = fn(mm);
    if (charge) mm.step(mm.pc, skipped);
    return r;
  }]]);
  const m = new Machine(ROM, { overrides: ov });
  m.runFrames(ATTRACT_FRAMES);
  return { frames: m.frames, calls };
}

/** The state-offset -> address table, built with Array.from (see the note in test 1). */
function addressTable() {
  const probe = new Machine(ROM);
  return Array.from(probe.dumpState(), (_, i) => probe.stateOffsetToAddr(i));
}

/** First (frame, address) where two traces differ. Nothing is excluded — the stack region counts. */
function firstTraceDiff(a, b, addrOf) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < a[i].length; j++) {
      if (a[i][j] !== b[i][j]) return { frame: i, addr: addrOf[j], a: a[i][j], b: b[i][j] };
    }
  }
  return a.length === b.length ? null : { frame: -1, addr: -1, a: a.length, b: b.length };
}

test("LIVE: wired at 0x20b5 for a whole attract run, the trace is identical to the oracle's", () => {
  const base = baselineFrames();
  const addrOf = addressTable();
  const live = liveRun(loc_20b5);

  // A live arm without this assertion can go green while the routine never runs at all.
  assert.ok(live.calls > 0, "the wired routine was never dispatched — this comparison proves nothing");
  assert.equal(live.calls, EXPECTED_DISPATCHES,
    `the wired run dispatched 0x20b5 ${live.calls} times, not ${EXPECTED_DISPATCHES} — a changed dispatch ` +
    "count is itself a fork, and the cheapest one to see");

  const diff = firstTraceDiff(base, live.frames, addrOf);
  assert.equal(diff, null,
    diff && `live attract diverged at frame ${diff.frame}, ${hx(diff.addr)}: oracle=${diff.a} cand=${diff.b}`);
  assert.equal(live.frames.length, base.length, "the wired run must reach the same frame budget");

  console.log(`  LIVE: ${live.calls} dispatches over ${ATTRACT_FRAMES} attract frames — byte-identical to the ` +
    "all-oracle baseline on every cell, STACK_SCRATCH included");
});

test("LIVE TEETH: dropping the cycle charge DOES move the trace, so the LIVE comparison is sensitive", () => {
  const base = baselineFrames();
  const addrOf = addressTable();
  const uncharged = liveRun(loc_20b5, { charge: false });
  const diff = firstTraceDiff(base, uncharged.frames, addrOf);
  assert.notEqual(diff, null,
    "an uncharged cycle-free run was expected to shift the NMI and diverge; it did not, which means the " +
    "LIVE test's cycle restoration is not what makes it pass and that comparison may be inert");
  console.log(`  LIVE TEETH: uncharged, the run diverges at frame ${diff.frame}, ${hx(diff.addr)} — a timing ` +
    "artifact, which is exactly why the LIVE test charges the skipped T-states back");
});

// -- 5. EQUAL (crafted): the shapes attract never delivers --------------------

/** A real captured state with the two step bytes poked — applied identically on both sides. */
function craft(entry, whole, fraction, ix = entry.regs.ix) {
  const e = entry.clone();
  e.regs.ix = ix;
  e.mem.write8((ix + STEP_WHOLE) & 0xffff, whole);
  e.mem.write8((ix + STEP_FRACTION) & 0xffff, fraction);
  return e;
}

const CRAFT_FRACTIONS = [0, 0x60, 0xa0, 255];

test("EQUAL (crafted): all 256 whole-pixel bytes x 4 fractions, and all ten record bases", () => {
  const { caps } = run();
  const seed = caps[0];
  let n = 0;
  for (const fraction of CRAFT_FRACTIONS) {
    for (let whole = 0; whole < 256; whole++) {
      const r = comparePair(craft(seed, whole, fraction), loc_20b5);
      assert.ok(!mismatched(r), `crafted whole=${hx(whole)} fraction=${hx(fraction)}: ${describeMismatch(r)}`);
      n++;
    }
  }

  let bases = 0;
  for (let slot = 0; slot < 10; slot++) {
    const ix = (OBJ_ARRAY_67 + slot * 0x20) & 0xffff;
    const r = comparePair(craft(seed, 0, 0xa0, ix), loc_20b5);
    assert.ok(!mismatched(r), `crafted record base ${hx(ix)}: ${describeMismatch(r)}`);
    // Record-relativity: the oracle's writes landed on THIS record.
    assert.equal(r.oracleMachine.mem.read8((ix + STEP_WHOLE) & 0xffff), 255, `base ${hx(ix)}: whole pixels`);
    bases++;
  }

  console.log(`  EQUAL/crafted: ${n} step values (every whole-pixel byte 0..255 crossed with fractions ` +
    `${CRAFT_FRACTIONS.map(hx).join(",")}) and ${bases} OBJ_ARRAY_67 record bases — the only cases that ` +
    "reach the whole-pixel bytes 1..254 at all");
});

// -- 6. TAIL CHOICE: the manufactured observable ------------------------------

// The routine returns `undefined`, so the return assertion is near-vacuous. Replacing the two
// continuations with stubs makes the branch decision and the handed-on record pointer directly
// observable instead of being inferred from the 35-write chain they run.
const MARKER = STACK_SCRATCH.lo; // dead scratch; nothing else runs on the stubbed machine

/**
 * Run `fn` on a real capture whose two continuations are stubbed out. The stubs go on the machine
 * that is ACTUALLY RUN — a stub does not survive clone(), and one installed on a machine that is
 * then cloned would silently test nothing.
 */
function runWithStubbedTails(entry, fn, { whole, fraction, ix = entry.regs.ix } = {}) {
  const m = entry.clone();
  m.regs.ix = ix;
  if (whole !== undefined) m.mem.write8((ix + STEP_WHOLE) & 0xffff, whole);
  if (fraction !== undefined) m.mem.write8((ix + STEP_FRACTION) & 0xffff, fraction);
  m.mem.write8(MARKER, 0);

  const entered = [];
  const stub = (addr, mark) => (mm) => {
    entered.push({ addr, ix: mm.regs.ix, whole: mm.mem.read8((mm.regs.ix + STEP_WHOLE) & 0xffff) });
    mm.mem.write8(MARKER, mark); // an observable in RAM, so stub liveness is provable from state
  };
  m.routines.set(MIRROR_ARM, stub(MIRROR_ARM, 0xe1));
  m.routines.set(SHARED_TAIL, stub(SHARED_TAIL, 0xc3));

  fn(m);
  return { entered, marker: m.mem.read8(MARKER), m };
}

test("TAIL CHOICE: the routine enters the right continuation, with the record pointer handed on intact", () => {
  const { caps } = run();
  const seed = caps[0];

  const local = runWithStubbedTails(seed, loc_20b5, { whole: 0, fraction: 0xa0 });
  assert.equal(local.marker, 0xc3, "the stub at ROM 0x20C3 did not fire — a stub nobody can see is no stub");
  assert.deepEqual(local.entered.map((e) => e.addr), [SHARED_TAIL],
    "a zero whole-pixel byte must fall through into ROM 0x20C3, exactly once");
  assert.equal(local.entered[0].ix, seed.regs.ix, "the record pointer must reach the continuation unchanged");
  assert.equal(local.entered[0].whole, 255, "the leftward whole pixel must already be stored when the tail runs");
  assert.equal(local.m.mem.read8((seed.regs.ix + STEP_FRACTION) & 0xffff), 0, "…and the fraction cleared");

  const mirror = runWithStubbedTails(seed, loc_20b5, { whole: 255, fraction: 0xa0 });
  assert.equal(mirror.marker, 0xe1, "the stub at ROM 0x20E1 did not fire");
  assert.deepEqual(mirror.entered.map((e) => e.addr), [MIRROR_ARM],
    "a nonzero whole-pixel byte must jump to ROM 0x20E1, exactly once");
  assert.equal(mirror.m.mem.read8((seed.regs.ix + STEP_WHOLE) & 0xffff), 255,
    "the mirror arm owns the store — this routine must not have written the record itself");
  assert.equal(mirror.m.mem.read8((seed.regs.ix + STEP_FRACTION) & 0xffff), 0xa0,
    "…and must have left the fraction alone");

  // Sensitivity: an inverted branch is caught by the observable itself, not by a downstream side
  // effect, which is the whole point of stubbing the continuations out.
  const wrong = runWithStubbedTails(seed, twinInvertedBranch, { whole: 0, fraction: 0xa0 });
  assert.deepEqual(wrong.entered.map((e) => e.addr), [MIRROR_ARM],
    "the inverted-branch twin should have been observed entering the WRONG continuation");

  console.log("  TAIL CHOICE: zero whole-pixel byte -> ROM 0x20C3 with the record already stamped; nonzero -> " +
    "ROM 0x20E1 with the record untouched; both stubs observed firing, and an inverted branch is seen going " +
    "to the wrong one");
});

// -- 7. TEETH -----------------------------------------------------------------

const at = (m, offset) => (m.regs.ix + offset) & 0xffff;

/** (a) the branch inverted: the two arms swapped. */
function twinInvertedBranch(m) {
  const { mem8 } = m;
  if (mem8[at(m, STEP_WHOLE)] === 0) return m.call(MIRROR_ARM);
  mem8[at(m, STEP_FRACTION)] = 0;
  mem8[at(m, STEP_WHOLE)] = 255;
  return m.call(SHARED_TAIL);
}

/** (b) the two stores in the wrong ORDER — value-identical RAM, so only the write sequence sees it. */
function twinStoreOrder(m) {
  const { mem8 } = m;
  if (mem8[at(m, STEP_WHOLE)] !== 0) return m.call(MIRROR_ARM);
  mem8[at(m, STEP_WHOLE)] = 255;
  mem8[at(m, STEP_FRACTION)] = 0;
  return m.call(SHARED_TAIL);
}

/** (c) the mirror arm's value written here, collapsing the two arms into one direction. */
function twinWrongDirection(m) {
  const { mem8 } = m;
  if (mem8[at(m, STEP_WHOLE)] !== 0) return m.call(MIRROR_ARM);
  mem8[at(m, STEP_FRACTION)] = 0;
  mem8[at(m, STEP_WHOLE)] = 1;
  return m.call(SHARED_TAIL);
}

/** (d) the fraction store dropped — invisible in RAM when the fraction is already zero. */
function twinNoFractionStore(m) {
  const { mem8 } = m;
  if (mem8[at(m, STEP_WHOLE)] !== 0) return m.call(MIRROR_ARM);
  mem8[at(m, STEP_WHOLE)] = 255;
  return m.call(SHARED_TAIL);
}

/** (e) the continuation dropped: the two stores land, the rest of the frame's work never runs. */
function twinNoTail(m) {
  const { mem8 } = m;
  if (mem8[at(m, STEP_WHOLE)] !== 0) return;
  mem8[at(m, STEP_FRACTION)] = 0;
  mem8[at(m, STEP_WHOLE)] = 255;
}

/** (f) the stores go to a fixed address instead of following the record pointer. */
function twinFixedAddress(m) {
  const { mem8 } = m;
  if (mem8[at(m, STEP_WHOLE)] !== 0) return m.call(MIRROR_ARM);
  mem8[OBJ_ARRAY_67 + STEP_FRACTION] = 0;
  mem8[OBJ_ARRAY_67 + STEP_WHOLE] = 255;
  return m.call(SHARED_TAIL);
}

/** (g) the branch reads the FRACTION byte instead of the whole-pixel byte. */
function twinBranchOnFraction(m) {
  const { mem8 } = m;
  if (mem8[at(m, STEP_FRACTION)] !== 0) return m.call(MIRROR_ARM);
  mem8[at(m, STEP_FRACTION)] = 0;
  mem8[at(m, STEP_WHOLE)] = 255;
  return m.call(SHARED_TAIL);
}

const TWINS = {
  "inverted-branch": twinInvertedBranch,
  "store-order-swapped": twinStoreOrder,
  "wrong-direction": twinWrongDirection,
  "fraction-store-dropped": twinNoFractionStore,
  "continuation-dropped": twinNoTail,
  "fixed-address": twinFixedAddress,
  "branch-on-fraction": twinBranchOnFraction,
};

test("TEETH: seven broken twins are all CAUGHT", () => {
  const { caps } = run();
  const seed = caps[0];
  const entries = [
    ...caps.map((e) => ({ name: `real dispatch at ${hx(e.regs.ix)}`, entry: e })),
    { name: "crafted whole=1 fraction=0", entry: craft(seed, 1, 0) },
    { name: "crafted whole=0 fraction=0x80", entry: craft(seed, 0, 0x80) },
    { name: "crafted whole=0 fraction=0", entry: craft(seed, 0, 0) },
    { name: "crafted whole=0x7f fraction=0", entry: craft(seed, 0x7f, 0) },
  ];

  for (const [label, fn] of Object.entries(TWINS)) {
    let hit = null;
    for (const { name, entry } of entries) {
      const r = comparePair(entry, fn);
      if (mismatched(r)) { hit = { name, r }; break; }
    }
    assert.notEqual(hit, null, `the ${label} twin ESCAPED every entry — the gate proves nothing`);
    console.log(`  TEETH/${label}: caught on ${hit.name} — ${describeMismatch(hit.r)}`);
  }
});

test("TEETH: the swapped store order is caught by the write sequence ALONE, and nothing else", () => {
  // Both stores still land with the right values, so the final state is byte-identical and every
  // other half of the contract is blind to it. This is the case that justifies comparing the
  // ordered write sequence at all.
  const { caps } = run();
  const entry = craft(caps[0], 0, 0xa0);
  const r = comparePair(entry, twinStoreOrder);
  assert.equal(r.state, null, "a swapped store order must leave the final state identical");
  assert.equal(r.regsO, r.regsC, "…and the registers identical");
  assert.equal(r.retO, r.retC, "…and the return identical");
  assert.notEqual(r.writeDiff, null,
    "…so the ordered write-sequence comparison must be what catches it — otherwise a reordered store " +
    "pair would pass this gate unseen");
  console.log(`  TEETH/order-only: state, registers and return all identical; caught at write ` +
    `#${r.writeDiff.i} oracle=${r.writeDiff.a} twin=${r.writeDiff.b}`);
});

test("TEETH: a twin that only misbehaves on a whole-pixel byte attract never delivers is caught by the crafted arm alone", () => {
  // Attract delivers only 0 and 255, so a twin that mishandles 1..127 is invisible to every real
  // dispatch. This pins that the crafted sweep is load-bearing rather than decorative.
  const { caps } = run();
  const twin = (m) => {
    const { mem8 } = m;
    const whole = mem8[at(m, STEP_WHOLE)];
    if (whole !== 0 && whole < 128) { // a "small positive step counts as none" misreading
      mem8[at(m, STEP_FRACTION)] = 0;
      mem8[at(m, STEP_WHOLE)] = 255;
      return m.call(SHARED_TAIL);
    }
    return loc_20b5(m);
  };
  for (const entry of caps) {
    assert.ok(!mismatched(comparePair(entry, twin)),
      `this twin was supposed to be invisible to real dispatches, but one at ix=${hx(entry.regs.ix)} caught it`);
  }
  const crafted = comparePair(craft(caps[0], 1, 0xa0), twin);
  assert.ok(mismatched(crafted), "the crafted whole=1 entry must catch it");
  console.log(`  TEETH/crafted-only: invisible to all ${caps.length} real dispatches, caught by crafted ` +
    `whole=0x1 — ${describeMismatch(crafted)}`);
});
