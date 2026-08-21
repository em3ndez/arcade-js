// SPDX-License-Identifier: GPL-3.0-only
//
// idiomatic — pooyan's born-live spine gate. Runs the assembled game under the cycle-free coroutine
// engine (core/frame-stepped.js runIdiomaticGame, wired via resolveAllIdiomatic — the same override
// map web/worker.js ships) and compares it, frame for frame, against the pure-translated oracle run
// under runCycleFree at the SAME frame boundary (the main-loop top 0x020f, manifest.convergence).
// Both engines collapse pooyan's free-running main loop to one iteration per frame, so they execute
// the identical sequence and must agree on every LIVE cell — only the dead stack scratch is excluded.
// ROM-guarded (skips without the BYO ROM).
//
// SCOPE, stated exactly so it is not overstated: this proves the idiomatic control SPINE (the mainLoop
// generator) drives the assembled game and reproduces the oracle over attract. The leaf routines are
// NOT wired here (idiomatic/names.js ROUTINES holds only mainLoop), so it exercises the spine, not the
// translated->idiomatic leaf seam — that is a later unit, once the leaves are wired.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runIdiomaticGame, runCycleFree } from "../../../../core/frame-stepped.js";
import { Machine, resolveAllIdiomatic } from "../../machine.js";
import manifest from "../../manifest.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROM_PATH = join(HERE, "..", "..", "rom", "maincpu.bin");
const HAVE_ROM = existsSync(ROM_PATH);
const ROM = HAVE_ROM ? new Uint8Array(readFileSync(ROM_PATH)) : null;

const FRAMES = 900;
const { pollPCs, stateExclude, idiomatic } = manifest.convergence;
const { nmiReturnPC } = idiomatic;
const [STACK_LO, STACK_HI] = stateExclude.stack; // dead stack scratch, excluded (memory-equivalence)
const hex = (v) => `0x${(v & 0xffff).toString(16).padStart(4, "0")}`;

/** Byte offsets of the LIVE state cells — everything outside the dead stack scratch. */
function liveOffsets(bytesPerFrame, probe) {
  const keep = [];
  for (let o = 0; o < bytesPerFrame; o++) {
    const a = probe.stateOffsetToAddr(o);
    if (!(a >= STACK_LO && a < STACK_HI)) keep.push(o);
  }
  return keep;
}

test("the born-live spine reproduces the translated oracle over attract", { skip: !HAVE_ROM }, async () => {
  // Wire the spine live exactly as the worker does. resolveAllIdiomatic() reads idiomatic/names.js
  // ROUTINES (mainLoop at the main-loop top); machine.call(0x0000) then runs the frozen translated
  // boot, whose tail call into the main loop returns the mainLoop GENERATOR (generators pass the seam
  // unwrapped), which runIdiomaticGame drives frame by frame.
  const overrides = await resolveAllIdiomatic();
  assert.ok(overrides.has(0x020f), "mainLoop must be wired at the main-loop entry");

  const mi = new Machine(ROM, { overrides });
  const idi = [];
  const ri = runIdiomaticGame(mi, {
    bootAddr: 0x0000,
    nmiReturnPC,
    maxFrames: FRAMES,
    onFrame: (m, f) => { if (f !== 0) idi.push(Buffer.from(m.dumpState())); },
  });
  assert.equal(ri.stopError, null, `idiomatic run errored: ${ri.stop}`);
  assert.ok(ri.frames >= FRAMES, `idiomatic run covered only ${ri.frames}/${FRAMES} frames (${ri.stop})`);

  // The pure-translated oracle under runCycleFree, sampled at the same main-loop top.
  const mt = new Machine(ROM, {});
  const tr = [];
  const rt = runCycleFree(mt, {
    pollPCs, maxFrames: FRAMES, stepBudget: FRAMES * 200000,
    onFrame: (m, f) => { if (f !== 0) tr.push(Buffer.from(m.dumpState())); },
  });
  assert.equal(rt.stopError, null, `translated oracle run errored: ${rt.stop}`);
  assert.equal(idi.length, tr.length, "frame counts differ between idiomatic spine and translated oracle");

  // Compare the whole dumped state EXCEPT the dead stack scratch [STACK_LO, STACK_HI). Both engines run
  // the identical collapsed sequence, so every live cell (including the RNG working set) must match
  // byte-for-byte with no entropy pin.
  const keep = liveOffsets(tr[0].length, mt);
  assert.ok(keep.length > 0, "no live-state bytes selected to compare");
  for (let i = 0; i < idi.length; i++) {
    for (const o of keep) {
      if (idi[i][o] !== tr[i][o]) {
        assert.fail(
          `frame ${i}: spine diverged from oracle at ${hex(mt.stateOffsetToAddr(o))} ` +
            `(spine ${idi[i][o]} vs oracle ${tr[i][o]})`,
        );
      }
    }
  }
});
