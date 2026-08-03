// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_1f72 (ROM 0x1F72) — the board gate in front of the per-frame
 * object walk.
 *
 * COVERAGE — ATTRACT, PLUS POKES ON TOP OF ATTRACT STATE. Stated plainly because the two arms are
 * covered by different evidence and only one of them is natural:
 *
 *   • The 25m arm is REAL. A capturing override at 0x1F72 sees every natural dispatch during a
 *     1200-frame attract run, and EQUAL replays EVERY ONE of them inline — clone twice, run
 *     oracle and rewrite on the two clones, compare, discard — so there is no sampling and no
 *     stride to skip a rare shape.
 *   • The early-return arm is NOT REACHED BY ATTRACT AT ALL. REACHABILITY measures that and
 *     asserts it, at 1200 frames and again at 4000: every natural dispatch arrives with
 *     BOARD == 1. So attract is no evidence whatever about what this routine does on 50m, 75m or
 *     100m, and everything that covers the early return is either a crafted entry (EQUAL
 *     (crafted): a real capture with BOARD poked identically on both sides) or a poked live run
 *     (LIVE-OUT with BOARD held at 2 from frame 400).
 *
 * Nothing here enters a credited game or a second player, and no board other than 25m is reached
 * any way except by poking the very byte under test.
 *
 * CONTRACT — the FULL state dump, INCLUDING STACK_SCRATCH, plus pc, SP, the return value, and the
 * CPU register file. Including the stack region is the deliberate choice the recipe asks to be
 * stated: this rewrite keeps the oracle's boundary call into the still-frozen walk at ROM 0x1F83
 * rather than dissolving it, so both sides push and pop the same words and the stack region MUST
 * agree — which is the only way a dropped call bracket, invisible to both work RAM and the return
 * value, can be caught. On the 25m arm all 19 register fields are compared too, because from the
 * hand-off onward the frozen walk owns every one of them on both sides. On the early-return arm
 * the accumulator and the flags are excluded, and ONLY those two: the oracle leaves the result of
 * its own board compare there and the rewrite does not, and the caller's continuation (ROM 0x1986)
 * loads the accumulator with a constant before its first read. "the early-return arm differs …
 * and NOTHING else" asserts that exclusion is exactly two fields wide rather than a licence to
 * ignore registers.
 *
 * THE ARM LABEL IS DERIVED FROM THE ORACLE, NEVER FROM THE REWRITE. Each replay wraps the
 * registry entry for 0x1F83 on the oracle's own clone and records whether the oracle called it.
 * That outgoing call is what says which arm this dispatch is, so the rewrite cannot choose its own
 * coverage — and EQUAL additionally asserts the rewrite took the SAME arm, which is what catches
 * a twin that runs the walk on the wrong board.
 *
 * The 14 tests, in the order they run (referenced by NAME, so this list cannot drift out of step
 * with the file):
 *   REACHABILITY (x2) — measured before anything is replayed: the dispatch count, that every
 *      natural dispatch is 25m, and the oracle's exit contract. Every count and address the
 *      routine's own header states is produced and printed by these two.
 *   EQUAL — every real dispatch, replayed inline, no sampling.
 *   EQUAL (crafted) — the early-return arm, BOARD poked to 0, 2, 3 and 4 on real captures.
 *   the early-return arm differs … and NOTHING else — the {a, f} exclusion, asserted exact.
 *   HAND-OFF — 0x1F83 stubbed on both sides so the four values handed to the frozen walk become
 *      observable. This routine returns `undefined`, so the return assertion alone is near-vacuous;
 *      this is the manufactured observable that gives it teeth. The stub is installed on each fresh
 *      clone (a clone rebuilds `routines` from assets, so a stub on the parent would be gone) and
 *      the test asserts it actually fired, because a stub nobody can see fire proves nothing.
 *   TEETH (x5) — five broken twins, each asserted to be caught, and each asserted to be caught by
 *      the half of the gate that is supposed to catch it.
 *   LIVE-OUT (x2) — the rewrite wired live at 0x1F72 for a whole 1200-frame run, twice: natural
 *      attract, and with BOARD held at 2. Both diff the per-frame trace against the all-oracle
 *      baseline. The all-oracle machine IS the right control here: this rewrite calls no idiomatic
 *      callee, so wiring it is the single difference between the two runs.
 *   BLIND SPOT — the BOARD=2 live run's limitation, asserted rather than merely admitted. That run
 *      confirms the trace, but it is NOT what gives the early-return arm its teeth: on the poked
 *      state the walk finds nothing to render, so a rewrite that wrongly ran it there leaves the
 *      trace identical anyway. This wires exactly that twin live and asserts the run stays green,
 *      so the limitation has a producing line instead of living only in prose. The crafted entries
 *      are what actually catch a missing board gate.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-1f72.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine } from "../../machine.js";
