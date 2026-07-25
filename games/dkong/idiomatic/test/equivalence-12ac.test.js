// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_12ac (ROM 0x12ac) — arm 1 of the 0x639D animation
 * sequence: a gated two-cell blinker with a repeat-count that advances the phase.
 *
 * The routine WRITES MEMORY, calls the rst-0x18 gate, and has a gate that can skip its
 * whole body, so it is gated on MEMORY-equivalence — RAM (minus STACK_SCRATCH) + pc +
 * SP — never on a register file (its live-out is memory-only; see the routine header),
 * and every case runs on a FRESH clone (a reused clone is only safe for a read-only
 * leaf). The idiomatic routine models the Z80 `ret` as a JS return and calls its callee
 * (tickSubstateTimer) directly (no stack modelling), so the harness performs ONE
 * m.ret() on the candidate clone after the call to line pc + SP up with the oracle:
 *
 *   - All three arms collapse to that single net return. On EXPIRY the oracle threads
 *     push(0x12ad) -> sub_0018 `ret z` -> body (blink or the 0x12CB advance tail) ->
 *     the final `ret`; on the SKIP the oracle's sub_0018 does `inc sp/inc sp/ret` to
 *     drop its own frame and return to the caller's caller. Either way it ends
 *     SP = entry+2, pc = the caller's return — which one candidate m.ret() reproduces.
 *     The oracle's transient push byte lands in STACK_SCRATCH, excluded by the contract.
 *
 *   1. EQUAL (real dispatches) — hook 0x12ac in a real attract run and clone the machine
 *      at each true dispatch (loc_12ac first fires ~frame 2619 skip, ~2626 blink, ~2722
 *      advance). oracle vs candidate must agree on RAM + pc + SP for every one.
 *
 *   2. EQUAL (crafted arms) — the exact blink/advance/skip arms, poked from a real
 *      captured state (SUBSTATE_TIMER + 0x639E) so all three are covered regardless of
 *      capture timing. Each compared identically both sides.
 *
 *   3. TEETH — two deliberately-broken twins, each MUST be caught:
 *      (a) a wrong blink store (the sprite-code write lands value ^ 0xFF) — caught on a
 *          blink arm;
 *      (b) a gate-polarity inversion (runs the body while counting, skips on expiry) —
 *          caught on the skip arm and on real skip-arm dispatches.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-12ac.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_12ac as oracle } from "../../translated/loc_12ac.js";
import { loc_12ac } from "../loc_12ac.js";
import { Machine } from "../../machine.js";
import { STACK_SCRATCH, SUBSTATE_TIMER, MARIO_SPRITE_RECORD } from "../../optimized/ram.js";
import { tickSubstateTimer } from "../tickSubstateTimer.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x12ac;
const PHASE = 0x639d; // sequence-phase selector (unconfirmed in ram.js)
const BLINK_COUNT = 0x639e; // blink repeat-count
const SPRITE_CODE = MARIO_SPRITE_RECORD + 1; // 0x694D
const SPRITE_ATTR = MARIO_SPRITE_RECORD + 2; // 0x694E

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");
const inStack = (addr) => addr != null && addr >= STACK_SCRATCH.lo && addr < STACK_SCRATCH.hi;

// -- the memory-equivalence contract ------------------------------------------

/**
 * First RAM byte that differs between two machines, skipping STACK_SCRATCH — the dead
 * stack region the standard gate excludes. The oracle transiently pushes the rst / call
 * return addresses into this region; the idiomatic routine (JS call stack) never writes
 * it, so excluding it is exactly the contract, not a fudge.
 */
