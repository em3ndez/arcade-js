// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0038 — memory-equivalent to the frozen oracle at ROM 0x0038.
 *
 * ★ THE VECTOR QUESTION, SETTLED — it is a CALLED HELPER, not an interrupt entry.
 *   0x0038 is both the RST 38 vector and the Z80 IM-1 interrupt vector, and which one this
 *   game reaches changes what the routine is. Three independent readings agree:
 *     1. Every call site in games/timeplt/translated/ arrives by `rst 0x38` (11 cycles) or by
 *        `jp 0x0038` (10, a tail jump) — a call and a jump, never an accepted interrupt.
 *     2. The main CPU has no maskable IRQ line at all. boards/timeplt/io.js gates a vblank NMI
 *        at 0x0066 on LS259 bit 0, and the only other interrupt the latch drives is bit 2, which
 *        goes to the separate audio CPU. mame-src/src/mame/konami/timeplt.cpp agrees: the two
 *        set_input_line calls on the main CPU are both INPUT_LINE_NMI, bit 2 goes to
 *        timeplt_audio, and the driver header says "interrupts: standard NMI at 0x66".
 *     3. The main ROM image contains no `im` opcode anywhere, so IM 1 is never selected, and
 *        all eight RST slots hold hand-written helpers (0x0008 table-index, 0x0010 word-table
 *        fetch, 0x0018 HL+=A, 0x0020/0x0028 DE-=/+=0x20, 0x0030 inline jump-table dispatch).
 *   So the name may speak of posting rather than of servicing anything.
 *
 * GATE: strict unit-capture through unitEquivalence for the real entry, plus crafted-entry
 *   sweeps for the priors a real run never produces. What it exercises, holes stated:
 *
 *   1. EQUAL at the real dispatch — the coin -> start tape reaches 0x0038 (undriven attract
 *      reaches it too), and RAM agrees everywhere except the
 *      two dead stack-scratch bytes named in 2.
 *   2. THE DEAD STACK SCRATCH IS THE ONE EXCLUSION. The oracle brackets its work with
 *      `push hl` / `pop hl`, so it leaves HL's low and high bytes in the two popped bytes below
 *      the entry stack pointer; the rewrite models no stack, so those two bytes differ. The
 *      exclusion is exactly [SP-2, SP) and the test PINS it: it walks the whole dump and asserts
 *      every divergence lies in that two-byte window, so the exclusion cannot quietly widen.
 *   3. REGISTERS AND PC ARE EXCLUDED, DELIBERATELY — memory-equivalence drops the Z80 register
 *      trace, so `equal` is false for a CORRECT routine. Pinned to exactly {a, f, sp} plus pc.
 *   4. EXHAUSTIVE over write-cursor priors, 0..255 against four guard bytes. Only this covers
 *      the ring wrap at cursor 62 and the eight-bit wrap of the second cell at cursor 255; the
 *      real run only ever presents even cursors 0..62 with the cell free.
 *   5. THE REAL CORPUS, replayed. A second driven run of CORPUS_FRAMES frames — longer than the
 *      ENTRY_FRAMES window the unitEquivalence arm uses, which is sized to reach the routine and
 *      not to be a corpus — records every distinct (cursor, guard, command, argument) the game
 *      actually presents, and each is replayed through both arms.
 *   6. AND THE CASE THE CORPUS DOES NOT CONTAIN, which is why 4 exists. The guard byte is free at
 *      every dispatch of the driven run, so the DROP branch never happens on real data, and the
 *      cursor never leaves 0..62, so the second-cell wrap never happens either. A separate test
 *      asserts the corpus is BLIND to exactly the two twins aimed at those behaviours while the
 *      crafted sweep catches them, so identical-on-the-corpus is never read as reassurance.
 *   7. TEETH — five broken twins aimed at five distinct behaviours (existence, the guard, the
 *      pair order, the ring wrap, the second-cell wrap), each of which must FAIL the same
 *      comparison the real arm passes, at a REAL cell rather than a stack-scratch ghost.
 *
 * LIVE-OUT IS MEMORY-ONLY, AND THAT IS A CLAIM ABOUT THE CALLERS, not about the instructions.
 * The oracle also leaves the write cursor in A and flags from its last mask. The call sites were
 * read to see whether anything consumes them, and none does -- but note the LIMIT of that: an
 * exhaustive reading is exactly the kind of claim a reader cannot re-check cheaply. Treat it as
 * the weaker half of the argument; the DROPPED REGISTERS arm below is the half that can fail, and
 * it is what actually licenses dropping A and F. The in-line continuations either
 * load A from memory or overwrite the flags before any read, and those that continue into a
 * call reach routines whose first act is to load A (0x0809 and 0x5805 from memory, 0x4bdc not at
 * all). The tail sites hand the pair up unread. So dropping
 * A and F is safe and the RAM diff is the whole contract — and RAM here is a REAL gate, not a
 * tautology: the last test proves a bare no-op FAILS the same unitEquivalence call.
 *
 * The whole-machine gate is not usable for this routine and that is by design, not a gap: the
 * rewrite models no stack, so it does not pop the return address its callers push, and wiring it
 * into the translated engine through the registry creeps the stack pointer until an unrelated
 * routine writes through a corrupted address. A bare no-op fails there identically. That layer
 * goes live under the generator engine, not by substitution into the oracle's call graph.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0038.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_0038 } from "../loc_0038.js";
