// SPDX-License-Identifier: GPL-3.0-only
/**
 * offsetAddress — memory-equivalent to the frozen oracle at ROM 0x0018.
 *
 * GATE: strict unit-capture through unitEquivalence, PLUS a live-out comparison this file
 *   defines, because for THIS routine the RAM half of unitEquivalence has no teeth at all.
 *
 * ★ THE HOLE, STATED FIRST. 0x0018 writes no memory. Its whole effect is the register pair it
 *   advances and the byte it echoes back, so `r.ram === null` is true of a routine with an empty
 *   body — and the BLIND test below PROVES that by passing a no-op through the same call.
 *   Asserting only `r.ram` here would gate nothing. The comparison every arm in this file is
 *   judged by is therefore `liveOutDiff`: the whole RAM dump AND the two halves of the advanced
 *   address, which the rewrite also RETURNS (checked against the oracle's HL on every input).
 *   That is not a re-introduction of register fidelity — the flag byte, the stack pointer, pc and
 *   the echoed low byte in A are excluded, and the EXCLUDED test pins exactly which.
 *
 * WHY THE ADDRESS, derived from the CALLERS rather than the instruction sequence. Every call site
 * uses the advanced address on its very next step, as the pointer it reads a table entry through
 * or copies a block from. The oracle ALSO echoes the new low half into A, and whether anything
 * reads that is asked of the ORACLE, not argued: THE ECHO HAND-OFF complements A as the frozen
 * routine hands back, one caller (return address) at a time, over attract, coin-start and every
 * distant state a tapes/*.poke.json schedule drives. It is heard at exactly one caller — the
 * tamper-check fold after 0x1311 that XORs the echo against the high half — and that code lies only
 * in frozen routines every one of which is replaced by an idiomatic override (names.js ROUTINES), so no
 * reader of the echo runs in the wired game and the rewrite returns the address only. A reader
 * reached only in a state none of those sessions drives is not measured. Not one caller reads a flag on its next step, and the
 * FLAGS test extends that from "next step" to a whole session by measurement.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — through unitEquivalence, on the pristine entry the coin ->
 *      start tape reaches. Undriven attract dispatches it too; the tape buys an entry taken
 *      while the game is being played, not the only entry available. Weak on its own for the
 *      reason above, which is why 2 and 3 carry the teeth.
 *   2. BLIND — the RAM half demonstrated toothless, so no later reader mistakes it for a gate.
 *   3. EXCLUDED, deliberately — the divergence is pinned to {a, f, sp} plus pc and nothing else
 *      (at a crafted carrying input, and as a ceiling over all real traffic), so "excluded" cannot
 *      quietly widen to the address the callers actually read through.
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
 *   7. TEETH — three broken twins, each caught by liveOutDiff, and each caught on a COUNTED set
 *      of inputs that a stated predicate predicts exactly; the stale-echo twin, whose only defect
 *      is the echo, is HARMLESS and caught on no input.
 *   8. THE ECHO HAND-OFF — described above; the heard callers are pinned, each one's frozen
 *      owners must be ROUTINES overrides, and an SP flip at the same exit must be heard.
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
import { offsetAddress } from "../offsetAddress.js";
import { loc_0018 as oracle } from "../../translated/loc_0018.js";
import { firstStateDiff, unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u8, u16 } from "../../../../core/int.js";
import { ROUTINES } from "../names.js";
import { TAPE_SESSIONS, handOffReaders, heardAs } from "./_deadAtExit.js";

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

/** The registers a caller consumes: the two halves of the advanced address (also the return). */
const LIVE_OUT = ["h", "l"];

/** The registers allowed to differ: the echo (THE ECHO HAND-OFF), the flag byte, the stack. */
const EXCLUDED = ["a", "f", "sp"];

/**
 * Where the oracle's echo in A is heard, keyed by the return address of the rst, and the frozen
 * routines that contain that call site — each must be served by an idiomatic override. The rst at
 * 0x1311 is the tamper-check fold (`xor h / sub 0x9b`), inlined in 0x12fb, 0x1253 and 0x1271.
 */
const A_READERS = new Map([[0x1312, [0x1253, 0x1271, 0x12fb]]]);
const HANDOFF_FRAMES = 2500;

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
  if (entry === null) gate(offsetAddress);
  return entry;
}

/**
 * The comparison with teeth: RAM plus the two registers a caller consumes — the two halves of
 * the advanced address. Returns null when the arms agree.
 */
function liveOutDiff(a, b) {
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return { where: "ram", oracle: ram.a, candidate: ram.b, addr: ram.addr };
  for (const k of LIVE_OUT) {
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
  let returnMismatch = 0;
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
        const returned = candidate(b);
        if (a.regs.h !== b.regs.h || a.regs.l !== b.regs.l) caught++;
        if (returned !== a.regs.hl) returnMismatch++;
      }
    }
  }
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { caught, returnMismatch, ram };
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

test("EQUAL at the real dispatch: offsetAddress == oracle on RAM", { skip }, () => {
  const r = gate(offsetAddress);
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
  // The captured entry's offset is zero, where an empty body IS the routine on the address; the
  // live-out arm is shown catching it one offset along, at the same address.
  assert.equal(entryState().regs.a, 0, "the captured entry's offset is no longer zero -- re-derive this arm");
  assert.equal(atInput(() => {}, entryState().regs.hl, 0), null, "at offset zero the address does not move");
  const d = atInput(() => {}, entryState().regs.hl, 0x01);
  assert.notEqual(d, null, "the live-out comparison must catch what the RAM half cannot");
  console.log(`  BLIND: empty body passes RAM; live-out catches it — ${show(d)}`);
});

