// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_3984 (ROM 0x3984) — the pending-spawn init of a
 * two-body actor (figure + twin).
 *
 * loc_3984 writes work/video/colour RAM and tail-hands-off to the still-translated
 * loc_3a4c, so it is NOT a pure leaf. Its contract is MEMORY: the eight-cell tile
 * block it stamps, the two actor records it seeds, and (via loc_3a4c) the sprite
 * records copied from them. The registers loc_3a4c leaves behind are dead ABI, and
 * on the not-pending early-return the idiomatic routine models the return as a plain
 * JS `return` (leaving pc/SP where the oracle's `ret` would move them) — so the gate
 * compares RAM (dumpState — work+colour+video+attr/sprite), never registers/pc/SP.
 *
 * Inputs are CAPTURED, not constructed: the routine is hooked in a real attract run
 * and the machine is cloned at every true dispatch. In a 4000-frame run it is entered
 * 172 times — 170 with no pending spawn (early-return) and 2 with a pending request
 * (flag 0x1f) that run the full spawn body. Both classes are replayed.
 *
 *   1. EQUAL — for every captured dispatch, run oracle vs loc_3984 on independent
 *      clones of the same entry state and diff RAM; all must be identical. Asserts at
 *      least one body-run capture is present, so the spawn body is actually exercised.
 *   2. TEETH — a broken twin that seeds the actor timer one off, but ONLY on the
 *      body-run dispatches, MUST be caught. Because it diverges only when the body
 *      runs, catching it also proves the harness captured a real body-run state (an
 *      always-early-return capture set would let the twin pass and expose the gate).
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3984.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3984 as oracle } from "../../translated/loc_3984.js";
import { loc_3984 as idiomatic } from "../loc_3984.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x3984;
const REQUEST = 0x810d; // the pending-spawn request byte read at entry
const TIMER = 0x8112; // primary actor countdown timer (a body-only write)
const FRAMES = 4000;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// -- capture every real dispatch of 0x3984 from a live attract run -----------
// The hook clones the pristine machine at each entry (before the oracle runs), then
// delegates to the oracle so the host game continues undisturbed.
const captures = [];
if (ROM_PRESENT) {
  const makeMachine = await makeMachineFactory(ROM);
  const hook = new Map([[TARGET, (mm) => {
    captures.push({ entry: mm.clone(), pending: mm.mem.read8(REQUEST) !== 0 });
    return oracle(mm);
  }]]);
  makeMachine(hook).runFrames(FRAMES);
}

const bodyRuns = () => captures.filter((c) => c.pending).length;

// -- 1. EQUAL ----------------------------------------------------------------

test("EQUAL: loc_3984 == oracle (RAM) on every captured attract dispatch", () => {
  assert.ok(captures.length > 0, `0x3984 was never dispatched in ${FRAMES} attract frames`);
  assert.ok(
    bodyRuns() > 0,
    "no captured dispatch ran the spawn body (all early-returns) — the body is untested",
  );

  let firstDiff = null;
  for (let i = 0; i < captures.length && !firstDiff; i++) {
    const a = captures[i].entry.clone(); // oracle
    const b = captures[i].entry.clone(); // idiomatic
    oracle(a);
    idiomatic(b);
    const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    if (d) firstDiff = { i, pending: captures[i].pending, d };
  }

  assert.equal(
    firstDiff,
    null,
    firstDiff &&
      `RAM diff on capture #${firstDiff.i} (pending=${firstDiff.pending}) at ` +
        `${hx(firstDiff.d.addr ?? 0)}: oracle=${firstDiff.d.a} idiomatic=${firstDiff.d.b}`,
  );
  console.log(
    `  EQUAL: ${captures.length} captured dispatches identical ` +
      `(${bodyRuns()} ran the spawn body, ${captures.length - bodyRuns()} early-returned)`,
  );
});

// -- 2. TEETH ----------------------------------------------------------------

/** Broken twin: the oracle, then the actor timer bumped by one — but only when a
 *  spawn was actually pending, so it diverges ONLY on a body-run dispatch. */
function brokenTwin(m) {
  const pending = m.mem.read8(REQUEST) !== 0;
  oracle(m);
  if (pending) m.mem.write8(TIMER, m.mem.read8(TIMER) + 1); // BUG: wrong seeded timer
}

test("TEETH: a body-only wrong timer seed is CAUGHT", () => {
  assert.ok(bodyRuns() > 0, "cannot exercise teeth: no body-run capture was recorded");

  let caught = null;
  for (let i = 0; i < captures.length && !caught; i++) {
    const a = captures[i].entry.clone();
    const b = captures[i].entry.clone();
    oracle(a);
    brokenTwin(b);
    const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    if (d) caught = { i, pending: captures[i].pending, d };
  }

  assert.notEqual(caught, null, "the gate FAILED to catch a wrong timer seed — it is worthless");
  assert.equal(caught.pending, true, "the teeth should bite only on a body-run dispatch");
  assert.equal(
    caught.d.addr,
    TIMER,
    `teeth caught the wrong address ${hx(caught.d.addr ?? 0)} (expected ${hx(TIMER)})`,
  );
  console.log(
    `  TEETH: wrong timer seed caught on capture #${caught.i} at ${hx(caught.d.addr)} ` +
      `(oracle=${caught.d.a} broken=${caught.d.b})`,
  );
});