import { loc_1f72 as oracle } from "../../translated/loc_1f72.js";
import { loc_1f72 } from "../loc_1f72.js";
import { BOARD, OBJ_ARRAY_67, ACTOR_SPRITES } from "../ram.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/dkong/rom/maincpu.bin" }, fn);

const ATTRACT_FRAMES = 1200;
const WALK = 0x1f83; // the still-frozen walk this routine falls into
const GIRDER_BOARD = 1;
const CAPTURES_KEPT = 6; // entry clones retained for the crafted and hand-off cases

const hx = (v) => "0x" + (v & 0xffff).toString(16);

// -- replay plumbing ----------------------------------------------------------

/**
 * Wrap the registry entry for the walk on ONE machine so its dispatch becomes observable, then run
 * `body` on it. The wrapper DELEGATES to whatever the registry already holds rather than importing
 * an implementation, so it keeps working — and keeps meaning the same thing — when 0x1F83 stops
 * being the frozen oracle. The wrapper must go on the clone that runs, not on the parent: a clone
 * rebuilds `routines` from assets, so a wrapper installed upstream would silently vanish.
 */
function runWatchingWalk(machine, body) {
  let enteredWalk = false;
  const registered = machine.routines.get(WALK);
  machine.routines.set(WALK, (mm) => {
    enteredWalk = true;
    return registered(mm);
  });
  const returned = body(machine);
  return { returned, enteredWalk };
}

/**
 * Run the ORACLE, recording whether it entered the walk. That outgoing call is what labels this
 * dispatch's arm, so the label comes from the oracle and never from the rewrite.
 */
const runOracle = (machine) => runWatchingWalk(machine, oracle);

/** Run a CANDIDATE, recording the same outgoing call. */
const runCandidate = (machine, candidate) => runWatchingWalk(machine, candidate);

/** First differing byte of the FULL dump (STACK_SCRATCH included), or null. */
function fullDumpDiff(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) return { addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] };
  }
  return null;
}

/**
 * Replay ONE entry state both ways on independent clones and report the first contract breach.
 *
 * On the arm where the oracle returns without entering the walk, the oracle performs the caller's
 * return pop itself while the rewrite models it as a plain JS return (the seam closes that bracket
 * at go-live). One m.ret() on the candidate models the seam, so pc and SP are still compared
 * rather than waved through. The arm is taken from the ORACLE's outgoing call, so which side gets
 * the shim is not the candidate's choice.
 */
