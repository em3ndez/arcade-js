// SPDX-License-Identifier: GPL-3.0-only
/**
 * enterVblankInterrupt — memory-equivalent to the frozen oracle at ROM 0x0066.
 *
 * This entry is a single transfer: the frame interrupt lands on 0x0066 and jumps straight to the
 * handler at 0x00D8, which stacks the accumulator and falls into the shared body that does the
 * frame's work. The rewrite reaches 0x00D8 by a direct import, so the two sides do NOT meet at
 * 0x00D8; they meet one instruction later at the hand-off into 0x00D9, which both reach through the
 * registry, so 0x00D9 is the seam a stub can watch. The oracle is `jp 0x00D8` and borrows the
 * handler's return, which itself borrows 0x00D9's, so the rewrite performs the caller's return and
 * is wired RAW, exactly as _harness.js drives it — every arm runs the candidate unwrapped.
 *
 * 0x0066 reads and writes nothing of its own, so a seam comparison only proves the hand-off (the
 * accumulator stacked, the seat moved); the FULL arm runs the whole frame service so its real
 * product is in the diff. The pushed pair lands in diffed work RAM and SP is a compared register,
 * so a skipped push or a misplaced seat is caught in ordinary terms.
 *
 * What it exercises, holes stated:
 *   1. REACH — dispatch counts under both tapes, cross-checked against the machine's interrupt
 *      counter, with the handler as the positive control the same tap can see.
 *   2. SEAM — every captured entry, both sides stopped at the hand-off, comparing the whole dump,
 *      the device signature, the seat and every register.
 *   3. FULL — the same entries with 0x00D9 running, end to end, including the returned value.
 *   4. EXCLUDED — measured empty, with a control twin that scribbles on an index register.
 *   5. DEVICES — the device signature is shown able to see a write this entry never makes.
 *   6. TEETH — three twins, each caught at the seam and in the full run.
 *
 * HOLE: SEAM and FULL inherit whatever states the tapes visit; there are no crafted arms because
 * this entry has no branch of its own to force. HOLE: pc and cycles are not compared — the frozen
 * path steps both and the rewrite steps neither, the ordinary memory-equivalence drop.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0066.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { enterVblankInterrupt } from "../enterVblankInterrupt.js";
import { loc_0066 as oracle } from "../../translated/loc_0066.js";
import { loc_00d8 } from "../loc_00d8.js";
import { buildRoutines } from "../../routines.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x0066;
const HANDLER = 0x00d8;
const CONTINUATION = 0x00d9;
const WATCHDOG = 0xc200;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const CORPUS_ENTRIES = 120;
const FULL_FORM_LIMIT = 80;

/**
 * The ceiling on register divergence, EMPTY: the rewrite reaches the same handler and leaves
 * through the same return, so nothing the frozen path spends is left standing. A subset ceiling,
 * not a demand — a rewrite cannot be refused for being closer than this.
 */
const MOVED = [];

const TAPES = [
  ["attract", { tape: [] }],
  ["coin-start", {}],
];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

/** Drop the decoded graphics: nothing here renders, and re-decoding them per clone is the cost. */
function lean(mm) {
  mm.assets = {};
  mm.video = null;
  return mm;
}

// ── capture ─────────────────────────────────────────────────────────────────────────────

const captured = new Map();

function capture(label, opts) {
  if (captured.has(label)) return captured.get(label);
  const real = buildRoutines();
  const body = real.get(TARGET);
  const entries = [];
  const m = makeMachine(
    new Map([[TARGET, (mm, ...args) => {
      if (entries.length < CORPUS_ENTRIES) entries.push(lean(mm.clone()));
      return body(mm, ...args);
    }]]),
    opts,
  );
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the ${label} capture run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, `the ${label} capture run ran short`);
  captured.set(label, entries);
  return entries;
}

const firstEntry = () => capture("coin-start", {})[0] ?? null;

// ── the seam ────────────────────────────────────────────────────────────────────────────

/** A routine map that RECORDS the hand-off into 0x00D9 instead of taking it, passing all else. */
function stopAtSeam(real, sink) {
  return {
    get(addr) {
      if (addr !== CONTINUATION) return real.get(addr);
      return (mm) => {
        sink.hits++;
        sink.addr = addr;
        sink.sp = mm.regs.sp;
        sink.regs = Object.fromEntries(REG_FIELDS.map((k) => [k, mm.regs[k]]));
      };
    },
  };
}

/** Everything the state dump does NOT carry, so a device write cannot hide from this gate. */
const deviceSignature = (c) =>
  `${[...c.io.latch].join(",")}|wd=${c.io.watchdogKicks}|snd=${c.io.soundData}` +
  `|ur=${c.mem.unmappedReads}|uw=${c.mem.unmappedWrites}`;

