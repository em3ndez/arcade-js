#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
/**
 * Donkey Kong RENDER emitter — the JS side of the IDIOMATIC pixel gate (tools/pixel_suite.py).
 * Writes frames.rgb in the same wire format as the MAME golden and the other games: 256x224
 * RGB888, row-major, top-left origin, unrotated, headerless, 172032 bytes/frame, plus a
 * frames.json index. `--help`-less; the flags it consumes are listed below.
 *
 * TWO PATHS, ONE FRAME CONTRACT:
 *   • DEFAULT (oracle): the frozen translated layer on the CYCLE-DRIVEN engine — exactly what
 *     tools/emit.js captures (runFrames + captureVideo, the raster/beam painter). Frame N is
 *     painted DURING frame N and MAME's AVI lags one, so framediff freezes the +1 (FROZEN_OFFSET).
 *   • --idiomatic: the IDIOMATIC layer (resolveAllIdiomatic) on the COROUTINE engine
 *     (runIdiomaticGame), THE ENGINE THAT SHIPS (web/worker.js). It swaps the CLOCK as well as
 *     the routine map: there is no T-state clock, frames advance on the vblank YIELD, and the
 *     picture is rendered ON DEMAND with machine.renderFrame() (a whole-frame snapshot with the
 *     sprite post-pass — the shipped runtime's exact render call), not scanline-composited.
 *
 * ★ THE TWO SIDES SHARE NO FRAME ORIGIN. On the coroutine engine boot burns NO frames (it is a
 * generator that yields at the first vblank wait); in MAME the RAM-clear boot spends ~4 emulated
 * frames before that same wait. The tape origin is that gap: the input tape rides the GOLDEN's
 * frame numbering and applyInputs is called at (idiomaticFrame + tapeOrigin), or the two coin on
 * different game frames. pixel_suite.py measures and pins the value (--tape-origin).
 *
 * A run that stops early writes what it painted, says why, and exits NONZERO: a short artifact
 * must never read as a clean one.
 */

import { createHash } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Machine, CYCLES_PER_FRAME, resolveAllIdiomatic } from "../machine.js";
import { installEntropyPin } from "../../../core/entropy-pin.js";
import { runIdiomaticGame } from "../../../core/frame-stepped.js";
import { Inputs } from "../../../boards/dkong/io.js";
import manifest from "../manifest.js";
import { parseEmitArgs, hex4 } from "../../../tools/emit-core.js";

const GAME_DIR = dirname(dirname(fileURLToPath(import.meta.url))); // games/dkong
const BYTES_PER_FRAME = 256 * 224 * 3; // 172032, the frame contract

const ROM_SIZES = { gfx1: 0x1000, gfx2: 0x2000, proms: 0x0300 };

function loadRegion(name, path) {
  const buf = new Uint8Array(readFileSync(path));
  if (buf.length !== ROM_SIZES[name]) {
    throw new Error(
      `${name}: ${path} is ${buf.length} bytes, expected ${ROM_SIZES[name]} — ` +
        "a wrong or partial region renders a plausible, wrong image rather than failing",
    );
  }
  return buf;
}

