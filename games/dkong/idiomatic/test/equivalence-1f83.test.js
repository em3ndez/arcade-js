// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceBarrelSlotIfLive — memory-equivalent to the frozen oracle at ROM 0x1F83 — the object
 * walk's per-slot gate: send a record whose OBJ_ACTIVE holds exactly 1 to the active-slot
 * dispatch at ROM 0x1F93, otherwise step the staging cursor three bytes over the record this slot
 * leaves alone and fall into the between-slots step at ROM 0x1F8D.
 * GATE:  captured + crafted + live, ATTRACT ONLY. Every real dispatch in a 1200-frame attract
 *        run is replayed inline — no sampling — and two crafted arms cover what attract cannot
 *        produce: a flag value of 3, and a staging cursor whose step wraps its page. Credited
 *        gameplay, boards 2-4 and two-player are NOT covered: the walk runs only while BOARD
 *        is 1.
 *
 * WHAT THIS GATE ACTUALLY COVERS, stated plainly:
 *
 *   1. EQUAL (captured, ATTRACT ONLY). 0x1F83 needs no input to reach: a plain 1200-frame attract
 *      run dispatches it 6160 times, the first at frame 586. EVERY ONE of those is replayed —
 *      inline at the dispatch (clone twice, run oracle and rewrite, compare, discard), so nothing
 *      is sampled and nothing is held in memory. The test asserts the coverage it should see and
 *      prints the counts: all three flag values attract produces (0, 1 and 2), all ten
 *      remaining-slot values, all ten OBJ_ARRAY_67 record bases, all ten staging-cursor positions,
 *      and the cursor arithmetic the routine's header rests on. Credited gameplay, boards 2-4 and
 *      two-player are NOT covered — the walk this belongs to runs only while BOARD is 1.
 *
 *      A replay is not one instruction's worth of work. The rewrite is installed in the replaying
 *      machine's registry, so the loop-back at ROM 0x1F8D re-enters IT and one replay drives the
 *      whole remaining walk — every later slot, through whichever dispatch arm each one selects —
 *      against the oracle doing the same.
 *
 *   2. REACH (measured). The staging cursor this routine moves is read by NOTHING except the
 *      shared sprite-record tail at ROM 0x21BA, so a replay that never reaches that tail cannot
 *      see a wrong cursor however wrong it is. The sweep counts, on the oracle side, how many
 *      replays stage anything (1688 of 6160) and how many of those entered on the skip arm — the
 *      arm where this routine touches the cursor at all — which is 96. That number is the CEILING
 *      on any cursor twin's catch rate, and the two cursor twins below are asserted against it
 *      rather than against "more than zero", so a low count cannot read as weak teeth when it is
 *      in fact complete.
 *
 *   3. EQUAL (crafted), two arms for the two things attract cannot produce:
 *      (a) A FLAG OF 3. Attract only ever shows 0, 1 and 2, so a rewrite that tested bit 0 instead
 *          of equality with 1 would be indistinguishable from the real one on every natural
 *          capture. The arm forces 3 on both sides and is proved LIVE by showing that forcing it
 *          changes what the ORACLE itself does — on all 6160 dispatches, since the value reaches
 *          the flag byte every replay compares. (Whether the ROM can ever produce a 3 is NOT
 *          claimed — this arm pins the comparison, not reachability.)
 *      (b) A STAGING CURSOR THAT WRAPS ITS PAGE. Attract runs the cursor 0x6980-0x69A4 and stops,
 *          so a full-width 16-bit step is invisible to it. The arm parks the cursor's low byte at
 *          254 on both sides, and its liveness is asserted as an EQUALITY: moving the cursor
 *          changes the oracle's own result on exactly the 1688 replays that stage through it, and
 *          on no others.
 *
 *   4. LIVE-OUT (measured). The rewrite drops the accumulator and every flag the oracle writes.
 *      Two independent measurements back that:
 *      - the unit replay compares the FULL state dump INCLUDING STACK_SCRATCH, plus pc, SP and the
 *        propagated return value. Those hold here rather than being excluded on principle: the
 *        oracle pushes nothing (both of its exits are jumps) and the frozen tail chain performs
 *        the single `ret` on both sides, so the stack and both pointers legitimately agree, and
 *        comparing them is free teeth.
 *      - the live arm wires the rewrite at 0x1F83 for a 1200-frame CYCLE-FREE attract run and
 *        diffs every frame against the all-oracle baseline. That baseline is the right control
 *        because this rewrite calls no idiomatic callee — both of its exits are m.call into
 *        routines that are still the frozen oracle — so the only difference between the two runs
 *        is the routine under test. The arm COUNTS its own dispatches and asserts the count, so it
 *        cannot pass by never running.
 *
 *   5. TEETH — five broken twins, each of which the suite MUST catch:
 *      (a) bit test instead of equality with 1 — admits a claimed-but-inactive record into the
 *          animation dispatch. ESCAPES EVERY NATURAL CAPTURE and is caught only by crafted arm
 *          3(a); both halves are asserted, which is the whole reason that arm exists.
 *      (b) the cursor steps four bytes instead of three — the next record is staged one byte high.
 *          Caught on 96 of 6160, which is EVERY dispatch that can see it (part 2), asserted as an
 *          equality rather than reported as a fraction.
 *      (c) full-width 16-bit cursor step instead of low-byte-only. ESCAPES EVERY NATURAL CAPTURE
 *          and is caught only by crafted arm 3(b), again on the full 96; both halves asserted.
 *      (d) inverted gate — active records are skipped and inactive ones animated.
 *      (e) a spurious return value, whose RAM is byte-identical to the correct routine's, so ONLY
 *          the return half of the contract can catch it.
 *
 * CONTRACT. The full work/sprite/video state dump (STACK_SCRATCH included — see 3), plus pc, SP
 * and the propagated return value. The other registers are not compared: from the tail call
 * onward they belong to the callee's contract, and the routine's own live-out (the staging
 * cursor's low byte) is observed through the RAM the tail chain stages with it.
 *
 * THE RETURN VALUE IS `undefined` ON EVERY REPLAYED DISPATCH — the walk's tail chain always ends
 * at the between-slots step's own fall-through. So the return comparison discriminates nothing on
 * the captured arms; twin (e) exists to prove that half of the contract is nonetheless wired.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-1f83.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine } from "../../machine.js";