test("EXCLUDED, deliberately: the echo, the flag byte, the stack pointer and pc, and nothing else",
  { skip },
  () => {
    const a = entryState().clone();
    const b = entryState().clone();
    a.regs.hl = 0x18ff;
    a.regs.a = 0x01;
    b.regs.hl = 0x18ff;
    b.regs.a = 0x01;
    oracle(a);
    const returned = offsetAddress(b);

    const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
    assert.deepEqual(
      moved,
      EXCLUDED,
      "the excluded set changed shape: only the echo, the flag byte and the stack pointer may differ",
    );
    assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
    assert.equal(a.regs.hl, 0x1900, "the address must carry into its high half");
    assert.equal(b.regs.hl, 0x1900, "the rewrite must carry into the high half too");
    assert.equal(returned, 0x1900, "the rewrite must RETURN the moved address");
    assert.equal(a.regs.a, 0x00, "the oracle's echo is the low half of the moved address");
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
  const r = sweepAll(offsetAddress);
  assert.equal(r.ram, null, `a byte of memory moved during the sweep — ${show(r.ram)}`);
  assert.equal(r.caught, 0, `${r.caught} of ${SPACE} inputs diverged`);
  assert.equal(r.returnMismatch, 0, `the returned address differs from the oracle's HL on ${r.returnMismatch} inputs`);

  const wrap = atInput(offsetAddress, 0xffff, 0x01);
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
    const moved = new Set();
    for (const p of pairs) {
      const d = atInput(offsetAddress, p.address, p.offset);
      assert.equal(d, null, `${hex4(p.address)} + ${hex2(p.offset)}: ${show(d)}`);
      const a = entryState().clone();
      const b = entryState().clone();
      a.regs.hl = b.regs.hl = p.address;
      a.regs.a = b.regs.a = p.offset;
      oracle(a);
      assert.equal(offsetAddress(b), a.regs.hl, `${hex4(p.address)} + ${hex2(p.offset)}: the return is not the oracle's HL`);
      for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
      dispatches += p.hits;
      if (u8(p.address) + p.offset > 255) carrying++;
    }
    assert.ok(
      carrying > 0,
      "no observed input carries into the high half — the branch would be dead in play and " +
        "the sweep would be the only thing testing it",
    );
    const widened = [...moved].filter((k) => !EXCLUDED.includes(k));
    assert.deepEqual(widened, [], `real traffic moved ${widened.join(", ")}, outside the excluded set`);
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

/** HARMLESS: moves the address but leaves the offset byte holding its old value. Its only defect is
 * the echo, which THE ECHO HAND-OFF shows no wired reader consumes. */
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
  // caught wherever the offset actually moves the address, which is every non-zero offset
  ["no-op", brokenNoOp, (_h, _l, off) => off !== 0],
];

test("HARMLESS: the stale-echo twin moves the address right, so it is caught nowhere", { skip }, () => {
  const r = sweepAll(brokenStaleEcho);
  assert.equal(r.caught, 0, "the echo is not a live-out; only the address may be judged");
  const pairs = realTraffic();
  assert.equal(pairs.filter((p) => atInput(brokenStaleEcho, p.address, p.offset) !== null).length, 0,
    "the stale-echo twin was caught on real traffic");
  const a = entryState().clone();
  const b = entryState().clone();
  a.regs.hl = b.regs.hl = 0x18ff;
  a.regs.a = b.regs.a = 0x01;
  oracle(a);
  brokenStaleEcho(b);
  assert.notEqual(a.regs.a, b.regs.a, "the twin must actually leave the echo different, or this proves nothing");
  console.log(`  HARMLESS/stale-echo: caught on 0 of ${SPACE} inputs and 0 of ${pairs.length} real pairs; its only defect is A`);
});

test("THE ECHO HAND-OFF: every oracle reader of the echoed A, over every tape session, is overridden", { skip }, () => {
  const { callers, readers, exitControl } = handOffReaders({ at: TARGET, poison: ["a"], sessions: TAPE_SESSIONS, frames: HANDOFF_FRAMES });
  assert.ok(callers.size > 0, "vacuous: no rst 0x18 was taken");
  assert.deepEqual([...readers.keys()].sort((p, q) => p - q), [...A_READERS.keys()],
    "the set of callers that read the oracle's echo moved -- a new reader needs its override checked");
  for (const [ret, owners] of A_READERS) {
    const served = owners.filter((addr) => ROUTINES[addr] !== undefined);
    assert.deepEqual(served, owners, `the reader after ${hex4(ret)} is not served by an override`);
  }
  console.log(`  ECHO HAND-OFF: ${callers.size} callers over ${TAPE_SESSIONS.length} sessions, A heard at ` +
    `${[...readers].map(([r, w]) => `${hex4(r)} (${w})`).join(" ")}, each served by an override; ` +
    `${callers.size - readers.size} callers never read it; exit control heard (${heardAs(exitControl)})`);
});

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
