// SPDX-License-Identifier: GPL-3.0-only
/**
 * sendOldestQueuedSoundCommand — memory-equivalent to the frozen oracle at ROM 0x55D4.
 *
 * GATE: strict unit-capture over every dispatch of the coin-and-start tape, an exhaustive crafted
 *   sweep of the queue count, one measured stack exclusion, a hardware-write arm, and teeth.
 *
 * ★ WHERE THE LIVE-OUT COMES FROM. The oracle's only caller is ROM 0x0174, and both of the
 *   oracle's exits return into it. Its first eleven instructions are `pop iy / pop ix / pop hl /
 *   pop de / pop bc / pop af / exx / ex af,af' / pop hl / pop de / pop bc`, and it then loads the
 *   accumulator from a ROM byte and pops AF once more before returning. Every register in the
 *   main set AND the alternate set is therefore restored from the stack before anything reads it,
 *   so NO register is live out of this routine and the declared ceiling below is wide on purpose.
 *   What IS live is memory, and the two hardware latches the send drives — which the state dump
 *   does not cover, hence the HARDWARE arm.
 *
 * ★ THE ORACLE PUSHES AND THE REWRITE DOES NOT. The oracle saves the flag its count decrement set
 *   across a call, and reaches the sender through the registry; the rewrite calls the sender
 *   directly and models no stack. That leaves dead scratch below the entry seat, and moves most of
 *   the register file. The window is MEASURED — the WINDOW arm instruments the oracle's own
 *   `push16` over this file's whole sweep — never assumed and never copied from another gate.
 *
 * What it exercises, holes stated:
 *   1. REACHED    — the shared harness enters the routine, AND its first entry finds the queue
 *                   empty, so a no-op passes there. Measured and asserted, not glossed: every
 *                   arm with teeth works from the corpus instead.
 *   1b. EQUAL     — identical across the whole state dump outside the measured window, at the
 *                   first captured dispatch that actually had something to drain.
 *   2. WINDOW     — the oracle's own deepest push, measured over the whole sweep and PINNED, so a
 *                   change that deepens its stack traffic turns this gate red instead of being
 *                   absorbed by a wider mask.
 *   3. BOUNDARY   — a planted divergence one byte BELOW the window is caught, one AT the entry
 *                   seat is caught, and one INSIDE is masked. The third is what shows the first
 *                   two are not simply the instrument catching everything.
 *   4. CORPUS     — every dispatch the tape produces, replayed from its own captured machine,
 *                   with the spread of queue counts reported and all three arms asserted present:
 *                   the empty queue, the last entry, and a queue with a slide left to do.
 *   5. HARDWARE   — the ordered hardware writes and the device state, which RAM cannot see. The
 *                   arm MEASURES that blindness with a twin that never sends: it passes the RAM
 *                   comparison and this arm catches it. TWO of the six twins are hardware-only,
 *                   and the second says something worth knowing — a twin sending the byte AFTER
 *                   the head still slides the queue, so WHICH byte goes out leaves no trace in
 *                   memory at all. Without this arm the choice of byte would be ungated.
 *   6. EXHAUSTIVE — the count crafted over all 256 values on a real machine, the queue bytes given
 *                   distinct values so a short or long slide diverges, plus the exact after-state
 *                   of a count of one, which is the arm that sends and must not slide.
 *   7. EXCLUDED   — no register outside the declared ceiling moves, with a twin that moves one as
 *                   the in-arm control that the measurement can see one.
 *   8. TEETH      — six twins with their exact catch counts over the crafted sweep, and each one's
 *                   verdict on the RAM comparison declared rather than averaged.
 *
 * HOLE: the send itself is gated by ROM 0x55F8's own file. What this file gates is WHICH byte is
 * handed over, that the count comes down, and that the rest of the queue slides.
 * HOLE: pulse width and the cycle stamps on the recorded writes are not compared; the rewrite
 * charges no time, so its writes carry one stamp where the oracle's carry three.
 * HOLE: nothing here says what a queued byte MEANS to the processor that receives it.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-55d4.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { sendOldestQueuedSoundCommand } from "../sendOldestQueuedSoundCommand.js";
import { sendSoundCommand } from "../sendSoundCommand.js";
import { loc_55d4 as oracle } from "../../translated/loc_55d4.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x55d4;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const PENDING_COUNT = 0xac43;
const FIRST_PENDING = 0xac44;

/** Measured by the WINDOW arm: the deepest the oracle's own pushes reach below the entry seat. */
const SCRATCH_BYTES = 4;