import { loc_1f83 as oracle } from "../../translated/loc_1f83.js";
import { serviceBarrelSlotIfLive } from "../serviceBarrelSlotIfLive.js";
import { OBJ_ACTIVE, OBJ_ARRAY_67, ACTOR_SPRITES } from "../names.js";
import { runCycleFree } from "../../../../core/frame-stepped.js";
import manifest from "../../manifest.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1f83;
// The shared sprite-record tail — the ONLY consumer of the staging cursor this routine moves, and
// therefore the only place a wrong cursor can become visible. Still the frozen oracle.
const SPRITE_RECORD_TAIL = 0x21ba;
const SLOTS = 10; // the walk visits ten OBJ_ARRAY_67 records
const SLOT_STRIDE = 32; // OBJ_ARRAY_67 record stride
const SPRITE_RECORD = 4; // bytes of ACTOR_SPRITES staged per slot
const ATTRACT_FRAMES = 1200;

// The flag values attract actually produces on this array, and the one it never does. names.js
// records {0,1,2} live under MAME (bit0 = active, bit1 = occupied); 3 is the crafted value that
// separates "equals 1" from "bit 0 is set".
const NATURAL_FLAGS = [0, 1, 2];
const CRAFTED_FLAG = 3;
// The crafted low byte that puts the cursor three bytes short of the end of its page.
const PAGE_WRAP_L = 254;

// Measured, and asserted rather than merely printed — a live arm that never dispatches the
// routine proves nothing while looking green. Attract is deterministic, so these are exact.
const CAPTURED_DISPATCHES = 6160; // cycle-accurate runFrames, 1200 frames
const LIVE_DISPATCHES = 6210; // cycle-free runCycleFree, 1200 frames (a different frame clock)

const hx = (v) => "0x" + (v & 0xffff).toString(16);

// -- the sweep: replay INLINE at every real dispatch ---------------------------