function contractBreach(entry, candidate) {
  const a = entry.clone();
  const b = entry.clone();

  const o = runOracle(a);
  let c;
  try {
    c = runCandidate(b, candidate);
  } catch (err) {
    // A broken twin can FAULT rather than diverge (a bad pointer walks a table off its end).
    // Report the fault as the breach so the run reports instead of dying.
    return { kind: "fault", detail: `${err.name}: ${err.message}` };
  }

  if (o.enteredWalk !== c.enteredWalk) {
    return { kind: "arm", detail: `oracle enteredWalk=${o.enteredWalk} cand=${c.enteredWalk}` };
  }
  if (!o.enteredWalk) b.ret(); // model the seam's bracket close on the early-return arm

  const ram = fullDumpDiff(a, b);
  if (ram) return { kind: "ram", detail: `${hx(ram.addr)} oracle=${ram.a} cand=${ram.b}`, addr: ram.addr };
  if (o.returned !== c.returned) {
    return { kind: "return", detail: `oracle=${String(o.returned)} cand=${String(c.returned)}` };
  }
  if (a.pc !== b.pc) return { kind: "pc", detail: `oracle=${hx(a.pc)} cand=${hx(b.pc)}` };
  if (a.regs.sp !== b.regs.sp) {
    return { kind: "sp", detail: `oracle=${hx(a.regs.sp)} cand=${hx(b.regs.sp)}` };
  }

  // The accumulator and the flags carry the oracle's dead board compare on the early-return arm.
  const skip = o.enteredWalk ? [] : ["a", "f"];
  for (const k of REG_FIELDS) {
    if (skip.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) {
      return { kind: `reg ${k}`, detail: `oracle=${hx(a.regs[k])} cand=${hx(b.regs[k])}` };
    }
  }
  return null;
}

// -- 0. REACHABILITY, measured before anything else --------------------------

/**
 * Boot attract with a capturing hook at 0x1F72. Every dispatch is replayed INLINE (clone twice,
 * compare, discard) so the sweep is O(1) in memory and skips nothing; a handful of entry clones
 * are also retained for the crafted and hand-off cases below.
 */
function sweepAttract(candidate, frames = ATTRACT_FRAMES) {
  const captures = [];
  const boards = new Map();
  const arms = new Map();
  const costs = new Set();
  const spDeltas = new Set();
  const endPcs = new Set();
  const returns = new Set();
  const breaches = [];
  let dispatches = 0;

  const m = new Machine(ROM, {
    overrides: {
      "1f72": (mm) => {
        const board = mm.mem.read8(BOARD);
        boards.set(board, (boards.get(board) ?? 0) + 1);

        if (candidate) {
          const entry = mm.clone();
          const breach = contractBreach(entry, candidate);
          if (breach) breaches.push({ index: dispatches, board, breach });
          if (captures.length < CAPTURES_KEPT && dispatches % 97 === 0) captures.push(entry);
        }

        const before = mm.cycles;
        const spBefore = mm.regs.sp;
        const registered = mm.routines.get(WALK);
        const { returned: r, enteredWalk } = runOracle(mm);
        mm.routines.set(WALK, registered); // the host run continues; leave its registry as found
        costs.add(mm.cycles - before);
        spDeltas.add(mm.regs.sp - spBefore);
        endPcs.add(mm.pc);
        returns.add(typeof r === "undefined" ? "undefined" : String(r));
        arms.set(enteredWalk, (arms.get(enteredWalk) ?? 0) + 1);
        dispatches++;
        return r;
      },
    },
  });
  m.runFrames(frames);
  return { dispatches, boards, arms, costs, spDeltas, endPcs, returns, captures, breaches };
}

const SWEEP = ROM_PRESENT ? sweepAttract(loc_1f72) : null;
const LONG_FRAMES = 4000;
const LONG_SWEEP = ROM_PRESENT ? sweepAttract(null, LONG_FRAMES) : null;

test("REACHABILITY: attract dispatches 0x1F72, and only ever on 25m", () => {
  assert.ok(
    SWEEP.dispatches > 0,
    "attract never dispatched 0x1F72 — every capture-based check below would be vacuous",
  );
  assert.deepEqual(
    [...SWEEP.boards.keys()],
    [GIRDER_BOARD],
    `attract reached BOARD values ${JSON.stringify([...SWEEP.boards.keys()])}; the header's ` +
      "claim that the early return is unreachable in attract is what this asserts",
  );
  // The header says the walk arm is the only one attract takes; this is the producing line.
  assert.deepEqual([...SWEEP.arms.keys()], [true], "attract took an arm other than the walk");
  // …and that it is not an artefact of a short run.
  assert.deepEqual(
    [...LONG_SWEEP.boards.keys()],
    [GIRDER_BOARD],
    `a ${LONG_FRAMES}-frame run reached BOARD values ${JSON.stringify([...LONG_SWEEP.boards.keys()])}`,
  );
  console.log(
    `  REACHABILITY: ${SWEEP.dispatches} dispatches of 0x1F72 in ${ATTRACT_FRAMES} attract frames ` +
      `and ${LONG_SWEEP.dispatches} in ${LONG_FRAMES}, all at BOARD == ${GIRDER_BOARD}, all ` +
      `entering the walk; ${SWEEP.costs.size} distinct oracle cycle costs (path-dependent, so the ` +
      "live arm prices per dispatch)",
  );
});