/**
 * The ceiling on divergence, and the whole of it. Derived from the caller, which restores every
 * register from the stack before reading one — not from the rewrite. Not a set the rewrite is
 * required to fill: one that diverged on fewer still passes, so this can never refuse a fix.
 */
const MOVED = ["a", "f", "b", "c", "d", "e", "h", "l", "sp"];

const COUNTS = Array.from({ length: 256 }, (_unused, c) => c);
/** Long enough that the far end of the biggest crafted slide is still a distinct byte. */
const QUEUE_BYTES = 260;

const read = (mm, i) => mm.mem8[(FIRST_PENDING + i) & 0xffff];
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => {
  if (!d) return "identical";
  return d.addr === null
    ? `${d.reg}: oracle=${d.a} candidate=${d.b}`
    : `${hex4(d.addr)}: oracle=${d.a} candidate=${d.b}`;
};

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

/** The masked window, and nothing else: the bytes the oracle's own pushes reach and no others. */
const inScratch = (addr, sp) => addr !== null && addr >= sp - SCRATCH_BYTES && addr < sp;

/**
 * Oracle vs candidate on clones of `machine`: the whole dump masked to the measured window, then
 * every register outside the ceiling. Only the candidate's side is wrapped, because a raise from
 * the oracle is a harness fault and must not be swallowed.
 */
function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, reg: "raised", a: "returned", b: String(e).slice(0, 40) };
  }
  const ram = allDiffs(a, b).find((d) => !inScratch(d.addr, sp));
  if (ram) return ram;
  for (const k of REG_FIELDS) {
    if (MOVED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) return { addr: null, reg: k, a: a.regs[k], b: b.regs[k] };
  }
  return null;
}

/** How far below its seat the oracle's own pushes take the stack pointer, on one entry state. */
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

// ── the captured corpus ─────────────────────────────────────────────────────────────────

let corpus = null;
let entry = null;