/**
 * Boot attract with a hook at 0x1F83 that, at EVERY real dispatch, clones the machine twice, runs
 * the oracle on one clone and `candidate` on the other, compares, and throws both away before
 * letting the host continue on the oracle. O(1) memory, and it replays every dispatch rather than
 * a sample.
 *
 * Each clone gets its OWN 0x1F83 installed in its registry, which is what stops the capture
 * recursing: a clone rebuilds its override map from the host's assets, so without this the walk's
 * loop-back would re-enter the capturing hook and clone again. It also means each replay drives
 * the whole remaining walk through the implementation under test, not just its first slot.
 *
 * `prep` is applied identically to both clones, which is how a crafted arm is built on a REAL
 * captured state rather than from scratch.
 */
function sweepAttract(candidate, { prep = null, frames = ATTRACT_FRAMES } = {}) {
  let dispatches = 0;
  const breaches = [];
  const flags = new Map();
  const bases = new Map();
  const remaining = new Map();
  const cursors = new Map();
  let cursorArithmeticHolds = true;
  let firstFrame = null;
  // A crafted arm is worthless if it changes nothing; count the dispatches on which it moves the
  // ORACLE's own result, so non-vacuity is a measurement rather than an assumption.
  let prepChangedOracle = 0;
  // The staging cursor's ONLY consumer is the shared sprite-record tail at ROM 0x21BA, so a wrong
  // cursor is observable exactly on the replays that reach it. Counted on the ORACLE side (the
  // wrapper delegates and changes nothing), which makes the ceiling on any cursor twin's catch
  // rate a measurement rather than an excuse for a low number.
  let stagingReplays = 0;
  let skipArmStagingReplays = 0;

  const tally = (map, k) => map.set(k, (map.get(k) ?? 0) + 1);

  const host = new Machine(ROM, {
    overrides: new Map([[TARGET, (mm) => {
      dispatches++;
      if (firstFrame === null) firstFrame = mm.frames.length;
      const entryFlag = mm.mem8[mm.regs.ix + OBJ_ACTIVE];
      tally(flags, entryFlag);
      tally(bases, mm.regs.ix);
      tally(remaining, mm.regs.b);
      tally(cursors, mm.regs.hl);
      if (mm.regs.hl !== ACTOR_SPRITES + (SLOTS - mm.regs.b) * SPRITE_RECORD) cursorArithmeticHolds = false;

      const a = mm.clone();
      a.routines.set(TARGET, oracle);
      let staged = 0;
      const sharedTail = a.routines.get(SPRITE_RECORD_TAIL);
      a.routines.set(SPRITE_RECORD_TAIL, (m2) => { staged++; return sharedTail(m2); });
      const b = mm.clone();
      b.routines.set(TARGET, candidate);
      if (prep) { prep(a); prep(b); }

      let breach = null;
      let oracleValue, oracleDump;
      try {
        oracleValue = oracle(a);
        oracleDump = a.dumpState();
        if (staged > 0) {
          stagingReplays++;
          if (entryFlag !== 1) skipArmStagingReplays++;
        }
      } catch (err) {
        // The oracle faulting on a crafted state is a defect in the ARM, not in the candidate.
        throw new Error(`the oracle threw on dispatch #${dispatches}: ${err.message}`);
      }
      let candidateValue;
      try {
        candidateValue = candidate(b);
        const candidateDump = b.dumpState();
        for (let i = 0; i < oracleDump.length; i++) {
          if (oracleDump[i] === candidateDump[i]) continue;
          breach = { kind: "RAM", addr: a.stateOffsetToAddr(i), a: oracleDump[i], b: candidateDump[i] };
          break;
        }
        if (!breach && a.pc !== b.pc) breach = { kind: "pc", addr: null, a: a.pc, b: b.pc };
        if (!breach && a.regs.sp !== b.regs.sp) breach = { kind: "SP", addr: null, a: a.regs.sp, b: b.regs.sp };
        if (!breach && oracleValue !== candidateValue) {
          breach = { kind: "return", addr: null, a: String(oracleValue), b: String(candidateValue) };
        }
      } catch (err) {
        // A twin handed a record it should never have accepted can walk a ROM table off its end
        // and THROW rather than diverge. A fault is a result, so record it as the breach.
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
        breaches.push({
          dispatch: dispatches,
          flag: entryFlag,
          base: mm.regs.ix,
          remaining: mm.regs.b,
          cursor: mm.regs.hl,
          ...breach,
        });
      }
      return oracle(mm); // the HOST always runs the oracle, so attract proceeds normally
    }]]),
  });
  host.runFrames(frames);

  return {
    dispatches, breaches, flags, bases, remaining, cursors, cursorArithmeticHolds, firstFrame,
    prepChangedOracle, stagingReplays, skipArmStagingReplays,
  };
}