import { loc_0038 as oracle } from "../../translated/loc_0038.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x0038;
const RING = 0xac00;
const RING_CELLS = 64;
const WRITE_CURSOR = 0xa9b2;
const SCRATCH_BYTES = 2;

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
  if (entry === null) gate(loc_0038);
  return entry;
}

/** The window the oracle's scratch push dirties: the bytes just below the entry stack pointer. */
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
function craftedDiff(candidate, cursor, guard, command, argument) {
  const arms = [entryState().clone(), entryState().clone()];
  for (const s of arms) {
    s.mem8[WRITE_CURSOR] = cursor;
    s.mem8[RING + cursor] = guard;
    s.regs.d = command;
    s.regs.e = argument;
  }
  oracle(arms[0]);
  candidate(arms[1]);
  return ramDiff(arms[0], arms[1]);
}

const FREE = [0xff, 0x80];
const OCCUPIED = [0x7f, 0x00];
const GUARDS = [...FREE, ...OCCUPIED];
const BYTES = [0, 1, 63, 127, 128, 254, 255];

/** The whole cursor x guard space, one candidate, returning how many comparisons diverged. */
function sweepCaught(candidate) {
  let caught = 0;
  for (const guard of GUARDS) {
    for (let cursor = 0; cursor < 256; cursor++) {
      if (craftedDiff(candidate, cursor, guard, 0x2b, 0x94)) caught++;
    }
  }
  return caught;
}

const SWEEP_SIZE = GUARDS.length * 256;

/** Longer than the entry window, which is sized to REACH the routine rather than to sample it. */
const CORPUS_FRAMES = 1800;

let corpus = null;

/** Every distinct input tuple the driven run actually presents at the routine's entry. */
function inputCorpus() {
  if (corpus !== null) return corpus;
  const seen = new Map();
  const probe = new Map([
    [
      TARGET,
      (mm) => {
        const cursor = mm.mem8[WRITE_CURSOR];
        const tuple = [cursor, mm.mem8[RING + cursor], mm.regs.d, mm.regs.e];
        seen.set(tuple.join(","), tuple);
        return oracle(mm);
      },
    ],
  ]);
  const host = makeMachine(probe);
  host.runFrames(CORPUS_FRAMES);
  assert.equal(host.stoppedBy, null, `the corpus run stopped early: ${host.stoppedBy}`);
  corpus = [...seen.values()];
  return corpus;
}

