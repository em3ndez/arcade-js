// SPDX-License-Identifier: GPL-3.0-only
//
// Smoke test for the CYCLE-FREE (frame-stepped) engine mode — core/frame-stepped.js —
// exercised on The Pit. It must drive the game from reset with NO T-state clock, produce
// one frame per vblank-poll yield, and reach the attract demo (GAME_STATE 0x8001 -> 4) —
// the RNG-INDEPENDENT milestone MAME also hits at ~f691 (this engine at f671; see the
// convergence runbook in docs/decompiler-pipeline.md). This is the gated backstop that the
// scratch model-b rig never had. ROM-guarded: skips when the BYO ROM is absent (CI).

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine } from "../../machine.js";
import manifest from "../../manifest.js";
import { installEntropyPin } from "../../../../core/entropy-pin.js";
import { runCycleFree } from "../../../../core/frame-stepped.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

test("cycle-free engine drives The Pit to the demo without a T-state clock", async () => {
  const m = await Machine.create(ROM);
  installEntropyPin(m, manifest.entropyPin); // pin RNG so the run is deterministic

  // Log GAME_STATE (0x8001) writes with the frame they happen in.
  let frame = 0;
  const gameStateWrites = [];
  const origWrite = m.mem.write8.bind(m.mem);
  m.mem.write8 = (addr, val) => {
    if (addr === 0x8001) gameStateWrites.push([frame, val]);
    origWrite(addr, val);
  };

  const r = runCycleFree(m, {
    pollPCs: manifest.convergence.pollPCs,
    maxFrames: 720,
    onFrame: (_machine, f) => { frame = f; },
  });

  // It ran the whole budget without hanging or a boot gap.
  assert.equal(r.stopError, null, `unexpected error: ${r.stop}`);
  assert.equal(r.stop, "reached maxFrames", `expected a clean 720-frame run, got stop=${r.stop}`);
  assert.equal(r.frames, 720, `expected 720 frame boundaries, got ${r.frames}`);

  // It reached the attract demo — the frame-stepped engine actually advanced game logic.
  const demoEntry = gameStateWrites.find(([, v]) => v === 4);
  assert.ok(demoEntry, `GAME_STATE never reached the demo (0x8001<-4); writes: ${JSON.stringify(gameStateWrites)}`);
  assert.ok(
    demoEntry[0] >= 650 && demoEntry[0] <= 700,
    `demo entry at frame ${demoEntry[0]}, expected ~671 (RNG-independent loc_3a6f delay)`,
  );
});