function firstRamDiff(a, b) {
  const da = a.dumpState(), db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (inStack(addr)) continue;
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/** Run the ORACLE on a fresh clone. It performs its own returns, so pc/SP advance. */
function runOracle(entry) {
  const c = entry.clone();
  oracle(c);
  return c;
}

/**
 * Run a candidate on a fresh clone, then model its return with ONE m.ret() so pc + SP
 * match the oracle's (the idiomatic routine replaces the Z80 stack with the JS call
 * stack, so it does not touch pc/SP itself — the harness supplies the single net return
 * that all three arms collapse to).
 */
function runCandidate(entry, fn) {
  const c = entry.clone();
  fn(c);
  c.ret();
  return c;
}

/**
 * Compare candidate vs oracle over the contract: RAM − STACK_SCRATCH, pc, SP. NO
 * registers — loc_12ac's live-out is memory-only, and because it calls the idiomatic
 * callee directly (whereas the oracle calls the translated one) the two leave different
 * DEAD registers behind; comparing them would fail on values nothing reads. Returns a
 * list of human-readable mismatches (empty when equal).
 */
function contractDiffs(entry, fn) {
  const o = runOracle(entry);
  const c = runCandidate(entry, fn);
  const diffs = [];
  const ram = firstRamDiff(o, c);
  if (ram) diffs.push(`RAM@0x${(ram.addr ?? 0).toString(16)} oracle=${hx(ram.a)} cand=${hx(ram.b)}`);
  if (o.pc !== c.pc) diffs.push(`pc oracle=0x${o.pc.toString(16)} cand=0x${c.pc.toString(16)}`);
  if (o.regs.sp !== c.regs.sp) diffs.push(`SP oracle=0x${o.regs.sp.toString(16)} cand=0x${c.regs.sp.toString(16)}`);
  return diffs;
}

// -- branch classifiers (read the ENTRY state) --------------------------------

/** The gate expires this frame iff SUBSTATE_TIMER decrements to 0 (i.e. it is 1). */
const gateExpires = (e) => ((e.mem.read8(SUBSTATE_TIMER) - 1) & 0xff) === 0;
/** The advance tail runs iff the gate expires AND 0x639E decrements to 0 (i.e. it is 1). */
const isAdvanceArm = (e) => gateExpires(e) && ((e.mem.read8(BLINK_COUNT) - 1) & 0xff) === 0;
const isBlinkArm = (e) => gateExpires(e) && !isAdvanceArm(e);
const isSkipArm = (e) => !gateExpires(e);

// -- capture ------------------------------------------------------------------

/**
 * Hook 0x12ac in a real attract run and clone the machine at up to K real dispatches.
 * The wrapper snapshots the entry state, then runs the oracle so the host game proceeds
 * undisturbed. dispatchGameState routes 0x12ac through m.call, which the override map
 * overlays, so every dispatch is captured here.
 */
function captureDispatches(K, maxFrames) {
  const caps = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snapshot });
  host.runFrames(maxFrames);
  return caps;
}

/** A real captured state with surgical pokes: gate value, blink count, and a safe SP. */
function craft(seed, { timer, count }) {
  const e = seed.clone();
  e.mem.write8(SUBSTATE_TIMER, timer);
  e.mem.write8(BLINK_COUNT, count);
  e.regs.sp = 0x6bfe; // pushes land in STACK_SCRATCH, well clear of work RAM
  return e;
}

// -- teeth twins --------------------------------------------------------------

/**
 * Broken twin (a): the wrong blink store. Blinks correctly EXCEPT the sprite-code write
 * lands value ^ 0xFF (guaranteed to differ). Agrees on the gate and on the advance/skip
 * arms, so only a blink arm exposes it.
 */
function brokenBlinkStore(m) {
  const { mem } = m;
  if (!tickSubstateTimer(m)) return;
  mem.write8(SUBSTATE_TIMER, 0x08);
  const remaining = (mem.read8(BLINK_COUNT) - 1) & 0xff;
  mem.write8(BLINK_COUNT, remaining);
  if (remaining === 0) {
    const code = mem.read8(SPRITE_CODE);
    mem.write8(SPRITE_CODE, (code & 0x80) | 0x7a);
    mem.write8(PHASE, (mem.read8(PHASE) + 1) & 0xff);
    mem.write8(SUBSTATE_TIMER, 0x80);
    return;
  }
  const code = mem.read8(SPRITE_CODE);
  const b = ((code & 0x01) << 7) | 0x01;
  mem.write8(SPRITE_CODE, (b ^ code) ^ 0xff); // BUG: wrong value to the sprite-code cell
  mem.write8(SPRITE_ATTR, (b & 0x80) ^ mem.read8(SPRITE_ATTR));
}

/**
 * Broken twin (b): the gate-polarity inversion. Runs the body while the counter is
 * still counting down and skips on expiry — the classic "do it every Nth frame" misread.
 * Ticks the timer identically (so the skip arm still decrements 0x6009) but takes the
 * wrong branch, so it diverges on every arm.
 */
