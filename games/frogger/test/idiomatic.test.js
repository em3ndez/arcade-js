// SPDX-License-Identifier: GPL-3.0-only
//
// Whole-machine gate for Frogger (modelled on games/timeplt/idiomatic/test/idiomatic.test.js): builds
// the real Machine from the assembled ROM, drives it from reset, and samples memory at each vblank NMI.
// The translated oracle now boots into the attract loop, so this PASSES when boot runs the full frame
// budget with no translation gap, and FAILS (naming the address) if a boot path reaches an un-translated
// routine. Still TODO (blocked on a MAME golden boot): the idiomatic-vs-oracle arm, the vs-MAME pixel
// arm, and manifest.convergence.idiomatic.{nmiReturnPC,pollPCs,stateExclude.stack}.
// LOCATION: at games/frogger/test/ (not idiomatic/test/) until the first idiomatic module is born — an
// empty games/frogger/idiomatic/ would trip the layer-discovery wiring lints (no-stale-mcall).

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine, CYCLES_PER_FRAME, FramesComplete } from "../machine.js";

const ROM_PATH = new URL("../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "ROM absent at games/frogger/rom/maincpu.bin (BYO)" }, fn);

// Run length compared over, in vblank-NMI ordinals (the clock a cycle-driven oracle and a frame-stepped
// idiomatic run agree on). Boot burns no frames on a yield clock, so align by ordinal, never frame index.
const NMIS = 600;

// Drive the oracle from reset, capturing a memory dump at every vblank NMI. Boot never returns: a clean
// full-budget run unwinds as FramesComplete (gap stays null); a missing dispatch throws NotImplemented,
// whose address becomes `gap`. Any other throw is a real JS/board bug and is left in `stop` to re-raise.
async function runOracle() {
  const m = await Machine.create(ROM, {});
  m.maxCycles = (NMIS + 500) * CYCLES_PER_FRAME;
  const states = new Map();
  const realFire = m.fireNmi.bind(m);
  m.fireNmi = function () {
    if (m.nmiCount <= NMIS) states.set(m.nmiCount, Buffer.from(m.mem.dumpState()));
    return realFire();
  };
  let stop = null;
  let gap = null;
  try {
    m.reset();
  } catch (e) {
    if (!(e instanceof FramesComplete)) {
      stop = e;
      const match = /0x([0-9a-f]{4})/.exec(e.message || "");
      if (e.name === "NotImplemented" && match) gap = parseInt(match[1], 16);
    }
  }
  return { m, states, stop, gap };
}

test("the whole machine boots and runs a full frame budget (no translation gap)", async () => {
  const oracle = await runOracle();

  // Anything other than a translation gap or the clean budget unwind is a real bug — surface it as-is.
  if (oracle.stop && oracle.stop.name !== "NotImplemented") throw oracle.stop;

  assert.equal(
    oracle.gap,
    null,
    `boot reached un-translated routine 0x${(oracle.gap ?? 0).toString(16).padStart(4, "0")}: register ` +
      `it (Step 3). ${oracle.states.size} of ${NMIS} interrupts produced before the gap.`,
  );
  assert.ok(
    oracle.states.size > NMIS - 2,
    `boot produced only ${oracle.states.size} of ${NMIS} interrupts; it stopped on ${oracle.stop}`,
  );
});