/** How many of the corpus tuples a candidate gets wrong. */
function corpusCaught(candidate) {
  return inputCorpus().filter((t) => craftedDiff(candidate, ...t)).length;
}

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: loc_0038 == oracle on RAM", { skip }, () => {
  const r = gate(loc_0038);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");

  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  loc_0038(b);
  assert.equal(ramDiff(a, b), null, `RAM diverged — ${show(ramDiff(a, b))}`);

  const strays = allDiffs(a, b).filter((d) => !inScratch(d.addr));
  assert.deepEqual(strays, [], "a divergence escaped the two-byte scratch window");
  assert.notEqual(r.ram, null, "unitEquivalence saw no diff at all — the scratch push vanished");
  assert.ok(inScratch(r.ram.addr), `the raw gate's first diff is real, not scratch: ${show(r.ram)}`);
  console.log(
    `  EQUAL: entry cursor=${entryState().mem8[WRITE_CURSOR]} sp=${hex4(entryState().regs.sp)}; ` +
      `RAM identical outside [SP-${SCRATCH_BYTES}, SP)`,
  );
});

test("EXCLUDED, deliberately: registers, pc and the scratch push and nothing else", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  loc_0038(b);

  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(
    moved,
    ["a", "f", "sp"],
    "the excluded set changed shape: only the accumulator, the flag byte and the stack " +
      "pointer may differ — the address pair is push/pop balanced and must come back",
  );
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  assert.equal(a.regs.sp - b.regs.sp, 2, "the oracle pops its return address; the rewrite does not");
  assert.equal(a.regs.d, b.regs.d, "the command byte is an input and must survive");
  assert.equal(a.regs.e, b.regs.e, "the argument byte likewise");

  const dirty = allDiffs(a, b).map((d) => d.addr);
  assert.ok(dirty.length > 0 && dirty.length <= SCRATCH_BYTES, `scratch window: ${dirty.length}`);
  console.log(`  EXCLUDED: registers ${moved.join(", ")}, pc, and ${dirty.map(hex4).join(" ")}`);
});

test("EXHAUSTIVE over priors: every cursor and guard byte behaves as the oracle", { skip }, () => {
  const diverged = sweepCaught(loc_0038);
  assert.equal(diverged, 0, "the rewrite diverged somewhere in the crafted space");
  console.log(`  EXHAUSTIVE: ${SWEEP_SIZE} cursor x guard comparisons identical`);
});

test("EXHAUSTIVE over the pair: neither byte is masked, reordered or dropped", { skip }, () => {
  let compared = 0;
  for (const command of BYTES) {
    for (const argument of BYTES) {
      for (const cursor of [0, 61, 62, 255]) {
        const d = craftedDiff(loc_0038, cursor, 0xff, command, argument);
        assert.equal(d, null, `cursor=${cursor} pair=(${command},${argument}): ${show(d)}`);
        compared++;
      }
    }
  }
  console.log(`  EXHAUSTIVE: ${compared} (command, argument) placements identical`);
});

test("CORPUS: every input tuple a longer driven run presents replays identically", { skip }, () => {
  const tuples = inputCorpus();
  assert.ok(tuples.length > 0, "vacuous: the longer run never reached the routine either");
  assert.equal(corpusCaught(loc_0038), 0, "the rewrite diverged on a real input tuple");
  const guards = [...new Set(tuples.map((t) => t[1]))];
  const cursors = tuples.map((t) => t[0]);
  console.log(
    `  CORPUS: ${tuples.length} distinct tuples over ${CORPUS_FRAMES} frames identical; ` +
      `cursors ${Math.min(...cursors)}..${Math.max(...cursors)}, ` +
      `guard bytes ${guards.map((g) => g.toString(16)).join(" ")}`,
  );
});

