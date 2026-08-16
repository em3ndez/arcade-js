// SPDX-License-Identifier: GPL-3.0-only
/**
 * initColdBootAndEnterMainLoop — memory-equivalent to the frozen oracle at ROM 0x02a3.
 * GATE: crafted-entry. The cold-boot init clears work RAM + OBJRAM, seeds lives/cabinet/coinage from the
 * DSW reads, copies two ROM boot blocks, settles, programs the PPIs, primes the sound port, and tail-hands
 * to the main loop 0x0341 (severed here). A post-attract seed is cloned with SP seated at 0x8800 and a
 * probe cell poked; both sides run and RAM is compared (stack masked). Teeth: no-op, a twin that skips the
 * OBJRAM control write, a twin that leaves a work-RAM cell set. Positive control: a seeded cell 0x77->0.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, STUBS } from "./_bootSetup.js";
import { initColdBootAndEnterMainLoop as cand } from "../initColdBootAndEnterMainLoop.js";
import { loc_02a3 as oracle } from "../../translated/loc_02a3.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const PROBE = 0x8123, SOUND_SHADOW = 0x83d9, OBJRAM_HI = 0xb003;

const seeded = () => craft((mem) => { mem[PROBE] = 0x77; });

test("EQUAL (crafted): initColdBootAndEnterMainLoop == oracle over the cold-boot init", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, seeded()), null, "the cold-boot init diverged");
  const e = seeded(); const a = e.clone(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[PROBE], 0, "positive control: the work-RAM clear must zero the seeded cell 0x77->0");
  assert.equal(a.mem8[SOUND_SHADOW], 0x08, "sound-control shadow must settle to 0x08 (0x18 & 0xef)");
  assert.equal(a.mem8[OBJRAM_HI], 0x06, "OBJRAM control byte must be seeded to 6");
  console.log("  EQUAL: cold-boot init; probe 0x77->0, sound shadow ->0x08, OBJRAM ctrl ->6");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const skipObjram = (m) => { cand(m); m.mem8[OBJRAM_HI] = 0; };
  const leaveCell = (m) => { cand(m); m.mem8[PROBE] = 0xff; };
  assert.ok(ramDiff(oracle, noOp, seeded()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, skipObjram, seeded()), "skip-objram twin escaped");
  assert.ok(ramDiff(oracle, leaveCell, seeded()), "leave-cell twin escaped");
  console.log("  TEETH: no-op, skip-objram, leave-cell all caught");
});