test("REACHABILITY: the oracle's exit contract — one caller-return pop, one continuation, no result", () => {
  // Every number the routine header states about the oracle's exit is produced here.
  assert.deepEqual([...SWEEP.spDeltas], [2], "the oracle did not net exactly one caller-return pop");
  assert.deepEqual([...SWEEP.endPcs], [0x1986], "the oracle did not always land at the caller's continuation");
  assert.deepEqual([...SWEEP.returns], ["undefined"], "the oracle returned something other than undefined");
  console.log(
    `  EXIT CONTRACT: over ${SWEEP.dispatches} dispatches the oracle nets SP ` +
      `${[...SWEEP.spDeltas].map((d) => (d > 0 ? `+${d}` : d)).join(",")}, always lands at ` +
      `${[...SWEEP.endPcs].map(hx).join(",")}, and always returns ${[...SWEEP.returns].join(",")}; ` +
      `${REG_FIELDS.length} register fields are compared on the walk arm`,
  );
});

// -- 1. EQUAL over every real dispatch ---------------------------------------

test("EQUAL: loc_1f72 matches the oracle on EVERY real attract dispatch", () => {
  assert.equal(
    SWEEP.breaches.length,
    0,
    SWEEP.breaches.length
      ? `${SWEEP.breaches.length} of ${SWEEP.dispatches} dispatches breached; first at #` +
        `${SWEEP.breaches[0].index} (board ${SWEEP.breaches[0].board}): ` +
        `${SWEEP.breaches[0].breach.kind} ${SWEEP.breaches[0].breach.detail}`
      : "",
  );
  console.log(
    `  EQUAL: ${SWEEP.dispatches} of ${SWEEP.dispatches} real dispatches replayed inline ` +
      "(full dump incl. STACK_SCRATCH + pc + SP + return + 19 register fields)",
  );
});

// -- 2. EQUAL on the arm attract never takes ---------------------------------

const OTHER_BOARDS = [0, 2, 3, 4];

/** A crafted entry: a REAL capture with only BOARD changed. Everything else is left alone. */
function craft(capture, board) {
  const c = capture.clone();
  c.mem.write8(BOARD, board);
  return c;
}

test("EQUAL (crafted): the early return matches the oracle for every non-25m BOARD value", () => {
  assert.ok(SWEEP.captures.length > 0, "no entry state was captured — the crafted cases are vacuous");
  for (const board of OTHER_BOARDS) {
    for (const [i, capture] of SWEEP.captures.entries()) {
      const entry = craft(capture, board);
      // Non-vacuous: the oracle must actually take the early return for this to be that arm.
      const probe = entry.clone();
      assert.equal(
        runOracle(probe).enteredWalk,
        false,
        `BOARD=${board} did not put the oracle on the early-return arm`,
      );
      const breach = contractBreach(entry, loc_1f72);
      assert.equal(
        breach,
        null,
        breach ? `BOARD=${board} capture#${i}: ${breach.kind} ${breach.detail}` : "",
      );
    }
  }
  console.log(
    `  EQUAL (crafted): ${OTHER_BOARDS.length * SWEEP.captures.length} early-return entries ` +
      `(BOARD in ${JSON.stringify(OTHER_BOARDS)} x ${SWEEP.captures.length} real captures)`,
  );
});

// -- 3. The early-return register exclusion is exactly two fields wide -------

