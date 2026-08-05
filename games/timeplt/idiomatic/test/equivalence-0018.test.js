// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0018 — memory-equivalent to the frozen oracle at ROM 0x0018.
 *
 * GATE: strict unit-capture through unitEquivalence, PLUS a live-out comparison this file
 *   defines, because for THIS routine the RAM half of unitEquivalence has no teeth at all.
 *
 * ★ THE HOLE, STATED FIRST. 0x0018 writes no memory. Its whole effect is the register pair it
 *   advances and the byte it echoes back, so `r.ram === null` is true of a routine with an empty
 *   body — and the BLIND test below PROVES that by passing a no-op through the same call.
 *   Asserting only `r.ram` here would gate nothing. The comparison every arm in this file is
 *   judged by is therefore `liveOutDiff`: the whole RAM dump AND the three value registers the
 *   callers consume. That is not a re-introduction of register fidelity — the flag byte, the
 *   stack pointer and pc are still excluded, and the EXCLUDED test pins exactly which.
 *
 * WHY THOSE THREE REGISTERS, derived from the CALLERS rather than the instruction sequence.
 * Every call site uses the advanced address on its very next
 * step, as the pointer it reads a table entry through or copies a block from. Three of those also
 * consume the echoed low byte, folding it against the high half. Not one reads a flag on its next
 * step, and the FLAGS test extends that from "next step" to a whole session by measurement.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — through unitEquivalence, on the pristine entry the coin ->
 *      start tape reaches. Undriven attract dispatches it too; the tape buys an entry taken
 *      while the game is being played, not the only entry available. Weak on its own for the
 *      reason above, which is why 2 and 3 carry the teeth.
 *   2. BLIND — the RAM half demonstrated toothless, so no later reader mistakes it for a gate.
 *   3. EXCLUDED, deliberately — the divergence is pinned to {f, sp} plus pc and nothing else, so
 *      "excluded" cannot quietly widen to the address the callers actually read through.
 *   4. FLAGS — the excluded flag byte forced to a hostile constant on every dispatch of a whole
 *      driven session, to find out what actually depends on it. This is the licence for dropping
 *      it, and it is a measurement, so it expires if the answer ever changes.
 *   5. EXHAUSTIVE over the ENTIRE input space — all 16777216 combinations of the address pair
 *      and the offset byte. Nothing about this routine depends on memory, so that sweep is the
 *      complete behaviour, wrap at the top of the address space included.
 *   6. REAL TRAFFIC — every (address, offset) pair a driven session actually presents, replayed.
 *      This is what proves the carry-into-the-high-half path is live in play rather than dead.
 *      The corpus run is FILE-LOCAL and longer than the entry capture: 900 frames is enough to
 *      enter, but it reaches only 11 distinct table bases where 1800 reaches 17.
 *   7. TEETH — four broken twins, each caught by liveOutDiff, and each caught on a COUNTED set
 *      of inputs that a stated predicate predicts exactly.
 *
 * The pristine entry is HARVESTED from the gate rather than captured a second time: the
 * candidate arm is handed a fresh clone of the entry, so cloning it there keeps one capture
 * path in this file instead of two.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0018.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_0018 } from "../loc_0018.js";
import { loc_0018 as oracle } from "../../translated/loc_0018.js";
import { firstStateDiff, unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u8, u16 } from "../../../../core/int.js";

const TARGET = 0x0018;
const skip = romsPresent() ? false : "ROM images absent";

/**
 * Frames for the CORPUS runs, file-local and deliberately longer than the entry capture. Measured
 * rather than picked: distinct table bases go 11 -> 17 between 900 frames and 1200, and 1800
 * adds one further input pair over 1200 while 2400 adds one more, so the corpus has flattened.
 */
const CORPUS_FRAMES = 1800;

/** Top of the stack, which grows down from here into the last bytes of work RAM. */
const STACK_TOP = 0xb000;

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
  if (entry === null) gate(loc_0018);
  return entry;
}

/**
 * The comparison with teeth: RAM plus the three registers a caller consumes — the two halves of
 * the advanced address, and the echoed low byte. Returns null when the arms agree.
 */
function liveOutDiff(a, b) {
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return { where: "ram", oracle: ram.a, candidate: ram.b, addr: ram.addr };
  for (const k of ["h", "l", "a"]) {
    if (a.regs[k] !== b.regs[k]) {
      return { where: k, oracle: a.regs[k], candidate: b.regs[k], addr: null };
    }
  }
  return null;
}

/** Both arms from the real entry, with the address pair and the offset forced. */
function atInput(candidate, address, offset) {
  const a = entryState().clone();
  const b = entryState().clone();
  a.regs.hl = address;
  a.regs.a = offset;
  b.regs.hl = address;
  b.regs.a = offset;
  oracle(a);
  candidate(b);
  return liveOutDiff(a, b);
}

/**
 * Every (address, offset) the routine is handed during a driven session. Collected by snooping
 * the dispatch and delegating, so the host run is the untouched one.
 */
