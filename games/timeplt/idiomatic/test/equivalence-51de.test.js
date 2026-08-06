// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_51de — memory-equivalent to the frozen oracle at ROM 0x51DE.
 *
 * WHAT IT IS, AND WHAT THAT COSTS THE GATE. Every call posts one (command, argument) pair into
 * the 64-cell command ring through the helper at 0x0038, which is ALREADY DECOMPILED, so the
 * rewrite calls it directly instead of through m.call — dissolving that call belongs to this
 * caller's unit. It also re-arms a countdown cell to 30. Measured over a driven run, that cell
 * is decremented once per frame from elsewhere, so the window is 30 frames wide: a second call
 * inside the window advances a step cell and posts the NEXT argument, climbing 1..8 and then
 * starting round again, while a call after the window has run out posts argument 1 and leaves
 * the step cell alone.
 *
 * GATE: strict unit-capture through unitEquivalence for the real entry, plus crafted entries for
 *   the whole input space the driven run never presents. What it exercises, holes stated:
 *
 *   1. EQUAL at the real dispatch — the coin -> start tape reaches 0x51DE at frame 1076 (undriven
 *      attract reaches it too, later, at 1156), and RAM agrees everywhere outside the six dead
 *      stack-scratch bytes named in 2.
 *   2. THE DEAD STACK SCRATCH IS THE ONE EXCLUSION, and it is SIX bytes here, not two: the oracle
 *      saves a register pair, pushes a return address around its helper call, and the translated
 *      helper saves a pair of its own. The rewrite models no stack, so all six differ. The
 *      window is [SP-6, SP) measured from THIS capture's own stack pointer — never a depth
 *      borrowed from another routine's gate, which would sit at another routine's stack depth and
 *      report real scratch as an escape. It is pinned from BOTH edges: every divergence must lie
 *      inside it (so it cannot hide one) and it must be filled exactly to its bottom byte (so it
 *      cannot quietly widen). This is the mixed-migration stack leak, recorded, not fixed.
 *   3. REGISTERS AND PC ARE EXCLUDED, DELIBERATELY — memory-equivalence drops the Z80 register
 *      trace, so `equal` is false for a CORRECT routine. Pinned to exactly {a, f, sp} plus pc.
 *   4. THE FIRST DISPATCH IS PINNED, because unitEquivalence clones the FIRST entry rather than
 *      the first informative one and no larger frame budget changes which one that is. It lands
 *      on the expired-window path with a free ring cell, which is informative — it writes three
 *      cells — but it is only ONE of the two paths, and the test asserts that shape so a change
 *      of entry cannot silently turn the arm into a weaker one.
 *   5. TWO REAL CORPORA, replayed: every distinct (window, step, cursor, guard) that a 2400-frame
 *      driven session and a 2400-frame undriven attract session present at the entry. Both are
 *      needed and that is a finding, not padding — the coin -> start tape sits still once play
 *      begins, so it reaches this routine three times and every one arrives with the window
 *      expired, while the attract demo actually plays and reaches it ten times as often, building
 *      chains as far as the fifth entry.
 *   6. AND THE CASE NEITHER CORPUS CONTAINS, which is the whole reason 7 exists: no real session
 *      here ever climbs to the eighth entry, so the wrap back to the first is unexercised by real
 *      data. A separate test asserts the driven tape alone is BLIND to all three chain twins,
 *      that the two sessions together are blind to exactly the wrap twin, and that the crafted
 *      space catches it — so identical-on-the-corpus is never read as reassurance.
 *   7. CRAFTED, over the whole input space: window prior x step prior x ring guard, plus a second
 *      pass over ring cursors that reach the ring's wrap and the argument cell's own wrap.
 *   8. THE CHAIN ITSELF, end to end: ten successive calls from an expired window must post
 *      1,2,3,4,5,6,7,8,1,2 — from the rewrite and from the oracle alike.
 *   9. TEETH — six broken twins aimed at six distinct behaviours (existence, the re-arm, the
 *      expired path's hands-off treatment of the step cell, the branch itself, the argument base
 *      and the eight-long wrap), each caught by the SAME comparison the real arm passes, and
 *      caught at a REAL cell rather than at a stack-scratch ghost.
 *
 * LIVE-OUT IS MEMORY-ONLY, AND THAT IS A CLAIM ABOUT THE CALLERS. The oracle also leaves 30 in A
 * and flags from its last mask. The DROPPED REGISTERS arm below measures rather than argues it:
 * a whole driven session runs with A and F forced hostile after every dispatch, and no byte of
 * game memory moves. That arm excludes NOTHING, and needs to: both of its sides run the oracle,
 * so their stack traffic is identical and the stack bytes are part of the result rather than a
 * hole in it. Its real hole is the sample — the driven tape dispatches this routine only twice
 * in 1800 frames, so it is two dispatches' worth of evidence, and it is paired with a tooth that
 * proves the instrument reaches the routine at all.
 *
 * The whole-machine gate is not usable for this routine, by design: the rewrite models no stack,
 * so it never pops the return address its translated callers push, and substituting it into the
 * oracle's call graph creeps the stack pointer. That layer goes live under the generator engine.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-51de.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_51de } from "../loc_51de.js";
