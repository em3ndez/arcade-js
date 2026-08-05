#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
/**
 * Time Pilot RENDER emitter — the JS side of the pixel gate (game #3).
 *
 * Boots the translated machine WITH the video ROMs, paints every frame line by line as
 * the beam reaches it (boards/timeplt/video.js via Machine.drainRaster), and writes a
 * frames.rgb in the SAME wire format the MAME golden capture and the other two games
 * use: 256x224 RGB888, row-major, top-left origin, UNROTATED, headerless concatenation,
 * 172032 bytes per frame, plus a frames.json index.
 *
 * FRAME MAPPING, and it needs no shifting here:
 *   videoFrames[k] is the image painted DURING frame k. MAME's AVI writer lags one
 *   frame, so AVI[k+1] is also the image of frame k — which is exactly the +1 that
 *   tools/framediff.py freezes (JS[M] <-> golden[M+1]). So the frames go to disk in
 *   the order the Machine produced them. Contrast games/thepit/tools/render.js, which
 *   renders SNAPSHOTS at frame boundaries and therefore has to drop its index 0.
 *
 * WHY THE PIXEL GATE COMES SECOND. The state diff already says this CPU reproduces
 * MAME's RAM byte-for-byte over the whole 30-second capture. So a pixel difference
 * here cannot be the CPU: it is the video model, and the two halves never have to be
 * debugged at once.
 *
 * WHAT THIS GATE CANNOT SEE, measured rather than assumed. Feeding MAME's own captured
 * RAM to the renderer agrees byte-for-byte on a contiguous run of early frames — and
 * those frames are the attract TITLE screen. Zeroing both sprite RAM banks changes not
 * one pixel across all of them, so nothing a sprite draws is compared there: sprite
 * decode, priority, flip and clipping are all invisible, as are the tile flip bits and
 * flip-screen. Sixteen deliberate breakages of those paths, including a swapped tile
 * flip bit that shipped once, survive that comparison byte-identical. Everything in
 * those paths rests on the transcription from the .cpp until a capture with the game
 * actually drawing replaces it.
 *
 *   --frames N        frames of state to run (default 1802, the golden30 length)
 *   --rom PATH        maincpu image      (default <game>/rom/maincpu.bin)
 *   --tiles PATH      8KB tile ROM       (default <game>/rom/tiles.bin)
 *   --sprites PATH    16KB sprite ROM    (default <game>/rom/sprites.bin)
 *   --proms PATH      576-byte PROMs     (default <game>/rom/proms.bin)
 *   --frames-out DIR  output dir         (default <game>/out/render)
 *
 * A run that stops early writes the frames it DID paint, prints why, and exits
 * NONZERO. A short artifact must never read as a clean one.
 */
import { createHash } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Machine, CYCLES_PER_FRAME } from "../machine.js";
import { buildRoutines } from "../routines.js";
import { SCREEN_W, SCREEN_H } from "../../../boards/timeplt/video.js";
import { parseEmitArgs, hex4 } from "../../../tools/emit-core.js";

const GAME_DIR = dirname(dirname(fileURLToPath(import.meta.url))); // games/timeplt
const BYTES_PER_FRAME = SCREEN_W * SCREEN_H * 3; // 172032, the frame contract

/** Expected sizes, so a mis-assembled region fails here and not as a mangled picture. */
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
        default: return false;
      }
    },
  });
  if (!Number.isInteger(args.frames) || args.frames < 2) {
    throw new Error(`--frames expects an integer >= 2, got ${args.frames}`);
  }
  if (args.pokes.length || args.inputs.length) {
    throw new Error("--poke/--input are not plumbed on this board yet; they would be ignored");
  }

  const machine = new Machine(new Uint8Array(readFileSync(args.rom)), buildRoutines(), {
    tiles: loadRegion("tiles", args.tiles),
    sprites: loadRegion("sprites", args.sprites),
    proms: loadRegion("proms", args.proms),
  });

  // STREAM the frames out. 1801 frames is 310MB; holding them costs nothing but a heap
  // limit, and the hash is wanted per frame anyway.
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
  const states = machine.runFrames(want);
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
  // A frame count cannot tell running from spinning; the NMI count can. Boot runs with
  // NMIs masked for a couple of hundred frames, so allow generous slack. Same assertion,
  // and the same reason, as emit.js.
  const expectedNmis = states.length - 400;
  if (expectedNmis > 0 && machine.nmiCount < expectedNmis) {
    console.error(
      `\nSTUCK: ran ${states.length} frames but took only ${machine.nmiCount} NMI(s). ` +
        "The CPU is spinning while the cycle budget drains; these frames are not a clean run.",
    );
    return 1;
  }

  console.log(
    `\nCLEAN: painted ${hashes.length} frames (${(machine.cycles / CYCLES_PER_FRAME).toFixed(1)} ` +
      `frames of cycles) with no translation gap, taking ${machine.nmiCount} NMI(s). ` +
      "Now pixel-diff frames.rgb against the MAME golden.",
  );
  return 0;
}

process.exit(await main());
