// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_21ba (ROM 0x21BA) — the object walk's shared sprite tail: swap the
 * walk's registers back in, gather OBJ_X / OBJ_SPRITE_CODE / OBJ_SPRITE_ATTR / OBJ_Y out of the
 * record into four consecutive staging bytes, step the cursor three of the four, and jump on to
 * the between-slots step at ROM 0x1F8D.
 *
 * WHAT THIS GATE ACTUALLY COVERS, stated plainly:
 *
 *   1. EQUAL (captured, ATTRACT ONLY). 0x21BA needs no input to reach: a 1200-frame cycle-free
 *      attract run dispatches it 1665 times, the first at frame 607. EVERY ONE of those is
 *      replayed — inline at the dispatch (clone twice, run oracle and rewrite, compare, discard),
 *      so nothing is sampled and nothing is held in memory. The whole sweep costs about a fifth
 *      of a second, which is why sampling was never needed.
 *
 *      A replay is not twenty-three bytes' worth of work. Both exits are jumps into the still
 *      frozen between-slots step, so one replay drives the WHOLE REMAINING WALK — every later
 *      slot, through whichever dispatch arm each one selects — and the comparison is made after
 *      all of it. The rewrite is installed in the replaying machine's registry, so the walk's
 *      loop-back re-enters IT rather than the capturing hook; that is also what stops the capture
 *      recursing, which matters here because 1071 of the 1665 host dispatches are themselves
 *      nested inside another one (measured; the walk tail-jumps, so it nests up to five deep).
 *
 *      The test asserts the coverage it should see and prints the counts: all five OBJ_ARRAY_67
 *      records attract activates, all five staging-cursor positions, all five remaining-slot
 *      counts, the stride, and the record/cursor correspondence the routine's header rests on.
 *      Records 5-9 of the walk, credited gameplay, boards 2-4 and two-player are NOT covered —
 *      attract activates none of them.
 *
 *   2. THE ENTRY CONTRACT (measured, not assumed). The routine's inputs do not arrive in the
 *      live registers at all: they arrive in the ALTERNATE bank, and the leading exchange is what
 *      makes them live. The sweep checks that on every dispatch, and it is a real check rather
 *      than a restatement: thirteen jump sites across twelve frozen routines reach here, ten of
 *      those routines are exercised by attract, and they include ROM 0x215F — which the frozen
 *      oracle's own note calls a NON-exchanged entry. The parked bank holds the walk's cursor,
 *      stride and slot count at all of them.
 *
 *   3. EQUAL (crafted), two arms for the two things attract cannot produce:
 *      (a) A STAGING CURSOR WHOSE FOUR WRITES WRAP ITS PAGE. Attract runs the cursor 0x6980-
 *          0x6990 and stops, so a full-width 16-bit destination would be indistinguishable from
 *          the real one on every natural capture. The arm parks the cursor's low byte at 254 on
 *          both sides.
 *      (b) A SWEPT SOURCE PAYLOAD. Attract only ever puts 8 distinct values in the record's
 *          sprite code and 4 in its attribute, and NEVER a zero in either. The arm writes a
 *          different one of all 256 values into each of the four source fields per dispatch, so
 *          the gather is pinned on payload the game never produces.
 *      Both arms are proved LIVE by counting the dispatches on which the craft moves the ORACLE's
 *      own result — non-vacuity as a measurement, not an assumption.
 *
 *   4. LIVE-OUT (measured). Two independent measurements:
 *      - the unit replay compares the FULL state dump INCLUDING STACK_SCRATCH, plus pc, SP, the
 *        ENTIRE register file (both banks, flags included) and the propagated return value. All
 *        of that holds here rather than being excluded on principle: the oracle pushes nothing
 *        (its exit is a jump), the frozen tail chain performs the same single return on both
 *        sides, and every register the rewrite declines to write — the accumulator and the flags
 *        — is overwritten by that tail chain before control leaves. Measured across all 1665
 *        dispatches, so it is asserted rather than hoped for, and it is free teeth.
 *      - the live arm wires the rewrite at 0x21BA for a 1200-frame CYCLE-FREE attract run and
 *        diffs every frame against the all-oracle baseline. That baseline is the right control
 *        because this rewrite calls no idiomatic callee — its one exit is into a routine that is
 *        still the frozen oracle — so the only difference between the two runs is the routine
 *        under test. The arm COUNTS its own dispatches and asserts the count, so it cannot pass
 *        by never running.
 *
 *   5. TEETH — six broken twins, each of which the suite MUST catch:
 *      (a) no register exchange — the gather reads and writes through whichever set the calling
 *          arm left active.
 *      (b) the four source fields read IN ASCENDING ORDER (+3,+5,+7,+8) instead of the ROM's
 *          permutation — the "it is nearly a block copy, surely it is sorted" defect.
 *      (c) the cursor steps four bytes instead of three, so the next slot is staged one byte on.
 *      (d) a full-width 16-bit destination instead of a page-confined one. ESCAPES EVERY NATURAL
 *          CAPTURE and is caught only by crafted arm 3(a); both halves asserted.
 *      (e) a zero sprite code is treated as "nothing to draw" and the store skipped. ESCAPES
 *          EVERY NATURAL CAPTURE — attract never puts a zero there — and is caught only by
 *          crafted arm 3(b); both halves asserted.
 *      (f) a spurious return value, whose RAM is byte-identical to the correct routine's, so only
 *          the return half of the contract can catch it.
 *
 * CONTRACT. The full work/sprite/video state dump (STACK_SCRATCH included — see 4), plus pc, SP,
 * every register in both banks, and the propagated return value.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-21ba.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine } from "../../machine.js";