import { postCommand } from "../postCommand.js";
import { loc_51de as oracle } from "../../translated/loc_51de.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x51de;
const CHAIN_WINDOW = 0xa99d;
const CHAIN_STEP = 0xa99e;
const RING = 0xac00;
const RING_CURSOR = 0xa9b2;
const SCRATCH_BYTES = 6;
const WINDOW_RELOAD = 30;

const skip = romsPresent() ? false : "ROM images are absent from this checkout";

let entry = null;

/** The required contract call, with the pristine entry harvested off the candidate's clone. */
function gate(candidate) {
  return unitEquivalence(
    makeMachine,
    TARGET,
    oracle,
    (m) => {
      if (entry === null) entry = m.clone();
      return candidate(m);
    },
    { maxFrames: ENTRY_FRAMES },
  );
}

function entryState() {
  if (entry === null) gate(loc_51de);
  return entry;
}

/** The window the oracle's saves and its call bracket dirty: the bytes just below entry SP. */
function inScratch(addr) {
  const sp = entryState().regs.sp;
  return addr !== null && addr >= sp - SCRATCH_BYTES && addr < sp;
}

/** Every differing byte of the two dumps, as {addr, a, b} — the scratch window included. */
function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

/** First REAL divergence: the same walk, with the dead scratch window skipped. */
function ramDiff(a, b) {
  return allDiffs(a, b).find((d) => !inScratch(d.addr)) ?? null;
}

/** Oracle vs candidate from the real entry, with the routine's whole input space forced. */
function craftedDiff(candidate, window, stepPrior, cursor, guard) {
  const arms = [entryState().clone(), entryState().clone()];
  for (const s of arms) {
    s.mem8[CHAIN_WINDOW] = window;
    s.mem8[CHAIN_STEP] = stepPrior;
    s.mem8[RING_CURSOR] = cursor;
    s.mem8[RING + cursor] = guard;
  }
  oracle(arms[0]);
  candidate(arms[1]);
  return ramDiff(arms[0], arms[1]);
}

// An expired window, the first frame of a fresh one, its last frame, and a value the reload never
// produces; a free ring cell and an occupied one, so a wrong argument is also tested where the
// ring DROPS it and only the two chain cells can show the error.
const WINDOWS = [0, 1, WINDOW_RELOAD, 255];
const GUARDS = [0xff, 0x7f];
const CURSORS = [0, 6, 30, 62, 63, 255];
const STEP_EDGES = [0, 6, 7, 8, 255];
const SWEEP_SIZE = WINDOWS.length * GUARDS.length * 256;
const CURSOR_SWEEP_SIZE = CURSORS.length * 2 * STEP_EDGES.length;

/** The window x guard x step-prior space at the real cursor: how many comparisons diverged. */
function sweepCaught(candidate) {
  let caught = 0;
  for (const window of WINDOWS) {
    for (const guard of GUARDS) {
      for (let prior = 0; prior < 256; prior++) {
        if (craftedDiff(candidate, window, prior, 6, guard)) caught++;
      }
    }
  }
  return caught;
}

/** The same, swept over ring cursors instead: the ring's wrap and the argument cell's own wrap. */
function cursorSweepCaught(candidate) {
  let caught = 0;
  for (const cursor of CURSORS) {
    for (const window of [0, 5]) {
      for (const prior of STEP_EDGES) {
        if (craftedDiff(candidate, window, prior, cursor, 0xff)) caught++;
      }
    }
  }
  return caught;
}