const describe = (b) =>
  `dispatch #${b.dispatch} (flag=${b.flag} base=${hx(b.base)} remaining=${b.remaining} ` +
  `cursor=${hx(b.cursor)}): ${b.kind}${b.addr === null ? "" : "@" + hx(b.addr)} oracle=${b.a} cand=${b.b}`;

// The one sweep the first three tests share. Node's test runner evaluates the module top to
// bottom, so this runs once at load rather than once per test.
const NATURAL = ROM_PRESENT ? sweepAttract(serviceBarrelSlotIfLive) : null;

// -- 1. EQUAL, on every real attract dispatch ----------------------------------

test("EQUAL: serviceBarrelSlotIfLive matches the oracle on every one of the real attract dispatches", () => {
  assert.ok(NATURAL.dispatches > 0, "no dispatch of 0x1F83 was captured — the harness never engaged");
  assert.equal(
    NATURAL.dispatches,
    CAPTURED_DISPATCHES,
    `attract dispatched 0x1F83 ${NATURAL.dispatches} times, not the ${CAPTURED_DISPATCHES} this gate claims`,
  );
  assert.equal(
    NATURAL.breaches.length,
    0,
    NATURAL.breaches.length ? `${NATURAL.breaches.length} breach(es), first: ${describe(NATURAL.breaches[0])}` : "",
  );

  // Coverage the walk must show if the capture is honest.
  for (const f of NATURAL_FLAGS) {
    assert.ok(NATURAL.flags.has(f), `no captured dispatch with the record's active flag at ${f}`);
  }
  assert.ok(!NATURAL.flags.has(CRAFTED_FLAG), "attract produced a flag of 3 — the crafted arm's premise is stale");
  for (let n = 1; n <= SLOTS; n++) {
    assert.ok(NATURAL.remaining.has(n), `no captured dispatch with ${n} slots remaining`);
  }
  for (let i = 0; i < SLOTS; i++) {
    assert.ok(NATURAL.bases.has(OBJ_ARRAY_67 + i * SLOT_STRIDE),
      `no captured dispatch with the record cursor at ${hx(OBJ_ARRAY_67 + i * SLOT_STRIDE)}`);
    assert.ok(NATURAL.cursors.has(ACTOR_SPRITES + i * SPRITE_RECORD),
      `no captured dispatch with the staging cursor at ${hx(ACTOR_SPRITES + i * SPRITE_RECORD)}`);
  }
  // The arithmetic the routine's header rests on: entering the check for slot `10 - remaining`,
  // the staging cursor sits on the FIRST byte of that slot's ACTOR_SPRITES record.
  assert.ok(NATURAL.cursorArithmeticHolds,
    "a captured dispatch had the staging cursor somewhere other than ACTOR_SPRITES + 4*(10-remaining)");

  const byFlag = [...NATURAL.flags].sort((p, q) => p[0] - q[0]).map(([f, n]) => `flag ${f}: ${n}`).join(", ");
  console.log(
    `  EQUAL: all ${NATURAL.dispatches} real 0x1F83 dispatches in ${ATTRACT_FRAMES} attract frames replayed inline ` +
      `(first at frame ${NATURAL.firstFrame}); ${byFlag}; ${NATURAL.bases.size} record bases, ` +
      `${NATURAL.remaining.size} slot positions, ${NATURAL.cursors.size} staging-cursor positions; ` +
      "full state dump INCLUDING STACK_SCRATCH, plus pc, SP and the return value",
  );
});

// -- 1b. What the captures can and cannot see about the staging cursor ---------

test("REACH: the ceiling on any staging-cursor defect is measured, not assumed", () => {
  // The cursor is read by nothing but the shared sprite-record tail, so a replay that never
  // reaches that tail cannot see a wrong cursor however wrong it is. Both cursor twins below are
  // asserted against this number rather than against "more than zero", which is what stops a low
  // catch rate reading as weak teeth when it is in fact complete.
  assert.ok(NATURAL.stagingReplays > 0, "no replay reached the shared sprite-record tail — nothing was ever staged");
  assert.ok(NATURAL.skipArmStagingReplays > 0,
    "no replay entering on the SKIP arm went on to stage anything — the cursor twins would be untestable");
  console.log(
    `  REACH: ${NATURAL.stagingReplays} of ${NATURAL.dispatches} replays reach the shared sprite-record tail at ` +
      `${hx(SPRITE_RECORD_TAIL)}; ${NATURAL.skipArmStagingReplays} of them entered on the skip arm, and that is ` +
      "the exact set on which a wrong staging cursor is observable",
  );
});

