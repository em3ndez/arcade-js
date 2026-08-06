// SPDX-License-Identifier: GPL-3.0-only
/**
 * fetchTableWord — memory-equivalent to the frozen oracle at ROM 0x0010.
 *
 * GATE: crafted-entry live-out, plus a whole-session arm. Both halves of the standard
 *   unitEquivalence verdict are toothless for THIS routine, and this file proves that rather
 *   than asserting around it.
 *
 * ★ THE HOLE, STATED FIRST — TWICE OVER.
 *   1. `r.ram === null` is not merely weak here, it is FALSE for the correct rewrite. The oracle
 *      brackets its inner call with a stack push, so it leaves the return address in the two
 *      bytes below the entry stack pointer; the rewrite models no stack and leaves them alone.
 *      That one byte is the whole RAM difference, in both directions: the BLIND test shows an
 *      EMPTY BODY produces the identical RAM verdict. RAM decides nothing about this routine.
 *   2. The FIRST dispatch the tape reaches hands the routine entry number 0, where doubling the
 *      number is invisible. unitEquivalence clones the first entry, not the first informative
 *      one, so no larger frame budget can fix that — the DEGENERATE test pins it by running a
 *      twin that never doubles at that exact entry and watching it pass.
 *
 * The comparison every arm is judged by is therefore `liveOutDiff`: RAM outside the two scratch
 * bytes, AND the five value registers the callers consume. The flag byte, the stack pointer and
 * pc stay excluded, and the EXCLUDED test pins exactly which, so "excluded" cannot widen.
 *
 * WHY THOSE FIVE, derived from the CALLERS. Every live call site consumes the fetched word on
 * its very next step. The busiest exchanges it into the address register and jumps to it, so
 * there the word is a code address and the advanced pointer travels into the target alongside
 * it. A second walks a record byte by byte through the word. A third exchanges the word and then
 * indexes a byte table through it. A fourth splits the word and stores its halves as an object's
 * two coordinates, which is why both halves are compared rather than the pair as a number. The
 * echoed low byte is the one live-out no observed caller reads on its next step; it is included
 * anyway, because the jump-table site dispatches with it still live.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — on the pristine entry the coin -> start tape reaches. The
 *      tape buys an entry taken while the game is being played; undriven attract reaches this
 *      routine too, first at frame 237.
 *   2. BLIND — the RAM verdict demonstrated identical for the rewrite and for an empty body.
 *   3. EXCLUDED — the divergence pinned to {f, sp} plus pc, and the RAM difference pinned to the
 *      scratch window and nothing else.
 *   4. DEGENERATE — the captured entry shown to be blind to the doubling.
 *   5. FLAGS — the excluded flag byte forced to a hostile constant on every dispatch of a whole
 *      driven session, to find out what actually depends on it. The busiest caller jumps to a
 *      table target with that byte still live, so dropping it needs a licence rather than an
 *      argument. It is a measurement, so it expires if the answer ever changes.
 *   6. EXHAUSTIVE — every entry number 0..255 against a curated set of table bases: the two
 *      busiest real ones, two more the game uses, and the addresses that force the table pointer
 *      to wrap at the top of the address space. HOLE: the base is NOT swept over all 65536
 *      values. Most of that space is work RAM and hardware ports, which no caller uses as a
 *      table base, and reading a port has side effects that would make the sweep a fiction.
 *   7. SESSION — every dispatch of a whole driven session compared, the run asserted complete.
 *   8. WINDOW — the excluded scratch measured at every one of those dispatches against that
 *      dispatch's OWN stack pointer, which spans several bytes over a session. An exclusion
 *      pinned to one sample would call honest scratch an escape at the deeper end, and the
 *      repair that suggests itself — widening it — is what quietly removes the check.
 *   9. TEETH — five broken twins, each caught by liveOutDiff on a COUNTED set of inputs that a
 *      stated predicate predicts exactly, and each caught on real traffic as well.
 *
 * The pristine entry is HARVESTED from the gate rather than captured a second time: the
 * candidate arm is handed a fresh clone of the entry, so cloning it there keeps one capture path
 * in this file instead of two.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0010.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { fetchTableWord } from "../fetchTableWord.js";
import { offsetAddress } from "../offsetAddress.js";
import { loc_0010 as oracle } from "../../translated/loc_0010.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u8, u16 } from "../../../../core/int.js";

const TARGET = 0x0010;
const skip = romsPresent() ? false : "ROM images are gitignored and absent";

/** Bytes the oracle's call bracket leaves below the entry stack pointer. */
const SCRATCH_BYTES = 2;