/** Longer than the entry window, which is sized to REACH the routine rather than to sample it. */
const CORPUS_FRAMES = 2400;

// Two real sessions, because they are not interchangeable HERE. The coin -> start tape sits still
// once the game begins, so it reaches this routine three times in 2400 frames and every one of
// them arrives with the window expired. The undriven attract demo PLAYS, so it reaches the routine
// an order of magnitude more often and does build chains. The entry capture still uses the driven
// tape, per the shared harness; only the corpus replay adds the second session.
const CORPORA = [["driven", undefined], ["attract", []]];

const corpora = new Map();

/** Every distinct input tuple a session actually presents at the routine's entry. */
function inputCorpus(name) {
  if (corpora.has(name)) return corpora.get(name);
  const tape = CORPORA.find(([n]) => n === name)[1];
  const seen = new Map();
  const probe = new Map([
    [
      TARGET,
      (mm) => {
        const cursor = mm.mem8[RING_CURSOR];
        const tuple = [mm.mem8[CHAIN_WINDOW], mm.mem8[CHAIN_STEP], cursor, mm.mem8[RING + cursor]];
        seen.set(tuple.join(","), tuple);
        return oracle(mm);
      },
    ],
  ]);
  const host = makeMachine(probe, tape ? { tape } : {});
  host.runFrames(CORPUS_FRAMES);
  assert.equal(host.stoppedBy, null, `the ${name} corpus run stopped early: ${host.stoppedBy}`);
  corpora.set(name, [...seen.values()]);
  return corpora.get(name);
}

/** Every tuple either session presents. A tuple's order IS craftedDiff's argument order. */
function allTuples() {
  return CORPORA.flatMap(([name]) => inputCorpus(name));
}

/** How many real input tuples a candidate gets wrong. */
function corpusCaught(candidate, tuples = allTuples()) {
  return tuples.filter((t) => craftedDiff(candidate, ...t)).length;
}

const CHAIN_CALLS = 10;

/** Ten successive calls from an expired window and a free ring: the arguments they post. */
function chainSequence(fn) {
  const s = entryState().clone();
  s.mem8[CHAIN_WINDOW] = 0;
  s.mem8[CHAIN_STEP] = 0;
  s.mem8[RING_CURSOR] = 0;
  for (let cell = 0; cell < 2 * CHAIN_CALLS; cell++) s.mem8[RING + cell] = 0xff;
  const posted = [];
  for (let call = 0; call < CHAIN_CALLS; call++) {
    fn(s);
    posted.push(s.mem8[RING + 2 * call + 1]);
  }
  return posted;
}

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: loc_51de == oracle on RAM", { skip }, () => {
  const r = gate(loc_51de);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");

  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  loc_51de(b);
  assert.equal(ramDiff(a, b), null, `RAM diverged — ${show(ramDiff(a, b))}`);

  const strays = allDiffs(a, b).filter((d) => !inScratch(d.addr));
  assert.deepEqual(strays, [], "a divergence escaped the six-byte scratch window");
  assert.notEqual(r.ram, null, "unitEquivalence saw no diff at all — the scratch saves vanished");
  assert.ok(inScratch(r.ram.addr), `the raw gate's first diff is real, not scratch: ${show(r.ram)}`);
  console.log(
    `  EQUAL: entry window=${entryState().mem8[CHAIN_WINDOW]} step=${entryState().mem8[CHAIN_STEP]}` +
      ` cursor=${entryState().mem8[RING_CURSOR]} sp=${hex4(entryState().regs.sp)}; RAM identical` +
      ` outside [SP-${SCRATCH_BYTES}, SP)`,
  );
});

test("THE FIRST DISPATCH IS NOT DEAD, and its shape is pinned", { skip }, () => {
  const s = entryState();
  const cursor = s.mem8[RING_CURSOR];
  assert.equal(s.mem8[CHAIN_WINDOW], 0, "the captured entry stopped taking the expired path");
  assert.equal(s.mem8[CHAIN_STEP], 0, "the captured entry's step prior moved");
  assert.equal(s.mem8[RING + cursor] & 0x80, 0x80, "the ring cell is no longer free, so no pair " +
    "is posted at the real entry and the arm above tests one cell instead of three");

  const after = s.clone();
  oracle(after);
  assert.equal(after.mem8[CHAIN_WINDOW], WINDOW_RELOAD, "the window must be re-armed");
  assert.equal(after.mem8[RING + cursor], 4, "the command byte must land in the cursor's cell");
  assert.equal(after.mem8[RING + cursor + 1], 1, "the expired path posts the FIRST argument");
  assert.equal(after.mem8[CHAIN_STEP], 0, "the expired path must leave the step cell alone");
  console.log(`  FIRST DISPATCH: expired window, free cell at ${cursor} — three cells move`);
});