test("the early-return arm differs from the oracle in the accumulator and the flags, and NOTHING else", () => {
  const entry = craft(SWEEP.captures[0], 2);
  const a = entry.clone();
  const b = entry.clone();
  runOracle(a);
  loc_1f72(b);
  b.ret();
  const differing = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(
    differing,
    ["a", "f"],
    `expected exactly the accumulator and flags to differ, got ${JSON.stringify(differing)}`,
  );
  // And the difference really is the oracle's dead board compare: BOARD - 1.
  assert.equal(a.regs.a, (2 - 1) & 0xff, "the oracle's leftover accumulator is not BOARD - 1");
  console.log("  EXCLUSION: exactly {a, f} differ on the early return; oracle leaves BOARD - 1 in a");
});

// -- 4. HAND-OFF: make the void return observable ----------------------------

/**
 * The four values handed to the frozen walk are this routine's whole product on the 25m arm, and
 * they are invisible to a return-value check because the routine returns `undefined`. Stub the
 * walk on each side so they become observable. The stub is installed on the FRESH CLONE (a clone
 * rebuilds `routines` from assets, so a stub on the parent would silently vanish) and the test
 * asserts it fired.
 */
function handOff(entry, run) {
  const m = entry.clone();
  const seen = [];
  m.routines.set(WALK, (mm) => {
    seen.push({ ix: mm.regs.ix, hl: mm.regs.hl, de: mm.regs.de, b: mm.regs.b });
    mm.regs.ix = 0xdead; // steering: the real walk owns these registers from here on, so a
    mm.regs.hl = 0xbeef; // rewrite that kept a private copy would disagree with the oracle
    mm.ret();
  });
  run(m);
  return { seen, machine: m };
}

test("HAND-OFF: the rewrite hands the frozen walk exactly the values the oracle does", () => {
  const entry = SWEEP.captures[0];
  const o = handOff(entry, oracle);
  const c = handOff(entry, loc_1f72);

  assert.equal(o.seen.length, 1, "the stub never fired on the oracle side — it proves nothing");
  assert.equal(c.seen.length, 1, "the stub never fired on the rewrite side — it proves nothing");
  assert.deepEqual(c.seen, o.seen, "the rewrite hands the walk different values than the oracle");
  assert.deepEqual(
    o.seen[0],
    { ix: OBJ_ARRAY_67, hl: ACTOR_SPRITES, de: 32, b: 10 },
    "the oracle's hand-off is not the record base / sprite cursor / stride / count this file claims",
  );
  // With the walk stubbed out, the two sides must still agree byte for byte and on the boundary.
  assert.equal(fullDumpDiff(o.machine, c.machine), null, "state diverged with the walk stubbed");
  assert.equal(o.machine.pc, c.machine.pc, "pc diverged with the walk stubbed");
  assert.equal(o.machine.regs.sp, c.machine.regs.sp, "SP diverged with the walk stubbed");
  console.log(
    `  HAND-OFF: stub fired 1x per side; walk handed record ${hx(o.seen[0].ix)}, cursor ` +
      `${hx(o.seen[0].hl)}, stride ${o.seen[0].de}, count ${o.seen[0].b}`,
  );
});

// -- 5. TEETH ----------------------------------------------------------------

/** No board gate: runs the walk on every board. Only a non-25m entry can see this. */
function twinNoBoardGate(m) {
  const { regs } = m;
  regs.ix = OBJ_ARRAY_67;
  regs.hl = ACTOR_SPRITES;
  regs.de = 32;
  regs.b = 10;
  return m.call(WALK);
}

/** Starts on record 1 instead of record 0. */
function twinWrongRecordBase(m) {
  const { regs, mem8 } = m;
  if (mem8[BOARD] !== GIRDER_BOARD) return;
  regs.ix = OBJ_ARRAY_67 + 32;
  regs.hl = ACTOR_SPRITES;
  regs.de = 32;
  regs.b = 10;
  return m.call(WALK);
}

/** Sprite cursor off by one record. */
function twinWrongCursor(m) {
  const { regs, mem8 } = m;
  if (mem8[BOARD] !== GIRDER_BOARD) return;
  regs.ix = OBJ_ARRAY_67;
  regs.hl = ACTOR_SPRITES + 4;
  regs.de = 32;
  regs.b = 10;
  return m.call(WALK);
}

