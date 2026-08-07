// SPDX-License-Identifier: GPL-3.0-only
/**
 * unpackCoinage — memory-equivalent to the frozen oracle at ROM 0x4ACC.
 *
 * GATE: the one real dispatch each tape produces, plus an EXHAUSTIVE sweep of the only input:
 *   the single source byte, all 256 values of it. What it exercises, holes stated:
 *
 *   1. CORPUS — both tapes reach it exactly once, asserted as a count, and both replay
 *      identically over the whole state dump outside the scratch window.
 *   2. THE DEAD STACK SCRATCH IS THE ONE EXCLUSION, pinned to [SP-2, SP): the oracle pushes a
 *      return address for each of the two lookups it delegates, and both use the same slot.
 *   3. REGISTERS AND PC ARE EXCLUDED, DELIBERATELY, and pinned to exactly {f, sp} — the table
 *      pointer and the last byte fetched are reproduced and compared, not excused.
 *   4. EXHAUSTIVE — all 256 source bytes, each a whole-dump comparison, and for each one the two
 *      destination bytes and the flag cell are read back off the ORACLE and checked against the
 *      table entry the nibble selects. So the routing is pinned per value, not just the equality.
 *   5. THE FLAG IS RAISED BY EITHER NIBBLE — the three cases (low only, high only, both) are
 *      asserted from the sweep's own measurements rather than argued from the code.
 *   6. THE FLAG IS NOT LOWERED — a source byte with neither nibble at the raising value leaves a
 *      pre-raised flag cell standing, which is what makes "raises" the right word for it.
 *   7. TEETH — eight twins, each reported with its catch count over the sweep.
 *
 * HOLE: nothing here says what the two destination bytes are used for, nor what the flag cell
 * gates. The table is read as data; its entries are not interpreted.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-4acc.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { unpackCoinage } from "../unpackCoinage.js";
import { loc_4acc as oracle } from "../../translated/loc_4acc.js";
import { fetchTableByte } from "../fetchTableByte.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import {
  COINAGE_SETTINGS as SETTINGS,
  COIN_SLOT_1_RATIO as LOW_DESTINATION,
  COIN_SLOT_2_RATIO as HIGH_DESTINATION,
  FREE_PLAY as FLAG_CELL,
} from "../names.js";

const TARGET = 0x4acc;

const VALUES = 0x4b95;
const NIBBLE = 0x0f;
const RAISING_VALUE = 15;
const RAISED = 255;

/** A value the table cannot produce, so a pre-set flag cell is distinguishable from a raised one. */
const FLAG_PRIOR = 0x3c;

const SCRATCH_BYTES = 2;
const EXCLUDED = ["f", "sp"];

const DISPATCHES = { shared: 1, attract: 1 };
const TAPES = [["shared", {}], ["attract", { tape: [] }]];

const skip = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

const inScratch = (addr, sp) => addr >= sp - SCRATCH_BYTES && addr < sp;

function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  const ram = allDiffs(a, b).find((d) => !inScratch(d.addr, sp));
  if (ram) return ram;
  const moved = REG_FIELDS.find((k) => !EXCLUDED.includes(k) && a.regs[k] !== b.regs[k]);
  return moved ? { addr: null, a: a.regs[moved], b: b.regs[moved] } : null;
}

let corpusCache = null;
function corpus() {
  if (corpusCache) return corpusCache;
  corpusCache = TAPES.map(([label, opts]) => {
    const states = [];
    const sources = new Set();
    const host = makeMachine(
      new Map([[TARGET, (mm) => {
        states.push(mm.clone());
        sources.add(mm.mem8[SETTINGS]);
        return oracle(mm);
      }]]),
      opts,
    );
    const frames = host.runFrames(ENTRY_FRAMES);
    assert.equal(host.stoppedBy, null, `the ${label} session stopped early: ${host.stoppedBy}`);
    assert.equal(frames.length, ENTRY_FRAMES, `the ${label} session ran short`);
    assert.equal(states.length, DISPATCHES[label], `the ${label} dispatch count moved`);
    return { label, states, sources };
  });
  return corpusCache;
}

const anEntry = () => corpus()[0].states[0];

/** A real captured machine with the source byte forced and the flag cell pre-set to a marker. */
function craft(source) {
  const m = anEntry().clone();
  m.mem8[SETTINGS] = source;
  m.mem8[FLAG_CELL] = FLAG_PRIOR;
  return m;
}

