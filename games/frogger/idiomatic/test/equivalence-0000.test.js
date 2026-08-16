// SPDX-License-Identifier: GPL-3.0-only
/**
 * seatStackAndEnterColdBoot — memory-equivalent to the frozen oracle at ROM 0x0000 (the reset vector).
 * GATE: crafted-entry. The vector kicks the watchdog, seats SP at 0x8800, and tail-calls the cold-boot
 * init 0x02a3 (kept as a call; the main-loop sink 0x0341 it reaches is severed here). It writes no RAM of
 * its own, so the compared state is the cold-boot init's work reached through the tail. A post-attract
 * seed is cloned with a probe cell poked; RAM is compared (stack masked). Teeth: a no-op (never enters
 * the init) and a twin that leaves a work-RAM cell set. Positive control: a seeded cell 0x77->0 via boot.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, STUBS } from "./_bootSetup.js";
import { seatStackAndEnterColdBoot as cand } from "../seatStackAndEnterColdBoot.js";
import { loc_0000 as oracle } from "../../translated/loc_0000.js";
import { withOmittedRet } from "../../machine.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const PROBE = 0x8123;

const seeded = () => craft((mem) => { mem[PROBE] = 0x77; });

test("EQUAL (crafted): seatStackAndEnterColdBoot == oracle through the tail into cold boot", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, seeded()), null, "the reset->cold-boot chain diverged");
  const e = seeded(); const a = e.clone(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[PROBE], 0, "positive control: cold boot reached through the tail cleared 0x77->0");
  console.log("  EQUAL: reset vector -> cold boot; probe 0x77->0 via the tail");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const leaveCell = (m) => { cand(m); m.mem8[PROBE] = 0xff; };
  assert.ok(ramDiff(oracle, noOp, seeded()), "no-op twin escaped (never entered cold boot)");
  assert.ok(ramDiff(oracle, leaveCell, seeded()), "leave-cell twin escaped");
  console.log("  TEETH: no-op, leave-cell both caught");
});

test("SEAM: wireable — the tail hands back the driver coroutine, SP not blocked", { skip }, () => {
  const r = withOmittedRet(cand, 0x0000)(seeded());
  assert.ok(r && typeof r.next === "function" && typeof r.throw === "function",
    "the seam must pass the main-loop coroutine handoff through as an iterator");
  console.log("  SEAM: iterator handoff -> wireable");
});
