// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_08fa — the checksum-fail trap at ROM 0x08FA, dissolved to a throw.
 * Its bytes are a read-as-data table; the ROM-integrity check jumps here as code only when the sum
 * MISMATCHES, i.e. only on a tampered image. On a genuine image the two live sites that could branch
 * here never take it, so the address is dispatched zero times under the coin-start tape and the
 * idiomatic rewrite traps ON ENTRY rather than reproducing the ROM's churn-to-fault.
 * This gate asserts the two real properties of that trap: (1) UNREACHED — the coin-start tape lands
 * here zero times though its dispatcher (the checksum site 0x083E) runs, the positive control; and
 * (2) TRAPS ON ENTRY — the rewrite throws NotImplemented where the oracle would churn the index
 * registers to its derail-into-unmapped fault. The oracle-side fault is kept as documentation of the
 * ROM's own behaviour. Teeth below: a rewrite that DID NOT throw (the no-op twin) is caught.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_08fa } from "../loc_08fa.js";
import { loc_08fa as oracle } from "../../translated/loc_08fa.js";
import { F_C } from "../../../../core/cpu/z80.js";
import { NotImplemented } from "../../../../boards/timeplt/io.js";

const TARGET = 0x08fa;
const CHECKSUM_SITE = 0x083e;
const STACK_SEAT = 0xab00;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// A real machine with a surgical nudge: seat SP in work RAM, plant the top word (its high byte
// becomes A), pick the incoming carry, and give DE/HL distinctive values the pushes carry. These
// are the crafted entries the oracle churns from; the rewrite traps on every one.
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

// Whether fn terminates abnormally (throws) on a clone of the crafted machine.
function faults(fn, machine) {
  try { fn(machine.clone()); return false; }
  catch { return true; }
}

// The broken twin: a rewrite that returns instead of throwing. The throw-on-entry assertion must
// catch it, or the trap has no teeth.
function brokenNoOp() {}

// ── UNREACHED ─────────────────────────────────────────────────────────────────────────────────
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
  assert.equal(seen[TARGET], 0, "the checksum-fail trap 0x08fa was dispatched on a genuine ROM");
  console.log(`  UNREACHED: ${hex4(TARGET)} entered ${seen[TARGET]}, ` +
    `checksum ${hex4(CHECKSUM_SITE)} ${seen[CHECKSUM_SITE]}`);
});

// ── TRAPS ON ENTRY + oracle still faults ────────────────────────────────────────────────────────
test("TRAPS: rewrite throws on entry where the oracle churns to its unmapped-derail fault", { skip }, () => {
  const machines = ENTRIES.map(([, spec]) => craft(spec));

  // The rewrite traps on EVERY crafted entry.
  for (const [i, m] of machines.entries()) {
    assert.throws(() => loc_08fa(m.clone()), NotImplemented,
      `${ENTRIES[i][0]}: the rewrite did not trap on entry`);
  }

  // Oracle-faults documentation: the ROM's own bytes fault on the carry-set churn entries.
  const faulted = machines.filter((m) => faults(oracle, m)).length;
  assert.ok(faulted > 0, "no crafted entry faults the oracle, so the churn-to-fault behaviour is undocumented");

  // Teeth: the no-op twin returns without throwing, so the throw-on-entry assertion catches it.
  assert.throws(
    () => { for (const m of machines) assert.throws(() => brokenNoOp(m.clone()), NotImplemented); },
    "the no-op twin (no throw on entry) escaped the trap assertion",
  );
  console.log(`  TRAPS: ${machines.length} entries trap on entry; oracle faults on ${faulted}`);
});