function runToSeam(entry, fn) {
  const c = entry.clone();
  const sink = { hits: 0, addr: null, sp: null, regs: null };
  c.routines = stopAtSeam(entry.routines, sink);
  let threw = null;
  try {
    fn(c);
  } catch (e) {
    threw = String(e).slice(0, 60);
  }
  return { c, sink, threw };
}

/** null when the two agree everywhere this gate compares; otherwise the first disagreement. */
function seamDiff(candidate, entry) {
  const a = runToSeam(entry, oracle);
  const b = runToSeam(entry, candidate);
  if (a.threw !== b.threw) return `threw ${a.threw} vs ${b.threw}`;
  if (a.sink.hits !== b.sink.hits) return `reached the seam ${a.sink.hits} vs ${b.sink.hits} times`;
  if (a.sink.addr !== b.sink.addr) return `went to ${a.sink.addr} vs ${b.sink.addr}`;
  if (a.sink.sp !== b.sink.sp) return `seat ${hex4(a.sink.sp ?? 0)} vs ${hex4(b.sink.sp ?? 0)}`;
  const d = firstStateDiff(a.c.dumpState(), b.c.dumpState(), (o) => a.c.stateOffsetToAddr(o));
  if (d) return `${hex4(d.addr ?? 0)}: frozen=${d.a} rewrite=${d.b}`;
  if (deviceSignature(a.c) !== deviceSignature(b.c)) {
    return `devices ${deviceSignature(a.c)} vs ${deviceSignature(b.c)}`;
  }
  for (const k of REG_FIELDS) {
    if (MOVED.includes(k)) continue;
    if (a.sink.regs && a.sink.regs[k] !== b.sink.regs[k]) {
      return `${k}=${a.sink.regs[k]} vs ${b.sink.regs[k]} at the seam`;
    }
    if (a.c.regs[k] !== b.c.regs[k]) return `${k}=${a.c.regs[k]} vs ${b.c.regs[k]} after`;
  }
  return null;
}

/** Both sides run the frame service for real, so the whole per-frame product is in the diff. */
function fullDiff(candidate, entry) {
  const run = (fn) => {
    const c = entry.clone();
    try {
      return { c, ret: fn(c), threw: null };
    } catch (e) {
      return { c, ret: undefined, threw: String(e).slice(0, 60) };
    }
  };
  const a = run(oracle);
  const b = run(candidate);
  if (a.threw !== b.threw) return `threw ${a.threw} vs ${b.threw}`;
  if (a.ret !== b.ret) return `returned ${a.ret} vs ${b.ret}`;
  const d = firstStateDiff(a.c.dumpState(), b.c.dumpState(), (o) => a.c.stateOffsetToAddr(o));
  if (d) return `${hex4(d.addr ?? 0)}: frozen=${d.a} rewrite=${d.b}`;
  if (deviceSignature(a.c) !== deviceSignature(b.c)) {
    return `devices ${deviceSignature(a.c)} vs ${deviceSignature(b.c)}`;
  }
  for (const k of REG_FIELDS) {
    if (!MOVED.includes(k) && a.c.regs[k] !== b.c.regs[k]) {
      return `${k}=${a.c.regs[k]} vs ${b.c.regs[k]}`;
    }
  }
  return null;
}

// ── broken twins ────────────────────────────────────────────────────────────────────────

/** BUG: never hands on, so the frame's work simply does not happen and the seat is never moved. */
function brokenNoOp() {}

/** BUG: jumps past the handler to the shared body, so nothing is stacked and the seat is wrong. */
function brokenSkipsPush(m) {
  return m.call(CONTINUATION);
}

/** BUG: runs the whole frame service twice. */
function brokenDoubleService(m) {
  loc_00d8(m);
  return loc_00d8(m);
}

/** BUG: scribbles on an index register — the control for the EXCLUDED ceiling. */
function brokenMovesIndex(m) {
  const r = enterVblankInterrupt(m);
  m.regs.ix = (m.regs.ix + 1) & 0xffff;
  return r;
}