/** One pristine machine per dispatch of the tape, in the order the game produced them. */
function captureCorpus() {
  if (corpus) return corpus;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    entries.push(mm.clone());
    return oracle(mm);
  }]]));
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `corpus run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "corpus run ran short");
  assert.ok(entries.length > 0, "vacuous: the tape never reached the routine");
  corpus = entries;
  return corpus;
}

function entryState() {
  if (entry === null) entry = captureCorpus()[0];
  return entry;
}

/** A real machine with the count set and the queue filled with bytes that differ from each other. */
function withCount(count) {
  const mm = entryState().clone();
  mm.mem8[PENDING_COUNT] = count;
  for (let i = 0; i < QUEUE_BYTES; i++) mm.mem8[(FIRST_PENDING + i) & 0xffff] = (i * 7 + 3) & 0xff;
  return mm;
}

/** Every machine this file compares on. What the WINDOW arm measures the oracle over. */
function sweep() {
  return [...captureCorpus(), ...COUNTS.map(withCount)];
}

/** The ordered hardware writes, addresses and values only — the cycle stamp is a hole above. */
const writeOrder = (mm) =>
  (mm.mem.writeTrace ?? []).map((w) => `${hex4(w.addr)}=${w.value}`).join(" ");
const deviceState = (mm) => `${mm.io.soundData}:${[...mm.io.latch].join("")}`;

/** Oracle vs candidate on the hardware alone: what the state dump structurally cannot see. */
function hardwareDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  a.mem.writeTrace = [];
  b.mem.writeTrace = [];
  oracle(a);
  candidate(b);
  if (writeOrder(a) !== writeOrder(b)) return `writes [${writeOrder(a)}] vs [${writeOrder(b)}]`;
  if (deviceState(a) !== deviceState(b)) return `device ${deviceState(a)} vs ${deviceState(b)}`;
  return null;
}

// ── broken twins ────────────────────────────────────────────────────────────────────────
// Each is the module with one thing wrong, built the way the module is built — a direct call to
// the sender. A twin reaching it through the registry would match the oracle's stack traffic and
// so would never be masked, which would let the teeth pass without exercising the exclusion.

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: leaves the count standing, so the same byte goes out again next frame. */
function brokenKeepsCount(m) {
  const { mem8 } = m;
  const pending = mem8[PENDING_COUNT];
  if (pending === 0) return;
  sendSoundCommand(m, mem8[FIRST_PENDING]);
  for (let i = 0; i < pending - 1; i++) mem8[FIRST_PENDING + i] = mem8[FIRST_PENDING + i + 1];
}

/** BUG: sends the byte after the head. The slide still happens, so RAM never sees it. */
function brokenWrongSlot(m) {
  const { mem8 } = m;
  const pending = mem8[PENDING_COUNT];
  if (pending === 0) return;
  const remaining = pending - 1;
  mem8[PENDING_COUNT] = remaining;
  sendSoundCommand(m, mem8[FIRST_PENDING + 1]);
  if (remaining === 0) return;
  for (let i = 0; i < remaining; i++) mem8[FIRST_PENDING + i] = mem8[FIRST_PENDING + i + 1];
}

/** BUG: slides one byte short, so the last waiting entry is never reached. */
function brokenShortSlide(m) {
  const { mem8 } = m;
  const pending = mem8[PENDING_COUNT];
  if (pending === 0) return;
  const remaining = pending - 1;
  mem8[PENDING_COUNT] = remaining;
  sendSoundCommand(m, mem8[FIRST_PENDING]);
  if (remaining === 0) return;
  for (let i = 0; i < remaining - 1; i++) mem8[FIRST_PENDING + i] = mem8[FIRST_PENDING + i + 1];
}

/** BUG: slides one byte too far, dragging a byte from past the queue into it. */
function brokenLongSlide(m) {
  const { mem8 } = m;
  const pending = mem8[PENDING_COUNT];
  if (pending === 0) return;
  const remaining = pending - 1;
  mem8[PENDING_COUNT] = remaining;
  sendSoundCommand(m, mem8[FIRST_PENDING]);
  if (remaining === 0) return;
  for (let i = 0; i <= remaining; i++) mem8[FIRST_PENDING + i] = mem8[FIRST_PENDING + i + 1];
}

/** BUG: keeps the bookkeeping and never sends. Invisible to RAM; the HARDWARE arm owns it. */
function brokenNeverSends(m) {
  const { mem8 } = m;
  const pending = mem8[PENDING_COUNT];
  if (pending === 0) return;
  const remaining = pending - 1;
  mem8[PENDING_COUNT] = remaining;
  if (remaining === 0) return;
  for (let i = 0; i < remaining; i++) mem8[FIRST_PENDING + i] = mem8[FIRST_PENDING + i + 1];
}

/** BUG: scribbles on an index register, the in-arm control for the ceiling. */
function brokenMovesIndex(m) {
  sendOldestQueuedSoundCommand(m);
  m.regs.ix = (m.regs.ix + 1) & 0xffff;
}

const TWINS = [
  { label: "no-op", fn: brokenNoOp, ram: true },
  { label: "keeps-count", fn: brokenKeepsCount, ram: true },
  { label: "wrong-slot", fn: brokenWrongSlot, ram: false },
  { label: "short-slide", fn: brokenShortSlide, ram: true },
  { label: "long-slide", fn: brokenLongSlide, ram: true },
  { label: "never-sends", fn: brokenNeverSends, ram: false },
];

/**
 * The BOUNDARY arm's probe: the ORACLE ITSELF, plus one byte flipped at `sp + offset`. Built on
 * the oracle so what the arm reports is a property of the MASK alone.
 */
function scribbler(offset) {
  return (m) => {
    const at = (m.regs.sp + offset) & 0xffff;
    oracle(m);
    m.mem8[at] ^= 0xff;
  };
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("REACHED, and BLIND at the first entry — measured, not assumed", { skip }, () => {
  const r = unitEquivalence(makeMachine, TARGET, oracle, sendOldestQueuedSoundCommand, { maxFrames: ENTRY_FRAMES });
  assert.equal(r.ram, null, `the shared harness's first entry diverged on RAM: ${show(r.ram)}`);
  const first = captureCorpus()[0];
  // The shared harness clones the FIRST entry, and at that entry the queue is empty, so a no-op
  // passes it. Asserted rather than glossed: every arm with teeth below works from the corpus.
  assert.equal(first.mem8[PENDING_COUNT], 0, "the first dispatch no longer finds the queue empty, " +
    "so the blindness this arm records has changed and the note above is stale");
  assert.equal(unitDiff(brokenNoOp, first), null, "a no-op is now CAUGHT at the first entry, so " +
    "this arm has become stronger than it claims and should be re-derived");
  console.log("  REACHED: the shared harness enters the routine; its first entry finds the queue " +
    "empty, so a no-op passes there and the corpus carries the teeth");
});

