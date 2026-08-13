// SPDX-License-Identifier: GPL-3.0-only
//
// idiomatic — the WHOLE-GAME idiomatic gate. Wires EVERY idiomatic routine live and runs the
// assembled game under the cycle-free go-live engine (core/frame-stepped.js runWatchdogGame,
// which fires the vblank NMI on the once-per-frame watchdog kick since the idiomatic poll
// routines never call m.step). It then asserts the idiomatic game is byte-identical to the pure
// translated game across the whole run, over the used game-state region [0x8000, gameStateHi]
// (minus the cycle-proxy cells that hold a bounded frame-phase offset). This is the capstone the
// per-routine equivalence tests and the swap gate build toward: not "each routine matches in
// isolation" but "all 169 routines run together AS the game and reproduce the translated oracle"
// (which is itself pixel-validated vs MAME 0.288).
//
// Above gameStateHi is the Z80 stack + unused work RAM; it is not compared (a direct idiomatic
// call leaves different dead scratch there than a translated call/ret — documented, benign). The
// run also reaches the attract demo (GAME_STATE == 4), proving boot -> setup -> demo all work
// idiomatic. ROM-guarded (skips without the BYO ROM).

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine, resolveOverrides } from "../../machine.js";
import manifest from "../../manifest.js";
import { ROUTINES, GAME_STATE } from "../names.js";
import { runCycleFree, runIdiomaticGame } from "../../../../core/frame-stepped.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const FRAMES = 700; // enough to boot, run attract setup, and enter the playable demo
const { pollPCs, stateExclude, idiomatic } = manifest.convergence;
const { nmiReturnPC, gameStateHi } = idiomatic;

test("the whole idiomatic game reproduces the translated oracle (all 169 routines live)", async () => {
  // Wire EVERY idiomatic routine that has a file.
  const spec = {};
  for (const [addr, meta] of Object.entries(ROUTINES)) {
    const file = new URL(`../${meta.name}.js`, import.meta.url);
    if (existsSync(file)) spec[Number(addr).toString(16)] = { module: `./idiomatic/${meta.name}.js`, export: meta.name };
  }
  const overrides = await resolveOverrides(spec);

  // Idiomatic run (all routines live) via the watchdog-kick go-live engine.
  const mi = await Machine.create(ROM, { overrides });
  const idi = [];
  const ri = runIdiomaticGame(mi, { nmiReturnPC, maxFrames: FRAMES, onFrame: (m) => idi.push(Buffer.from(m.dumpState())) });
  assert.equal(ri.stopError, null, `idiomatic run errored: ${ri.stop}`);
  assert.ok(ri.frames >= FRAMES, `idiomatic run covered only ${ri.frames}/${FRAMES} frames (${ri.stop})`);

  // Translated baseline via the poll-PC frame-stepped engine.
  const mt = await Machine.create(ROM, {});
  const tr = [];
  const rt = runCycleFree(mt, { pollPCs, maxFrames: FRAMES, stepBudget: FRAMES * 20000, onFrame: (m) => tr.push(Buffer.from(m.dumpState())) });
  assert.equal(rt.stopError, null, `translated run errored: ${rt.stop}`);
  assert.equal(idi.length, tr.length, "frame counts differ between idiomatic and translated");

  // Compare the used game-state region [0x8000, gameStateHi], minus the cycle-proxy cells.
  const excl = new Set(stateExclude.cells || []);
  const probe = new Machine(ROM);
  const BPF = tr[0].length;
  const keep = [];
  for (let o = 0; o < BPF; o++) { const a = probe.stateOffsetToAddr(o); if (a >= 0x8000 && a <= gameStateHi && !excl.has(a)) keep.push(o); }
  assert.ok(keep.length > 0, "no game-state bytes selected to compare");

  for (let i = 0; i < idi.length; i++) {
    for (const o of keep) {
      if (idi[i][o] !== tr[i][o]) {
        assert.fail(`frame ${i}: idiomatic game diverged from translated at 0x${probe.stateOffsetToAddr(o).toString(16)} (idiomatic ${idi[i][o]} vs translated ${tr[i][o]})`);
      }
    }
  }

  // And it actually reaches the attract demo (boot -> setup -> demo all idiomatic).
  assert.equal(mi.mem.read8(GAME_STATE), 4, "idiomatic game did not reach the attract demo (GAME_STATE 4)");
});