let traffic = null;
function realTraffic() {
  if (traffic === null) {
    const seen = new Map();
    const snoop = new Map([[TARGET, (mm) => {
      const key = (mm.regs.hl << 8) | mm.regs.a;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      return oracle(mm);
    }]]);
    const host = makeMachine(snoop);
    host.runFrames(CORPUS_FRAMES);
    traffic = [...seen.entries()].map(([key, hits]) => ({
      address: (key >> 8) & 0xffff,
      offset: key & 0xff,
      hits,
    }));
  }
  return traffic;
}

/**
 * Where a deliberately corrupted flag byte shows up. Runs a driven session twice — untouched,
 * and with the byte the rewrite declines to reproduce forced to a hostile constant on every
 * single dispatch — then reports every address that ever differed and the last frame any did.
 * A flag a caller reads would steer that caller, and steering shows up in memory.
 */
function flagFallout() {
  const base = makeMachine();
  const baseFrames = base.runFrames(CORPUS_FRAMES);
  let dispatches = 0;
  const hostile = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    const r = oracle(mm);
    mm.regs.f = 0xff;
    return r;
  }]]));
  const hostileFrames = hostile.runFrames(CORPUS_FRAMES);

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

/**
 * The whole 24-bit input space through both arms, on two machines reused across iterations
 * rather than cloned 16777216 times. Every register the routine reads is rewritten each pass,
 * and the frame machinery of a clone is already neutralised, so no iteration can leak into the
 * next. Returns how many inputs the arms disagreed on, plus a final whole-RAM check: neither arm
 * may have written a byte anywhere across the entire sweep.
 */
function sweepAll(candidate) {
  const a = entryState().clone();
  const b = entryState().clone();
  const sp = a.regs.sp;
  const pc = a.pc;
  const f = a.regs.f;
  const cycles = a.cycles;
  let caught = 0;
  for (let h = 0; h < 256; h++) {
    for (let l = 0; l < 256; l++) {
      for (let off = 0; off < 256; off++) {
        a.regs.h = h;
        a.regs.l = l;
        a.regs.a = off;
        a.regs.f = f;
        a.regs.sp = sp;
        a.pc = pc;
        a.cycles = cycles;
        b.regs.h = h;
        b.regs.l = l;
        b.regs.a = off;
        oracle(a);
        candidate(b);
        if (a.regs.h !== b.regs.h || a.regs.l !== b.regs.l || a.regs.a !== b.regs.a) caught++;
      }
    }
  }
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { caught, ram };
}

/** How many inputs a stated predicate says a twin must be caught on. */
function predicted(pred) {
  let n = 0;
  for (let h = 0; h < 256; h++) {
    for (let l = 0; l < 256; l++) {
      for (let off = 0; off < 256; off++) if (pred(h, l, off)) n++;
    }
  }
  return n;
}

const SPACE = 256 * 256 * 256;
const hex4 = (v) => "0x" + u16(v).toString(16).padStart(4, "0");
const hex2 = (v) => "0x" + u8(v).toString(16).padStart(2, "0");
const show = (d) =>
  d
    ? `${d.where}${d.addr === null ? "" : " " + hex4(d.addr)}: ` +
      `oracle=${d.oracle} candidate=${d.candidate}`
    : "identical";

// ── the contract call ───────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: loc_0018 == oracle on RAM", { skip }, () => {
  const r = gate(loc_0018);
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  const e = entryState();
  console.log(
    `  EQUAL: entry address ${hex4(e.regs.hl)} offset ${hex2(e.regs.a)} within ` +
      `${ENTRY_FRAMES} frames; RAM identical`,
  );
});

test("BLIND: the RAM half of the contract call cannot fail here", { skip }, () => {
  const r = gate(() => {});
  assert.equal(
    r.ram,
    null,
    "a routine with an empty body was expected to pass the RAM half — if this ever FAILS the " +
      "routine writes memory after all, and every claim in this file must be re-derived",
  );
  const d = atInput(() => {}, entryState().regs.hl, entryState().regs.a);
  assert.notEqual(d, null, "the live-out comparison must catch what the RAM half cannot");
  console.log(`  BLIND: empty body passes RAM; live-out catches it — ${show(d)}`);
});

