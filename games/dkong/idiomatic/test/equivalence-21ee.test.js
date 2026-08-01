// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_21ee (ROM 0x21EE) — the attract-demo canned-input script tick.
 *
 * sub_21ee is a LEAF whose entire memory-observable behaviour is a pure function of TWO
 * work-RAM bytes — the script step index (0x63CC) and the step countdown (0x63CD) — read
 * against a FIXED ROM table of (input, duration) pairs at 0x21D1. It writes only three
 * cells: the cooked control word P1_INPUT (0x6010), the countdown (0x63CD), and the index
 * (0x63CC). Nothing else it touches reaches RAM, and no general-purpose register survives
 * to the caller (handler_1977 falls straight into the 0x197A cascade, whose first act is a
 * call that reloads before reading). So the contract is memory + the control-flow return.
 *
 * Because the effect is a pure function of just those two bytes, the WHOLE input space is
 * only 256×256 = 65536 states — an EXHAUSTIVE sweep, not a sample. It reaches every path:
 *   - the index-doubling (`rlca`) and its wrap, over all 256 indices — decides which ROM
 *     pair, hence the P1_INPUT byte and (on advance) the reload address and the index step;
 *   - the pre-decrement HOLD/ADVANCE branch and the countdown write, over all 256 countdown
 *     values — including the 1->0 hold, the 0-triggered advance, and the 0->0xFF wrap.
 *
 * LIVE-OUT — memory + return. The idiomatic routine models no stack (a plain JS return),
 * so the harness performs one m.ret() after the candidate to line pc + SP up with the
 * oracle (whose two paths each end in `ret`), and asserts pc AND SP match — the routine's
 * true control-flow live-out — alongside the RAM diff.
 *
 *   1. EQUAL (exhaustive) — loc_21ee == oracle on RAM (whole dump; neither writes outside
 *      those three cells) + pc + SP, across all 65536 (index, countdown) states.
 *
 *   2. TEETH (exhaustive) — three deliberately-broken twins, each of which the same sweep
 *      MUST catch:
 *        (a) no-double — indexes the table with the raw index instead of the doubled one,
 *            so the wrong pair is read; caught on P1_INPUT for every index but 0.
 *        (b) inverted branch — advances while still counting down and holds at 0; caught on
 *            the countdown/index wherever hold and advance disagree.
 *        (c) no index step — reloads the countdown but leaves the index unchanged on the
 *            advance frame; caught on the index (0x63CC) at every countdown==0 state.
 *
 *   3. REALISM (captured dispatches) — hook 0x21EE in a real attract run (the demo replays
 *      the script every frame), clone the machine at each true dispatch, and confirm
 *      loc_21ee reproduces the oracle's RAM + return on every real state the game produces.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-21ee.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_21ee as oracle } from "../../translated/sub_21ee.js";
import { loc_21ee } from "../loc_21ee.js";
import { P1_INPUT, DEMO_SCRIPT_INDEX as SCRIPT_INDEX, DEMO_SCRIPT_COUNTDOWN as SCRIPT_COUNTDOWN } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x21ee;
const RET_ADDR = 0x197a;     // the real caller site (handler_1977 continues here after `call 0x21ee`)

const hx = (v) => "0x" + (v & 0xffff).toString(16);

/**
 * A synthetic entry: a clone of `base` with the two input cells set, a caller return on the
 * stack (so both the oracle's `ret` and the harness's modelling `ret` have a valid target),
 * and P1_INPUT pre-cleared so the compared state is identical on both sides at the start.
 * Frame machinery is neutralised (clone() sets nextNmi/nextBoundary = Infinity; re-asserted).
 */
function makeEntry(base, index, countdown) {
  const e = base.clone();
  e.regs.sp = 0x6c00;
  e.push16(RET_ADDR);
  e.mem.write8(SCRIPT_INDEX, index);
  e.mem.write8(SCRIPT_COUNTDOWN, countdown);
  e.mem.write8(P1_INPUT, 0x00);
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the ORACLE and CANDIDATE on two fresh, byte-identical entries and diff the
 * memory-equivalence + return contract: RAM over the whole dump, then pc and SP. The
 * candidate models no stack, so it takes one m.ret() to line pc + SP up with the oracle's
 * terminal `ret`. A fresh entry per side because the routine WRITES memory.
 *
 * @returns {Array<string>} human-readable diffs (empty when equivalent).
 */
function contractDiffs(base, index, countdown, candidate) {
  const a = makeEntry(base, index, countdown); // oracle
  const b = makeEntry(base, index, countdown); // candidate
  oracle(a);
  candidate(b);
  b.ret(); // model the routine's return (pc + SP live-out)

  const diffs = [];
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) diffs.push(`RAM@${hx(ram.addr)} oracle=${ram.a} cand=${ram.b}`);
  if (a.pc !== b.pc) diffs.push(`pc oracle=${hx(a.pc)} cand=${hx(b.pc)}`);
  if (a.regs.sp !== b.regs.sp) diffs.push(`SP oracle=${hx(a.regs.sp)} cand=${hx(b.regs.sp)}`);
  return diffs;
}

/**
 * The exhaustive sweep: every (index, countdown) in 256×256. Returns the first mismatch
 * (or null) and the total combos compared.
 */
