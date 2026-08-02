// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_128b (ROM 0x128b) — arm 0 (the seed) of the 0x639D
 * animation sequence: on the gate's expiry frame it turns the two-cell blinker on,
 * primes the blink repeat-count, clears its sprite runs, fires a sound, and advances
 * the phase.
 *
 * The routine WRITES MEMORY, calls the rst-0x18 gate, and its gate can skip the whole
 * body, so it is gated on MEMORY-equivalence — RAM (minus STACK_SCRATCH) + pc + SP —
 * never on a register file (its live-out is memory-only; see the routine header), and
 * every case runs on a FRESH clone (a reused clone is only safe for a read-only leaf).
 *
 * The idiomatic routine models the Z80 stack as the JS call stack: it calls its callees
 * (tickSubstateTimer, and the still-oracle sub_30bd) directly and never touches SP/pc
 * itself. The oracle does, so the harness reconciles pc + SP per arm — and the two arms
 * need DIFFERENT reconciliation, which is the one subtlety worth spelling out:
 *
 *   - SKIP arm (gate still counting): the oracle's sub_0018 does `inc sp / inc sp / ret`
 *     to drop its own frame and return to the caller's caller (the Z80 caller-skip). The
 *     candidate just returns without touching the stack, so ONE harness m.ret() supplies
 *     that single net return → SP = entry+2, pc = the caller's return.
 *   - SEED (expiry) arm: the candidate calls sub_30bd DIRECTLY, without the oracle's
 *     `push 0x12A6` in front of it. sub_30bd ends in a TAIL JUMP into sub_30e4, whose
 *     `ret` therefore pops the caller's OWN return slot instead of that 0x12A6 — i.e. the
 *     tail jump already performs the single net return. So the seed arm needs ZERO extra
 *     m.ret(); the oracle reaches the same SP = entry+2, pc = caller's return by pushing
 *     0x12A6 (eaten by the tail jump) and then doing its own final `ret` (eats the slot).
 *
 * Either way both sides end at SP = entry+2 and pc = the caller's return; the oracle's
 * transient pushes land in STACK_SCRATCH, excluded by the contract. (Measured: seed arm
 * matches at 0 rets, skip arm at 1 ret; both with a null RAM diff.)
 *
 *   1. EQUAL (real dispatches) — hook 0x128b in a real attract run and clone the machine
 *      at each true dispatch (0x128b fires 64× over 3000 frames: the timer counts 0x40
 *      down as 63 skip-arm dispatches, then 1 seed-arm dispatch on the expiry frame).
 *      oracle vs candidate must agree on RAM + pc + SP for every one.
 *
 *   2. EQUAL (crafted arms) — the seed and skip arms poked from a real captured state
 *      (SUBSTATE_TIMER) so both are covered regardless of capture timing.
 *
 *   3. TEETH — two deliberately-broken twins, each MUST be caught:
 *      (a) a wrong sprite-code store (writes tile 0x7A — arm 2's constant — instead of
 *          0x78) — caught on the seed arm;
 *      (b) a gate-polarity inversion (runs the body while counting, skips on expiry) —
 *          caught on the skip arm and on the real skip-arm dispatches.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-128b.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { entry_128b as oracle } from "../../translated/entry_128b.js";
import { loc_128b } from "../loc_128b.js";
import { Machine } from "../../machine.js";
import { STACK_SCRATCH, SUBSTATE_TIMER, MARIO_SPRITE_RECORD, SND_IRQ_TRIGGER } from "../ram.js";
import { tickSubstateTimer } from "../tickSubstateTimer.js";
import { sub_30bd } from "../../translated/sub_30bd.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x128b;
const PHASE = 0x639d; // sequence-phase selector (unconfirmed in ram.js)
const BLINK_COUNT = 0x639e; // blink repeat-count
const SPRITE_CODE = MARIO_SPRITE_RECORD + 1; // 0x694D

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");
const inStack = (addr) => addr != null && addr >= STACK_SCRATCH.lo && addr < STACK_SCRATCH.hi;