import { loc_21ba as oracle } from "../../translated/loc_21ba.js";
import { loc_21ba } from "../loc_21ba.js";
import {
  ACTOR_SPRITES, OBJ_ARRAY_67, OBJ_SPRITE_ATTR, OBJ_SPRITE_CODE, OBJ_X, OBJ_Y,
  SPRITE_ATTR, SPRITE_CODE, SPRITE_X, SPRITE_Y,
} from "../ram.js";
import { u8 } from "../../../../core/int.js";
import { runCycleFree } from "../../../../core/frame-stepped.js";
import manifest from "../../manifest.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x21ba;
const SLOTS = 10; //        the walk visits ten OBJ_ARRAY_67 records
const SLOT_STRIDE = 32; //  OBJ_ARRAY_67 record stride
const SPRITE_RECORD = 4; // bytes of ACTOR_SPRITES staged per slot
const ATTRACT_FRAMES = 1200;

// The crafted low byte that leaves the cursor three bytes short of the end of its page, so the
// last two of the four stores wrap to the bottom of it.
const PAGE_WRAP_L = 254;

// Measured, and asserted rather than merely printed — a live arm that never dispatches the
// routine proves nothing while looking green. Attract is deterministic, so these are exact.
const DISPATCHES = 1665; // 1200 cycle-free attract frames
const FIRST_FRAME = 607; // nothing shorter than this reaches the routine at all

// Every register the comparison covers, both banks. Nothing is excluded: see the header.
const REGISTERS = [
  "a", "f", "b", "c", "d", "e", "h", "l", "ix", "iy", "sp",
  "a_", "f_", "b_", "c_", "d_", "e_", "h_", "l_",
];

const hx = (v) => "0x" + (v & 0xffff).toString(16);

/** The walk's own state at entry: it is parked in the ALTERNATE bank until the exchange. */
const parkedCursor = (m) => (m.regs.h_ << 8) | m.regs.l_;
const parkedRemaining = (m) => m.regs.b_;
const parkedStride = (m) => (m.regs.d_ << 8) | m.regs.e_;

// -- the sweep: replay INLINE at every real dispatch ---------------------------

/**
 * Boot attract with a hook at 0x21BA that, at EVERY real dispatch, clones the machine twice, runs
 * the oracle on one clone and `candidate` on the other, compares, and throws both away before
 * letting the host continue on the oracle. O(1) memory, and it replays every dispatch rather than
 * a sample.
 *
 * Each clone gets its OWN 0x21BA installed in its registry. That is load-bearing twice over: it
 * stops the capture recursing (a clone rebuilds its override map from the host's assets, and this
 * routine's tail re-enters it), and it means each replay drives the whole remaining walk through
 * the implementation under test rather than only its first slot.
 *
 * `prep(machine, dispatchIndex)` is applied identically to both clones, which is how a crafted arm
 * is built on a REAL captured state rather than from scratch.
 */