function brokenGatePolarity(m) {
  const { mem } = m;
  const expired = tickSubstateTimer(m);
  if (expired) return; // BUG: inverted — should be `if (!expired) return`
  mem.write8(SUBSTATE_TIMER, 0x08);
  const remaining = (mem.read8(BLINK_COUNT) - 1) & 0xff;
  mem.write8(BLINK_COUNT, remaining);
  if (remaining === 0) {
    const code = mem.read8(SPRITE_CODE);
    mem.write8(SPRITE_CODE, (code & 0x80) | 0x7a);
    mem.write8(PHASE, (mem.read8(PHASE) + 1) & 0xff);
    mem.write8(SUBSTATE_TIMER, 0x80);
    return;
  }
  const code = mem.read8(SPRITE_CODE);
  const b = ((code & 0x01) << 7) | 0x01;
  mem.write8(SPRITE_CODE, b ^ code);
  mem.write8(SPRITE_ATTR, (b & 0x80) ^ mem.read8(SPRITE_ATTR));
}

// -- 1. EQUAL (real captured dispatches) --------------------------------------

test("EQUAL (real dispatches): loc_12ac == oracle on every captured 0x12ac entry", () => {
  const caps = captureDispatches(400, 3000);
  assert.ok(caps.length >= 1, "expected at least one real 0x12ac dispatch during attract");
  for (const cap of caps) {
    const diffs = contractDiffs(cap, loc_12ac); // FRESH clones inside — cap untouched
    assert.equal(diffs.length, 0, diffs.join("; "));
  }
  const skip = caps.filter(isSkipArm).length;
  const blink = caps.filter(isBlinkArm).length;
  const advance = caps.filter(isAdvanceArm).length;
  console.log(
    `  EQUAL/real: ${caps.length} captured dispatches identical ` +
      `(${skip} skip-arm, ${blink} blink-arm, ${advance} advance-arm)`,
  );
});

// -- 2. EQUAL (crafted arms) --------------------------------------------------

test("EQUAL (crafted): the blink, advance and skip arms each match the oracle", () => {
  const caps = captureDispatches(1, 3000);
  assert.ok(caps.length >= 1, "need one real capture to seed crafted entries with real RAM");
  const seed = caps[0];

  const cases = [
    { name: "blink arm (gate expires, 0x639E 13 -> 12)", e: craft(seed, { timer: 0x01, count: 0x0d }) },
    { name: "advance arm (gate expires, 0x639E 1 -> 0)", e: craft(seed, { timer: 0x01, count: 0x01 }) },
    { name: "skip arm (SUBSTATE_TIMER 5 -> 4, gate still counting)", e: craft(seed, { timer: 0x05, count: 0x0d }) },
  ];

  for (const { name, e } of cases) {
    const diffs = contractDiffs(e, loc_12ac);
    assert.equal(diffs.length, 0, `${name}: ${diffs.join("; ")}`);
  }
  console.log(`  EQUAL/crafted: ${cases.length} arms (blink, advance, skip) identical to the oracle`);
});

// -- 3. TEETH -----------------------------------------------------------------

test("TEETH: the wrong blink store and the gate-polarity inversion are CAUGHT", () => {
  const caps = captureDispatches(400, 3000);
  assert.ok(caps.length >= 1, "need real captures for the teeth check");
  const seed = caps[0];

  // (a) wrong blink store: only shows on a blink arm, so craft one.
  const blinkArm = craft(seed, { timer: 0x01, count: 0x0d });
  const storeDiffs = contractDiffs(blinkArm, brokenBlinkStore);
  assert.ok(storeDiffs.length > 0, "the wrong blink store escaped on the blink arm — the gate is worthless");

  // (b) gate-polarity inversion: diverges on every arm. Catch it on a crafted skip arm
  //     and confirm it is caught on the real skip-arm dispatches too.
  const skipArm = craft(seed, { timer: 0x05, count: 0x0d });
  const polSkip = contractDiffs(skipArm, brokenGatePolarity);
  assert.ok(polSkip.length > 0, "the gate-polarity inversion escaped on the crafted skip arm");

  const realSkips = caps.filter(isSkipArm);
  let caughtReal = 0;
  for (const c of realSkips) {
    if (contractDiffs(c, brokenGatePolarity).length > 0) caughtReal++;
  }
  assert.equal(
    caughtReal, realSkips.length,
    `the gate-polarity inversion escaped on ${realSkips.length - caughtReal}/${realSkips.length} real skip dispatches`,
  );

  console.log(
    `  TEETH: wrong blink store caught on the blink arm (${storeDiffs[0]}); ` +
      `gate-polarity caught on the crafted skip arm (${polSkip[0]}) and all ${realSkips.length} real skip dispatches`,
  );
});
