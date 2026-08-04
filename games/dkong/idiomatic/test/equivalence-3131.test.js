// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_3131 (ROM 0x3131) — the 7-in-8 frame-phase caller-skip gate.
 *
 * guard_3131 is a LEAF whose entire observable behaviour is a function of ONE byte —
 * FRAME (0x601A) — and it writes NO memory: it only reads FRAME, then either returns
 * normally (the caller proceeds) or performs the `inc sp; inc sp; ret` caller-skip (the
 * caller is returned past). So its live-out is the boolean proceed/skip DECISION, which
 * the oracle carries in the stack: a normal `ret` pops one word (SP +2, pc = the caller
 * continuation), the caller-skip pops two (SP +4, pc = the caller's own return). The
 * idiomatic routine returns that decision as a boolean and touches no stack, so this
 * harness MODELS the matching stack move on the candidate side (true -> one ret; false
 * -> inc sp; inc sp; ret) and then compares pc + SP + RAM against the oracle. A wrong
 * boolean models the wrong stack move and diverges on pc + SP — that is where the teeth
 * bite. RAM is compared too and is identical on every path (the oracle only POPS the
 * stack, never writes it), so no STACK_SCRATCH exclusion is needed.
 *
 * The input is a single byte, so the gate is EXHAUSTIVE over all 256 FRAME values — a
 * proof, not a sample. There is no realism arm: 0x3131 is never dispatched during
 * attract (it is reached only through the untranslated entry_30ed rst-0x28 table), so
 * there are no real captures to replay; the exhaustive sweep stands on its own.
 *
 *   1. EQUAL (exhaustive) — loc_3131 == oracle on pc + SP + RAM across all 256 FRAME
 *      values, covering both the proceed arm (FRAME & 7 != 7) and the skip arm
 *      (FRAME & 7 == 7).
 *
 *   2. DECISION (exhaustive) — the boolean loc_3131 returns matches the arm the oracle
 *      actually took (its SP delta), spelling out the live-out directly.
 *
 *   3. TEETH (exhaustive) — two deliberately-broken twins the same sweep MUST catch:
 *        (a) inverted decision — proceeds when it should skip and vice-versa; caught at
 *            the first FRAME value on pc + SP.
 *        (b) wrong mask (& 3 instead of & 7) — a 3-in-4 gate; disagrees with the true
 *            7-in-8 gate wherever the two masks pick different arms (first at FRAME 3).
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-3131.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3131 as oracle } from "../../translated/loc_3131.js";
import { loc_3131 } from "../loc_3131.js";
import { FRAME } from "../names.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const hx = (v) => "0x" + (v & 0xffff).toString(16);

// A two-word return frame in work RAM: [SP] = the caller's continuation (popped by a
// normal ret), [SP+2] = the caller's own return (popped by the caller-skip). Distinct
// sentinels so pc reveals which arm ran. Both bytes sit in RAM; neither routine writes
// them, so they never affect the RAM diff.
const SP_TOP = 0x6c00;
const RET_CONTINUE = 0x1234; // proceed lands here (SP -> 0x6bfe)
const RET_SKIP = 0x5678;     // caller-skip lands here (SP -> 0x6c00)

/**
 * A synthetic entry: a clone of `base` with FRAME set and a valid two-word return frame
 * on the stack. Frame machinery is neutralised (clone() already sets nextNmi/nextBoundary
 * = Infinity; re-asserted for clarity) so the oracle's `m.step`/`m.ret` cannot fire an NMI
 * or push a frame while running in isolation.
 */