test("EQUAL at a real draining dispatch: identical outside the measured window", { skip }, () => {
  const e = captureCorpus().find((mm) => mm.mem8[PENDING_COUNT] > 0);
  assert.notEqual(e, undefined, "vacuous: no captured dispatch had anything to drain");
  const sp = e.regs.sp;
  const a = e.clone();
  const b = e.clone();
  oracle(a);
  sendOldestQueuedSoundCommand(b);
  const all = allDiffs(a, b);
  const strays = all.filter((d) => !inScratch(d.addr, sp));
  console.log(
    `  EQUAL: seat ${hex4(sp)}; ${all.length} differing bytes, ${strays.length} outside the window`,
  );
  assert.deepEqual(strays, [], `a divergence escaped the scratch window: ${show(strays[0])}`);
  assert.ok(all.length <= SCRATCH_BYTES, "more bytes differ than the window is wide");
});

test("WINDOW: the oracle's own deepest push, measured over the whole sweep", { skip }, () => {
  let deepest = 0;
  for (const m of sweep()) deepest = Math.max(deepest, oracleDepth(m));
  console.log(`  WINDOW (measured): the oracle reaches ${deepest} bytes below its seat`);
  assert.equal(deepest, SCRATCH_BYTES, "the oracle's stack footprint moved, so the masked window " +
    "is no longer the measured one and every arm below is masking the wrong bytes");
});

test("BOUNDARY: the exclusion is exactly as wide as it declares", { skip }, () => {
  const draining = withCount(4);
  const sp = draining.regs.sp;
  const below = unitDiff(scribbler(-SCRATCH_BYTES - 1), draining);
  const seat = unitDiff(scribbler(0), draining);
  const inside = unitDiff(scribbler(-1), draining);
  console.log(
    `  BOUNDARY: ${hex4(sp - SCRATCH_BYTES - 1)} caught, ${hex4(sp)} caught, ${hex4(sp - 1)} masked`,
  );
  assert.notEqual(below, null, "a divergence one byte BELOW the window was swallowed, so the " +
    "exclusion is wider than it declares and a leaking stack pointer would walk out of sight");
  assert.notEqual(seat, null, "a divergence AT the entry seat was swallowed: the window must lie " +
    "strictly below the seat, and live stack above it must still fail");
  assert.equal(inside, null, "a divergence INSIDE the window was caught, so the two catches above " +
    "are the instrument catching everything rather than the boundary being where it says");
});

