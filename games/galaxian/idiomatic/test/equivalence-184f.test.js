// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_184f — memory-equivalent to the frozen sound-envelope word tick at ROM 0x184f. All live-outs are
 * work-RAM cells (the envelope word low/high bytes, the staged pitch, the composite sound flag), so
 * ramDiff covers everything. Three paths:
 *   - DELEGATE (low byte bit0 clear, high nonzero): store high-1, stage the bit2-gated pulse + raise flag.
 *   - IDLE (low byte bit0 clear, high zero): the high-byte processor bails; nothing is written.
 *   - RESET (low byte bit0 set): reset the word to low 0 / high 128, no pulse.
 * Teeth: no-op + wrong-high on delegate; no-reset + wrong-reset-high on reset.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { advancePulseToneEnvelope as cand } from "../advancePulseToneEnvelope.js";
import { loc_184f as oracle } from "../../translated/loc_184f.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const LOW = 0x41c7;   // envelope word low byte
const HIGH = 0x41c8;  // envelope word high byte
const PITCH = 0x41c1; // SOUND_PITCH staged value
const FLAG = 0x41c0;  // composite sound flag

// Low byte bit0 clear, high = 5 -> stores 4; bit2 of 4 set -> pulse a=129 -> PITCH=128, FLAG=1.
const delegateEntry = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[LOW] = 0x02;  // bit0 clear -> delegate
  mem[HIGH] = 5;
  mem[PITCH] = 0x77;
  mem[FLAG] = 0x00;
});
// Low byte bit0 clear, high = 0 -> the high-byte processor bails; nothing written.
const idleEntry = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[LOW] = 0x02;
  mem[HIGH] = 0;
  mem[PITCH] = 0x77;
});
// Low byte bit0 set -> reset the word.
const resetEntry = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[LOW] = 0x03; // bit0 set -> reset
  mem[HIGH] = 0x07;
});

function afterOracle(e) { const a = e.clone(); a.routines = STUBS; oracle(a); return a; }

test("EQUAL (crafted): loc_184f == oracle delegates the high byte to the pulse processor", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, delegateEntry()), null, "loc_184f diverged on the delegate path");
  const a = afterOracle(delegateEntry());
  assert.equal(a.mem8[HIGH], 4, "positive control: high byte not stored decremented");
  assert.equal(a.mem8[PITCH], 128, "positive control: pulse pitch not staged");
  assert.equal(a.mem8[FLAG], 1, "positive control: sound flag not raised");
  console.log("  EQUAL: loc_184f == oracle (delegate) — high 5->4, pitch staged, flag raised");
});

test("EQUAL (crafted): loc_184f == oracle idles on a zero high byte", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, idleEntry()), null, "loc_184f diverged on the idle path");
  const a = afterOracle(idleEntry());
  assert.equal(a.mem8[HIGH], 0, "positive control: idle path wrote the high byte");
  assert.equal(a.mem8[PITCH], 0x77, "positive control: idle path staged a pitch");
  console.log("  EQUAL: loc_184f == oracle (idle) — nothing written");
});

test("EQUAL (crafted): loc_184f == oracle resets the word when bit0 is set", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, resetEntry()), null, "loc_184f diverged on the reset path");
  const a = afterOracle(resetEntry());
  assert.equal(a.mem8[LOW], 0, "positive control: low byte not reset to 0");
  assert.equal(a.mem8[HIGH], 128, "positive control: high byte not reset to 128");
  console.log("  EQUAL: loc_184f == oracle (reset) — word -> low 0 / high 128");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongHigh = (m) => { cand(m); m.mem8[HIGH] = 0; };
  const noReset = (m) => { cand(m); m.mem8[LOW] = 0x03; };
  const wrongResetHigh = (m) => { cand(m); m.mem8[HIGH] = 0; };
  assert.ok(ramDiff(oracle, noOp, delegateEntry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongHigh, delegateEntry()), "the wrong-high twin escaped");
  assert.ok(ramDiff(oracle, noReset, resetEntry()), "the no-reset twin escaped");
  assert.ok(ramDiff(oracle, wrongResetHigh, resetEntry()), "the wrong-reset-high twin escaped");
  console.log("  TEETH: no-op, wrong-high, no-reset, wrong-reset-high all caught");
});