test("EXCLUDED, deliberately: the flag byte, the stack pointer and pc, and nothing else",
  { skip },
  () => {
    const a = entryState().clone();
    const b = entryState().clone();
    a.regs.hl = 0x18ff;
    a.regs.a = 0x01;
    b.regs.hl = 0x18ff;
    b.regs.a = 0x01;
    oracle(a);
    loc_0018(b);

    const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
    assert.deepEqual(
      moved,
      ["f", "sp"],
      "the excluded set changed shape: only the flag byte and the stack pointer may differ",
    );
    assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
    assert.equal(a.regs.hl, 0x1900, "the address must carry into its high half");
    assert.equal(b.regs.hl, 0x1900, "the rewrite must carry into the high half too");
    assert.equal(b.regs.a, 0x00, "the echoed byte is the low half of the moved address");
    console.log(`  EXCLUDED: registers ${moved.join(", ")} and pc — the address agrees`);
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
      "a hostile flag byte reached game memory — the flag is CONSUMED somewhere and dropping " +
        "it is not licensed; the rewrite must reproduce it",
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

test("EXHAUSTIVE: all 16777216 inputs, address pair and offset, identical", { skip }, () => {
  const r = sweepAll(loc_0018);
  assert.equal(r.ram, null, `a byte of memory moved during the sweep — ${show(r.ram)}`);
  assert.equal(r.caught, 0, `${r.caught} of ${SPACE} inputs diverged`);

  const wrap = atInput(loc_0018, 0xffff, 0x01);
  assert.equal(wrap, null, `the top-of-space wrap diverged — ${show(wrap)}`);
  console.log(`  EXHAUSTIVE: ${SPACE} inputs identical, top-of-space wrap included`);
});

test("REAL TRAFFIC: every pair a driven session presents, and the carry path is LIVE",
  { skip },
  () => {
    const pairs = realTraffic();
    assert.ok(pairs.length > 0, "vacuous: the driven session never reached the routine");
    let dispatches = 0;
    let carrying = 0;
    for (const p of pairs) {
      const d = atInput(loc_0018, p.address, p.offset);
      assert.equal(d, null, `${hex4(p.address)} + ${hex2(p.offset)}: ${show(d)}`);
      dispatches += p.hits;
      if (u8(p.address) + p.offset > 255) carrying++;
    }
    assert.ok(
      carrying > 0,
      "no observed input carries into the high half — the branch would be dead in play and " +
        "the sweep would be the only thing testing it",
    );
    const bases = new Set(pairs.map((p) => p.address >> 8));
    console.log(
      `  REAL TRAFFIC: ${pairs.length} distinct pairs over ${dispatches} dispatches in ` +
        `${CORPUS_FRAMES} frames, ${bases.size} distinct bases, ${carrying} pairs carrying ` +
        "— all identical",
    );
  });

// ── teeth ───────────────────────────────────────────────────────────────────────────────────
// A gate that cannot fail is worthless. Each twin is a plausible way to get this routine wrong,
// each must be caught by the SAME comparison the real arm passes, and each must be caught on
// exactly the inputs its stated predicate names — a twin caught on the wrong SET is a gate
// agreeing with the wrong theory of why it failed.

/** BUG: adds the offset to the low half only, dropping the carry into the high half. */
function brokenDropsCarry(m) {
  const { regs } = m;
  regs.l = u8(regs.l + regs.a);
  regs.a = regs.l;
}

/** BUG: treats the offset as a signed displacement, so a high offset walks backward. */
function brokenSignedOffset(m) {
  const { regs } = m;
  regs.hl = u16(regs.hl + ((regs.a << 24) >> 24));
  regs.a = regs.l;
}

/** BUG: moves the address but leaves the offset byte holding its old value. */
function brokenStaleEcho(m) {
  const { regs } = m;
  regs.hl = u16(regs.hl + regs.a);
}

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

const TWINS = [
  // caught wherever the low half plus the offset overflows a byte
  ["drops-carry", brokenDropsCarry, (_h, l, off) => l + off > 255],
  // caught wherever the offset's top bit is set, which is where signed and unsigned part ways
  ["signed-offset", brokenSignedOffset, (_h, _l, off) => off > 127],
  // caught wherever the moved low half differs from the offset that produced it
  ["stale-echo", brokenStaleEcho, (_h, l, _off) => l !== 0],
  // caught everywhere except the one input that is genuinely a no-op
  ["no-op", brokenNoOp, (_h, l, off) => l !== 0 || off !== 0],
];

for (const [label, twin, pred] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT on exactly the inputs it must be`, { skip }, () => {
    const want = predicted(pred);
    assert.ok(want > 0 && want < SPACE, `the ${label} predicate must split the space`);
    const r = sweepAll(twin);
    assert.equal(
      r.caught,
      want,
      `the ${label} twin was caught on ${r.caught} inputs, predicted ${want}`,
    );
    console.log(`  TEETH/${label}: caught on ${r.caught} of ${SPACE} inputs, as predicted`);
  });

  test(`TEETH: the ${label} twin is CAUGHT on real traffic`, { skip }, () => {
    const pairs = realTraffic();
    const hit = pairs.filter((p) => atInput(twin, p.address, p.offset) !== null);
    assert.ok(
      hit.length > 0,
      `the ${label} twin survived every pair a driven session presents — this twin is only ` +
        "caught by the synthetic sweep, which the report must say",
    );
    const first = hit[0];
    console.log(
      `  TEETH/${label}: caught on ${hit.length} of ${pairs.length} real pairs, first at ` +
        `${hex4(first.address)} + ${hex2(first.offset)} — ` +
        `${show(atInput(twin, first.address, first.offset))}`,
    );
  });
}