test("CORPUS: every captured dispatch replays identically", { skip }, () => {
  const entries = captureCorpus();
  const counts = new Map();
  for (const e of entries) {
    const c = e.mem8[PENDING_COUNT];
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  assert.ok(counts.get(0) > 0, "no captured dispatch found the queue empty: the early exit is " +
    "uncovered by real states");
  assert.ok(counts.get(1) > 0, "no captured dispatch drained the LAST entry, which is the arm " +
    "that sends and does not slide");
  assert.ok([...counts.keys()].some((c) => c > 1), "no captured dispatch had a slide to do");
  for (const e of entries) {
    const d = unitDiff(sendOldestQueuedSoundCommand, e);
    assert.equal(d, null, `count=${e.mem8[PENDING_COUNT]}: ${show(d)}`);
  }
  console.log(
    `  CORPUS: ${entries.length} dispatches; counts ` +
      `${[...counts].sort((x, y) => x[0] - y[0]).map(([k, v]) => `${k}:${v}`).join(" ")}`,
  );
});

test("HARDWARE: the writes RAM cannot see, with the blindness measured", { skip }, () => {
  const entries = captureCorpus();
  let sent = 0;
  for (const e of entries) {
    const probe = e.clone();
    probe.mem.writeTrace = [];
    oracle(probe);
    if (probe.mem.writeTrace.length > 0) sent++;
    const d = hardwareDiff(sendOldestQueuedSoundCommand, e);
    assert.equal(d, null, `count=${e.mem8[PENDING_COUNT]}: ${d}`);
  }
  assert.ok(sent > 0, "no captured dispatch drove the hardware at all, so this arm is vacuous");

  // The blindness is MEASURED, not argued: the never-sends twin passes the RAM comparison at
  // every draining state, and this arm is what catches it. Without both halves nobody can tell
  // whether the RAM arms above cover the send.
  const draining = entries.filter((e) => e.mem8[PENDING_COUNT] > 0);
  const ramBlind = draining.every((e) => unitDiff(brokenNeverSends, e) === null);
  const hardwareSees = draining.every((e) => hardwareDiff(brokenNeverSends, e) !== null);
  assert.ok(ramBlind, "the never-sends twin was caught on RAM, so the claim that the send is " +
    "invisible to the state dump is wrong and this header must be corrected");
  assert.ok(hardwareSees, "the never-sends twin escaped the hardware arm too, so nothing in this " +
    "file gates the send");
  console.log(
    `  HARDWARE: ${sent} of ${entries.length} dispatches drove the latches; the never-sends twin ` +
      `is invisible to RAM at all ${draining.length} draining states and caught here at all of them`,
  );
});

test("EXHAUSTIVE: the count crafted over all 256 values", { skip }, () => {
  for (const count of COUNTS) {
    const d = unitDiff(sendOldestQueuedSoundCommand, withCount(count));
    assert.equal(d, null, `count=${count}: ${show(d)}`);
  }
  const one = withCount(1);
  const head = read(one, 0);
  const next = read(one, 1);
  sendOldestQueuedSoundCommand(one);
  assert.equal(one.mem8[PENDING_COUNT], 0, "a count of one must come down to zero");
  assert.equal(read(one, 0), head, "a count of one must not slide, so the head byte stands");
  assert.equal(read(one, 1), next, "a count of one must not slide the byte behind it either");
  console.log(`  EXHAUSTIVE: ${COUNTS.length} counts identical outside the window`);
});

/** Which registers a candidate parts company with the oracle on, over the whole sweep. */
function movedOver(candidate) {
  const moved = new Set();
  for (const m of sweep()) {
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

test("EXCLUDED, deliberately: no register outside the ceiling moves", { skip }, () => {
  const moved = movedOver(sendOldestQueuedSoundCommand);
  // The absence below is only evidence if the same measurement CAN report a register outside the
  // ceiling. The index-scribbling twin moves one, and the control asserts it is seen.
  const control = movedOver(brokenMovesIndex);
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !MOVED.includes(k)),
    "the measurement reports nothing outside the ceiling even for a twin that scribbles on an " +
      "index register, so a clean reading below proves nothing");
  console.log(`  EXCLUDED (measured): ${REG_FIELDS.filter((k) => moved.has(k)).join(", ")} — ` +
    `ceiling ${MOVED.join(", ")}; the control twin also moves ` +
    `${REG_FIELDS.filter((k) => control.has(k) && !MOVED.includes(k)).join(", ")}`);
  // MOVED is a CEILING. deepEqual against it would DEMAND the divergence and go RED on a rewrite
  // that became register-exact — a gate that requires a wart refuses the fix.
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k) && !MOVED.includes(k)), [],
    "a register outside the declared ceiling diverged");
});

for (const twin of TWINS) {
  test(`TEETH: the ${twin.label} twin is CAUGHT`, { skip }, () => {
    let ram = 0;
    let hardware = 0;
    for (const count of COUNTS) {
      const m = withCount(count);
      if (unitDiff(twin.fn, m) !== null) ram++;
      if (hardwareDiff(twin.fn, m) !== null) hardware++;
    }
    console.log(`  TEETH/${twin.label}: caught on RAM at ${ram} of ${COUNTS.length} counts, ` +
      `on hardware at ${hardware}`);
    if (twin.ram) {
      assert.ok(ram > 0, `the masked comparison PASSED the ${twin.label} twin at every count`);
    } else {
      assert.equal(ram, 0, `the ${twin.label} twin is declared invisible to RAM but was caught ` +
        "there, so its entry in this file is wrong");
      assert.ok(hardware > 0, `nothing caught the ${twin.label} twin`);
    }
  });
}