/** A poison word, so a twin that never delivers one is caught rather than accidentally right. */
const POISON = 0xdead;

/** Top of the stack, which grows down from here into the last bytes of work RAM. */
const STACK_TOP = 0xb000;

/** The registers a caller consumes: the two halves of the word, of the pointer, and the echo. */
const VALUE_REGS = ["d", "e", "h", "l", "a"];

/**
 * Table bases for the crafted sweep. The first four are bases the game itself presents; the last
 * three force the pointer arithmetic and the two-byte read to wrap at the top of the address
 * space, which no real base ever does.
 */
const BASES = [0x015f, 0x15c8, 0x1b04, 0x3438, 0x0000, 0xfffe, 0xffff];
const SPACE = BASES.length * 256;

let entry = null;

/** The contract call, with the entry state harvested off the candidate arm's clone. */
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
  if (entry === null) gate(fetchTableWord);
  return entry;
}

/**
 * Every RAM byte that differs, each tagged with whether it lies in the scratch window.
 *
 * The window is derived from `top`, the stack pointer BOTH arms started from, and never from a
 * fixed address. A window pinned to one sample is wrong for every dispatch that arrives deeper:
 * this routine is entered anywhere in a seven-byte band, so a window drawn at the shallowest of
 * those would report honest scratch as an escape, and widening it until it passed would destroy
 * the check. The SESSION arm measures the true depth at every dispatch instead of assuming one.
 */
function ramDiffs(a, b, top) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    const scratch = addr >= u16(top - SCRATCH_BYTES) && addr < top;
    out.push({ where: "ram " + hex4(addr), oracle: da[i], candidate: db[i], scratch });
  }
  return out;
}

/** The comparison with teeth: RAM outside the scratch window, then the five value registers. */
function liveOutDiff(a, b, top) {
  const ram = ramDiffs(a, b, top).filter((d) => !d.scratch);
  if (ram.length) return ram[0];
  for (const k of VALUE_REGS) {
    if (a.regs[k] !== b.regs[k]) return { where: k, oracle: a.regs[k], candidate: b.regs[k] };
  }
  return null;
}

/** Both arms from the real entry, with the table base and the entry number forced. */
function atInput(candidate, base, number) {
  const a = entryState().clone();
  const b = entryState().clone();
  a.regs.hl = base;
  a.regs.a = number;
  a.regs.de = POISON;
  b.regs.hl = base;
  b.regs.a = number;
  b.regs.de = POISON;
  const top = a.regs.sp;
  oracle(a);
  candidate(b);
  return liveOutDiff(a, b, top);
}

/**
 * Every base and entry number through both arms, on two machines reused across iterations rather
 * than cloned thousands of times. Everything either arm reads is rewritten each pass — including
 * the stack pointer, so the oracle's scratch write always lands in the same two bytes — and the
 * frame machinery of a clone is already neutralised, so no iteration leaks into the next. The
 * reuse is only sound if neither arm writes elsewhere, which the returned RAM checks assert.
 */