test("NON-VACUOUS: the two branches really do different things", { skip }, () => {
  const free = entryState().clone();
  free.mem8[WRITE_CURSOR] = 62;
  free.mem8[RING + 62] = 0xff;
  free.regs.d = 0x2b;
  free.regs.e = 0x94;
  oracle(free);
  assert.equal(free.mem8[RING + 62], 0x2b, "the command byte must land in the cursor's cell");
  assert.equal(free.mem8[RING + 63], 0x94, "the argument byte must land in the next cell");
  assert.equal(free.mem8[WRITE_CURSOR], 0, "cursor 62 must step two cells on and wrap to 0");

  const full = entryState().clone();
  full.mem8[WRITE_CURSOR] = 62;
  full.mem8[RING + 62] = 0x7f;
  const before = full.mem8[RING + 63];
  full.regs.d = 0x2b;
  full.regs.e = 0x94;
  oracle(full);
  assert.equal(full.mem8[RING + 62], 0x7f, "an occupied cell must not be overwritten");
  assert.equal(full.mem8[RING + 63], before, "nor may the cell after it be");
  assert.equal(full.mem8[WRITE_CURSOR], 62, "and the cursor must not move");
  console.log("  NON-VACUOUS: the free path writes and wraps; the occupied path changes nothing");
});