async function main() {
  const args = parseEmitArgs(process.argv, {
    defaults: {
      rom: join(GAME_DIR, "rom", "maincpu.bin"),
      gfx1: join(GAME_DIR, "rom", "gfx1.bin"),
      gfx2: join(GAME_DIR, "rom", "gfx2.bin"),
      proms: join(GAME_DIR, "rom", "proms.bin"),
      frames: 1092,
      framesOut: join(GAME_DIR, "out", "render"),
      idiomatic: false,
      tapeOrigin: 0,
      pinEntropy: false,
    },
    extra: (flag, next, a) => {
      switch (flag) {
        case "--gfx1": a.gfx1 = next(); return true;
        case "--gfx2": a.gfx2 = next(); return true;
        case "--proms": a.proms = next(); return true;
        case "--frames-out": a.framesOut = next(); return true;
        case "--idiomatic": a.idiomatic = true; return true;
        case "--tape-origin": a.tapeOrigin = Number(next()); return true;
        case "--pin-entropy": a.pinEntropy = true; return true;
        default: return false;
      }
    },
  });
  if (!Number.isInteger(args.frames) || args.frames < 2) {
    throw new Error(`--frames expects an integer >= 2, got ${args.frames}`);
  }

  const gfx = {
    gfx1: loadRegion("gfx1", args.gfx1),
    gfx2: loadRegion("gfx2", args.gfx2),
    proms: loadRegion("proms", args.proms),
  };
  const romImage = new Uint8Array(readFileSync(args.rom));
  const overrides = args.idiomatic ? await resolveAllIdiomatic() : null;

  // Both paths build the SAME shape of Machine; --idiomatic layers the whole idiomatic map on
  // top (the seam is installed) and drives the coroutine engine below.
  const machine = new Machine(romImage, {
    inputs: new Inputs(),
    ...gfx,
    ...(overrides ? { overrides } : {}),
  });
  // TEST-ONLY entropy pin (mirrors tools/lua/pin_entropy.lua on the golden). The gate pins BOTH
  // sides so the spin-counter RNG cannot fork JS from MAME; never the shipped game.
  if (args.pinEntropy) installEntropyPin(machine, manifest.entropyPin);
  machine.inputTape = args.inputs.length ? args.inputs : null;
  machine.pokes = args.pokes.length ? args.pokes : null;

  mkdirSync(args.framesOut, { recursive: true });
  const rgbPath = join(args.framesOut, "frames.rgb");
  const fd = openSync(rgbPath, "w");
  const hashes = [];

  let states;
  if (args.idiomatic) {
    states = runGeneratorFrames(machine, args.frames, args.tapeOrigin, fd, hashes);
  } else {
    // Oracle/cycle-driven: identical capture to tools/emit.js (raster painter).
    machine.captureVideo = true;
    machine.onVideoFrame = null;
    machine.runFrames(args.frames);
    for (const f of machine.videoFrames) {
      writeSync(fd, Buffer.from(f), 0, f.length);
      hashes.push(createHash("sha256").update(Buffer.from(f)).digest("hex"));
    }
    states = machine.frames;
  }
  closeSync(fd);

  writeFileSync(
    join(args.framesOut, "frames.json"),
    JSON.stringify(
      {
        width: 256,
        height: 224,
        bytes_per_frame: BYTES_PER_FRAME,
        pixel_format: "RGB888",
        origin: "top-left",
        count: hashes.length,
        frames: hashes.map((h, i) => ({ i, sha256: h })),
      },
      null,
      1,
    ) + "\n",
  );

  const distinct = new Set(hashes).size;
  console.log(
    `wrote ${hashes.length} frame(s) x ${BYTES_PER_FRAME} bytes -> ${rgbPath}\n` +
      `  ${states.length} state frame(s); ${distinct} DISTINCT image(s) — the frame ` +
      "count is inflated by repetition, the distinct count is not",
  );
  if (machine.droppedFrames) {
    console.error(
      `\nDROPPED ${machine.droppedFrames} frame(s) with rows still unpainted: a tick ` +
        "ran longer than a frame. Do NOT diff it.",
    );
    return 1;
  }

  const err = machine.stoppedBy;
  if (err) {
    const gap = /no routine registered at (0x[0-9a-f]+)/.exec(String(err.message || err));
    if (gap) {
      console.error(
        `\nBOOT GAP: ${gap[1]} has no idiomatic/translated routine, reached after ` +
          `${states.length} state(s) / ${hashes.length} painted frame(s) ` +
          `(last known PC ${hex4(machine.pc)}).`,
      );
    } else {
      console.error(`\nSTOP after ${states.length} state(s): ${err.message || err}`);
    }
    return 1;
  }
  const clock = args.idiomatic
    ? "vblank yields"
    : `${(machine.cycles / CYCLES_PER_FRAME).toFixed(1)} frames of cycles`;
  console.log(
    `\nCLEAN: painted ${hashes.length} frames (${clock}). Now pixel-diff frames.rgb against the MAME golden.`,
  );
  return 0;
}

/**
 * Paint `want` frames of the idiomatic game under runIdiomaticGame — the shipped coroutine engine.
 *
 * RENDERED ON DEMAND AT THE VBLANK YIELD. onFrame fires PRE-NMI at each vblank wait; there is no
 * beam on this clock, so the whole frame is snapshotted with machine.renderFrame() (tilemap +
 * sprite post-pass — the same call web/worker.js's serviceIdiomaticFrame makes). Frame 0 is
 * power-on, before the boot generator runs: no golden frame matches it, so it is not painted.
 * Inputs/pokes are applied at (f + tapeOrigin) so the tape rides the golden's frame numbering.
 */
function runGeneratorFrames(machine, want, tapeOrigin, fd, hashes) {
  const states = [];
  const r = runIdiomaticGame(machine, {
    bootAddr: 0x0000,
    nmiReturnPC: manifest.convergence.idiomatic.nmiReturnPC,
    maxFrames: want,
    onFrame: (m, f) => {
      if (f === 0) return; // power-on, before the boot generator runs
      m.applyInputs(f + tapeOrigin);
      m.applyPokes(f + tapeOrigin);
      states.push(m.dumpState());
      const rgb = m.renderFrame();
      writeSync(fd, Buffer.from(rgb), 0, rgb.length);
      hashes.push(createHash("sha256").update(Buffer.from(rgb)).digest("hex"));
    },
  });
  machine.stoppedBy = r.stopError ?? null;
  return states;
}

process.exit(await main());