/** What the ORACLE leaves in the three cells this routine touches, for one source byte. */
function outcome(source) {
  const m = craft(source);
  oracle(m);
  return { low: m.mem8[LOW_DESTINATION], high: m.mem8[HIGH_DESTINATION], flag: m.mem8[FLAG_CELL] };
}

function sweepCaught(candidate) {
  let caught = 0;
  for (let source = 0; source < 256; source++) if (unitDiff(candidate, craft(source))) caught++;
  return caught;
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("CORPUS: the one dispatch each tape produces replays identically", { skip }, () => {
  for (const s of corpus()) {
    assert.ok(s.states.length > 0, `vacuous: the ${s.label} tape never reached the routine`);
    for (const state of s.states) {
      const d = unitDiff(unpackCoinage, state);
      assert.equal(d, null, `${s.label}: ${show(d)}`);
    }
  }
  const sources = [...new Set(corpus().flatMap((s) => [...s.sources]))];
  console.log(`  CORPUS: ${DISPATCHES.shared}/${DISPATCHES.attract} dispatches; source bytes ${sources.map(hex4).join(" ")}`);
});

test("NOT VACUOUS: a no-op candidate FAILS the same masked comparison", { skip }, () => {
  const d = unitDiff(brokenNoOp, craft(0x00));
  assert.notEqual(d, null, "the masked diff passed a candidate that does nothing");
  assert.notEqual(d.addr, null, "the no-op must be caught on a real cell, not on a register");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("EXCLUDED, deliberately: the flag byte, sp, pc and one scratch slot", { skip }, () => {
  const entry = craft(0x53);
  const sp = entry.regs.sp;
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  unpackCoinage(b);
  assert.deepEqual(REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]), EXCLUDED,
    "the excluded register set changed shape");
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  assert.deepEqual(allDiffs(a, b).filter((d) => !inScratch(d.addr, sp)), [],
    "a divergence escaped the scratch window");
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")}, pc, and [SP-${SCRATCH_BYTES}, SP)`);
});

test("EXHAUSTIVE: all 256 source bytes, with the routing read back for each", { skip }, () => {
  const image = anEntry().mem.rom;
  for (let source = 0; source < 256; source++) {
    const d = unitDiff(unpackCoinage, craft(source));
    assert.equal(d, null, `source=${hex4(source)}: ${show(d)}`);
    const { low, high } = outcome(source);
    assert.equal(low, image[VALUES + (source & NIBBLE)],
      `source=${hex4(source)}: the low destination is not the entry its nibble selects`);
    assert.equal(high, image[VALUES + (source >> 4)],
      `source=${hex4(source)}: the high destination is not the entry its nibble selects`);
  }
  console.log("  EXHAUSTIVE: 256 source bytes identical, and both destinations tracked per value");
});

test("THE FLAG IS RAISED BY EITHER NIBBLE, measured across the sweep", { skip }, () => {
  const lowOnly = outcome(0x0f);
  const highOnly = outcome(0xf0);
  const both = outcome(0xff);
  const neither = outcome(0x53);
  assert.equal(lowOnly.flag, RAISED, "the low nibble alone did not raise the flag");
  assert.equal(highOnly.flag, RAISED, "the high nibble alone did not raise the flag");
  assert.equal(both.flag, RAISED, "both nibbles together did not raise the flag");
  assert.notEqual(neither.flag, RAISED, "a source with neither nibble raising still raised it");

  // Either nibble at the raising value: sixteen bytes have it low, sixteen have it high, and one
  // byte has both, so the union is thirty-one. A different count means a different condition.
  const EITHER_NIBBLE = 16 + 16 - 1;
  let raisedCount = 0;
  for (let source = 0; source < 256; source++) if (outcome(source).flag === RAISED) raisedCount++;
  assert.equal(raisedCount, EITHER_NIBBLE,
    `the flag is raised on ${raisedCount} source bytes rather than ${EITHER_NIBBLE}, so the ` +
      "condition has changed shape");
  console.log(`  FLAG: raised on ${raisedCount} of 256 source bytes — either nibble is enough`);
});

test("THE FLAG IS NOT LOWERED: a non-raising source leaves a pre-set cell standing", { skip }, () => {
  assert.equal(outcome(0x53).flag, FLAG_PRIOR,
    "a non-raising source cleared the flag cell, so this routine lowers it as well as raising it " +
      "and the rewrite's one-way store is describing something that does not happen");
  console.log(`  NOT LOWERED: with no raising nibble the cell still reads ${hex4(FLAG_PRIOR)}`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

function unpack(m, setting, destination, table, raise) {
  const { mem8, regs } = m;
  if (raise) mem8[FLAG_CELL] = RAISED;
  regs.hl = table;
  regs.a = setting;
  mem8[destination] = fetchTableByte(m);
}

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: the two nibbles go to each other's destinations. */
function brokenDestinationsSwapped(m) {
  const { mem8 } = m;
  unpack(m, mem8[SETTINGS] & NIBBLE, HIGH_DESTINATION, VALUES, (mem8[SETTINGS] & NIBBLE) === RAISING_VALUE);
  unpack(m, mem8[SETTINGS] >> 4, LOW_DESTINATION, VALUES, (mem8[SETTINGS] >> 4) === RAISING_VALUE);
}

/** BUG: only the low nibble can raise the flag. */
function brokenHighCannotRaise(m) {
  const { mem8 } = m;
  unpack(m, mem8[SETTINGS] & NIBBLE, LOW_DESTINATION, VALUES, (mem8[SETTINGS] & NIBBLE) === RAISING_VALUE);
  unpack(m, mem8[SETTINGS] >> 4, HIGH_DESTINATION, VALUES, false);
}

/** BUG: the flag is never raised at all. */
function brokenNoFlag(m) {
  const { mem8 } = m;
  unpack(m, mem8[SETTINGS] & NIBBLE, LOW_DESTINATION, VALUES, false);
  unpack(m, mem8[SETTINGS] >> 4, HIGH_DESTINATION, VALUES, false);
}

/** BUG: the flag is written unconditionally, so it is not a condition at all. */
function brokenFlagAlways(m) {
  const { mem8 } = m;
  unpack(m, mem8[SETTINGS] & NIBBLE, LOW_DESTINATION, VALUES, true);
  unpack(m, mem8[SETTINGS] >> 4, HIGH_DESTINATION, VALUES, true);
}

/** BUG: reads the table one entry along. */
function brokenTableOffByOne(m) {
  const { mem8 } = m;
  unpack(m, mem8[SETTINGS] & NIBBLE, LOW_DESTINATION, VALUES + 1, (mem8[SETTINGS] & NIBBLE) === RAISING_VALUE);
  unpack(m, mem8[SETTINGS] >> 4, HIGH_DESTINATION, VALUES + 1, (mem8[SETTINGS] >> 4) === RAISING_VALUE);
}

/** BUG: takes the high nibble without shifting, so both halves index the same entry. */
function brokenNoShift(m) {
  const { mem8 } = m;
  unpack(m, mem8[SETTINGS] & NIBBLE, LOW_DESTINATION, VALUES, (mem8[SETTINGS] & NIBBLE) === RAISING_VALUE);
  unpack(m, mem8[SETTINGS] & NIBBLE, HIGH_DESTINATION, VALUES, (mem8[SETTINGS] & NIBBLE) === RAISING_VALUE);
}

/** BUG: raises the flag one value early. */
function brokenRaisingValue(m) {
  const { mem8 } = m;
  unpack(m, mem8[SETTINGS] & NIBBLE, LOW_DESTINATION, VALUES, (mem8[SETTINGS] & NIBBLE) === RAISING_VALUE - 1);
  unpack(m, mem8[SETTINGS] >> 4, HIGH_DESTINATION, VALUES, (mem8[SETTINGS] >> 4) === RAISING_VALUE - 1);
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["destinations-swapped", brokenDestinationsSwapped],
  ["high-nibble-cannot-raise", brokenHighCannotRaise],
  ["flag-never-raised", brokenNoFlag],
  ["flag-always-raised", brokenFlagAlways],
  ["table-off-by-one", brokenTableOffByOne],
  ["high-nibble-not-shifted", brokenNoShift],
  ["raising-value-off-by-one", brokenRaisingValue],
];

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT in the exhaustive sweep`, { skip }, () => {
    const caught = sweepCaught(twin);
    assert.ok(caught > 0, `the sweep PASSED the ${label} twin — it has no teeth`);
    console.log(`  TEETH/${label}: caught on ${caught} of 256 source bytes`);
  });
}