/** Nine records instead of ten. */
function twinShortCount(m) {
  const { regs, mem8 } = m;
  if (mem8[BOARD] !== GIRDER_BOARD) return;
  regs.ix = OBJ_ARRAY_67;
  regs.hl = ACTOR_SPRITES;
  regs.de = 32;
  regs.b = 9;
  return m.call(WALK);
}

/** The board gate inverted: skips 25m and runs everywhere else. */
function twinInvertedGate(m) {
  const { regs, mem8 } = m;
  if (mem8[BOARD] === GIRDER_BOARD) return;
  regs.ix = OBJ_ARRAY_67;
  regs.hl = ACTOR_SPRITES;
  regs.de = 32;
  regs.b = 10;
  return m.call(WALK);
}

/** Replay a twin over the real captures only (no fresh attract sweep). */
function capturedBreaches(twin) {
  return SWEEP.captures
    .map((c, i) => ({ i, breach: contractBreach(c, twin) }))
    .filter((r) => r.breach !== null);
}

/** Replay a twin over the crafted early-return entries. */
function craftedBreaches(twin) {
  const out = [];
  for (const board of OTHER_BOARDS) {
    for (const [i, capture] of SWEEP.captures.entries()) {
      const breach = contractBreach(craft(capture, board), twin);
      if (breach) out.push({ board, i, breach });
    }
  }
  return out;
}

const TEETH = [
  { name: "no board gate", twin: twinNoBoardGate, caughtBy: "crafted" },
  { name: "record base off by one record", twin: twinWrongRecordBase, caughtBy: "captured" },
  { name: "sprite cursor off by one record", twin: twinWrongCursor, caughtBy: "captured" },
  { name: "nine records instead of ten", twin: twinShortCount, caughtBy: "captured" },
  { name: "inverted board gate", twin: twinInvertedGate, caughtBy: "both" },
];

for (const { name, twin, caughtBy } of TEETH) {
  test(`TEETH: a twin with a ${name} is CAUGHT`, () => {
    const captured = capturedBreaches(twin);
    const crafted = craftedBreaches(twin);
    assert.ok(
      captured.length + crafted.length > 0,
      `the gate FAILED to catch the "${name}" twin anywhere — it proves nothing`,
    );
    // Assert WHICH half catches it, so a twin that is only incidentally caught is visible.
    if (caughtBy === "captured" || caughtBy === "both") {
      assert.ok(captured.length > 0, `"${name}" was not caught by the captured 25m replay`);
    }
    if (caughtBy === "crafted" || caughtBy === "both") {
      assert.ok(crafted.length > 0, `"${name}" was not caught by the crafted early-return entries`);
    }
    if (caughtBy === "crafted") {
      assert.equal(
        captured.length,
        0,
        `"${name}" was expected to be invisible on the 25m arm but the captured replay caught it`,
      );
    }
    const first = captured[0] ?? crafted[0];
    console.log(
      `  TEETH/${name}: ${captured.length} captured + ${crafted.length} crafted breaches; ` +
        `first ${first.breach.kind} ${first.breach.detail}`,
    );
  });
}

// -- 6/7. LIVE-OUT: wired live for whole runs --------------------------------

/**
 * One whole run with the rewrite wired live at 0x1F72, diffed against the all-oracle baseline on
 * the same machine configuration and the same pokes. The rewrite calls no idiomatic callee, so the
 * baseline differs from the live run in EXACTLY ONE thing — this routine.
 *
 * The oracle's cost is path-dependent (test 0 prints how many distinct costs a run produces), so
 * it is priced PER DISPATCH on a throwaway clone. The quantity charged is a DIFFERENCE: the
 * rewrite still runs the frozen walk through the registry and so already charges that whole
 * subtree itself; only the head instructions the rewrite replaced are owed. Left uncharged, the
 * accumulated deficit moves the vblank interrupt and the run forks on state that has nothing to do
 * with this routine.
 */
