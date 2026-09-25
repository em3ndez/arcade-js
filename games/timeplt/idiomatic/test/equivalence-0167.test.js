// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0167 — UNREACHABLE-on-a-genuine-image data-as-code, dissolved to a fault.
 *
 * ROM 0x0167 is not a routine: it is a caption record whose bytes only execute as code on the
 * checksum-mismatch derail arm of armWholePlaneWipeThenDerailOnATamperedImage (ROM 0x019A). That
 * arm folds a fixed run of the program image into an eight-bit total and calls here ONLY when the
 * total misses the value a genuine image folds to. A genuine image matches, so the bytes never run
 * as code; there is no faithful routine to transcribe, and the rewrite raises instead. This gate no
 * longer byte-replays the junk — it asserts the fault and PROVES the fault stands in for no live
 * path:
 *   THROWS    — reaching the derail address raises NotImplemented.
 *   UNREACHED — over the live tape the caller runs and the derail address is never dispatched, so on
 *               a genuine image the fault is dead code (positive control: the caller IS counted, so
 *               the zero at the derail is a real absence, not a tape that never got there).
 *   GUARD     — the derail is genuinely conditional: the genuine image folds to exactly the value
 *               the arm subtracts and neither the idiomatic caller nor the frozen oracle reaches the
 *               derail; a one-byte tamper at either END of the checked run sends BOTH sides to it; a
 *               byte just past the run sends neither. So the throw is only ever reached on a tamper.
 *
 * HOLE: a pair of byte changes that cancel in an eight-bit sum is exactly what the arm cannot see,
 * and nothing here pretends otherwise — the same hole the oracle has.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0167.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_0167 as candidate } from "../loc_0167.js";
import { armWholePlaneWipeThenDerailOnATamperedImage as caller } from "../armWholePlaneWipeThenDerailOnATamperedImage.js";
import { loc_019a as oracleCaller } from "../../translated/loc_019a.js";
import { NotImplemented } from "../../../../boards/timeplt/io.js";

const TARGET = 0x0167; // the derail address — caption-record data, not a routine
const CALLER = 0x019a; // its ONLY caller; arms the derail on a checksum mismatch
const CHECKED_BLOCK = 0x4ba5;
const CHECKED_BYTES = 0xf0;
const GENUINE_TOTAL = 0x11;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// The checked run is read from a PRIVATE copy of the image per craft, so tampering never poisons
// the harness's cached image. Guarded like the rest: the ROMs are gitignored.
const ROM_IMAGE = romsPresent() ? readFileSync(new URL("../../rom/maincpu.bin", import.meta.url)) : null;

// ── the captured caller entry ─────────────────────────────────────────────────────────────

let captured = null;
function entry() {
  if (captured) return captured;
  const entries = [];
  const m = makeMachine(new Map([[CALLER, (mm) => {
    entries.push(mm.clone());
    return oracleCaller(mm);
  }]]));
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `capture run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "capture run ran short");
  assert.notEqual(entries.length, 0, "vacuous: the tape never reached the caller");
  captured = entries[0];
  return captured;
}

/** A clone of the captured caller entry reading a PRIVATE copy of the image with one byte changed. */
function tampered(at, delta) {
  const image = Uint8Array.from(ROM_IMAGE);
  if (delta !== 0) image[at] = (image[at] + delta) & 0xff;
  const c = entry().clone();
  c.mem.rom = image;
  return c;
}

/** Whether a caller reaches the derail: the derail faults (the idiomatic side throws NotImplemented,
 * the oracle side runs the junk and stores through a mis-stepped pointer), so a throw is the signal —
 * true when it derails, false when the arm returns. */
function derails(fn, at, delta) {
  try {
    fn(tampered(at, delta));
    return false;
  } catch {
    return true;
  }
}

// ── the gate ──────────────────────────────────────────────────────────────────────────────

test("THROWS: the derail address raises NotImplemented rather than running caption bytes as code", { skip }, () => {
  assert.throws(() => candidate(entry().clone()), NotImplemented, "loc_0167 no longer faults when reached");
  console.log(`  THROWS: ${hex4(TARGET)} raises NotImplemented`);
});

test("UNREACHED: over the live tape the caller runs and the derail is never dispatched", { skip }, () => {
  for (const [label, opts] of [["coin-start", {}], ["undriven", { tape: [] }]]) {
    const seen = { [TARGET]: 0, [CALLER]: 0 };
    const m = makeMachine(new Map([
      [TARGET, (mm) => { seen[TARGET]++; return candidate(mm); }],
      [CALLER, (mm) => { seen[CALLER]++; return oracleCaller(mm); }],
    ]), opts);
    m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the ${label} run stopped early: ${m.stoppedBy}`);
    assert.ok(seen[CALLER] > 0, `${label} never ran the caller, so a zero at the derail proves nothing`);
    assert.equal(seen[TARGET], 0, `${label} dispatched the derail on a genuine image, so it is not dead code`);
    console.log(`  UNREACHED: ${label} — caller ${hex4(CALLER)} ran ${seen[CALLER]}, derail ${hex4(TARGET)} ${seen[TARGET]}`);
  }
});

test("GUARD: the derail is reached only when the folded run misses, on caller and oracle alike", { skip }, () => {
  // The guard math itself: the genuine image folds to exactly the value the arm subtracts.
  let total = 0;
  for (let i = 0; i < CHECKED_BYTES; i++) total = (total + ROM_IMAGE[CHECKED_BLOCK + i]) & 0xff;
  assert.equal(total, GENUINE_TOTAL, "the genuine image no longer sums to the arm's expected value");

  // The genuine image derails neither side — the throw is dead on a clean ROM.
  assert.equal(derails(caller, CHECKED_BLOCK, 0), false, "the idiomatic caller derails on a genuine image");
  assert.equal(derails(oracleCaller, CHECKED_BLOCK, 0), false, "the oracle derails on a genuine image");

  // A one-byte tamper at either END of the checked run derails BOTH sides — the guard is live and
  // its extent is measured, not declared. (A control: only a change inside the run moves the sum.)
  for (const off of [0, CHECKED_BYTES - 1]) {
    assert.equal(derails(caller, CHECKED_BLOCK + off, 1), true, `the idiomatic caller missed the derail on a tamper at +${off}`);
    assert.equal(derails(oracleCaller, CHECKED_BLOCK + off, 1), true, `the oracle missed the derail on a tamper at +${off}`);
  }

  // A byte just past the run leaves the sum alone, so neither side derails.
  assert.equal(derails(caller, CHECKED_BLOCK + CHECKED_BYTES, 1), false, "a byte past the run derailed the idiomatic caller");
  assert.equal(derails(oracleCaller, CHECKED_BLOCK + CHECKED_BYTES, 1), false, "a byte past the run derailed the oracle");

  console.log(`  GUARD: genuine image folds to ${hex4(GENUINE_TOTAL)} and neither side derails; a tamper at either end derails both, a byte past the run derails neither`);
});