/** BUG: quiets the watchdog on the way past — the control that the device tap can see one. */
function brokenKicksWatchdog(m) {
  m.mem.write8(WATCHDOG, 0);
  return enterVblankInterrupt(m);
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["skips-push", brokenSkipsPush],
  ["double-service", brokenDoubleService],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("REACH: the interrupt really lands here, cross-checked and with a positive control", { skip }, () => {
  for (const [label, opts] of TAPES) {
    const real = buildRoutines();
    const counts = { [TARGET]: 0, [HANDLER]: 0 };
    const overrides = new Map();
    for (const addr of [TARGET, HANDLER]) {
      const body = real.get(addr);
      overrides.set(addr, (mm, ...args) => {
        counts[addr]++;
        return body(mm, ...args);
      });
    }
    const m = makeMachine(overrides, opts);
    m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the ${label} reach run stopped early: ${m.stoppedBy}`);
    // The handler is the positive control: a tap wired to nothing reports zero for a live address
    // just as convincingly, so a zero here would mean the instrument, not the address.
    assert.ok(counts[HANDLER] > 0, `the ${label} tap counted nothing for the handler either`);
    assert.ok(counts[TARGET] > 0, `vacuous: the ${label} tape never reached this entry`);
    // Independent corroboration: the machine's own interrupt counter is bumped by different code
    // than this tap, and every interrupt dispatches this vector exactly once.
    assert.equal(counts[TARGET], m.nmiCount,
      `${label}: this entry fired ${counts[TARGET]} times but the machine counted ` +
        `${m.nmiCount} interrupts — the two should agree`);
    console.log(`  REACH: ${label} — ${counts[TARGET]} dispatches (interrupts ${m.nmiCount}, ` +
      `handler ${counts[HANDLER]})`);
  }
});

test("SEAM: every captured entry agrees at the hand-off into the shared body", { skip }, () => {
  let total = 0;
  for (const [label, opts] of TAPES) {
    const entries = capture(label, opts);
    assert.notEqual(entries[0] ?? null, null, `vacuous: the ${label} tape never reached the routine`);
    for (const e of entries) assert.equal(seamDiff(enterVblankInterrupt, e), null, `${label}: ${seamDiff(enterVblankInterrupt, e)}`);
    total += entries.length;
  }
  console.log(`  SEAM: ${total} captured entries identical at the hand-off`);
});

test("FULL: the frame's whole service agrees end to end", { skip }, () => {
  const entries = capture("coin-start", {}).slice(0, FULL_FORM_LIMIT);
  assert.ok(entries.length > 0, "vacuous: nothing was captured to run in full");
  for (const e of entries) assert.equal(fullDiff(enterVblankInterrupt, e), null, String(fullDiff(enterVblankInterrupt, e)));
  console.log(`  FULL: ${entries.length} entries run through the whole service, identical`);
});

/** Which registers a candidate parts company with the frozen entry on, over the corpus. */
function movedOver(candidate) {
  const moved = new Set();
  for (const e of capture("coin-start", {})) {
    const a = runToSeam(e, oracle);
    const b = runToSeam(e, candidate);
    for (const k of REG_FIELDS) if (a.c.regs[k] !== b.c.regs[k]) moved.add(k);
  }
  return moved;
}

test("EXCLUDED: nothing moves, and the measurement is shown able to see movement", { skip }, () => {
  const moved = movedOver(enterVblankInterrupt);
  const control = movedOver(brokenMovesIndex);
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !MOVED.includes(k)),
    "the control twin scribbles on an index register and this measurement did not notice, so a " +
      "clean reading below is worth nothing");
  console.log(`  EXCLUDED (measured): ${REG_FIELDS.filter((k) => moved.has(k)).join(", ") || "none"}` +
    ` — ceiling ${MOVED.join(", ") || "empty"}; the control also moves ` +
    `${REG_FIELDS.filter((k) => control.has(k) && !MOVED.includes(k)).join(", ")}`);
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k) && !MOVED.includes(k)), [],
    "a register outside the declared ceiling diverged");
});

test("DEVICES: the device tap is shown able to see a write this entry never makes", { skip }, () => {
  const entry = firstEntry();
  const clean = runToSeam(entry, enterVblankInterrupt);
  const control = runToSeam(entry, brokenKicksWatchdog);
  assert.notEqual(deviceSignature(clean.c), deviceSignature(control.c),
    "a twin that touches the watchdog reads the same as the rewrite, so the device comparison in " +
      "every arm above is decoration");
  assert.equal(deviceSignature(clean.c), deviceSignature(entry.clone()),
    "the rewrite touched a device at the seam, which this entry does not do");
  console.log(`  DEVICES: rewrite ${deviceSignature(clean.c)}; the watchdog twin reads ` +
    `${deviceSignature(control.c)}`);
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const corpus = capture("coin-start", {});
    const atSeam = corpus.filter((e) => seamDiff(twin, e) !== null).length;
    const inFull = corpus.slice(0, FULL_FORM_LIMIT).filter((e) => fullDiff(twin, e) !== null).length;
    console.log(`  TEETH/${label}: caught at the seam on ${atSeam}/${corpus.length} entries, ` +
      `in the full run on ${inFull}/${Math.min(FULL_FORM_LIMIT, corpus.length)}`);
    assert.ok(atSeam + inFull > 0, `every arm PASSED the ${label} twin`);
    assert.equal(atSeam, corpus.length, `the ${label} twin escaped a captured entry at the seam`);
  });
}