function liveRun(label, pokes, routine = loc_1f72) {
  const makePokes = () => (pokes ? pokes.map((p) => ({ ...p })) : null);

  const base = new Machine(ROM);
  base.pokes = makePokes();
  const baseline = base.runFrames(ATTRACT_FRAMES);

  let dispatches = 0;
  const deltas = new Set();
  const host = new Machine(ROM, {
    overrides: {
      "1f72": (mm) => {
        dispatches++;
        const probe = mm.clone(); // pins nextNmi/nextBoundary to Infinity: no NMI, no frame sample
        const priced = probe.cycles;
        oracle(probe);
        const oracleCost = probe.cycles - priced;
        const endPc = probe.pc;

        const spent = mm.cycles;
        const r = routine(mm);
        const delta = oracleCost - (mm.cycles - spent);
        deltas.add(delta);
        mm.step(endPc, delta); // step, not tick: tick clears pcKnown and a due NMI would throw
        return r;
      },
    },
  });
  host.pokes = makePokes();
  const live = host.runFrames(ATTRACT_FRAMES);

  assert.ok(dispatches > 0, `${label}: 0x1F72 was never dispatched — this run proves nothing`);
  assert.equal(live.length, baseline.length, `${label}: the two runs did not reach the same frame count`);
  let firstDiff = null;
  for (let f = 0; f < baseline.length && firstDiff === null; f++) {
    for (let i = 0; i < baseline[f].length; i++) {
      if (baseline[f][i] === live[f][i]) continue;
      firstDiff = `frame ${f}: ${hx(host.stateOffsetToAddr(i))} baseline=${baseline[f][i]} live=${live[f][i]}`;
      break;
    }
  }
  return { dispatches, deltas, firstDiff };
}

test("LIVE-OUT: wired live for a whole attract run, the rewrite leaves the same trace as the oracle", () => {
  const { dispatches, deltas, firstDiff } = liveRun("attract", null);
  assert.equal(firstDiff, null, `attract: ${firstDiff}`);
  console.log(
    `  LIVE-OUT (attract): ${ATTRACT_FRAMES} frames byte-identical with 0x1F72 wired live; ` +
      `${dispatches} dispatches; head cycles restored per dispatch: ${[...deltas].join(",")}`,
  );
});

const BOARD_2_POKE = [{ addr: BOARD, val: 2, frame: 400, dur: null }];

test("LIVE-OUT: the same holds with BOARD held at 2, which turns every dispatch into the early return", () => {
  const { dispatches, deltas, firstDiff } = liveRun("BOARD=2", BOARD_2_POKE);
  assert.equal(firstDiff, null, `BOARD=2: ${firstDiff}`);
  console.log(
    `  LIVE-OUT (BOARD=2): ${ATTRACT_FRAMES} frames byte-identical with 0x1F72 wired live; ` +
      `${dispatches} dispatches, all on the early-return arm; head cycles restored per dispatch: ` +
      `${[...deltas].join(",")}`,
  );
});

/**
 * The producing line for a HOLE both headers state, rather than a claim only prose carries: the
 * BOARD=2 live run confirms the trace but is NOT what gives the early return its teeth. On that
 * poked state the walk finds nothing to render, so a rewrite that wrongly ran it there leaves an
 * identical trace anyway. The crafted entries in test 2 are what actually catch a missing board
 * gate. This asserts the blindness so the headers cannot quietly overstate what the run covers —
 * and if it ever fails, the run has GAINED teeth and both headers must be updated to say so.
 */
test("the BOARD=2 live run is BLIND to a missing board gate — stated in both headers, asserted here", () => {
  const { dispatches, firstDiff } = liveRun("BOARD=2 twin", BOARD_2_POKE, twinNoBoardGate);
  assert.equal(
    firstDiff,
    null,
    "the BOARD=2 live run now CATCHES a missing board gate: it has gained teeth the headers " +
      `do not claim, so update them. First divergence: ${firstDiff}`,
  );
  console.log(
    `  LIVE-OUT (BOARD=2) BLIND SPOT: forcing the walk on all ${dispatches} dispatches of that run ` +
      "still leaves the trace byte-identical — the crafted entries, not this run, are the teeth " +
      "on the early-return arm",
  );
});
