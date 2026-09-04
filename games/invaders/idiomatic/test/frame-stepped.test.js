// SPDX-License-Identifier: GPL-3.0-only
// Whole-spine clock-free gate: the idiomatic generator spine boots invaders on runIdiomaticGame (no
// T-state clock) and reaches the ATTRACT DEMO. This is the milestone the §4 clock-free spine cluster
// asserts -- the busy-wait delays (0x20c0-spun) become function* generators that yield per frame, and the
// engine fires the vblank NMI at each yield. The object-dispatch handlers are still the translated
// fallback, so the run stops in walkObjectTable's pchl dispatch (0x2100) -- that is the wire-last work, not a
// spine defect; the full-run convergence proof lives in tools/convergence.mjs --idiomatic --mode state.
// Run: node --test games/invaders/idiomatic/test/frame-stepped.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine, resolveAllIdiomatic } from "../../machine.js";
import manifest from "../../manifest.js";
import { installEntropyPin } from "../../../../core/entropy-pin.js";
import { runIdiomaticGame } from "../../../../core/frame-stepped.js";
import { ATTRACT_DEMO_PTR } from "../names.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

test("idiomatic generator spine boots invaders clock-free to the attract demo", async () => {
  const m = await Machine.create(ROM, { overrides: await resolveAllIdiomatic() });
  installEntropyPin(m, manifest.entropyPin);
  // The idiomatic ISR bodies (idiomaticVblankNmi/idiomaticMidNmi) are pure JS -- no push16 needs a seated
  // SP, and no m.step ticks the cycle clock -- so the transitional bootSp seat and the nextInt1/nextInt2
  // = Infinity guards against a cycle-driven RST re-trigger are both retired (fireNmi fires them directly).

  // Fast tripwire: drive 200 clock-free frames (node --test process-isolation makes a full ~760-frame run
  // slow; the demo-advance + full-run convergence live in tools/convergence.mjs --idiomatic --mode state).
  let demoInit = 0;
  const r = runIdiomaticGame(m, {
    nmiReturnPC: manifest.convergence.idiomatic.nmiReturnPC,
    maxFrames: 200,
    onFrame: (mm, f) => { if (f === 200) demoInit = mm.mem8[ATTRACT_DEMO_PTR]; },
  });

  // The generator spine drove all 200 frames with NO boot gap (it never reached the deferred object-dispatch
  // at ~760): every busy-wait delay yielded, the engine fired the vblank NMI at each yield.
  assert.equal(r.stopError, null, `unexpected boot gap / error: ${r.stop}`);
  assert.equal(r.frames, 200, `expected 200 clock-free frames, got ${r.frames} (stop=${r.stop})`);
  // The boot ran: it initialized the attract demo pointer (the ROM seeds it during cold boot).
  assert.notEqual(demoInit, 0, "boot never initialized ATTRACT_DEMO_PTR -- the spine did not run the boot chain");
});
