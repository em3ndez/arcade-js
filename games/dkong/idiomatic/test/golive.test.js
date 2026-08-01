// SPDX-License-Identifier: GPL-3.0-only
//
// golive — the whole-game Donkey Kong coroutine go-live gate. It runs the assembled game with the
// idiomatic control SPINE (the boot generator, which delegates into the mainLoop generator with
// yield*) plus whatever leaves have been made idiomatic and DIRECT-called from it, wired live under
// the cycle-free coroutine engine (core/frame-stepped.js runGeneratorGame), and asserts it
// reproduces the pure-translated oracle over the whole dumped state — work RAM 0x6000-0x6BFF, sprite
// RAM 0x7000-0x73FF, video RAM 0x7400-0x77FF (the rendered output) — under the MEMORY-EQUIVALENCE
// contract: byte-for-byte on every LIVE cell, excluding only the dead stack scratch (a direct-called
// idiomatic leaf drops the oracle's push16/ret bracket, so the transient bytes below SP are never
// written; SP stays at/above the scratch floor and nothing reads them). The translated oracle runs
// under runCycleFree with the SAME frame boundary — the vblank wait at 0x02BD — so both runs cross
// vblank at the same logical point and reproduce each other.
//
// This is the go-live capstone: not "each idiomatic routine matches in isolation" (the
// equivalence-*.test.js gates) but "the idiomatic spine + its idiomatic callees drive the assembled
// game and reproduce the oracle". The idiomatic base grows under this gate (each newly-idiomatic
// leaf is dissolved to a direct call in its caller and must keep it green). ROM-guarded (skips
// without the BYO ROM).
//
// COVERAGE SCOPE: this exercises the 600-frame ATTRACT sequence, whose task handlers all ret
// promptly to 0x02BD (600 yields = 600 frames). It does NOT yet cover gameplay, where a handler
// could itself wait for vblank and would need its own yield. Before wiring gameplay leaves under
// this gate, add a gameplay input-tape run (see manifest.convergence). The three main-loop paths
// ARE all hit by attract (dispatch, fZ-spin once, new-frame).

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine, resolveOverrides } from "../../machine.js";
import manifest from "../../manifest.js";
import { installEntropyPin } from "../../../../core/entropy-pin.js";
import { runGeneratorGame, runCycleFree } from "../../../../core/frame-stepped.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const FRAMES = 600; // enough to boot and run the attract sequence
const { pollPCs, stateExclude, golive } = manifest.convergence;
const { nmiReturnPC } = golive;
const [STACK_LO, STACK_HI] = stateExclude.stack; // dead stack scratch, excluded (memory-equivalence)

test("the idiomatic spine reproduces the translated oracle (coroutine go-live)", async () => {
  // Wire the idiomatic control spine live: the boot generator (0x0000) is the entry; it delegates
  // into the mainLoop generator with `yield*` (idiomatic/boot.js imports it directly), so mainLoop
  // needs no registry override — an override at 0x02BD would be inert here, and m.call of a
  // generator returns an undriven generator (a silent no-op), so it is deliberately NOT registered.
  // The vblank NMI and every leaf routine stay translated for now — the base expands under this gate.
  const overrides = await resolveOverrides({
    "0": { module: "./idiomatic/boot.js", export: "boot" },
  });

  // Idiomatic run under the coroutine engine. Pin the spin-counter RNG (both runs) so the cycle-free
  // and poll-PC engines agree on the RNG — with the pin, every LIVE cell (incl. the 0x6019 counter)
  // reproduces byte-for-byte; only the dead stack scratch is excluded (see the comparison below).
  const mi = new Machine(ROM, { overrides });
  installEntropyPin(mi, manifest.entropyPin);
  const idi = [];
  const ri = runGeneratorGame(mi, {
    bootAddr: 0x0000,
    nmiReturnPC,
    maxFrames: FRAMES,
    onFrame: (m) => idi.push(Buffer.from(m.dumpState())),
  });
  assert.equal(ri.stopError, null, `idiomatic run errored: ${ri.stop}`);
  assert.ok(ri.frames >= FRAMES, `idiomatic run covered only ${ri.frames}/${FRAMES} frames (${ri.stop})`);

  // Translated oracle: same game, NMI fired at the same 0x02BD vblank wait (runCycleFree).
  const mt = new Machine(ROM, {});
  installEntropyPin(mt, manifest.entropyPin);
  const tr = [];
  const rt = runCycleFree(mt, {
    pollPCs,
    maxFrames: FRAMES,
    stepBudget: FRAMES * 200000,
    onFrame: (m) => tr.push(Buffer.from(m.dumpState())),
  });
  assert.equal(rt.stopError, null, `translated run errored: ${rt.stop}`);
  assert.equal(idi.length, tr.length, "frame counts differ between idiomatic and translated");

  // Compare the whole dumped state — work RAM 0x6000-0x6BFF, sprite RAM 0x7000-0x73FF, video RAM
  // 0x7400-0x77FF (incl. the rendered sprite/video output) — EXCEPT the dead stack scratch
  // [STACK_LO, STACK_HI). This is the memory-equivalence contract (manifest.convergence.stateExclude):
  // idiomatic leaves are DIRECT-called, so the oracle's transient push16/ret bytes below SP are never
  // written — dead, never read as data — while every LIVE cell must still match byte-for-byte.
  const probe = new Machine(ROM, {});
  const BPF = tr[0].length;
  const keep = [];
  for (let o = 0; o < BPF; o++) {
    const a = probe.stateOffsetToAddr(o);
    if (!(a >= STACK_LO && a < STACK_HI)) keep.push(o);
  }
  assert.ok(keep.length > 0, "no live-state bytes selected to compare");

  for (let i = 0; i < idi.length; i++) {
    for (const o of keep) {
      if (idi[i][o] !== tr[i][o]) {
        assert.fail(
          `frame ${i}: idiomatic spine diverged from translated at 0x${probe
            .stateOffsetToAddr(o)
            .toString(16)} (idiomatic ${idi[i][o]} vs translated ${tr[i][o]})`,
        );
      }
    }
  }
});