function sweepAttract(candidate, { prep = null, frames = ATTRACT_FRAMES } = {}) {
  let dispatches = 0;
  const breaches = [];
  const records = new Map();
  const cursors = new Map();
  const remaining = new Map();
  const strides = new Map();
  const codes = new Set();
  const attrs = new Set();
  let correspondenceHolds = true;
  let firstFrame = null;
  let frameIndex = 0;
  // A crafted arm is worthless if it changes nothing; count the dispatches on which it moves the
  // ORACLE's own result, so non-vacuity is a measurement rather than an assumption.
  let prepChangedOracle = 0;

  const tally = (map, k) => map.set(k, (map.get(k) ?? 0) + 1);

  const host = new Machine(ROM, {
    overrides: new Map([[TARGET, (mm) => {
      dispatches++;
      const index = dispatches;
      if (firstFrame === null) firstFrame = frameIndex;

      const record = mm.regs.ix; // the index register is NOT part of the exchange
      const cursor = parkedCursor(mm);
      const slotsLeft = parkedRemaining(mm);
      tally(records, record);
      tally(cursors, cursor);
      tally(remaining, slotsLeft);
      tally(strides, parkedStride(mm));
      codes.add(mm.mem8[record + OBJ_SPRITE_CODE]);
      attrs.add(mm.mem8[record + OBJ_SPRITE_ATTR]);
      if (record !== OBJ_ARRAY_67 + (SLOTS - slotsLeft) * SLOT_STRIDE) correspondenceHolds = false;
      if (cursor !== ACTOR_SPRITES + (SLOTS - slotsLeft) * SPRITE_RECORD) correspondenceHolds = false;

      const a = mm.clone();
      a.routines.set(TARGET, oracle);
      const b = mm.clone();
      b.routines.set(TARGET, candidate);
      if (prep) { prep(a, index); prep(b, index); }

      let breach = null;
      let oracleValue, oracleDump;
      try {
        oracleValue = oracle(a);
        oracleDump = a.dumpState();
      } catch (err) {
        // The oracle faulting on a crafted state is a defect in the ARM, not in the candidate.
        throw new Error(`the oracle threw on dispatch #${index}: ${err.message}`);
      }
      try {
        const candidateValue = candidate(b);
        const candidateDump = b.dumpState();
        for (let i = 0; i < oracleDump.length; i++) {
          if (oracleDump[i] === candidateDump[i]) continue;
          breach = { kind: "RAM", addr: a.stateOffsetToAddr(i), a: oracleDump[i], b: candidateDump[i] };
          break;
        }
        if (!breach && a.pc !== b.pc) breach = { kind: "pc", addr: null, a: hx(a.pc), b: hx(b.pc) };
        if (!breach) {
          for (const r of REGISTERS) {
            if (a.regs[r] === b.regs[r]) continue;
            breach = { kind: `register ${r}`, addr: null, a: a.regs[r], b: b.regs[r] };
            break;
          }
        }
        if (!breach && oracleValue !== candidateValue) {
          breach = { kind: "return", addr: null, a: String(oracleValue), b: String(candidateValue) };
        }
      } catch (err) {
        // A twin handed a state it should never have produced can walk a ROM table off its end and
        // THROW rather than diverge. A fault is a result, so record it as the breach.
        breach = { kind: "threw", addr: null, a: "-", b: err.message };
      }

      if (prep) {
        // Same entry, same oracle, WITHOUT the craft: if the result is identical the craft did
        // nothing on this dispatch.
        const plain = mm.clone();
        plain.routines.set(TARGET, oracle);
        oracle(plain);
        const p = plain.dumpState();
        for (let i = 0; i < p.length; i++) if (p[i] !== oracleDump[i]) { prepChangedOracle++; break; }
      }

      if (breach) {
        breaches.push({ dispatch: index, record, cursor, remaining: slotsLeft, ...breach });
      }
      return oracle(mm); // the HOST always runs the oracle, so attract proceeds normally
    }]]),
  });

  const result = runCycleFree(host, {
    pollPCs: manifest.convergence.pollPCs,
    maxFrames: frames,
    stepBudget: frames * 200000,
    onFrame: () => { frameIndex++; },
  });

  return {
    dispatches, breaches, records, cursors, remaining, strides, codes, attrs,
    correspondenceHolds, firstFrame, prepChangedOracle, stop: result.stop,
  };
}

const describe = (b) =>
  `dispatch #${b.dispatch} (record=${hx(b.record)} cursor=${hx(b.cursor)} remaining=${b.remaining}): ` +
  `${b.kind}${b.addr === null ? "" : "@" + hx(b.addr)} oracle=${b.a} cand=${b.b}`;