// -- branch classifier (reads the ENTRY state) --------------------------------

/** The gate expires this frame iff SUBSTATE_TIMER decrements to 0 (i.e. it is 1). On the
 *  seed (expiry) arm the body runs; otherwise the arm is skipped. */
const gateExpires = (e) => ((e.mem.read8(SUBSTATE_TIMER) - 1) & 0xff) === 0;

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
 * Run a candidate on a fresh clone, then reconcile pc + SP to the oracle's with the
 * per-arm number of net returns (see the header): the SKIP arm needs ONE m.ret() (the
 * caller-skip return the boolean gate replaces); the SEED arm needs NONE (sub_30bd's tail
 * jump already returned through the caller's slot). The classifier reads the untouched
 * ENTRY state, so it agrees with the branch the routine actually took.
 */
function runCandidate(entry, fn) {
  const c = entry.clone();
  fn(c);
  if (!gateExpires(entry)) c.ret();
  return c;
}

/**
 * Compare candidate vs oracle over the contract: RAM − STACK_SCRATCH, pc, SP. NO
 * registers — loc_128b's live-out is memory-only, and because it calls the idiomatic
 * callee (tickSubstateTimer) directly whereas the oracle calls the translated one, the two
 * leave different DEAD registers behind; comparing them would fail on values nothing reads.
 * Returns a list of human-readable mismatches (empty when equal).
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

// -- capture ------------------------------------------------------------------

/**
 * Hook 0x128b in a real attract run and clone the machine at up to K real dispatches.
 * The wrapper snapshots the entry state, then runs the oracle so the host game proceeds
 * undisturbed. loc_127f routes arm 0 through m.call, which the override map overlays, so
 * every dispatch is captured here.
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

/**
 * A real captured state with surgical pokes: the gate value + a safe SP inside
 * STACK_SCRATCH. SP is set to 0x6BF0 (the natural attract dispatch SP) rather than the
 * region top, so there is headroom BOTH ways: sub_30bd pushes 4 deep (down to 0x6BEC, still
 * ≥ STACK_SCRATCH.lo) and the teeth twin's wrong branch can walk the reconciling pops up to
 * 0x6BF4 (still < STACK_SCRATCH.hi = 0x6C00) without an unmapped access. All of it is dead
 * stack scratch, excluded by the contract.
 */
function craft(seed, { timer }) {
  const e = seed.clone();
  e.mem.write8(SUBSTATE_TIMER, timer);
  e.regs.sp = 0x6bf0;
  return e;
}

// -- teeth twins --------------------------------------------------------------

/**
 * Broken twin (a): the wrong sprite-code store. Seeds correctly EXCEPT it writes tile
 * code 0x7A (arm 2's advance constant) instead of 0x78 — a plausible copy-paste bug. The
 * low nibble differs for every input, so any seed arm exposes it; the skip arm is unaffected.
 */
function brokenSpriteStore(m) {
  const { mem } = m;
  if (!tickSubstateTimer(m)) return;
  const code = mem.read8(SPRITE_CODE);
  mem.write8(SPRITE_CODE, (code & 0x80) | 0x7a); // BUG: 0x7A should be 0x78
  mem.write8(PHASE, (mem.read8(PHASE) + 1) & 0xff);
  mem.write8(BLINK_COUNT, 0x0d);
  mem.write8(SUBSTATE_TIMER, 0x08);
  sub_30bd(m);
  mem.write8(SND_IRQ_TRIGGER, 0x03);
}

/**
 * Broken twin (b): the gate-polarity inversion. Runs the body while the counter is still
 * counting down and skips on expiry — the classic "do it every Nth frame" misread. Ticks
 * the timer identically (so the skip arm still decrements 0x6009) but takes the wrong
 * branch, so it diverges on every arm.
 */
function brokenGatePolarity(m) {
  const { mem } = m;
  if (tickSubstateTimer(m)) return; // BUG: inverted — should be `if (!expired) return`
  const code = mem.read8(SPRITE_CODE);
  mem.write8(SPRITE_CODE, (code & 0x80) | 0x78);
  mem.write8(PHASE, (mem.read8(PHASE) + 1) & 0xff);
  mem.write8(BLINK_COUNT, 0x0d);
  mem.write8(SUBSTATE_TIMER, 0x08);
  sub_30bd(m);
  mem.write8(SND_IRQ_TRIGGER, 0x03);
}

// -- 1. EQUAL (real captured dispatches) --------------------------------------

test("EQUAL (real dispatches): loc_128b == oracle on every captured 0x128b entry", () => {
  const caps = captureDispatches(400, 3000);
  assert.ok(caps.length >= 1, "expected at least one real 0x128b dispatch during attract");
  for (const cap of caps) {
    const diffs = contractDiffs(cap, loc_128b); // FRESH clones inside — cap untouched
    assert.equal(diffs.length, 0, diffs.join("; "));
  }
  const seed = caps.filter(gateExpires).length;
  const skip = caps.length - seed;
  assert.ok(seed >= 1, "expected the seed (expiry) arm among the real dispatches");
  console.log(`  EQUAL/real: ${caps.length} captured dispatches identical (${skip} skip-arm, ${seed} seed-arm)`);
});

// -- 2. EQUAL (crafted arms) --------------------------------------------------

test("EQUAL (crafted): the seed and skip arms each match the oracle", () => {
  const caps = captureDispatches(1, 3000);
  assert.ok(caps.length >= 1, "need one real capture to seed crafted entries with real RAM");
  const seed = caps[0];

  const cases = [
    { name: "seed arm (gate expires: SUBSTATE_TIMER 1 -> 0)", e: craft(seed, { timer: 0x01 }) },
    { name: "skip arm (SUBSTATE_TIMER 5 -> 4, gate still counting)", e: craft(seed, { timer: 0x05 }) },
  ];

  for (const { name, e } of cases) {
    const diffs = contractDiffs(e, loc_128b);
    assert.equal(diffs.length, 0, `${name}: ${diffs.join("; ")}`);
  }
  console.log(`  EQUAL/crafted: ${cases.length} arms (seed, skip) identical to the oracle`);
});

// -- 3. TEETH -----------------------------------------------------------------

test("TEETH: the wrong sprite-code store and the gate-polarity inversion are CAUGHT", () => {
  const caps = captureDispatches(400, 3000);
  assert.ok(caps.length >= 1, "need real captures for the teeth check");
  const seed = caps[0];

  // (a) wrong sprite-code store: only shows on the seed arm, so craft one.
  const seedArm = craft(seed, { timer: 0x01 });
  const storeDiffs = contractDiffs(seedArm, brokenSpriteStore);
  assert.ok(storeDiffs.length > 0, "the wrong sprite-code store escaped on the seed arm — the gate is worthless");

  // (b) gate-polarity inversion: diverges on every arm. Catch it on a crafted skip arm and
  //     confirm it is caught on the real skip-arm dispatches too.
  const skipArm = craft(seed, { timer: 0x05 });
  const polSkip = contractDiffs(skipArm, brokenGatePolarity);
  assert.ok(polSkip.length > 0, "the gate-polarity inversion escaped on the crafted skip arm");

  const realSkips = caps.filter((c) => !gateExpires(c));
  let caughtReal = 0;
  for (const c of realSkips) {
    if (contractDiffs(c, brokenGatePolarity).length > 0) caughtReal++;
  }
  assert.equal(
    caughtReal, realSkips.length,
    `the gate-polarity inversion escaped on ${realSkips.length - caughtReal}/${realSkips.length} real skip dispatches`,
  );

  console.log(
    `  TEETH: wrong sprite-code store caught on the seed arm (${storeDiffs[0]}); ` +
      `gate-polarity caught on the crafted skip arm (${polSkip[0]}) and all ${realSkips.length} real skip dispatches`,
  );
});