function makeEntry(base, frame) {
  const e = base.clone();
  e.mem.write8(FRAME, frame);
  e.regs.sp = SP_TOP;
  e.push16(RET_SKIP);     // [0x6bfe]
  e.push16(RET_CONTINUE); // [0x6bfc]  <- SP now here
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/** Run the ORACLE on a fresh clone. It performs its own `ret` / caller-skip. */
function runOracle(entry) {
  const c = entry.clone();
  oracle(c);
  return c;
}

/**
 * Run the candidate on a fresh clone, then MODEL its terminal control transfer from the
 * boolean it returns so pc + SP line up with the oracle: true -> one `ret` (the caller
 * proceeds); false -> `inc sp; inc sp; ret` (the caller-skip). Returns the machine and
 * the boolean decision.
 */
function runCandidate(entry, fn) {
  const c = entry.clone();
  const proceed = fn(c);
  if (!proceed) c.regs.sp = (c.regs.sp + 2) & 0xffff; // inc sp; inc sp
  c.ret();
  return { c, proceed };
}

/** Full contract diff for one FRAME value: RAM (whole dump) + pc + SP. */
function contractDiffs(entry, fn) {
  const o = runOracle(entry);
  const { c } = runCandidate(entry, fn);
  const diffs = [];
  const ram = firstStateDiff(o.dumpState(), c.dumpState(), (off) => o.stateOffsetToAddr(off));
  if (ram) diffs.push(`RAM@${hx(ram.addr ?? 0)} oracle=${ram.a} cand=${ram.b}`);
  if (o.pc !== c.pc) diffs.push(`pc oracle=${hx(o.pc)} cand=${hx(c.pc)}`);
  if (o.regs.sp !== c.regs.sp) diffs.push(`SP oracle=${hx(o.regs.sp)} cand=${hx(c.regs.sp)}`);
  return diffs;
}

/** Sweep all 256 FRAME values; return the first mismatching value (or null) + the count. */
function fullSweep(base, candidate) {
  for (let v = 0; v < 256; v++) {
    const diffs = contractDiffs(makeEntry(base, v), candidate);
    if (diffs.length) return { mismatch: { v, diffs }, count: v + 1 };
  }
  return { mismatch: null, count: 256 };
}

const describe = (mm) => mm && `at FRAME=${hx(mm.v)} (& 7 = ${mm.v & 7}): ${mm.diffs.join("; ")}`;

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): loc_3131 == oracle on pc + SP + RAM across all 256 FRAME values", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_3131);
  assert.equal(mismatch, null, describe(mismatch));
  assert.equal(count, 256, "must have compared every FRAME value");
  console.log(`  EQUAL/exhaustive: ${count} FRAME values — pc + SP + RAM identical to the oracle`);
});

// -- 2. DECISION (exhaustive) -------------------------------------------------
//
// Spell out the live-out directly: the boolean loc_3131 returns must equal the arm the
// oracle actually took, read from the oracle's SP delta (+2 = proceed, +4 = caller-skip).

test("DECISION (exhaustive): loc_3131's boolean matches the oracle's arm on all 256 values", () => {
  const base = new Machine(ROM).clone();
  let proceeds = 0, skips = 0;
  for (let v = 0; v < 256; v++) {
    const entry = makeEntry(base, v);
    const oracleSp = runOracle(entry).regs.sp;
    const oracleProceed = oracleSp === SP_TOP - 2 ? true : oracleSp === SP_TOP ? false : null;
    assert.notEqual(oracleProceed, null, `unexpected oracle SP ${hx(oracleSp)} at FRAME=${hx(v)}`);
    const { proceed } = runCandidate(entry, loc_3131);
    assert.equal(proceed, oracleProceed, `decision mismatch at FRAME=${hx(v)}`);
    // Independent cross-check against the documented rule (proceed iff low 3 bits != 7).
    assert.equal(proceed, (v & 7) !== 7, `decision != (FRAME & 7 != 7) at FRAME=${hx(v)}`);
    if (proceed) proceeds++; else skips++;
  }
  assert.equal(proceeds, 224, "224 = 7/8 of 256 frames proceed");
  assert.equal(skips, 32, "32 = 1/8 of 256 frames are caller-skipped");
  console.log(`  DECISION: ${proceeds} proceed / ${skips} skip — matches the oracle and the 7-in-8 rule`);
});

// -- 3. TEETH (exhaustive) ----------------------------------------------------

/** BUG (a): inverts the decision — proceeds when it should skip and vice-versa. */
function brokenInverted(m) {
  const { mem } = m;
  return (mem.read8(FRAME) & 7) === 7; // BUG: inverted
}

/** BUG (b): wrong mask — a 3-in-4 gate (& 3) instead of the true 7-in-8 gate (& 7). */
function brokenWrongMask(m) {
  const { mem } = m;
  return (mem.read8(FRAME) & 3) !== 3; // BUG: & 3, not & 7
}

test("TEETH (exhaustive): the inverted-decision twin is CAUGHT (pc + SP diverge)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenInverted);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch an inverted decision — the gate is worthless");
  console.log(`  TEETH/inverted: caught — ${describe(mismatch)}`);
});

test("TEETH (exhaustive): the wrong-mask (&3) twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenWrongMask);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong gate mask — the gate is worthless");
  console.log(`  TEETH/mask: caught — ${describe(mismatch)}`);
});