// The one sweep the first two tests share. Node's test runner evaluates the module top to bottom,
// so this runs once at load rather than once per test.
const NATURAL = ROM_PRESENT ? sweepAttract(loc_21ba) : null;

// -- 1. EQUAL, on every real attract dispatch ----------------------------------

test("EQUAL: loc_21ba matches the oracle on every one of the real attract dispatches", () => {
  assert.ok(NATURAL.dispatches > 0, "no dispatch of 0x21BA was captured — the harness never engaged");
  assert.equal(NATURAL.stop, "reached maxFrames", `the capture run stopped early: ${NATURAL.stop}`);
  assert.equal(
    NATURAL.dispatches,
    DISPATCHES,
    `attract dispatched 0x21BA ${NATURAL.dispatches} times, not the ${DISPATCHES} this gate claims`,
  );
  assert.equal(
    NATURAL.firstFrame,
    FIRST_FRAME,
    `the first dispatch was at frame ${NATURAL.firstFrame}, not the ${FIRST_FRAME} this gate claims — ` +
      "a run shorter than that reaches the routine zero times and would prove nothing",
  );
  assert.equal(
    NATURAL.breaches.length,
    0,
    NATURAL.breaches.length ? `${NATURAL.breaches.length} breach(es), first: ${describe(NATURAL.breaches[0])}` : "",
  );

  // Coverage the walk must show if the capture is honest. Attract activates the first FIVE of the
  // ten slots and no more, so that is what is claimed and that is what is checked.
  const activeSlots = NATURAL.records.size;
  assert.ok(activeSlots > 0, "no record base was seen at all");
  for (let i = 0; i < activeSlots; i++) {
    assert.ok(NATURAL.records.has(OBJ_ARRAY_67 + i * SLOT_STRIDE),
      `no captured dispatch on the OBJ_ARRAY_67 record at ${hx(OBJ_ARRAY_67 + i * SLOT_STRIDE)}`);
    assert.ok(NATURAL.cursors.has(ACTOR_SPRITES + i * SPRITE_RECORD),
      `no captured dispatch with the staging cursor at ${hx(ACTOR_SPRITES + i * SPRITE_RECORD)}`);
    assert.ok(NATURAL.remaining.has(SLOTS - i), `no captured dispatch with ${SLOTS - i} slots remaining`);
  }
  assert.deepEqual([...NATURAL.strides], [[SLOT_STRIDE, NATURAL.dispatches]],
    "the walk's record stride was not 32 on every captured dispatch");
  // The arithmetic the routine's header rests on: staging slot `10 - remaining` means the record
  // pointer is on that OBJ_ARRAY_67 record and the cursor on the first byte of its sprite record.
  assert.ok(NATURAL.correspondenceHolds,
    "a captured dispatch had the record pointer or the staging cursor away from its slot's base");

  console.log(
    `  EQUAL: all ${NATURAL.dispatches} real 0x21BA dispatches in ${ATTRACT_FRAMES} cycle-free attract frames ` +
      `replayed inline (first at frame ${NATURAL.firstFrame}); ${activeSlots} of ${SLOTS} slots activated ` +
      `(records ${hx(OBJ_ARRAY_67)}-${hx(OBJ_ARRAY_67 + (activeSlots - 1) * SLOT_STRIDE)}, cursors ` +
      `${hx(ACTOR_SPRITES)}-${hx(ACTOR_SPRITES + (activeSlots - 1) * SPRITE_RECORD)}); full state dump ` +
      "INCLUDING STACK_SCRATCH, plus pc, SP, both register banks and the return value",
  );
});

// -- 2. The entry contract -----------------------------------------------------

test("ENTRY: the walk's state is parked in the alternate bank on every dispatch", () => {
  // The routine's first act is the exchange, so this is what makes its inputs its inputs. It is a
  // real check: the record pointer is NOT part of the exchange, so if the walk's cursor, stride and
  // slot count were live rather than parked, the correspondence above would fail on every dispatch.
  assert.ok(NATURAL.correspondenceHolds,
    "the parked bank did not hold the walk's cursor/stride/slot count on some dispatch");
  const cursors = [...NATURAL.cursors].sort((p, q) => p[0] - q[0]).map(([c, n]) => `${hx(c)}x${n}`).join(" ");
  console.log(
    `  ENTRY: the alternate bank held the walk's state on all ${NATURAL.dispatches} dispatches — ` +
      `stride 32 every time, staging cursor ${cursors}`,
  );
});

