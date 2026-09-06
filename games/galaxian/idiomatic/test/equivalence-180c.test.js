// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_180c — memory-equivalent to the frozen oracle at ROM 0x180c (dissolves its fall-through into the
 * pitch-staging routine into a direct idiomatic call). It recomputes a pitch from the sound counter cell
 * (0x41c4): odd selector -> bias by 96 and rotate the biased sum right (carry into bit 7); even selector
 * -> pass through. The staged value lands in SOUND_PITCH (0x41c1), a work-RAM shadow in the state dump, so
 * EQUAL is asserted on ramDiff over both selector parities. Teeth: a no-op, a pass-through twin (which
 * skips the odd-path transform), and a wrong-value twin. The return-stack window is masked by ramDiff.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { stagePitchFromSoundCounter as cand } from "../stagePitchFromSoundCounter.js";
import { loc_180c as oracle } from "../../translated/loc_180c.js";

const COUNTER = 0x41c4;
const PITCH = 0x41c1; // SOUND_PITCH shadow (work RAM, in the state dump)
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const odd = () => craft((mem, m) => { m.push16(0x9999); m.regs.a = 0x01; mem[COUNTER] = 0xf0; mem[PITCH] = 0x00; });
const even = () => craft((mem, m) => { m.push16(0x9999); m.regs.a = 0x00; mem[COUNTER] = 0xf0; mem[PITCH] = 0x00; });

test("EQUAL (crafted): loc_180c == oracle stages the pitch on both selector parities", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, odd()), null, "loc_180c diverged on the odd selector");
  assert.equal(ramDiff(oracle, cand, even()), null, "loc_180c diverged on the even selector");
  // positive control: odd path biases 0xf0 by 96 (=0x150), keeps 0x50, rotates right with carry -> 0xa8;
  // even path stages the counter (0xf0) unchanged.
  const a = odd(); oracle(a);
  assert.equal(a.mem8[PITCH], 0xa8, "positive control: odd selector staged the transformed pitch");
  const b = even(); oracle(b);
  assert.equal(b.mem8[PITCH], 0xf0, "positive control: even selector staged the counter unchanged");
  console.log("  EQUAL: loc_180c == oracle (RAM), odd 0xf0->0xa8, even 0xf0->0xf0");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const passThrough = (m) => { m.mem8[PITCH] = m.mem8[COUNTER]; }; // skips the odd-path transform
  const wrongValue = (m) => { m.mem8[PITCH] = 0x01; };
  assert.ok(ramDiff(oracle, noOp, odd()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, passThrough, odd()), "the pass-through twin escaped on the odd path");
  assert.ok(ramDiff(oracle, wrongValue, odd()), "the wrong-value twin escaped");
  console.log("  TEETH: no-op, pass-through, wrong-value all caught");
});