function sweep(candidate) {
  const a = entryState().clone();
  const b = entryState().clone();
  const sp = a.regs.sp;
  const pc = a.pc;
  const f = a.regs.f;
  const cycles = a.cycles;
  let caught = 0;
  for (const base of BASES) {
    for (let number = 0; number < 256; number++) {
      a.regs.sp = sp;
      a.pc = pc;
      a.regs.f = f;
      a.cycles = cycles;
      a.regs.hl = base;
      a.regs.a = number;
      a.regs.de = POISON;
      b.regs.hl = base;
      b.regs.a = number;
      b.regs.de = POISON;
      oracle(a);
      candidate(b);
      if (VALUE_REGS.some((k) => a.regs[k] !== b.regs[k])) caught++;
    }
  }
  return {
    caught,
    strayed: ramDiffs(a, b, sp).filter((d) => !d.scratch),
    wrote: ramDiffs(entryState(), b, sp),
  };
}

/** How many inputs a stated predicate says a twin must be caught on. */
function predicted(pred) {
  let n = 0;
  for (const base of BASES) for (let number = 0; number < 256; number++) if (pred(base, number)) n++;
  return n;
}

const entryAddressOf = (base, number) => u16(base + u8(number + number));
const wordAt = (base, number) => entryState().mem16[entryAddressOf(base, number)];

/**
 * A whole driven session with the routine snooped: every dispatch is compared on a clone while
 * the host itself keeps running on the oracle, so the session is never perturbed and the mixed
 * stack leak never accumulates.
 *
 * It also MEASURES the scratch window rather than trusting the one sample the captured entry
 * gives. At each dispatch it records the stack pointer, counts any byte the rewrite writes
 * anywhere, and counts any byte the oracle writes outside the two bytes below THAT dispatch's
 * own stack pointer. Returns the run's health as well as its verdict.
 */
let session = null;
function drivenSession() {
  if (session === null) {
    const seen = new Map();
    let dispatches = 0;
    let diverged = 0;
    let escaped = 0;
    let rewrote = 0;
    let deepest = 0;
    let lowSp = 0x10000;
    let highSp = 0;
    const snoop = new Map([[TARGET, (mm) => {
      dispatches++;
      seen.set((mm.regs.hl << 8) | mm.regs.a, (seen.get((mm.regs.hl << 8) | mm.regs.a) ?? 0) + 1);
      const top = mm.regs.sp;
      if (top < lowSp) lowSp = top;
      if (top > highSp) highSp = top;

      const mine = mm.clone();
      const beforeMine = mine.dumpState();
      fetchTableWord(mine);
      rewrote += countDiff(beforeMine, mine.dumpState());

      const before = mm.dumpState();
      const r = oracle(mm);
      const after = mm.dumpState();
      for (let i = 0; i < before.length; i++) {
        if (before[i] === after[i]) continue;
        const depth = top - mm.stateOffsetToAddr(i);
        if (depth > deepest) deepest = depth;
        if (depth <= 0 || depth > SCRATCH_BYTES) escaped++;
      }
      if (VALUE_REGS.some((k) => mine.regs[k] !== mm.regs[k])) diverged++;
      return r;
    }]]);
    const host = makeMachine(snoop);
    const frames = host.runFrames(ENTRY_FRAMES);
    session = {
      dispatches,
      diverged,
      escaped,
      rewrote,
      deepest,
      lowSp,
      highSp,
      frames: frames.length,
      stoppedBy: host.stoppedBy,
      pairs: [...seen.entries()].map(([key, hits]) => ({
        base: (key >> 8) & 0xffff,
        number: key & 0xff,
        hits,
      })),
    };
  }
  return session;
}

function countDiff(a, b) {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

/**
 * Where a deliberately corrupted flag byte shows up. Runs a driven session twice — untouched,
 * and with the byte the rewrite declines to reproduce forced to a hostile constant on every
 * single dispatch — then reports every address that ever differed and the last frame any did.
 * A flag a caller reads would steer that caller, and steering shows up in memory.
 */
function flagFallout() {
  const base = makeMachine();
  const baseFrames = base.runFrames(ENTRY_FRAMES);
  let dispatches = 0;
  const hostile = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    const r = oracle(mm);
    mm.regs.f = 0xff;
    return r;
  }]]));
  const hostileFrames = hostile.runFrames(ENTRY_FRAMES);

  const addrs = new Set();
  let last = -1;
  const n = Math.min(baseFrames.length, hostileFrames.length);
  for (let i = 0; i < n; i++) {
    const x = baseFrames[i];
    const y = hostileFrames[i];
    for (let o = 0; o < x.length; o++) {
      if (x[o] !== y[o]) {
        addrs.add(base.stateOffsetToAddr(o));
        last = i;
      }
    }
  }
  return { addrs: [...addrs].sort((p, q) => p - q), last, frames: n, dispatches };
}