// -- 3. EQUAL (crafted) --------------------------------------------------------

/** Real capture, one surgical nudge: the parked cursor's four stores wrap its page. */
const craftPageWrap = (m) => { m.regs.l_ = PAGE_WRAP_L; };

/**
 * Real capture, four surgical pokes: source payload the game never produces. Stepping the values
 * with the dispatch index sweeps each field across all 256 values over the run, and puts a zero
 * into each of them — which attract never does for the sprite code or the attribute.
 */
const craftPayload = (m, i) => {
  const record = m.regs.ix;
  m.mem8[record + OBJ_X] = u8(i * 7);
  m.mem8[record + OBJ_SPRITE_CODE] = u8(i);
  m.mem8[record + OBJ_SPRITE_ATTR] = u8(i * 13);
  m.mem8[record + OBJ_Y] = u8(i * 11);
};

const CRAFTED = ROM_PRESENT
  ? {
      wrap: sweepAttract(loc_21ba, { prep: craftPageWrap }),
      payload: sweepAttract(loc_21ba, { prep: craftPayload }),
    }
  : null;

test("EQUAL (crafted): a staging cursor whose four stores wrap its page matches the oracle", () => {
  const s = CRAFTED.wrap;
  // Non-vacuous, and as non-vacuous as it can be: every dispatch stages four bytes through the
  // cursor, so moving it must move the oracle's own result on every one of them.
  assert.equal(s.prepChangedOracle, s.dispatches,
    `wrapping the cursor moved the oracle on ${s.prepChangedOracle} of ${s.dispatches} replays — the craft is ` +
      "not landing where the cursor is read");
  assert.equal(s.breaches.length, 0,
    s.breaches.length ? `${s.breaches.length} breach(es), first: ${describe(s.breaches[0])}` : "");
  console.log(
    `  EQUAL/crafted wrap: ${s.dispatches} dispatches replayed with the staging cursor's low byte at ` +
      `${PAGE_WRAP_L}, three short of the end of its page (attract runs it ${hx(ACTOR_SPRITES)}-` +
      `${hx(ACTOR_SPRITES + 4 * SPRITE_RECORD)} and never wraps); the craft moves the oracle's own result on ` +
      `${s.prepChangedOracle} of them`,
  );
});

test("EQUAL (crafted): source payload the game never produces matches the oracle", () => {
  const s = CRAFTED.payload;
  assert.ok(s.prepChangedOracle > 0,
    "the swept payload changed nothing the oracle does on any dispatch — the arm would be vacuous");
  assert.equal(s.breaches.length, 0,
    s.breaches.length ? `${s.breaches.length} breach(es), first: ${describe(s.breaches[0])}` : "");
  // The premise the payload arm exists for: attract's own sprite codes never include a zero, so
  // any zero-sensitive defect is invisible without this arm.
  assert.ok(!NATURAL.codes.has(0),
    "attract produced a zero sprite code — the payload arm's premise is stale");
  console.log(
    `  EQUAL/crafted payload: ${s.dispatches} dispatches replayed with all four source fields swept across ` +
      `all 256 values (attract produces only ${NATURAL.codes.size} distinct sprite codes and ` +
      `${NATURAL.attrs.size} attributes, and never a zero in either); the craft moves the oracle's own result ` +
      `on ${s.prepChangedOracle} of them`,
  );
});

// -- 4. TEETH ------------------------------------------------------------------

/** (a) no register exchange: the gather runs on whichever set the calling arm left active. */
function brokenNoExchange(m) {
  const { regs, mem8 } = m;
  const record = regs.ix;
  const page = regs.h * 256;
  const cursor = regs.l;
  mem8[page + u8(cursor + SPRITE_X)] = mem8[record + OBJ_X];
  mem8[page + u8(cursor + SPRITE_CODE)] = mem8[record + OBJ_SPRITE_CODE];
  mem8[page + u8(cursor + SPRITE_ATTR)] = mem8[record + OBJ_SPRITE_ATTR];
  mem8[page + u8(cursor + SPRITE_Y)] = mem8[record + OBJ_Y];
  regs.l = cursor + 3;
  return m.call(0x1f8d);
}

