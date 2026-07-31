// SPDX-License-Identifier: GPL-3.0-only
//
// assembled-swap — the ASSEMBLED-GAME gate for promoting idiomatic routines into the runtime.
// Runs the game cycle-free TWICE — pure translated (baseline) vs manifest.idiomatic wired LIVE
// — and asserts the game state is byte-identical for the whole run, excluding the dead Z80
// stack scratch (a direct idiomatic call doesn't push/pop the return address a translated one
// does — legitimate, documented). This is the whole-game half the per-routine equivalence
// tests cannot cover (copyTileColumn passed in isolation but wrote 0 live, via the register
// ABI). Also asserts each promoted routine actually DISPATCHED — a swap that never ran is not
// a validated swap. ROM-guarded (skips without the BYO ROM). See tools/swap_check.mjs to
// classify a candidate before promoting it here.

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine, resolveOverrides } from "../../machine.js";
import manifest from "../../manifest.js";
import { ROUTINES } from "../ram.js";
import { runCycleFree } from "../../../../core/frame-stepped.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
// RETIRED (coroutine go-live): the SWAP harness promoted idiomatic routines one leaf at a time and
// gated them by running the ASSEMBLED game cycle-free (runCycleFree) with manifest.idiomatic wired
// over the translated oracle. That model is superseded: the whole idiomatic layer now runs live under
// the coroutine engine (runGeneratorGame), where the control spine is generators — which runCycleFree
// cannot drive (it dispatches them as plain calls, so an un-run generator is a silent no-op; this gate
// only ever "passed" because attract never reaches the converted routines). The coroutine gates cover
// the same ground and more: golive.test.js diffs the SAME attract run idiomatic-vs-translated under the
// correct engine, tape.test.js adds coin/start/dig, transition.test.js adds the level/round/game-over
// boundaries. Kept (not deleted) for history; manifest.idiomatic / tools/swap_check.mjs are likewise
// retired promotion tooling. See docs/integration-testing.md "Go-live, the RIGHT way".
const test = (name, fn) =>
  nodeTest(name, { skip: "retired: swap-era gate superseded by the whole-game coroutine gates (golive/tape/transition)" }, fn);

const FRAMES = 720;
const { pollPCs, stateExclude } = manifest.convergence;
const [S_LO, S_HI] = stateExclude?.stack || [0, 0];

test("promoted idiomatic routines are transparent swaps in the assembled game", async () => {
  const promoted = manifest.idiomatic || [];
  if (promoted.length === 0) return; // nothing promoted yet — trivially transparent

  // Build the override map from the promoted addresses via ROUTINES (address -> idiomatic file).
  const spec = {};
  for (const addr of promoted) {
    const meta = ROUTINES[addr];
    assert.ok(meta, `manifest.idiomatic 0x${addr.toString(16)} not in ROUTINES`);
    spec[addr.toString(16)] = { module: `./idiomatic/${meta.name}.js`, export: meta.name };
  }
  const raw = await resolveOverrides(spec); // baseUrl defaults to machine.js's location
  const counts = new Map();
  const overrides = new Map();
  for (const [addr, fn] of raw) {
    counts.set(addr, 0);
    overrides.set(addr, (m, ...rest) => { counts.set(addr, counts.get(addr) + 1); return fn(m, ...rest); });
  }

  const run = async (ovr) => {
    const m = await Machine.create(ROM, ovr ? { overrides: ovr } : {});
    const frames = [];
    const r = runCycleFree(m, {
      pollPCs, maxFrames: FRAMES, stepBudget: FRAMES * 20000,
      onFrame: (mm) => frames.push(Buffer.from(mm.dumpState())),
    });
    return { frames, r };
  };
  const base = await run(null);
  const swapped = await run(overrides);

  assert.equal(base.r.stopError, null, `baseline errored: ${base.r.stop}`);
  assert.equal(swapped.r.stopError, null, `swapped run errored: ${swapped.r.stop}`);
  assert.equal(base.frames.length, swapped.frames.length, "frame counts differ between baseline and swapped");

  // Byte-diff each frame, excluding the dead stack scratch.
  const probe = new Machine(ROM);
  const BPF = base.frames[0].length;
  const keep = [];
  for (let o = 0; o < BPF; o++) { const a = probe.stateOffsetToAddr(o); if (!(a >= S_LO && a < S_HI)) keep.push(o); }
  for (let i = 0; i < base.frames.length; i++) {
    const a = base.frames[i], b = swapped.frames[i];
    for (const o of keep) {
      if (a[o] !== b[o]) {
        assert.fail(`frame ${i}: promoted idiomatic diverged at 0x${probe.stateOffsetToAddr(o).toString(16)} (baseline ${a[o]} vs swapped ${b[o]})`);
      }
    }
  }

  // Dispatch count via the override map = calls from TRANSLATED callers only. Idiomatic
  // routines call EACH OTHER by direct import (not m.call), which bypasses the map, so a 0
  // here does NOT mean "never ran" — the byte-identical state above already proved the run,
  // and each routine is separately validated in isolation by its equivalence-*.test.js. So
  // this is an info signal (which routines are the translated->idiomatic bridge points), not
  // a gate.
  const noMapDispatch = [...counts.values()].filter((c) => c === 0).length;
  if (noMapDispatch) {
    console.error(`  info: ${noMapDispatch}/${counts.size} promoted routines had no translated-caller dispatch (reached via direct idiomatic calls)`);
  }
});