const hex4 = (v) => "0x" + u16(v).toString(16).padStart(4, "0");
const hex2 = (v) => "0x" + u8(v).toString(16).padStart(2, "0");
const show = (d) => (d ? `${d.where}: oracle=${d.oracle} candidate=${d.candidate}` : "identical");

// ── the contract call ───────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: fetchTableWord == oracle on every live-out", { skip }, () => {
  gate(fetchTableWord);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  const e = entryState();
  const d = atInput(fetchTableWord, e.regs.hl, e.regs.a);
  assert.equal(d, null, `the real entry diverged — ${show(d)}`);
  console.log(
    `  EQUAL: entry base ${hex4(e.regs.hl)} number ${hex2(e.regs.a)} within ${ENTRY_FRAMES} ` +
      `frames; word ${hex4(wordAt(e.regs.hl, e.regs.a))} fetched identically`,
  );
});

test("BLIND: the RAM verdict says the same thing about an empty body", { skip }, () => {
  const real = gate(fetchTableWord);
  const empty = gate(() => {});
  assert.notEqual(real.ram, null, "the oracle's scratch write vanished — re-derive this file");
  assert.deepEqual(
    empty.ram,
    real.ram,
    "an empty body was expected to produce the IDENTICAL RAM verdict — if it no longer does, " +
      "RAM has become a real gate here and every claim in this file must be re-derived",
  );
  const e = entryState();
  const d = atInput(() => {}, e.regs.hl, e.regs.a);
  assert.notEqual(d, null, "the live-out comparison must catch what the RAM verdict cannot");
  console.log(`  BLIND: empty body gives the same RAM verdict; live-out catches it — ${show(d)}`);
});

test("EXCLUDED, deliberately: the flag byte, the stack pointer, pc, and two scratch bytes",
  { skip },
  () => {
    const a = entryState().clone();
    const b = entryState().clone();
    const top = a.regs.sp;
    oracle(a);
    fetchTableWord(b);

    const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
    assert.deepEqual(moved, ["f", "sp"], "the excluded register set changed shape");
    assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");

    const diffs = ramDiffs(a, b, top);
    assert.ok(diffs.length > 0, "the scratch write vanished, so this test measures nothing");
    assert.deepEqual(
      diffs.filter((d) => !d.scratch),
      [],
      "RAM moved OUTSIDE the two bytes below the entry stack pointer — that is the routine " +
        "writing memory, not the known cost of wiring a stackless rewrite into a stacked engine",
    );
    console.log(
      `  EXCLUDED: registers ${moved.join(", ")} and pc; RAM differs only at ` +
        `${diffs.map((d) => d.where).join(", ")}, inside the ${SCRATCH_BYTES} bytes below the ` +
        `entry stack pointer ${hex4(entryState().regs.sp)}`,
    );
  });

test("DEGENERATE: the captured entry cannot see the doubling at all", { skip }, () => {
  const e = entryState();
  assert.equal(e.regs.a, 0, "the first dispatch no longer hands over entry number zero");
  const d = atInput(brokenNoDouble, e.regs.hl, e.regs.a);
  assert.equal(
    d,
    null,
    "a twin that never doubles was expected to PASS at the captured entry — the point of this " +
      "test is that the captured entry is blind, and the crafted sweep is where the teeth are",
  );
  const elsewhere = atInput(brokenNoDouble, e.regs.hl, 1);
  assert.notEqual(elsewhere, null, "entry number 1 must expose the twin the captured entry hides");
  console.log(`  DEGENERATE: number 0 hides the doubling; number 1 exposes it — ${show(elsewhere)}`);
});

