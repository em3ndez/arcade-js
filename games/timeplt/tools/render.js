#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
/**
 * Time Pilot RENDER emitter — the JS side of the pixel gate. Writes frames.rgb in the same wire
 * format as the MAME golden and the other two games: 256x224 RGB888, row-major, top-left origin,
 * unrotated, headerless, 172032 bytes/frame, plus a frames.json index. `--help` lists the flags.
 *
 * FRAME MAPPING needs no shift on the cycle-driven path: videoFrames[k] is painted DURING frame k
 * and MAME's AVI lags one, so AVI[k+1] is the same image — the +1 framediff.py freezes.
 *
 * ⚠ WHAT THIS GATE CANNOT SEE, measured. Feeding MAME's own captured RAM to the renderer agrees
 * byte-for-byte over a run of early frames, and those are the attract TITLE screen: zeroing both
 * sprite RAM banks changes not one pixel there. Sprite decode, priority, flip and clipping, the
 * tile flip bits and flip-screen are all invisible to it — sixteen deliberate breakages of those
 * paths, including a swapped tile flip bit that shipped once, survive byte-identical. Those paths
 * rest on the .cpp transcription until a capture with the game actually drawing replaces it.
 *
 * A run that stops early writes what it painted, says why, and exits NONZERO: a short artifact
 * must never read as a clean one.
 */

import { createHash } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Machine, CYCLES_PER_FRAME, resolveAllIdiomatic } from "../machine.js";
import { buildRoutines } from "../routines.js";
import { runGeneratorGame } from "../../../core/frame-stepped.js";
import manifest from "../manifest.js";
import { SCREEN_W, SCREEN_H } from "../../../boards/timeplt/video.js";
import { parseEmitArgs, hex4 } from "../../../tools/emit-core.js";

const GAME_DIR = dirname(dirname(fileURLToPath(import.meta.url))); // games/timeplt
const BYTES_PER_FRAME = SCREEN_W * SCREEN_H * 3; // 172032, the frame contract