// -- 2. EQUAL (crafted) --------------------------------------------------------

/** Real capture, one surgical poke: the record claims both flag bits. */
const craftFlag3 = (m) => { m.mem8[m.regs.ix + OBJ_ACTIVE] = CRAFTED_FLAG; };
/** Real capture, one surgical nudge: the cursor's three-byte step wraps its page. */
const craftPageWrap = (m) => { m.regs.l = PAGE_WRAP_L; };

const CRAFTED = ROM_PRESENT
  ? {
      flag3: sweepAttract(serviceBarrelSlotIfLive, { prep: craftFlag3 }),
      wrap: sweepAttract(serviceBarrelSlotIfLive, { prep: craftPageWrap }),
    }
  : null;

test("EQUAL (crafted): a record flagged 3 — a value attract never produces — matches the oracle", () => {
  const s = CRAFTED.flag3;
  assert.ok(s.prepChangedOracle > 0,
    "forcing the flag to 3 changed nothing the oracle does on any dispatch — the arm would be vacuous");
  assert.equal(s.breaches.length, 0,
    s.breaches.length ? `${s.breaches.length} breach(es), first: ${describe(s.breaches[0])}` : "");
  console.log(`  EQUAL/crafted flag=3: ${s.dispatches} dispatches replayed with the record's flag forced to 3; ` +
    `the craft moves the oracle's own result on ${s.prepChangedOracle} of them`);
});

test("EQUAL (crafted): a staging cursor whose step wraps its page matches the oracle", () => {
  const s = CRAFTED.wrap;
  // Non-vacuous, and exactly as non-vacuous as it can be: moving the cursor changes what the
  // oracle does on precisely the replays that go on to stage a record through it, and on no
  // others. Asserting the equality rather than "> 0" is what makes the arm's reach a measurement.
  assert.equal(s.prepChangedOracle, s.stagingReplays,
    `wrapping the cursor moved the oracle on ${s.prepChangedOracle} replays but ${s.stagingReplays} reach the ` +
      "shared sprite-record tail — the craft is not landing where the cursor is read");
  assert.equal(s.breaches.length, 0,
    s.breaches.length ? `${s.breaches.length} breach(es), first: ${describe(s.breaches[0])}` : "");
  console.log(`  EQUAL/crafted wrap: ${s.dispatches} dispatches replayed with the staging cursor's low byte at ` +
    `${PAGE_WRAP_L}, three short of the end of its page (attract runs it ${hx(ACTOR_SPRITES)}-` +
    `${hx(ACTOR_SPRITES + (SLOTS - 1) * SPRITE_RECORD)} and never wraps); the craft moves the oracle's own result ` +
    `on ${s.prepChangedOracle} of them`);
});

// -- 3. TEETH ------------------------------------------------------------------

/** (a) tests bit 0 rather than equality with 1 — a claimed-but-inactive record gets animated. */
function brokenBitTest(m) {
  const { regs, mem8 } = m;
  if (mem8[regs.ix + OBJ_ACTIVE] & 1) return m.call(0x1f93);
  regs.l = regs.l + 3;
  return m.call(0x1f8d);
}

/** (b) steps the staging cursor four bytes instead of three. */
function brokenCursorStepsFour(m) {
  const { regs, mem8 } = m;
  if (mem8[regs.ix + OBJ_ACTIVE] === 1) return m.call(0x1f93);
  regs.l = regs.l + 4;
  return m.call(0x1f8d);
}

/** (c) steps the cursor full-width, so it leaves its page instead of wrapping. */
function brokenFullWidthStep(m) {
  const { regs, mem8 } = m;
  if (mem8[regs.ix + OBJ_ACTIVE] === 1) return m.call(0x1f93);
  regs.hl = regs.hl + 3;
  return m.call(0x1f8d);
}