test("FLAGS: the byte the rewrite drops steers nothing in a whole driven session",
  { skip },
  () => {
    const f = flagFallout();
    assert.ok(f.dispatches > 0, "vacuous: the session never dispatched the routine");
    assert.ok(
      f.addrs.length > 0,
      "the corrupted byte left NO trace anywhere, which is a claim about the instrument before " +
        "it is a claim about the flag: check that the hostile value is actually being written",
    );

    const outside = f.addrs.filter((a) => a < STACK_TOP - 256);
    assert.deepEqual(
      outside.map(hex4),
      [],
      "a hostile flag byte reached game memory — the flag is CONSUMED somewhere, so dropping " +
        "it is not licensed and the rewrite must reproduce it",
    );
    assert.ok(
      f.last < f.frames - 200,
      `the stack-scratch difference was still present at frame ${f.last} of ${f.frames} — it ` +
        "must heal and stay healed, or it is not scratch",
    );
    console.log(
      `  FLAGS: hostile on all ${f.dispatches} dispatches over ${f.frames} frames — only ` +
        `${f.addrs.map(hex4).join(", ")} ever differed, last at frame ${f.last}`,
    );
  });

// ── the comparison with teeth ───────────────────────────────────────────────────────────────

test("EXHAUSTIVE: every entry number against every crafted base, identical", { skip }, () => {
  const r = sweep(fetchTableWord);
  assert.deepEqual(r.strayed, [], `RAM moved outside the scratch window — ${show(r.strayed[0])}`);
  assert.deepEqual(r.wrote, [], "the rewrite wrote memory, so reusing one machine was unsound");
  assert.equal(r.caught, 0, `${r.caught} of ${SPACE} inputs diverged`);

  const wrap = atInput(fetchTableWord, 0xffff, 0);
  assert.equal(wrap, null, `the two-byte read across the top of the space diverged — ${show(wrap)}`);
  console.log(`  EXHAUSTIVE: ${SPACE} inputs identical, top-of-space wrap included`);
});

test("SESSION: every dispatch of a whole driven session, and the run COMPLETED", { skip }, () => {
  const s = drivenSession();
  assert.equal(s.stoppedBy, null, `the session stopped early: ${s.stoppedBy}`);
  assert.equal(s.frames, ENTRY_FRAMES, "a truncated run finds no divergence and reads as a pass");
  assert.ok(s.dispatches > 0, "vacuous: the session never dispatched the routine");
  assert.equal(s.diverged, 0, `${s.diverged} of ${s.dispatches} dispatches diverged`);

  const doubling = s.pairs.filter((p) => p.number !== 0);
  assert.ok(doubling.length > 0, "every real dispatch used entry number zero — the doubling " +
    "would then be dead in play and only the crafted sweep would test it");
  const bases = new Set(s.pairs.map((p) => p.base));
  console.log(
    `  SESSION: ${s.dispatches} dispatches over ${s.frames} frames, ${s.pairs.length} distinct ` +
      `inputs across ${bases.size} bases, ${doubling.length} of them doubling — all identical`,
  );
});