const ROM_SIZES = { tiles: 0x2000, sprites: 0x4000, proms: 0x0240 };

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
      tiles: join(GAME_DIR, "rom", "tiles.bin"),
      sprites: join(GAME_DIR, "rom", "sprites.bin"),
      proms: join(GAME_DIR, "rom", "proms.bin"),
      frames: 1802,
      framesOut: join(GAME_DIR, "out", "render"),
    },
    extra: (flag, next, a) => {
      switch (flag) {
        case "--tiles": a.tiles = next(); return true;
        case "--sprites": a.sprites = next(); return true;
        case "--proms": a.proms = next(); return true;
        case "--frames-out": a.framesOut = next(); return true;
        case "--idiomatic": a.idiomatic = true; return true;
        case "--tape-origin": a.tapeOrigin = Number(next()); return true;
        default: return false;
      }
    },
  });
  if (!Number.isInteger(args.frames) || args.frames < 2) {
    throw new Error(`--frames expects an integer >= 2, got ${args.frames}`);
  }
  // --idiomatic renders the IDIOMATIC layer THROUGH THE ENGINE THAT SHIPS, so it swaps the CLOCK
  // as well as the routine map. Without it the default path builds from buildRoutines() alone.
  // ★ THE CYCLE-DRIVEN --idiomatic COULD NOT BE TRUSTED: a module spending no T-states drifted the
  // frame boundary ahead, and 36 of 300 boot frames differed while a one-frame shift matched 292 of
  // 299 against 263 -- the diff measured the clock, not the picture. Frames advance on a YIELD here.
  // ★ THE TWO SIDES SHARE NO FRAME ORIGIN: boot burns no frames, the machine spends ~235. The tape
  // origin is that gap and the TAPE must ride the golden's numbering, or the two coin on different
  // game frames; pixel_suite.py measures and pins the value.

  const gfx = {
    tiles: loadRegion("tiles", args.tiles),
    sprites: loadRegion("sprites", args.sprites),
    proms: loadRegion("proms", args.proms),
  };
  const romImage = new Uint8Array(readFileSync(args.rom));
  const overrides = args.idiomatic ? await resolveAllIdiomatic() : null;

  const machine = args.idiomatic
    ? await Machine.create(romImage, { ...gfx, overrides })
    : new Machine(romImage, buildRoutines(), gfx);
  machine.inputTape = args.inputs.length ? args.inputs : null;
  machine.pokes = args.pokes.length ? args.pokes : null;

  mkdirSync(args.framesOut, { recursive: true });
  const rgbPath = join(args.framesOut, "frames.rgb");
  const fd = openSync(rgbPath, "w");
  const hashes = [];
  machine.captureVideo = true;
  machine.onVideoFrame = (buf) => {
    writeSync(fd, buf, 0, buf.length);
    hashes.push(createHash("sha256").update(buf).digest("hex"));
  };

  const want = args.frames;
  const states = args.idiomatic
    ? runGeneratorFrames(machine, want, args.tapeOrigin ?? 0)
    : machine.runFrames(want);
  closeSync(fd);

  writeFileSync(
    join(args.framesOut, "frames.json"),
    JSON.stringify(
      {
        width: SCREEN_W,
        height: SCREEN_H,
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
        "ran longer than a frame. The artifact is missing images and the indices after " +
        "the first drop are shifted — do NOT diff it.",
    );
    return 1;
  }

  const err = machine.stoppedBy;
  if (err) {
    const gap = /no routine registered at (0x[0-9a-f]+)/.exec(err.message || "");
    if (gap) {
      console.error(
        `\nBOOT GAP: ${gap[1]} has no translated routine, reached after ` +
          `${states.length} state(s) / ${hashes.length} painted frame(s) ` +
          `(last known PC ${hex4(machine.pc)}).`,
      );
    } else {
      console.error(
        `\nSTOP after ${states.length} state(s) / ${machine.cycles} cycles ` +
          `(PC ${hex4(machine.pc)}): ${err.message || err}`,
      );
    }
    return 1;
  }
  if (states.length < want) {
    console.error(
      `\nNOTE: asked for ${want} states, produced ${states.length} with no recorded ` +
        "stop reason — investigate before trusting this run.",
    );
    return 1;
  }
  const expectedNmis = states.length - 400;
  if (expectedNmis > 0 && machine.nmiCount < expectedNmis) {
    console.error(
      `\nSTUCK: ran ${states.length} frames but took only ${machine.nmiCount} NMI(s). ` +
        "The CPU is spinning while the cycle budget drains; these frames are not a clean run.",
    );
    return 1;
  }

  const clock = args.idiomatic
    ? "vblank yields"
    : `${(machine.cycles / CYCLES_PER_FRAME).toFixed(1)} frames of cycles`;
  console.log(
    `\nCLEAN: painted ${hashes.length} frames (${clock}) with no translation gap, ` +
      `taking ${machine.nmiCount} NMI(s). Now pixel-diff frames.rgb against the MAME golden.`,
  );
  return 0;
}

/**
 * Paint `want` frames of the idiomatic game under runGeneratorGame.
 *
 * PAINTED WHOLE AT THE VBLANK YIELD: there is no beam on this clock, and the cycle-driven painter
 * publishes on a boundary this engine sets to Infinity. ⚠ The whole-frame tolerance does NOT settle
 * which instant to snapshot -- yield 1324px and post-NMI 2810px BOTH sit inside 5%. The band check
 * does: 33px/0 over at the yield against 1571px/1278 over post-NMI. Pick on the band.
 */
function runGeneratorFrames(machine, want, tapeOrigin) {
  const states = [];
  machine.startBeamFrame(); // open frame 1's band buffer before the boot foreground runs
  const r = runGeneratorGame(machine, {
    nmiReturnPC: manifest.convergence.golive.nmiReturnPC,
    maxFrames: want,
    onFrame: (m, f) => {
      if (f === 0) return; // power-on, before the boot generator runs: no golden frame matches it
      m.applyInputs(f + tapeOrigin);
      m.applyPokes(f + tapeOrigin);
      states.push(m.mem.dumpState());
      if (m.onVideoFrame) m.onVideoFrame(m.finishBeamFrame());
      m.startBeamFrame(); // open the next frame's band buffer
    },
  });
  machine.stoppedBy = r.stopError ?? null;
  return states;
}

process.exit(await main());
