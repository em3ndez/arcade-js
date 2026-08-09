// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_08fa — memory-equivalent to the frozen oracle at ROM 0x08FA.
 * GATE: crafted entries. This address is the checksum-fail trap and its bytes are a data table,
 *   so it is dispatched zero times under the coin-start tape (arm UNREACHED, with the site that
 *   would jump here, 0x083E, as the live control). Every path throws, so equivalence is: both
 *   sides throw the SAME kind and leave identical RAM. Seven twins, each caught.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_08fa } from "../loc_08fa.js";
import { loc_08fa as oracle } from "../../translated/loc_08fa.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { F_C } from "../../../../core/cpu/z80.js";

const TARGET = 0x08fa;
const CHECKSUM_SITE = 0x083e;
const STACK_SEAT = 0xab00;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const parityEven = (v) => {
  let p = v ^ (v >> 4);
  p ^= p >> 2;
  p ^= p >> 1;
  return (p & 1) === 0;
};

// A real machine with a surgical nudge: seat SP in work RAM, plant the top word (its high byte
// becomes A), pick the incoming carry, and give DE/HL distinctive values the pushes carry.
function craft({ carry, hi, de, hl }) {
  const m = makeMachine();
  m.regs.sp = STACK_SEAT;
  m.regs.de = de;
  m.regs.hl = hl;
  m.regs.f = carry ? m.regs.f | F_C : m.regs.f & ~F_C;
  m.mem.write8(STACK_SEAT, 0x00);
  m.mem.write8(STACK_SEAT + 1, hi);
  return m;
}

const ENTRIES = [
  ["carry-clear-fault", { carry: false, hi: 0x01, de: 0x1234, hl: 0x5678 }],
  ["parity-odd-one-push", { carry: true, hi: 0x01, de: 0x1234, hl: 0x5678 }],
  ["parity-even-jp", { carry: true, hi: 0x03, de: 0x1234, hl: 0x5678 }],
  ["zero-high-byte", { carry: true, hi: 0x00, de: 0x1234, hl: 0x5678 }],
  ["parity-even-2", { carry: true, hi: 0x3c, de: 0xabcd, hl: 0x1357 }],
  ["parity-odd-2", { carry: true, hi: 0x07, de: 0x0f0f, hl: 0xf0f0 }],
];

function shape(fn, m) {
  try {
    fn(m);
    return "returned";
  } catch (e) {
    return e.name;
  }
}

/** oracle vs candidate on identical clones: the throw KIND must match, then the whole RAM dump. */
function diverge(candidate, base) {
  const a = base.clone();
  const b = base.clone();
  const sa = shape(oracle, a);
  const sb = shape(candidate, b);
  if (sa !== sb) return `throw ${sa} vs ${sb}`;
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return d ? `${hex4(d.addr)}: frozen=${d.a} cand=${d.b}` : null;
}

/** Bytes the oracle moves from an entry, so a do-nothing rewrite cannot pass unnoticed. */
function footprint(base) {
  const before = base.dumpState().slice();
  const a = base.clone();
  shape(oracle, a);
  const after = a.dumpState();
  let n = 0;
  for (let i = 0; i < after.length; i++) if (after[i] !== before[i]) n++;
  return n;
}

// ── broken twins ────────────────────────────────────────────────────────────────────────
// A knob-driven twin: with no knob it is the routine, each knob a single defect the gate catches.
function variant(bug = {}) {
  return (m) => {
    const { regs, mem8 } = m;
    const carry = bug.flipCarry ? !regs.fC : regs.fC;
    if (!carry) {
      if (!bug.noFault) mem8[0x2f01] = regs.a;
      return;
    }
    regs.l = regs.l - 1;
    regs.h = regs.h + 1;
    regs.e = 0x01;
    const hi = (m.pop16() >> 8) & 0xff;
    regs.exDeHl();
    if (!bug.skipFirstPush) m.push16(bug.wrongFirst ? regs.de : regs.hl);
    if (!parityEven(hi) && !bug.ignoreParity) return m.call(0xde00);
    if (!bug.skipSecondPush) m.push16(regs.de);
    regs.de = m.pop16();
    return hi === 0 ? m.call(0xc600) : m.call(0xbc00);
  };
}

const TWINS = [
  ["no-op", () => {}, 6],
  ["no-fault", variant({ noFault: true }), 1],
  ["skip-first-push", variant({ skipFirstPush: true }), 5],
  ["wrong-first-push", variant({ wrongFirst: true }), 5],
  ["ignore-parity", variant({ ignoreParity: true }), 2],
  ["skip-second-push", variant({ skipSecondPush: true }), 3],
  ["flip-carry", variant({ flipCarry: true }), 6],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("UNREACHED: the coin-start tape never lands here, though its dispatcher runs", { skip }, () => {
  const seen = { [TARGET]: 0, [CHECKSUM_SITE]: 0 };
  const realChecksum = TRANSLATED.get(CHECKSUM_SITE);
  const m = makeMachine(
    new Map([
      [TARGET, () => seen[TARGET]++],
      [CHECKSUM_SITE, (mm) => {
        seen[CHECKSUM_SITE]++;
        return realChecksum(mm);
      }],
    ]),
  );
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
  // ★ The zero is evidence ONLY because the same run counted the site that would branch here.
  assert.ok(seen[CHECKSUM_SITE] > 0, "the checksum site never ran, so the instrument is blind");
  assert.equal(seen[TARGET], 0, "this address is now dispatched, so crafted entries are stale");
  console.log(`  UNREACHED: ${hex4(TARGET)} entered ${seen[TARGET]}, ` +
    `checksum ${hex4(CHECKSUM_SITE)} ${seen[CHECKSUM_SITE]}`);
});

test("EQUIVALENT: every crafted entry throws alike and leaves identical RAM", { skip }, () => {
  for (const [label, spec] of ENTRIES) {
    assert.equal(diverge(loc_08fa, craft(spec)), null, `${label} diverged`);
  }
  // ★ Not vacuous: a carry-set entry must actually WRITE the stack, or a do-nothing twin passes.
  const wrote = footprint(craft(ENTRIES[2][1]));
  assert.ok(wrote > 0, "the crafted entries move no RAM, so these comparisons prove nothing");
  console.log(`  EQUIVALENT: ${ENTRIES.length} entries identical; a carry-set entry moves ${wrote} bytes`);
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    let caught = 0;
    for (const [, spec] of ENTRIES) if (diverge(twin, craft(spec))) caught++;
    assert.ok(caught > 0, `every entry PASSED the ${label} twin`);
    assert.equal(caught, expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught}/${ENTRIES.length} entries`);
  });
}