test("WINDOW: the excluded scratch is MEASURED at every dispatch, not assumed", { skip }, () => {
  const s = drivenSession();
  assert.ok(s.dispatches > 0, "vacuous: the session never dispatched the routine");
  assert.equal(s.rewrote, 0, `the rewrite wrote ${s.rewrote} bytes of memory across the session`);
  assert.equal(
    s.escaped,
    0,
    `${s.escaped} byte(s) landed outside the ${SCRATCH_BYTES} below the stack pointer of the ` +
      "dispatch that wrote them — that is an escape, and widening the window would hide it",
  );
  assert.equal(s.deepest, SCRATCH_BYTES, "the scratch depth is not what the exclusion claims");
  assert.ok(
    s.lowSp < entryState().regs.sp,
    "every dispatch arrived at the captured entry's stack depth, so a window pinned to that one " +
      "sample was never tested against a deeper one and this measurement proves nothing",
  );
  console.log(
    `  WINDOW: stack pointer spans ${hex4(s.lowSp)}..${hex4(s.highSp)} across ${s.dispatches} ` +
      `dispatches; every written byte within ${s.deepest} of its own dispatch's pointer, ` +
      `lowest ${hex4(s.lowSp - s.deepest)}; rewrite wrote nothing`,
  );
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────────
// A gate that cannot fail is worthless. Each twin is a plausible way to get this routine wrong,
// each must be caught by the SAME comparison the real arm passes, and each must be caught on
// exactly the inputs its stated predicate names — a twin caught on the wrong SET is a gate
// agreeing with the wrong theory of why it failed.

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: takes the entry number as a byte offset, so it lands mid-entry from number 1 on. */
function brokenNoDouble(m) {
  const at = offsetAddress(m);
  m.regs.de = m.mem16[at];
  m.regs.hl = at + 2;
}

/** BUG: leaves the pointer ON the entry it just read instead of past it. */
function brokenNoAdvance(m) {
  const number = m.regs.a;
  m.regs.a = u8(number + number);
  m.regs.de = m.mem16[offsetAddress(m)];
}

/** BUG: reads the entry's two bytes the other way round. */
function brokenByteSwap(m) {
  const number = m.regs.a;
  m.regs.a = u8(number + number);
  const at = offsetAddress(m);
  const word = m.mem16[at];
  m.regs.de = u16((u8(word) << 8) | (word >> 8));
  m.regs.hl = at + 2;
}

/** BUG: echoes back the entry number instead of the low half of the entry's address. */
function brokenNumberEcho(m) {
  const number = m.regs.a;
  m.regs.a = u8(number + number);
  const at = offsetAddress(m);
  m.regs.de = m.mem16[at];
  m.regs.hl = at + 2;
  m.regs.a = number;
}

const TWINS = [
  // the pointer always moves, so an untouched machine is caught everywhere
  ["no-op", brokenNoOp, () => true],
  // caught wherever doubling the number changes it, which is everywhere but number zero
  ["no-double", brokenNoDouble, (_base, number) => number !== 0],
  // the pointer always ends two bytes short, whatever the input
  ["no-advance", brokenNoAdvance, () => true],
  // caught wherever the entry's two bytes are not the same byte twice
  ["byte-swap", brokenByteSwap, (base, n) => u8(wordAt(base, n)) !== wordAt(base, n) >> 8],
  // caught wherever the low half of the entry's address is not the number that selected it
  ["number-echo", brokenNumberEcho, (base, n) => u8(entryAddressOf(base, n)) !== n],
];

for (const [label, twin, pred] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT on exactly the inputs it must be`, { skip }, () => {
    const want = predicted(pred);
    assert.ok(want > 0 && want <= SPACE, `the ${label} predicate must name a real set`);
    const r = sweep(twin);
    assert.equal(r.caught, want, `the ${label} twin was caught on ${r.caught}, predicted ${want}`);
    console.log(`  TEETH/${label}: caught on ${r.caught} of ${SPACE} inputs, as predicted`);
  });

  test(`TEETH: the ${label} twin is CAUGHT on real traffic`, { skip }, () => {
    const { pairs } = drivenSession();
    const hit = pairs.filter((p) => atInput(twin, p.base, p.number) !== null);
    assert.ok(
      hit.length > 0,
      `the ${label} twin survived every input a driven session presents — it is caught only by ` +
        "the crafted sweep, which the report must say",
    );
    const first = hit[0];
    console.log(
      `  TEETH/${label}: caught on ${hit.length} of ${pairs.length} real inputs, first at ` +
        `${hex4(first.base)} number ${hex2(first.number)} — ` +
        `${show(atInput(twin, first.base, first.number))}`,
    );
  });
}