function fullSweep(base, candidate) {
  let count = 0;
  for (let index = 0; index < 256; index++) {
    for (let countdown = 0; countdown < 256; countdown++) {
      const diffs = contractDiffs(base, index, countdown, candidate);
      count++;
      if (diffs.length) return { mismatch: { index, countdown, diffs }, count };
    }
  }
  return { mismatch: null, count };
}

const describeMismatch = (mm) =>
  mm && `at index=${hx(mm.index)} countdown=${hx(mm.countdown)}: ${mm.diffs.join("; ")}`;

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): loc_21ee == oracle over all 65536 (index, countdown) states", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_21ee);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, 256 * 256, "must have compared the full 2-byte input space");
  console.log(`  EQUAL/exhaustive: ${count} (index, countdown) states — RAM + pc + SP identical to the oracle`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

const rotl8 = (v) => ((v << 1) | (v >> 7)) & 0xff;

/** BUG (a): indexes the table with the raw index instead of the doubled (`rlca`) one. */
function brokenNoDouble(m) {
  const { mem } = m;
  const index = mem.read8(SCRIPT_INDEX);
  const inputLo = (index + 0xd1) & 0xff; // BUG: dropped the doubling
  const inputAddr = 0x2100 | inputLo;
  mem.write8(P1_INPUT, mem.read8(inputAddr));
  const remaining = mem.read8(SCRIPT_COUNTDOWN);
  mem.write8(SCRIPT_COUNTDOWN, remaining - 1);
  if (remaining !== 0) return;
  mem.write8(SCRIPT_COUNTDOWN, mem.read8(0x2100 | ((inputLo + 1) & 0xff)));
  mem.write8(SCRIPT_INDEX, index + 1);
}

/** BUG (b): inverts the hold/advance branch — advances while counting, holds at zero. */
function brokenBranchInverted(m) {
  const { mem } = m;
  const index = mem.read8(SCRIPT_INDEX);
  const inputLo = (rotl8(index) + 0xd1) & 0xff;
  mem.write8(P1_INPUT, mem.read8(0x2100 | inputLo));
  const remaining = mem.read8(SCRIPT_COUNTDOWN);
  mem.write8(SCRIPT_COUNTDOWN, remaining - 1);
  if (remaining === 0) return; // BUG: should be `remaining !== 0`
  mem.write8(SCRIPT_COUNTDOWN, mem.read8(0x2100 | ((inputLo + 1) & 0xff)));
  mem.write8(SCRIPT_INDEX, index + 1);
}

/** BUG (c): reloads the countdown but forgets to step the index on the advance frame. */
function brokenNoIndexStep(m) {
  const { mem } = m;
  const index = mem.read8(SCRIPT_INDEX);
  const inputLo = (rotl8(index) + 0xd1) & 0xff;
  mem.write8(P1_INPUT, mem.read8(0x2100 | inputLo));
  const remaining = mem.read8(SCRIPT_COUNTDOWN);
  mem.write8(SCRIPT_COUNTDOWN, remaining - 1);
  if (remaining !== 0) return;
  mem.write8(SCRIPT_COUNTDOWN, mem.read8(0x2100 | ((inputLo + 1) & 0xff)));
  // BUG: no `mem.write8(SCRIPT_INDEX, index + 1)`
}

test("TEETH (exhaustive): the no-double twin is CAUGHT (P1_INPUT diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenNoDouble);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a dropped index-doubling — worthless");
  assert.ok(mismatch.diffs[0].startsWith(`RAM@${hx(P1_INPUT)}`), `expected a P1_INPUT diff, got ${mismatch.diffs[0]}`);
  console.log(`  TEETH/no-double: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the inverted-branch twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenBranchInverted);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch an inverted hold/advance branch — worthless");
  console.log(`  TEETH/branch: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the no-index-step twin is CAUGHT (0x63CC diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenNoIndexStep);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a missing index step — worthless");
  assert.ok(mismatch.diffs[0].startsWith(`RAM@${hx(SCRIPT_INDEX)}`), `expected a 0x63CC diff, got ${mismatch.diffs[0]}`);
  console.log(`  TEETH/no-index-step: caught — ${describeMismatch(mismatch)}`);
});

// -- 3. REALISM (captured dispatches) -----------------------------------------

/**
 * Hook 0x21EE in a real attract run and clone the machine at up to K real dispatches. The
 * attract demo replays the input script, so 0x21EE is dispatched once per demo frame. The
 * wrapper clones the entry state, then runs the oracle so the host game proceeds undisturbed.
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

test("REALISM: real captured 0x21EE dispatches — loc_21ee matches oracle RAM + return", () => {
  const caps = captureDispatches(200, 2600);
  assert.ok(caps.length >= 1, "expected at least one real 0x21EE dispatch during attract");

  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    const idx = a.mem.read8(SCRIPT_INDEX);
    const cd = a.mem.read8(SCRIPT_COUNTDOWN);
    oracle(a);
    loc_21ee(b);
    b.ret(); // model the return
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(ram, null, ram && `RAM diverges on real dispatch (index=${hx(idx)} countdown=${hx(cd)}) at ${hx(ram.addr)} (${ram.a}->${ram.b})`);
    assert.equal(a.pc, b.pc, `pc diverges on real dispatch (index=${hx(idx)} countdown=${hx(cd)})`);
    assert.equal(a.regs.sp, b.regs.sp, `SP diverges on real dispatch (index=${hx(idx)} countdown=${hx(cd)})`);
  }
  console.log(`  REALISM: ${caps.length} real 0x21EE dispatches — RAM + pc + SP == oracle`);
});
