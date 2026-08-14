#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Frogger RENDER emitter — the JS side of the pixel gate. Writes frames.rgb (256x224 RGB888, row-major,
// top-left origin, headerless, 172032 B/frame) + a frames.json index: the wire format the MAME golden is
// diffed against. Translated layer only for now (a --idiomatic switch arrives with the idiomatic layer).
// A run that stops early writes what it painted, says why, and exits NONZERO — a short artifact must not
// read as a clean one.

import { createHash } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Machine, CYCLES_PER_FRAME } from "../machine.js";
import { buildRoutines } from "../routines.js";
import { SCREEN_W, SCREEN_H } from "../../../boards/frogger/video.js";
import { parseEmitArgs, hex4 } from "../../../tools/emit-core.js";

const GAME_DIR = dirname(dirname(fileURLToPath(import.meta.url))); // games/frogger
const BYTES_PER_FRAME = SCREEN_W * SCREEN_H * 3;
const ROM_SIZES = { gfx: 0x1000, proms: 0x20 };

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
      gfx: join(GAME_DIR, "rom", "gfx.bin"),
      proms: join(GAME_DIR, "rom", "proms.bin"),
      frames: 900,
      framesOut: join(GAME_DIR, "out", "render"),
    },
    extra: (flag, next, a) => {
      switch (flag) {
        case "--gfx": a.gfx = next(); return true;
        case "--proms": a.proms = next(); return true;
        case "--frames-out": a.framesOut = next(); return true;
        default: return false;
      }
    },
  });
  if (!Number.isInteger(args.frames) || args.frames < 2) {
    throw new Error(`--frames expects an integer >= 2, got ${args.frames}`);
  }

  const gfx = loadRegion("gfx", args.gfx);
  const proms = loadRegion("proms", args.proms);
  const romImage = new Uint8Array(readFileSync(args.rom));

  const machine = new Machine(romImage, buildRoutines(), { gfx, proms });
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
      `  ${states.length} state frame(s); ${distinct} DISTINCT image(s)`,
  );
  if (machine.droppedFrames) {
    console.error(
      `\nDROPPED ${machine.droppedFrames} frame(s) with rows still unpainted: a tick ran longer ` +
        "than a frame. Indices after the first drop are shifted — do NOT diff it.",
    );
    return 1;
  }

  const err = machine.stoppedBy;
  if (err) {
    const gap = /0x([0-9a-f]+)/.exec(err.message || "");
    console.error(
      `\nSTOP after ${states.length} state(s) / ${hashes.length} painted frame(s)` +
        (gap ? ` at boot gap 0x${gap[1]}` : `: ${err.message || err}`) +
        ` (PC ${hex4(machine.pc)}).`,
    );
    return 1;
  }
  if (states.length < want) {
    console.error(`\nNOTE: asked for ${want} states, produced ${states.length} — investigate.`);
    return 1;
  }

  console.log(
    `\nCLEAN: painted ${hashes.length} frames ` +
      `(${(machine.cycles / CYCLES_PER_FRAME).toFixed(1)} frames of cycles) with no gap, ` +
      `taking ${machine.nmiCount} NMI(s). Now pixel-diff frames.rgb against the MAME golden.`,
  );
  return 0;
}

process.exit(await main());