test("HONEST SIGNATURE: passing the pair explicitly matches taking it from the machine", { skip }, () => {
  const viaRegisters = entryState().clone();
  const viaArguments = entryState().clone();
  viaRegisters.regs.d = 0x2b;
  viaRegisters.regs.e = 0x94;
  viaArguments.regs.d = 0x00;
  viaArguments.regs.e = 0x00;
  loc_0038(viaRegisters);
  loc_0038(viaArguments, 0x2b, 0x94);
  assert.equal(ramDiff(viaRegisters, viaArguments), null, "the two entry forms must agree");
  console.log("  HONEST SIGNATURE: named parameters and the register defaults agree on RAM");
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────
// A gate that cannot fail is worthless. Each twin below is a plausible way to get one of this
// routine's five behaviours wrong, and each must be caught by the SAME comparison the real arm
// passes — and caught at a real cell, never at the stack-scratch byte the gate excludes.

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: posts unconditionally, so a pair overwrites an entry that has not been taken yet. */
function brokenIgnoresGuard(m) {
  const { mem8 } = m;
  const cursor = mem8[WRITE_CURSOR];
  mem8[RING + cursor] = m.regs.d;
  mem8[RING + ((cursor + 1) & 0xff)] = m.regs.e;
  mem8[WRITE_CURSOR] = (cursor + 2) % RING_CELLS;
}

/** BUG: stores the pair the other way round, so the argument is read as the command. */
function brokenSwapsPair(m) {
  const { mem8 } = m;
  const cursor = mem8[WRITE_CURSOR];
  if ((mem8[RING + cursor] & 0x80) === 0) return;
  mem8[RING + cursor] = m.regs.e;
  mem8[RING + ((cursor + 1) & 0xff)] = m.regs.d;
  mem8[WRITE_CURSOR] = (cursor + 2) % RING_CELLS;
}

/** BUG: lets the cursor run past the end of the ring instead of wrapping inside it. */
function brokenCursorRunsOn(m) {
  const { mem8 } = m;
  const cursor = mem8[WRITE_CURSOR];
  if ((mem8[RING + cursor] & 0x80) === 0) return;
  mem8[RING + cursor] = m.regs.d;
  mem8[RING + ((cursor + 1) & 0xff)] = m.regs.e;
  mem8[WRITE_CURSOR] = (cursor + 2) & 0xff;
}

/** BUG: lets the argument cell leave the ring's page instead of wrapping to its start. */
function brokenArgumentCellLeavesPage(m) {
  const { mem8 } = m;
  const cursor = mem8[WRITE_CURSOR];
  if ((mem8[RING + cursor] & 0x80) === 0) return;
  mem8[RING + cursor] = m.regs.d;
  mem8[RING + cursor + 1] = m.regs.e;
  mem8[WRITE_CURSOR] = (cursor + 2) % RING_CELLS;
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["ignores-guard", brokenIgnoresGuard],
  ["swaps-pair", brokenSwapsPair],
  ["cursor-runs-on", brokenCursorRunsOn],
  ["argument-cell-leaves-page", brokenArgumentCellLeavesPage],
];

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT in the crafted space`, { skip }, () => {
    const caught = sweepCaught(twin);
    assert.ok(caught > 0, `the sweep PASSED the ${label} twin — it has no teeth`);
    const sample = GUARDS.flatMap((g) =>
      [...Array(256).keys()].map((c) => craftedDiff(twin, c, g, 0x2b, 0x94)),
    ).find(Boolean);
    assert.ok(!inScratch(sample.addr), `${label} was caught on a scratch ghost: ${show(sample)}`);
    console.log(`  TEETH/${label}: caught on ${caught}/${SWEEP_SIZE} — first ${show(sample)}`);
  });
}

test("TEETH: the real corpus is BLIND to two of them, and the crafted space is not", { skip }, () => {
  const blind = TWINS.filter(([, twin]) => corpusCaught(twin) === 0).map(([label]) => label);
  assert.deepEqual(
    blind,
    ["ignores-guard", "argument-cell-leaves-page"],
    "the set of behaviours the real data cannot discriminate moved — re-derive the sweep",
  );
  for (const label of blind) {
    const twin = TWINS.find(([l]) => l === label)[1];
    assert.ok(sweepCaught(twin) > 0, `${label} escapes BOTH the corpus and the crafted space`);
  }
  console.log(`  TEETH: corpus-blind but crafted-caught — ${blind.join(", ")}`);
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
 * Run the whole game twice and diff every frame: once all-oracle, once with the registers this
 * rewrite declines to reproduce forced to a hostile constant AFTER each dispatch. If a caller
 * consumed either of them, the corruption reaches game memory and the traces separate.
 *
 * `when` picks which side of the oracle the corruption lands on. "after" is the real measurement.
 * The tooth cannot simply corrupt the same two registers first: the routine's opening instruction
 * loads A from the write cursor, so A is an OUTPUT, not an input, and F is derived. It corrupts
 * the pair the routine actually consumes instead, which must change the bytes reaching the ring.
 */
function hostileSession(when) {
  const base = makeMachine();
  const baseFrames = base.runFrames(HOSTILE_FRAMES);

  let dispatches = 0;
  const hostile = makeMachine(new Map([[TARGET, (mm) => {
    dispatches += 1;
    if (when === "before") {
      mm.regs.d = mm.regs.d ^ 0xff;
      mm.regs.e = mm.regs.e ^ 0xff;
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
  // A truncated run finds nothing and reads as a pass. The tooth branch below deliberately kills
  // the machine, so `stopped` is reported rather than asserted here and the caller decides which
  // outcome its own arm requires.
  const stopped = base.stoppedBy ?? hostile.stoppedBy ?? null;
  return { addrs: [...addrs].sort((a, b) => a - b), frames: n, dispatches, stopped };
}

test("DROPPED REGISTERS: A and F steer nothing, measured over a whole driven session",
  { skip },
  () => {
    const r = hostileSession("after");
    assert.ok(r.dispatches > 0, "the instrument never reached the routine, so it measured nothing");
    assert.equal(r.stopped, null, `a run stopped early (${r.stopped}); a truncated trace finds no divergence and reads as a pass`);
    assert.equal(r.frames, HOSTILE_FRAMES, `compared ${r.frames} of ${HOSTILE_FRAMES} frames — too short to conclude anything`);
    assert.deepEqual(
      r.addrs,
      [],
      "a hostile value in a register this rewrite drops reached game memory: some caller CONSUMES " +
        "it, the live-out claim in the header is wrong, and the routine must reproduce it",
    );
    console.log(
      `  DROPPED REGISTERS: hostile A and F on all ${r.dispatches} dispatches over ${r.frames} ` +
        "frames left no trace",
    );
  });

test("TEETH: corrupting what the routine DOES consume forks the run", { skip }, () => {
  const r = hostileSession("before");
  assert.ok(
    r.addrs.length > 0,
    "corrupting the command pair the routine queues left the machine identical, so this " +
      "instrument never reaches the routine and the arm above proves nothing",
  );
  console.log(
    `  TEETH/dropped-registers: corrupting first diverges at ${r.addrs.length} cell(s) — the arm ` +
      "above is wired",
  );
});