test("EXCLUDED, deliberately: registers, pc and the six scratch bytes and nothing else",
  { skip },
  () => {
    const a = entryState().clone();
    const b = entryState().clone();
    oracle(a);
    loc_51de(b);

    const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
    assert.deepEqual(
      moved,
      ["a", "f", "sp"],
      "the excluded set changed shape: only the accumulator, the flag byte and the stack " +
        "pointer may differ — the saved pairs are push/pop balanced and must come back",
    );
    assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
    assert.equal(a.regs.sp - b.regs.sp, 2, "the oracle pops its return address; the rewrite " +
      "does not, and that unpopped word IS the mixed-migration leak, recorded not fixed");

    const dirty = allDiffs(a, b).map((d) => d.addr);
    const sp = entryState().regs.sp;
    assert.equal(dirty.length, SCRATCH_BYTES, `scratch window: ${dirty.length} bytes`);
    assert.equal(Math.min(...dirty), sp - SCRATCH_BYTES, "the exclusion must reach exactly as " +
      "deep as the oracle's own pushes and no deeper");
    assert.equal(Math.max(...dirty), sp - 1, "and must start at the byte below the entry pointer");
    console.log(`  EXCLUDED: registers ${moved.join(", ")}, pc, and ${dirty.map(hex4).join(" ")}`);
  });

test("CRAFTED: every window, step prior and ring guard behaves as the oracle", { skip }, () => {
  assert.equal(sweepCaught(loc_51de), 0, "the rewrite diverged somewhere in the crafted space");
  assert.equal(cursorSweepCaught(loc_51de), 0, "the rewrite diverged at some ring cursor");
  console.log(
    `  CRAFTED: ${SWEEP_SIZE} window x guard x step comparisons and ${CURSOR_SWEEP_SIZE} ` +
      "cursor comparisons identical",
  );
});

test("THE CHAIN: ten successive calls climb 1..8 and start round again", { skip }, () => {
  const expected = [1, 2, 3, 4, 5, 6, 7, 8, 1, 2];
  assert.deepEqual(chainSequence(oracle), expected, "the oracle's own chain is not what is claimed");
  assert.deepEqual(chainSequence(loc_51de), expected, "the rewrite's chain diverged");
  console.log(`  THE CHAIN: ${expected.join(" ")}`);
});

test("CORPUS: every input tuple two longer real sessions present replays identically",
  { skip },
  () => {
    for (const [name] of CORPORA) {
      const tuples = inputCorpus(name);
      assert.ok(tuples.length > 0, `vacuous: the ${name} session never reached the routine`);
      assert.equal(corpusCaught(loc_51de, tuples), 0, `${name}: diverged on a real input tuple`);
      const chained = tuples.filter((t) => t[0] !== 0).length;
      const steps = tuples.map((t) => t[1]);
      console.log(
        `  CORPUS/${name}: ${tuples.length} distinct tuples over ${CORPUS_FRAMES} frames ` +
          `identical; ${chained} on the chain path, step priors up to ${Math.max(...steps)}`,
      );
    }
  });

test("HONEST SIGNATURE: the routine reads no register, so its inputs are all in memory",
  { skip },
  () => {
    const clean = entryState().clone();
    const hostile = entryState().clone();
    for (const k of REG_FIELDS) if (k !== "sp") hostile.regs[k] = 0x5a;
    loc_51de(clean);
    loc_51de(hostile);
    assert.equal(ramDiff(clean, hostile), null, "a register steered the rewrite, so the " +
      "signature is hiding a live-in that ought to be a parameter");
    console.log("  HONEST SIGNATURE: every register forced hostile, same memory written");
  });

