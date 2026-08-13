// SPDX-License-Identifier: GPL-3.0-only
/**
 * trampolineToSelectFoldBlock — memory-equivalent to the frozen oracle at ROM 0x4BD9.
 *
 * Three bytes, `jp 0x08AE`; 0x08AE loads a fixed address and count and returns. Nothing on that
 * path writes memory, so the RAM diff is VACUOUS — it cannot tell a correct rewrite from a no-op.
 * This file MEASURES that: the LIVE-OUT comparison (address in hl, count in b, against the frozen
 * original) is the whole gate, and the VACUITY test asserts a no-op twin PASSES RAM but FAILS
 * live-out, so the hole is pinned rather than described. The EQUAL arm also pins the excluded set
 * to {sp} and the offset to the two bytes the guest `ret` no longer pops.
 *
 * THE TAPE IS UNDRIVEN ATTRACT. 0x4BD9 is reached by one site, `call 0x4BD9` at 0x17EC; attract
 * dispatches it at frame 787, while the shared coin -> start tape does not reach it inside the
 * budget (both asserted below). TEETH: no-op, transfers-elsewhere, and address/count off-by-one
 * twins, each caught by the live-out.
 *
 * HOLE: this says nothing about what the address and count are FOR — the caller folds a 30-byte
 * run from 0x335E into a byte at 0xAA6F, a checksum shape, but no arm here observes that.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-4bd9.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { trampolineToSelectFoldBlock } from "../trampolineToSelectFoldBlock.js";
import { loc_4bd9 as oracle } from "../../translated/loc_4bd9.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u16 } from "../../../../core/int.js";

const TARGET = 0x4bd9;

/** Bytes the guest `ret` at the end of the destination would have popped, and no longer does. */
const UNPOPPED_BYTES = 2;

/** Real code elsewhere, used only as a broken twin's destination. */
const SOMEWHERE_ELSE = 0x0f1a;

const SKIP = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

const attract = (overrides) => makeMachine(overrides, { tape: [] });

let entry = null;

function gate(candidate) {
  return unitEquivalence(
    attract,
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
  if (entry === null) gate(trampolineToSelectFoldBlock);
  return entry;
}

/** The two things this routine hands back. */
const liveOut = (m) => ({ address: m.regs.hl, count: m.regs.b });

function liveOutOf(candidate) {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  candidate(b);
  return { oracle: liveOut(a), candidate: liveOut(b) };
}

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: RAM, and every register but the stack pointer", { skip: SKIP }, () => {
  const r = gate(trampolineToSelectFoldBlock);
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");

  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  trampolineToSelectFoldBlock(b);

  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(moved, ["sp"], "the excluded register set changed shape");
  assert.equal(
    b.regs.sp,
    u16(a.regs.sp - UNPOPPED_BYTES),
    "the rewrite's stack pointer is not exactly the two bytes the guest `ret` would have popped " +
      "below the frozen original's — so the difference is no longer the one this file excludes",
  );
  assert.notEqual(a.pc, b.pc, "the frozen original's return moves pc; the rewrite returns to JS");
  console.log(
    `  EQUAL: RAM identical; the only register that moved is sp, ${UNPOPPED_BYTES} below the ` +
      `frozen original's ${hex4(a.regs.sp)}`,
  );
});

test("THE SHARED TAPE DOES NOT REACH IT, and that is why attract is used", { skip: SKIP }, () => {
  let hits = 0;
  const m = makeMachine(new Map([[TARGET, (mm) => { hits += 1; return oracle(mm); }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(hits, 0, "if the shared coin -> start tape now reaches it, this gate should use it");
  console.log(`  TAPE: the shared coin -> start tape dispatches it ${hits} times in the budget`);
});

test("LIVE-OUT: the address and the count match the frozen original", { skip: SKIP }, () => {
  const { oracle: o, candidate: c } = liveOutOf(trampolineToSelectFoldBlock);
  assert.deepEqual(c, o, "the two live-outs must match exactly");
  console.log(`  LIVE-OUT: address ${hex4(o.address)}, count ${o.count}`);
});

test("VACUITY, MEASURED: the RAM diff cannot see a no-op; the live-out can", { skip: SKIP }, () => {
  const r = gate(() => {});
  assert.equal(r.ram, null, "if RAM now catches a no-op here, this header's vacuity claim is stale");
  const { oracle: o, candidate: c } = liveOutOf(() => {});
  assert.notDeepEqual(c, o, "the live-out comparison must catch what the RAM diff cannot");
  console.log("  VACUITY: RAM blind to a no-op, live-out catches it — as stated");
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────────
// Every twin is caught by the live-out comparison, which is the only channel this routine has.

const wrongAddress = (m) => {
  m.regs.hl = 0x335f;
  m.regs.b = 30;
};
const wrongCount = (m) => {
  m.regs.hl = 0x335e;
  m.regs.b = 29;
};
const elsewhere = (m) => m.call(SOMEWHERE_ELSE);

for (const [label, twin] of [
  ["no-op", () => {}],
  ["address-off-by-one", wrongAddress],
  ["count-off-by-one", wrongCount],
  ["transfers-elsewhere", elsewhere],
]) {
  test(`TEETH: the ${label} twin is CAUGHT by the live-out`, { skip: SKIP }, () => {
    const { oracle: o, candidate: c } = liveOutOf(twin);
    assert.notDeepEqual(c, o, `the gate PASSED the ${label} twin — it has no teeth`);
    console.log(
      `  TEETH/${label}: caught — oracle(${hex4(o.address)}, ${o.count}) ` +
        `vs candidate(${hex4(c.address)}, ${c.count})`,
    );
  });
}
