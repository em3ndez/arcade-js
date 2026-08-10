// SPDX-License-Identifier: GPL-3.0-only
/**
 * sendOneQueuedSoundThenUnwindTheFrameInterrupt — memory-equivalent to the frozen oracle at ROM 0x0174.
 *
 * ★ THIS IS NOT AN ORDINARY CALL TARGET. Nothing in the image executes `call 0x0174`. The vblank
 *   service at 0x00D9 does `ld hl,0x0174 / push hl` and then dispatches the phase arm through
 *   RST 0x30; the arm's own `ret` lands here, and serviceVerticalBlankInterrupt's transcription follows that with a
 *   final `m.call(0x0174)`. So this address is reached as a CONTINUATION, and the stack it finds
 *   is the interrupt frame the service's prologue laid down — not a caller's return slot. That is
 *   why this rewrite ends in `m.ret()` where a normal one omits it, and why machine.js's
 *   withOmittedRet seam CANNOT place a dispatch here: the entry legitimately moves SP by +22, and
 *   the seam accepts only 0 or +2. The SEAT arm measures the +22 rather than asserting it.
 *
 * ★ THE EXCLUDED SET IS EMPTY, and that is measured, not hoped for. Every register the drain at
 *   0x55D4 damages is popped over before this entry finishes — both banks, both index registers,
 *   the flags — so calling the idiomatic sibling (which restores nothing) instead of the oracle's
 *   register-faithful chain costs nothing observable. REGISTERS measures the full REG_FIELDS set
 *   over the corpus and the crafted frames and pins it at "nothing moved", with a control twin
 *   that scribbles on one register so a clean reading cannot be vacuous. `pc` agrees too.
 *
 * ★ THE MASKED WINDOW IS THE ORACLE'S OWN PUSHES, MEASURED. The oracle pushes a return address
 *   for the drain, and the drain pushes two more words when it has anything to send; the rewrite
 *   calls the sibling directly and pushes nothing. WINDOW instruments the oracle's `push16` over
 *   every arm below and pins the depth; BOUNDARY shows the mask is neither too wide nor too
 *   narrow. Everything outside those bytes is compared, RAM and hardware latches alike.
 *
 * ★ THE CORPUS NEVER DRAINS. Measured: the sound queue's count cell is zero at every real
 *   dispatch under both tapes, so the corpus alone exercises only the empty-queue path and would
 *   miss the whole slide. QUEUE asserts that blind spot and sweeps crafted counts to cover it.
 *
 * What it exercises, holes stated:
 *   1. CORPUS — every captured dispatch, RAM outside the window plus registers, pc and the
 *      hardware latches. Vacuity guarded.
 *   2. WINDOW — the oracle's push depth, measured over every arm, with a control that the
 *      instrument sees a push at all.
 *   3. BOUNDARY — a planted byte below the window is caught, one at the seat is caught, one
 *      inside is masked.
 *   4. SEAT — SP lands exactly 22 above where it started, on both sides, and pc agrees.
 *   5. QUEUE — the corpus blind spot asserted, then crafted counts swept over the slide.
 *   6. FRAME — crafted interrupt frames: every register of both banks comes back with the byte
 *      the frame holds for it, so a cross-wired pop cannot pass.
 *   7. GATE — the interrupt-enable latch ends set from either starting state, with a twin that
 *      skips the write as the control.
 *   8. REGISTERS — nothing moves, with a control twin that moves one.
 *   9. DRIVEN — the rewrite wired live for 700 frames against an all-oracle baseline; divergence
 *      confined to dead stack.
 *  10. RESUME — why those stack bytes differ at all, measured: the rewrite charges no T-states,
 *      so the vblank boundary catches the foreground at a different instruction and the interrupt
 *      pushes a different resume address.
 *  11. TEETH — seven twins, each caught, with the arm that caught it named.
 *
 * HOLE: the drain itself is not re-derived here. Its own gate owns that; this file asserts only
 * that whatever the sibling does, the oracle does the same and the register damage is popped over.
 * HOLE: the crafted frames vary the 22 stacked bytes and the queue; everything else in a crafted
 * machine is whatever the captured dispatch happened to hold.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0174.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { sendOneQueuedSoundThenUnwindTheFrameInterrupt } from "../sendOneQueuedSoundThenUnwindTheFrameInterrupt.js";
import { loc_0174 as oracle } from "../../translated/loc_0174.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x0174;
const NMI_VECTOR = 0x0066;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

/** The interrupt frame this entry unwinds: eleven words, the pushed resume address included. */
const FRAME_WORDS = 11;
const FRAME_BYTES = FRAME_WORDS * 2;