// ── teeth ───────────────────────────────────────────────────────────────────────────────
// A gate that cannot fail is worthless. Each twin is a plausible way to get ONE of this routine's
// six behaviours wrong, and each must be caught by the SAME comparison the real arm passes — at a
// real cell, never at a stack-scratch byte the gate excludes.

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: posts correctly but never re-arms the window, so no chain can ever form. */
function brokenNeverRearms(m) {
  const { mem8 } = m;
  if (mem8[CHAIN_WINDOW] === 0) postCommand(m, 4, 1);
  else {
    const step = (mem8[CHAIN_STEP] + 1) & 0xff;
    mem8[CHAIN_STEP] = step;
    postCommand(m, 4, (step % 8) + 1);
  }
}

/** BUG: advances the step cell on the expired path too, so a fresh chain starts at the second. */
function brokenAdvancesOnRestart(m) {
  const { mem8 } = m;
  const step = (mem8[CHAIN_STEP] + 1) & 0xff;
  mem8[CHAIN_STEP] = step;
  postCommand(m, 4, mem8[CHAIN_WINDOW] === 0 ? 1 : (step % 8) + 1);
  mem8[CHAIN_WINDOW] = WINDOW_RELOAD;
}

/** BUG: ignores the window, so every call posts the first argument and nothing ever climbs. */
function brokenAlwaysFirstEntry(m) {
  const { mem8 } = m;
  postCommand(m, 4, 1);
  mem8[CHAIN_WINDOW] = WINDOW_RELOAD;
}

/** BUG: posts the step itself rather than the entry after it, so the chain is off by one. */
function brokenArgumentOffByOne(m) {
  const { mem8 } = m;
  if (mem8[CHAIN_WINDOW] === 0) postCommand(m, 4, 1);
  else {
    const step = (mem8[CHAIN_STEP] + 1) & 0xff;
    mem8[CHAIN_STEP] = step;
    postCommand(m, 4, step % 8);
  }
  mem8[CHAIN_WINDOW] = WINDOW_RELOAD;
}