/** (d) inverted gate: the active records are skipped and the rest animated. */
function brokenInvertedGate(m) {
  const { regs, mem8 } = m;
  if (mem8[regs.ix + OBJ_ACTIVE] !== 1) return m.call(0x1f93);
  regs.l = regs.l + 3;
  return m.call(0x1f8d);
}

/** (e) correct in RAM, wrong at the boundary: hands its caller a value it never had. */
function brokenSpuriousReturn(m) {
  serviceBarrelSlotIfLive(m);
  return false;
}

test("TEETH: the twins a natural capture must catch are caught", () => {
  const report = [];
  for (const [name, twin] of [
    ["cursor steps four", brokenCursorStepsFour],
    ["inverted gate", brokenInvertedGate],
    ["spurious return value", brokenSpuriousReturn],
  ]) {
    const s = sweepAttract(twin);
    assert.ok(s.breaches.length > 0,
      `the "${name}" twin escaped all ${s.dispatches} natural captures — the gate is worthless`);
    report.push(`${name} ${s.breaches.length}/${s.dispatches} (${s.breaches[0].kind})`);

    if (twin === brokenCursorStepsFour) {
      // Caught on EVERY dispatch where a wrong cursor can be seen at all — see the REACH test.
      assert.equal(s.breaches.length, s.skipArmStagingReplays,
        `the cursor twin was caught on ${s.breaches.length} dispatches but ${s.skipArmStagingReplays} could ` +
          "see it — the gate is missing some of the defect's own reachable set");
    }
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

test("TEETH: the bit-test twin ESCAPES every natural capture and is caught only by the crafted flag", () => {
  const natural = sweepAttract(brokenBitTest);
  assert.equal(natural.breaches.length, 0,
    `the bit-test twin was expected to escape every natural capture (attract's flags are ${NATURAL_FLAGS.join(",")}), ` +
      `but ${natural.breaches.length} of ${natural.dispatches} caught it — the crafted arm's premise is wrong`);
  const crafted = sweepAttract(brokenBitTest, { prep: craftFlag3 });
  assert.ok(crafted.breaches.length > 0,
    "the crafted flag=3 arm failed to catch the bit-test twin — that arm exists for exactly this");
  console.log(`  TEETH/bit test: 0/${natural.dispatches} natural, ${crafted.breaches.length}/${crafted.dispatches} ` +
    `crafted (${describe(crafted.breaches[0])})`);
});

test("TEETH: the full-width step twin ESCAPES every natural capture and is caught only by the crafted wrap", () => {
  const natural = sweepAttract(brokenFullWidthStep);
  assert.equal(natural.breaches.length, 0,
    `the full-width step twin was expected to escape every natural capture (attract never wraps the page), ` +
      `but ${natural.breaches.length} of ${natural.dispatches} caught it`);
  const crafted = sweepAttract(brokenFullWidthStep, { prep: craftPageWrap });
  assert.ok(crafted.breaches.length > 0,
    "the crafted page-wrap arm failed to catch the full-width step twin — that arm exists for exactly this");
  assert.equal(crafted.breaches.length, crafted.skipArmStagingReplays,
    `the crafted arm caught the full-width step on ${crafted.breaches.length} dispatches but ` +
      `${crafted.skipArmStagingReplays} could see it`);
  console.log(`  TEETH/full-width step: 0/${natural.dispatches} natural, ${crafted.breaches.length}/${crafted.dispatches} ` +
    `crafted (${describe(crafted.breaches[0])})`);
});

// -- 4. LIVE-OUT: wired live for a whole attract run ---------------------------

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
  const live = runFramesCycleFree(new Map([[TARGET, (m) => { dispatches++; return serviceBarrelSlotIfLive(m); }]]));

  // Without this the run can be byte-identical because the routine never executed. Measured on a
  // sibling routine: 800 frames of attract went green against a deliberately broken rewrite whose
  // first dispatch is at frame 1163.
  assert.ok(dispatches > 0, "0x1F83 was never dispatched in the live run — the arm proves nothing");
  assert.equal(dispatches, LIVE_DISPATCHES,
    `the live run dispatched 0x1F83 ${dispatches} times, not the ${LIVE_DISPATCHES} this gate claims`);

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
      `frames) byte-identical with 0x1F83 wired live over ${dispatches} dispatches — the accumulator and flags ` +
      "the rewrite drops are read back by nobody attract reaches",
  );
});