/** Measured by WINDOW: a return address for the drain, plus two words the drain itself pushes. */
const SCRATCH_BYTES = 6;

/** Where boot seats the stack, and the top of the dead region the DRIVEN arm allows. */
const STACK_SEAT = 0xb000;

/** The pending-sound queue, crafted by QUEUE so the drain's slide is exercised. */
const PENDING_COUNT = 0xac43;
const FIRST_PENDING = 0xac44;
const CRAFTED_COUNTS = [0, 1, 2, 3, 8, 64, 255];

/** LS259 bit 0 — the interrupt gate this entry reopens. */
const ENABLE_BIT = 0;

const CORPUS_ENTRIES = 120;
const CRAFTED_FRAMES = 24;
const DRIVEN_FRAMES = 700;

/**
 * The ceiling on register divergence, and it is EMPTY: this entry restores every register from
 * the stack, so a rewrite that drops the oracle's intermediate values still lands them all. Not a
 * demand — the arm is a subset check, so a rewrite diverging on fewer would still pass.
 */
const MOVED = [];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

/** Decoded graphics make a clone slow and nothing here renders. */
function lean(mm) {
  mm.assets = {};
  mm.video = null;
  return mm;
}

// ── the captured machines ───────────────────────────────────────────────────────────────

let captured = null;
function capture() {
  if (captured) return captured;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (entries.length < CORPUS_ENTRIES) entries.push(lean(mm.clone()));
    return oracle(mm);
  }]]));
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `capture run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "capture run ran short");
  assert.notEqual(entries.length, 0, "vacuous: the tape never reached the routine");
  captured = entries;
  return captured;
}

/** The window is relative to the seat the entry state carries, so it is computed per machine. */
const inWindow = (addr, seat) => addr !== null && addr >= seat - SCRATCH_BYTES && addr < seat;

/** Everything the state dump does not carry: the control latches and the audio side-channel. */
function ioDiff(a, b) {
  for (let bit = 0; bit < 8; bit++) {
    if (a.io.latch[bit] !== b.io.latch[bit]) {
      return { addr: null, a: `latch${bit}=${a.io.latch[bit]}`, b: `latch${bit}=${b.io.latch[bit]}` };
    }
  }
  if (a.io.soundData !== b.io.soundData) {
    return { addr: null, a: `sound=${a.io.soundData}`, b: `sound=${b.io.soundData}` };
  }
  if (a.io.watchdogKicks !== b.io.watchdogKicks) {
    return { addr: null, a: `dog=${a.io.watchdogKicks}`, b: `dog=${b.io.watchdogKicks}` };
  }
  return null;
}

/** Oracle vs candidate on independent clones: RAM outside the window, then registers, pc and IO. */
function unitDiff(candidate, machine) {
  const seat = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, a: "returned", b: String(e).slice(0, 50) };
  }
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (!inWindow(addr, seat)) return { addr, a: da[i], b: db[i] };
  }
  for (const k of REG_FIELDS) {
    if (MOVED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) return { addr: null, a: `${k}=${a.regs[k]}`, b: `${k}=${b.regs[k]}` };
  }
  if (a.pc !== b.pc) return { addr: null, a: `pc=${hex4(a.pc)}`, b: `pc=${hex4(b.pc)}` };
  return ioDiff(a, b);
}

/** How far below its seat the oracle's own pushes reach, on one entry state. */
function oracleDepth(machine) {
  const c = machine.clone();
  const seat = c.regs.sp;
  let deepest = seat;
  const push = c.push16.bind(c);
  c.push16 = (v) => {
    const r = push(v);
    if (c.regs.sp < deepest) deepest = c.regs.sp;
    return r;
  };
  oracle(c);
  return seat - deepest;
}

// ── crafted machines ────────────────────────────────────────────────────────────────────

/** A captured dispatch with a queue of `count` bytes waiting, each byte its own value. */
function withQueue(base, count) {
  const c = base.clone();
  c.mem8[PENDING_COUNT] = count;
  for (let i = 0; i < 16; i++) c.mem8[FIRST_PENDING + i] = 0x40 + i;
  return c;
}

/** A captured dispatch with the eleven stacked words replaced by a recognisable pattern. */
function withFrame(base, seed) {
  const c = base.clone();
  const seat = c.regs.sp;
  for (let w = 0; w < FRAME_WORDS; w++) c.mem16[seat + 2 * w] = (seed + w * 0x1111) & 0xffff;
  return c;
}

/** What the eleven words become, read straight off the frame rather than off either side. */
function expectedFromFrame(machine) {
  const seat = machine.regs.sp;
  const w = (n) => machine.mem16[seat + 2 * n];
  return {
    iy: w(0), ix: w(1),
    shadow: { hl: w(2), de: w(3), bc: w(4), af: w(5) },
    main: { hl: w(6), de: w(7), bc: w(8), af: w(9) },
    resume: w(10),
  };
}

// ── broken twins ────────────────────────────────────────────────────────────────────────

const pops = (m, n) => { for (let i = 0; i < n; i++) m.pop16(); };

/** BUG: does nothing — the tell that a gate is measuring an idle entry. */
function brokenNoOp() {}

/** BUG: unwinds correctly but never sends the byte the service queued. */
function brokenSkipsSend(m) {
  const { regs, mem } = m;
  regs.iy = m.pop16(); regs.ix = m.pop16();
  regs.hl = m.pop16(); regs.de = m.pop16(); regs.bc = m.pop16(); regs.af = m.pop16();
  regs.exx(); regs.exAf();
  regs.hl = m.pop16(); regs.de = m.pop16(); regs.bc = m.pop16();
  mem.write8(0xc300, mem.read8(0x1600), 10);
  regs.af = m.pop16();
  m.ret();
}

/** BUG: leaves the interrupt gate shut, so no further vblank is ever accepted. */
function brokenLeavesGateShut(m) {
  const { regs } = m;
  regs.iy = m.pop16(); regs.ix = m.pop16();
  regs.hl = m.pop16(); regs.de = m.pop16(); regs.bc = m.pop16(); regs.af = m.pop16();
  regs.exx(); regs.exAf();
  regs.hl = m.pop16(); regs.de = m.pop16(); regs.bc = m.pop16();
  regs.af = m.pop16();
  m.ret();
}

/** BUG: never swaps the banks back, so each bank is restored into the other one. */
function brokenNoBankSwap(m) {
  const { regs, mem } = m;
  regs.iy = m.pop16(); regs.ix = m.pop16();
  regs.hl = m.pop16(); regs.de = m.pop16(); regs.bc = m.pop16(); regs.af = m.pop16();
  regs.hl = m.pop16(); regs.de = m.pop16(); regs.bc = m.pop16();
  mem.write8(0xc300, mem.read8(0x1600), 10);
  regs.af = m.pop16();
  m.ret();
}

/** BUG: swaps the general bank but not the accumulator's, so the two flag sets cross over. */
function brokenAfNotSwapped(m) {
  const { regs, mem } = m;
  regs.iy = m.pop16(); regs.ix = m.pop16();
  regs.hl = m.pop16(); regs.de = m.pop16(); regs.bc = m.pop16(); regs.af = m.pop16();
  regs.exx();
  regs.hl = m.pop16(); regs.de = m.pop16(); regs.bc = m.pop16();
  mem.write8(0xc300, mem.read8(0x1600), 10);
  regs.af = m.pop16();
  m.ret();
}

/** BUG: the two index registers come back the other way round. */
function brokenIndexSwapped(m) {
  const { regs, mem } = m;
  regs.ix = m.pop16(); regs.iy = m.pop16();
  regs.hl = m.pop16(); regs.de = m.pop16(); regs.bc = m.pop16(); regs.af = m.pop16();
  regs.exx(); regs.exAf();
  regs.hl = m.pop16(); regs.de = m.pop16(); regs.bc = m.pop16();
  mem.write8(0xc300, mem.read8(0x1600), 10);
  regs.af = m.pop16();
  m.ret();
}

/** BUG: takes the resume address as the last register, so the stack never comes back level. */
function brokenShortUnwind(m) {
  const { regs, mem } = m;
  regs.iy = m.pop16(); regs.ix = m.pop16();
  regs.hl = m.pop16(); regs.de = m.pop16(); regs.bc = m.pop16(); regs.af = m.pop16();
  regs.exx(); regs.exAf();
  regs.hl = m.pop16(); regs.de = m.pop16(); regs.bc = m.pop16();
  mem.write8(0xc300, mem.read8(0x1600), 10);
  m.ret();
}

/** BUG: scribbles on an index register after unwinding — the control for the register arm. */
function brokenMovesIndex(m) {
  sendOneQueuedSoundThenUnwindTheFrameInterrupt(m);
  m.regs.iy = (m.regs.iy + 1) & 0xffff;
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["skips-send", brokenSkipsSend],
  ["gate-shut", brokenLeavesGateShut],
  ["no-bank-swap", brokenNoBankSwap],
  ["af-not-swapped", brokenAfNotSwapped],
  ["index-swapped", brokenIndexSwapped],
  ["short-unwind", brokenShortUnwind],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("CORPUS: every captured dispatch replays identically outside the window", { skip }, () => {
  const entries = capture();
  for (const e of entries) {
    const d = unitDiff(sendOneQueuedSoundThenUnwindTheFrameInterrupt, e);
    assert.equal(d, null, show(d));
  }
  console.log(`  CORPUS: ${entries.length} captured dispatches identical outside a ` +
    `${SCRATCH_BYTES}-byte window, registers pc and latches included`);
});

test("WINDOW: the oracle's push depth, measured over every arm", { skip }, () => {
  let deepest = 0;
  for (const e of capture()) deepest = Math.max(deepest, oracleDepth(e));
  const base = capture()[0];
  for (const count of CRAFTED_COUNTS) deepest = Math.max(deepest, oracleDepth(withQueue(base, count)));
  for (let i = 0; i < CRAFTED_FRAMES; i++) deepest = Math.max(deepest, oracleDepth(withFrame(base, i * 0x0301)));

  // The measurement is only evidence because the same instrument sees a push it is shown.
  const probe = base.clone();
  const seat = probe.regs.sp;
  let seen = seat;
  const push = probe.push16.bind(probe);
  probe.push16 = (v) => { const r = push(v); if (probe.regs.sp < seen) seen = probe.regs.sp; return r; };
  probe.push16(0x1234);
  assert.equal(seat - seen, 2, "the depth instrument does not notice a push it was handed, so " +
    "the number below means nothing");

  console.log(`  WINDOW (measured): the oracle reaches ${deepest} bytes below its seat`);
  assert.equal(deepest, SCRATCH_BYTES, "the oracle's stack footprint moved, so the masked window " +
    "is the wrong width and every arm here is either hiding or inventing a divergence");
});

test("BOUNDARY: the mask is neither too wide nor too narrow", { skip }, () => {
  const base = withQueue(capture()[0], 4);
  const scribbler = (offset) => (m) => {
    sendOneQueuedSoundThenUnwindTheFrameInterrupt(m);
    const at = (base.regs.sp + offset) & 0xffff;
    m.mem8[at] = (m.mem8[at] + 1) & 0xff;
  };
  const below = unitDiff(scribbler(-SCRATCH_BYTES - 1), base);
  const seat = unitDiff(scribbler(0), base);
  const inside = unitDiff(scribbler(-1), base);
  assert.notEqual(below, null, "a divergence one byte BELOW the window was swallowed, so the " +
    "mask is wider than the pushes it exists to cover");
  assert.notEqual(seat, null, "a divergence AT the entry seat was swallowed, so the mask reaches " +
    "into memory the oracle never writes");
  assert.equal(inside, null, "a divergence INSIDE the window was caught, so the two catches " +
    "above prove nothing about the mask");
  console.log(`  BOUNDARY: ${hex4(base.regs.sp - SCRATCH_BYTES - 1)} caught, ` +
    `${hex4(base.regs.sp)} caught, ${hex4(base.regs.sp - 1)} masked`);
});

test("SEAT: the stack comes back level and control resumes at the same address", { skip }, () => {
  const base = capture()[0];
  const a = base.clone();
  const b = base.clone();
  oracle(a);
  sendOneQueuedSoundThenUnwindTheFrameInterrupt(b);
  assert.equal(((a.regs.sp - base.regs.sp) & 0xffff), FRAME_BYTES,
    "the oracle no longer unwinds a whole interrupt frame, so the shape this file rests on moved");
  assert.equal(a.regs.sp, b.regs.sp, "the rewrite left the stack at a different depth");
  assert.equal(a.pc, b.pc, "the two sides resume at different addresses");
  console.log(`  SEAT: ${hex4(base.regs.sp)} -> ${hex4(a.regs.sp)} on both sides, ` +
    `resuming at ${hex4(a.pc)}`);
});

test("QUEUE: the corpus never drains, so crafted counts carry that arm", { skip }, () => {
  const entries = capture();
  const draining = entries.filter((e) => e.mem8[PENDING_COUNT] !== 0).length;
  assert.equal(draining, 0, "a real dispatch now arrives with sound waiting, so this arm's " +
    "premise has changed and the corpus should be measured for the slide rather than crafted");

  const base = entries[0];
  for (const count of CRAFTED_COUNTS) {
    const d = unitDiff(sendOneQueuedSoundThenUnwindTheFrameInterrupt, withQueue(base, count));
    assert.equal(d, null, `queue count ${count} diverged — ${show(d)}`);
  }
  // Flavour: with something waiting the entry must actually change the queue, or the sweep above
  // is comparing two routines that both did nothing.
  const one = withQueue(base, 3);
  const before = one.mem8[PENDING_COUNT];
  sendOneQueuedSoundThenUnwindTheFrameInterrupt(one);
  assert.notEqual(one.mem8[PENDING_COUNT], before, "a crafted queue was left untouched, so the " +
    "drain is not being reached and this arm is vacuous");
  console.log(`  QUEUE: ${draining} of ${entries.length} real dispatches had anything waiting; ` +
    `${CRAFTED_COUNTS.length} crafted counts identical`);
});

test("FRAME: every register comes back with the byte the frame holds for it", { skip }, () => {
  const base = capture()[0];
  for (let i = 0; i < CRAFTED_FRAMES; i++) {
    const crafted = withFrame(base, i * 0x0301 + 1);
    const want = expectedFromFrame(crafted);
    const d = unitDiff(sendOneQueuedSoundThenUnwindTheFrameInterrupt, crafted);
    assert.equal(d, null, `crafted frame ${i} diverged — ${show(d)}`);

    const after = crafted.clone();
    sendOneQueuedSoundThenUnwindTheFrameInterrupt(after);
    assert.equal(after.regs.iy, want.iy, `frame ${i}: the second index register is wrong`);
    assert.equal(after.regs.ix, want.ix, `frame ${i}: the first index register is wrong`);
    assert.equal(after.regs.hl, want.main.hl, `frame ${i}: the main pair is wrong`);
    assert.equal(after.regs.de, want.main.de, `frame ${i}: the main pair is wrong`);
    assert.equal(after.regs.bc, want.main.bc, `frame ${i}: the main pair is wrong`);
    assert.equal(after.regs.af, want.main.af, `frame ${i}: the main accumulator is wrong`);
    after.regs.exx();
    after.regs.exAf();
    assert.equal(after.regs.hl, want.shadow.hl, `frame ${i}: the other bank is wrong`);
    assert.equal(after.regs.de, want.shadow.de, `frame ${i}: the other bank is wrong`);
    assert.equal(after.regs.bc, want.shadow.bc, `frame ${i}: the other bank is wrong`);
    assert.equal(after.regs.af, want.shadow.af, `frame ${i}: the other accumulator is wrong`);
    assert.equal(after.pc, want.resume, `frame ${i}: control resumed at the wrong address`);
  }
  console.log(`  FRAME: ${CRAFTED_FRAMES} crafted frames, all eleven words landing where they belong`);
});

test("GATE: the interrupt gate ends open from either starting state", { skip }, () => {
  const base = capture()[0];
  for (const start of [0, 1]) {
    const a = base.clone();
    const b = base.clone();
    a.io.latch[ENABLE_BIT] = start;
    b.io.latch[ENABLE_BIT] = start;
    oracle(a);
    sendOneQueuedSoundThenUnwindTheFrameInterrupt(b);
    assert.equal(a.io.latch[ENABLE_BIT], 1, "the oracle no longer reopens the gate");
    assert.equal(b.io.latch[ENABLE_BIT], 1, `the rewrite left the gate shut, starting from ${start}`);
  }
  // The absence of a difference is evidence only because a twin that skips the write is seen.
  const control = base.clone();
  control.io.latch[ENABLE_BIT] = 0;
  brokenLeavesGateShut(control);
  assert.equal(control.io.latch[ENABLE_BIT], 0, "the twin that skips the write still ends with " +
    "the gate open, so this arm cannot tell the two apart");
  console.log("  GATE: open from either start, and the skipping twin is seen leaving it shut");
});

/** Which registers a candidate parts company with the oracle on, over the corpus and the frames. */
function movedOver(candidate) {
  const moved = new Set();
  const base = capture()[0];
  const machines = [...capture(), ...CRAFTED_COUNTS.map((c) => withQueue(base, c))];
  for (const m of machines) {
    const a = m.clone();
    const b = m.clone();
    oracle(a);
    try {
      candidate(b);
    } catch {
      continue;
    }
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

test("REGISTERS: nothing moves at all, with a control twin that moves one", { skip }, () => {
  const moved = movedOver(sendOneQueuedSoundThenUnwindTheFrameInterrupt);
  const control = movedOver(brokenMovesIndex);
  assert.ok(REG_FIELDS.some((k) => control.has(k)), "the measurement reports nothing even for a " +
    "twin that scribbles on an index register, so a clean reading below proves nothing");
  console.log(`  REGISTERS (measured): rewrite moves ${[...moved].join(", ") || "nothing"}; ` +
    `the control twin moves ${REG_FIELDS.filter((k) => control.has(k)).join(", ")}`);
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k) && !MOVED.includes(k)), [],
    "a register diverged outside the excluded set");
});

// ── the driven run ──────────────────────────────────────────────────────────────────────

/** Wire a candidate live for a whole session and collect every address that ever differs. */
function driven(candidate, baseline) {
  let calls = 0;
  let lowSp = 0xffff;
  const m = makeMachine(new Map([[TARGET, (mm) => {
    calls++;
    if (mm.regs.sp < lowSp) lowSp = mm.regs.sp;
    return candidate(mm);
  }]]));
  let frames = [];
  let threw = null;
  try {
    frames = m.runFrames(DRIVEN_FRAMES);
  } catch (e) {
    threw = String(e).slice(0, 60);
    frames = m.frames;
  }
  const differing = new Set();
  const compared = baseline === null ? 0 : Math.min(baseline.frames.length, frames.length);
  for (let f = 0; f < compared; f++) {
    const a = baseline.frames[f];
    const b = frames[f];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) differing.add(m.stateOffsetToAddr(i));
  }
  return { frames, calls, lowSp, threw, stopped: m.stoppedBy ? String(m.stoppedBy) : null,
    differing: [...differing].sort((x, y) => x - y) };
}

let baselineRun = null;
function baseline() {
  if (!baselineRun) {
    baselineRun = driven(oracle, null);
    assert.equal(baselineRun.threw, null, `the baseline itself threw: ${baselineRun.threw}`);
    assert.equal(baselineRun.stopped, null, `the baseline stopped early: ${baselineRun.stopped}`);
  }
  return baselineRun;
}

test("DRIVEN: wired live for a whole session, divergence confined to dead stack", { skip }, () => {
  const base = baseline();
  const r = driven(sendOneQueuedSoundThenUnwindTheFrameInterrupt, base);
  assert.equal(r.threw, null, `the driven run threw: ${r.threw}`);
  assert.equal(r.stopped, null, `the driven run stopped early: ${r.stopped}`);
  assert.equal(r.frames.length, DRIVEN_FRAMES, "the driven run did not reach the frames asked for");
  assert.ok(r.calls > 0, "vacuous: the rewrite was never dispatched in the driven run");

  const floor = base.lowSp - SCRATCH_BYTES;
  const escaped = r.differing.filter((a) => a < floor || a >= STACK_SEAT);
  assert.deepEqual(escaped.map(hex4), [], "a divergence reached memory outside the dead stack " +
    "region, so this rewrite is not a transparent swap after all");
  console.log(`  DRIVEN: ${r.calls} dispatches over ${DRIVEN_FRAMES} frames; ` +
    `${r.differing.length} byte(s) differ, all between ${hex4(floor)} and ${hex4(STACK_SEAT)}: ` +
    r.differing.map(hex4).join(" "));
});

test("RESUME: those stack bytes differ because the rewrite charges no time", { skip }, () => {
  // The claim is a MECHANISM, not just a location, so it is measured: with the rewrite wired the
  // vblank boundary catches the foreground at a different instruction, and the address the
  // interrupt pushes is that instruction's. Nothing else about the session moves.
  const resumesFor = (fn) => {
    const resumes = [];
    const m = makeMachine(new Map([
      [TARGET, fn],
      [NMI_VECTOR, (mm) => { resumes.push(mm.mem.read16(mm.regs.sp)); return mm.call(0x00d8); }],
    ]));
    m.runFrames(DRIVEN_FRAMES);
    assert.equal(m.stoppedBy, null, `the resume run stopped early: ${m.stoppedBy}`);
    return resumes;
  };
  const a = resumesFor(oracle);
  const b = resumesFor(sendOneQueuedSoundThenUnwindTheFrameInterrupt);
  assert.equal(a.length, b.length, "the two sides accepted a different number of interrupts, " +
    "which is a bigger divergence than this arm is written to describe");
  assert.ok(a.length > 0, "vacuous: no interrupt was accepted, so nothing was measured");
  const differing = a.filter((v, i) => v !== b[i]).length;
  assert.ok(differing > 0, "the resume addresses now agree, so the dead-stack difference the " +
    "DRIVEN arm allows has some OTHER cause and the explanation here is stale");
  const first = a.findIndex((v, i) => v !== b[i]);
  console.log(`  RESUME: ${differing} of ${a.length} interrupts resume elsewhere; the first is ` +
    `#${first}, ${hex4(a[first])} against ${hex4(b[first])}`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const base = capture()[0];
    const spaces = [
      ["corpus", capture().slice(0, 8)],
      ["queue", CRAFTED_COUNTS.map((c) => withQueue(base, c))],
      ["frames", Array.from({ length: 8 }, (_, i) => withFrame(base, i * 0x0301 + 1))],
    ];
    const got = [];
    let total = 0;
    for (const [name, machines] of spaces) {
      const caught = machines.filter((mm) => unitDiff(twin, mm) !== null).length;
      got.push(`${name} ${caught}/${machines.length}`);
      total += caught;
    }
    console.log(`  TEETH/${label}: caught on ${got.join(", ")}`);
    assert.ok(total > 0, `every arm PASSED the ${label} twin — the gate has no teeth against it`);
  });
}

test("TEETH: the driven arm catches a twin too", { skip }, () => {
  // Without a tooth of its own, "confined to dead stack" could mean the comparison sees nothing.
  const r = driven(brokenLeavesGateShut, baseline());
  const floor = baseline().lowSp - SCRATCH_BYTES;
  const escaped = r.differing.filter((a) => a < floor || a >= STACK_SEAT);
  assert.ok(r.threw !== null || r.stopped !== null || escaped.length > 0,
    "the driven arm PASSED a twin that never reopens the interrupt gate, so its confinement " +
      "result is vacuous");
  console.log(`  TEETH/driven: gate-shut twin — ${r.calls} dispatch(es), ` +
    `${escaped.length} escaped byte(s), stopped ${r.stopped ?? r.threw ?? "not at all"}`);
});