/** BUG: lets the chain climb past the eighth entry instead of starting round again. */
function brokenChainRunsPastEight(m) {
  const { mem8 } = m;
  if (mem8[CHAIN_WINDOW] === 0) postCommand(m, 4, 1);
  else {
    const step = (mem8[CHAIN_STEP] + 1) & 0xff;
    mem8[CHAIN_STEP] = step;
    postCommand(m, 4, step + 1);
  }
  mem8[CHAIN_WINDOW] = WINDOW_RELOAD;
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["never-rearms", brokenNeverRearms],
  ["advances-on-restart", brokenAdvancesOnRestart],
  ["always-first-entry", brokenAlwaysFirstEntry],
  ["argument-off-by-one", brokenArgumentOffByOne],
  ["chain-runs-past-eight", brokenChainRunsPastEight],
];

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT in the crafted space`, { skip }, () => {
    const caught = sweepCaught(twin);
    assert.ok(caught > 0, `the sweep PASSED the ${label} twin — it has no teeth`);
    const sample = WINDOWS.flatMap((w) =>
      GUARDS.flatMap((g) => [...Array(256).keys()].map((p) => craftedDiff(twin, w, p, 6, g))),
    ).find(Boolean);
    assert.ok(!inScratch(sample.addr), `${label} was caught on a scratch ghost: ${show(sample)}`);
    console.log(`  TEETH/${label}: caught on ${caught}/${SWEEP_SIZE} — first ${show(sample)}`);
  });
}

test("TEETH: real data cannot see the chain's wrap, and the crafted space can", { skip }, () => {
  const blindTo = (tuples) =>
    TWINS.filter(([, twin]) => corpusCaught(twin, tuples) === 0).map(([label]) => label);

  assert.deepEqual(
    blindTo(inputCorpus("driven")),
    ["always-first-entry", "argument-off-by-one", "chain-runs-past-eight"],
    "the driven tape's blind set moved — it reached the chain path, so re-derive the sweep",
  );
  const blind = blindTo(allTuples());
  assert.deepEqual(
    blind,
    ["chain-runs-past-eight"],
    "the set of behaviours real data cannot discriminate moved — re-derive the sweep",
  );
  for (const label of blind) {
    const twin = TWINS.find(([l]) => l === label)[1];
    assert.ok(sweepCaught(twin) > 0, `${label} escapes BOTH the corpus and the crafted space`);
  }
  console.log(
    `  TEETH: the driven tape alone is blind to three twins; both sessions together are blind ` +
      `to ${blind.join(", ")}, which only the crafted space catches`,
  );
});

test("TEETH: every twin also breaks the ten-call chain", { skip }, () => {
  const good = chainSequence(loc_51de);
  for (const [label, twin] of TWINS) {
    assert.notDeepEqual(chainSequence(twin), good, `the chain arm PASSED the ${label} twin`);
  }
  console.log(`  TEETH: all ${TWINS.length} twins post a different chain`);
});

test("TEETH: the no-op twin is CAUGHT by unitEquivalence itself", { skip }, () => {
  const r = gate(brokenNoOp);
  assert.notEqual(r.ram, null, "the contract call PASSED a routine that does nothing");
  assert.equal(r.equal, false, "a RAM divergence must fail the whole comparison");
  assert.ok(!inScratch(r.ram.addr), `caught on a scratch ghost: ${show(r.ram)}`);
  console.log(`  TEETH/no-op: caught by the contract call — ${show(r.ram)}`);
});

const HOSTILE_FRAMES = 1800;

/**
 * Run the whole game twice and diff every frame: once all-oracle, once corrupted at each
 * dispatch. "after" forces the two registers this rewrite declines to reproduce, which is the
 * real measurement — if a caller consumed either, the corruption reaches game memory. "before"
 * is the tooth: it forces the window prior instead, which the routine genuinely consumes, so
 * the traces MUST separate or the instrument never reaches the routine at all.
 */
function hostileSession(when) {
  const base = makeMachine();
  const baseFrames = base.runFrames(HOSTILE_FRAMES);

  let dispatches = 0;
  const hostile = makeMachine(new Map([[TARGET, (mm) => {
    dispatches += 1;
    if (when === "before") {
      mm.mem8[CHAIN_WINDOW] = 7;
      return oracle(mm);
    }
    const r = oracle(mm);
    mm.regs.a = 0x5a;
    mm.regs.f = 0xff;
    return r;
  }]]));
  const hostileFrames = hostile.runFrames(HOSTILE_FRAMES);

  const addrs = new Set();
  const n = Math.min(baseFrames.length, hostileFrames.length);
  for (let i = 0; i < n; i++) {
    const x = baseFrames[i];
    const y = hostileFrames[i];
    for (let o = 0; o < x.length; o++) if (x[o] !== y[o]) addrs.add(base.stateOffsetToAddr(o));
  }
  return {
    addrs: [...addrs].sort((p, q) => p - q),
    frames: n,
    dispatches,
    stopped: base.stoppedBy ?? hostile.stoppedBy ?? null,
  };
}

test("DROPPED REGISTERS: A and F steer nothing, measured over a whole driven session",
  { skip },
  () => {
    const r = hostileSession("after");
    assert.ok(r.dispatches > 0, "the instrument never reached the routine, so it measured nothing");
    assert.equal(r.stopped, null, `a run stopped early (${r.stopped}); a truncated trace finds ` +
      "no divergence and reads as a pass");
    assert.equal(r.frames, HOSTILE_FRAMES, `compared ${r.frames} of ${HOSTILE_FRAMES} frames — ` +
      "too short to conclude anything");
    assert.deepEqual(
      r.addrs,
      [],
      "a hostile value in a register this rewrite drops reached game memory: some caller CONSUMES " +
        "it, the live-out claim is wrong, and the routine must reproduce it",
    );
    console.log(
      `  DROPPED REGISTERS: hostile A and F on all ${r.dispatches} dispatches over ${r.frames} ` +
        "frames left no trace",
    );
  });

test("TEETH: corrupting what the routine DOES consume forks the run", { skip }, () => {
  const r = hostileSession("before");
  assert.equal(r.stopped, null, `a run stopped early (${r.stopped})`);
  assert.equal(r.frames, HOSTILE_FRAMES, `compared ${r.frames} of ${HOSTILE_FRAMES} frames`);
  assert.ok(
    r.addrs.length > 0,
    "forcing the window prior left the machine identical, so this instrument never reaches the " +
      "routine and the arm above proves nothing",
  );
  console.log(
    `  TEETH/dropped-registers: forcing the window first diverges at ${r.addrs.length} cell(s) — ` +
      "the arm above is wired",
  );
});