/** (b) the four source fields read in ascending order instead of the ROM's permutation. */
function brokenSorted(m) {
  const { regs, mem8 } = m;
  regs.exx();
  const record = regs.ix;
  const page = regs.h * 256;
  const cursor = regs.l;
  mem8[page + u8(cursor + 0)] = mem8[record + 3];
  mem8[page + u8(cursor + 1)] = mem8[record + 5];
  mem8[page + u8(cursor + 2)] = mem8[record + 7];
  mem8[page + u8(cursor + 3)] = mem8[record + 8];
  regs.l = cursor + 3;
  return m.call(0x1f8d);
}

/** (c) the cursor steps four bytes instead of three, so the next slot is staged one byte on. */
function brokenCursorStepsFour(m) {
  const { regs, mem8 } = m;
  regs.exx();
  const record = regs.ix;
  const page = regs.h * 256;
  const cursor = regs.l;
  mem8[page + u8(cursor + SPRITE_X)] = mem8[record + OBJ_X];
  mem8[page + u8(cursor + SPRITE_CODE)] = mem8[record + OBJ_SPRITE_CODE];
  mem8[page + u8(cursor + SPRITE_ATTR)] = mem8[record + OBJ_SPRITE_ATTR];
  mem8[page + u8(cursor + SPRITE_Y)] = mem8[record + OBJ_Y];
  regs.l = cursor + 4;
  return m.call(0x1f8d);
}

/** (d) a full-width 16-bit destination: the cursor leaves its page instead of wrapping. */
function brokenFullWidth(m) {
  const { regs, mem8 } = m;
  regs.exx();
  const record = regs.ix;
  const cursor = regs.hl;
  mem8[cursor + SPRITE_X] = mem8[record + OBJ_X];
  mem8[cursor + SPRITE_CODE] = mem8[record + OBJ_SPRITE_CODE];
  mem8[cursor + SPRITE_ATTR] = mem8[record + OBJ_SPRITE_ATTR];
  mem8[cursor + SPRITE_Y] = mem8[record + OBJ_Y];
  regs.hl = cursor + 3;
  return m.call(0x1f8d);
}

/** (e) a zero sprite code is read as "nothing to draw" and its store skipped. */
function brokenSkipBlankCode(m) {
  const { regs, mem8 } = m;
  regs.exx();
  const record = regs.ix;
  const page = regs.h * 256;
  const cursor = regs.l;
  const code = mem8[record + OBJ_SPRITE_CODE];
  mem8[page + u8(cursor + SPRITE_X)] = mem8[record + OBJ_X];
  if (code !== 0) mem8[page + u8(cursor + SPRITE_CODE)] = code;
  mem8[page + u8(cursor + SPRITE_ATTR)] = mem8[record + OBJ_SPRITE_ATTR];
  mem8[page + u8(cursor + SPRITE_Y)] = mem8[record + OBJ_Y];
  regs.l = cursor + 3;
  return m.call(0x1f8d);
}

/** (f) correct in RAM, wrong at the boundary: hands its caller a value it never had. */
function brokenSpuriousReturn(m) {
  loc_21ba(m);
  return false;
}

test("TEETH: the twins a natural capture must catch are caught", () => {
  const report = [];
  for (const [name, twin] of [
    ["no register exchange", brokenNoExchange],
    ["sorted source order", brokenSorted],
    ["cursor steps four", brokenCursorStepsFour],
    ["spurious return value", brokenSpuriousReturn],
  ]) {
    const s = sweepAttract(twin);
    assert.ok(s.breaches.length > 0,
      `the "${name}" twin escaped all ${s.dispatches} natural captures — the gate is worthless`);
    report.push(`${name} ${s.breaches.length}/${s.dispatches} (${s.breaches[0].kind})`);

    if (twin === brokenSpuriousReturn) {
      // It must be caught by the RETURN half of the contract and by nothing else — that is what
      // proves the return comparison is wired rather than decorative.
      assert.equal(s.breaches.length, s.dispatches, "the spurious return must be caught on every dispatch");
      assert.equal(s.breaches[0].kind, "return",
        `the spurious-return twin must be caught by the return comparison, not by ${s.breaches[0].kind}`);
    }
  }
  console.log(`  TEETH/natural: ${report.join("; ")}`);
});

test("TEETH: the full-width destination twin ESCAPES every natural capture and is caught only by the crafted wrap", () => {
  const natural = sweepAttract(brokenFullWidth);
  assert.equal(natural.breaches.length, 0,
    "the full-width destination twin was expected to escape every natural capture (attract never wraps the " +
      `page), but ${natural.breaches.length} of ${natural.dispatches} caught it`);
  const crafted = sweepAttract(brokenFullWidth, { prep: craftPageWrap });
  assert.ok(crafted.breaches.length > 0,
    "the crafted page-wrap arm failed to catch the full-width destination twin — that arm exists for exactly this");
  assert.equal(crafted.breaches.length, crafted.dispatches,
    `the crafted arm caught the full-width twin on ${crafted.breaches.length} of ${crafted.dispatches} dispatches; ` +
      "every one of them wraps, so every one of them should see it");
  console.log(
    `  TEETH/full-width destination: 0/${natural.dispatches} natural, ` +
      `${crafted.breaches.length}/${crafted.dispatches} crafted (${describe(crafted.breaches[0])})`,
  );
});

test("TEETH: the blank-code twin ESCAPES every natural capture and is caught only by the crafted payload", () => {
  const natural = sweepAttract(brokenSkipBlankCode);
  assert.equal(natural.breaches.length, 0,
    "the blank-code twin was expected to escape every natural capture (attract never stages a zero sprite " +
      `code), but ${natural.breaches.length} of ${natural.dispatches} caught it`);
  const crafted = sweepAttract(brokenSkipBlankCode, { prep: craftPayload });
  assert.ok(crafted.breaches.length > 0,
    "the crafted payload arm failed to catch the blank-code twin — that arm exists for exactly this");
  console.log(
    `  TEETH/blank code: 0/${natural.dispatches} natural, ${crafted.breaches.length}/${crafted.dispatches} ` +
      `crafted (${describe(crafted.breaches[0])})`,
  );
});

// -- 5. LIVE-OUT: wired live for a whole attract run ---------------------------

/**
 * Drive a whole attract run CYCLE-FREE — the frame boundary is the main loop's vblank poll, not a
 * T-state count — and sample every frame. Both sides use the same vehicle, so a cycle-free rewrite
 * shifts no interrupt and there is no cycle cost to restore.
 */
function runFramesCycleFree(overrides) {
  const m = new Machine(ROM, overrides ? { overrides } : {});
  const frames = [];
  const result = runCycleFree(m, {
    pollPCs: manifest.convergence.pollPCs,
    maxFrames: ATTRACT_FRAMES,
    stepBudget: ATTRACT_FRAMES * 200000,
    onFrame: (mm) => frames.push(Buffer.from(mm.dumpState())),
  });
  return { m, frames, result };
}

test("LIVE-OUT: wired live for a whole attract run, the rewrite leaves the same trace as the oracle", () => {
  const baseline = runFramesCycleFree(null);
  let dispatches = 0;
  const live = runFramesCycleFree(new Map([[TARGET, (m) => { dispatches++; return loc_21ba(m); }]]));

  // Without this the run can be byte-identical because the routine never executed. Measured on a
  // sibling routine: 800 frames of attract went green against a deliberately broken rewrite whose
  // first dispatch is at frame 1163. This one's first is at frame 607.
  assert.ok(dispatches > 0, "0x21BA was never dispatched in the live run — the arm proves nothing");
  assert.equal(dispatches, DISPATCHES,
    `the live run dispatched 0x21BA ${dispatches} times, not the ${DISPATCHES} this gate claims`);

  assert.equal(baseline.result.stop, "reached maxFrames", `baseline stopped early: ${baseline.result.stop}`);
  assert.equal(live.result.stop, "reached maxFrames", `live run stopped early: ${live.result.stop}`);
  assert.equal(live.frames.length, baseline.frames.length, "the two runs did not reach the same frame count");

  for (let f = 0; f < baseline.frames.length; f++) {
    const a = baseline.frames[f];
    const b = live.frames[f];
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) continue;
      assert.fail(`frame ${f}: ${hx(baseline.m.stateOffsetToAddr(i))} baseline=${a[i]} live=${b[i]}`);
    }
  }
  console.log(
    `  LIVE-OUT: ${baseline.frames.length} cycle-free frame samples (power-on plus ${ATTRACT_FRAMES} attract ` +
      `frames) byte-identical with 0x21BA wired live over ${dispatches} dispatches`,
  );
});
