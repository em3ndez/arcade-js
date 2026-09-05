#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
/**
 * Galaxian validation-artifact emitter — the JS side of the whole-machine state-diff gate. A thin wrapper
 * over the shared emit machinery in tools/emit-core.js (arg grammar, state.bin/state.json writer, hashing).
 *
 *   --state-out DIR   write state.bin + state.json (2304 bytes/frame: work + video + objram)
 *   --frames N        number of frames to emit (default 1; "all" = as far as the translation runs)
 *   --writes-out DIR  write writes.txt (hardware write trace, execution order)
 *   --frames-out DIR  write frames.rgb + frames.json (256x224x3 RGB888) -- needs gfx1.bin + proms.bin
 *   --poke / --input  ADDR=VAL@FRAME / PORT=BITS@FRAME  (see tools/emit-core.js)
 *   --rom PATH        maincpu image (default rom/maincpu.bin)
 *
 * Writes nothing unless asked. A SHORT run (a boot gap, or fewer frames than asked) writes what it
 * produced, prints why, and exits NONZERO -- a short artifact must never read as complete. At skeleton
 * stage the boot stops at the first untranslated m.call, so `--state-out` yields the power-on frame plus
 * however far the translated layer reaches; statediff.py vs the MAME golden is the boot-gap worklist.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Machine } from "../machine.js";
import {
  STATE_DUMP_SIZE,
  WORK_RAM_BASE, WORK_RAM_SIZE,
  VIDEO_RAM_BASE, VIDEO_RAM_SIZE,
  OBJ_RAM_BASE, OBJ_RAM_SIZE,
} from "../../../boards/galaxian/memory.js";
import {
  parseEmitArgs, writeStateArtifact, sha256, hex4,
} from "../../../tools/emit-core.js";

// Order mirrors AddressSpace.dumpState() (work, video, objram) and dump_state.lua's REGIONS.
const REGIONS = [
  { name: "work", start: hex4(WORK_RAM_BASE), len: WORK_RAM_SIZE },
  { name: "video", start: hex4(VIDEO_RAM_BASE), len: VIDEO_RAM_SIZE },
  { name: "objram", start: hex4(OBJ_RAM_BASE), len: OBJ_RAM_SIZE },
];

function extraFlag(flag, next, args) {
  switch (flag) {
    case "--frames-out": args.framesOut = next(); return true;
    case "--writes-out": args.writesOut = next(); return true;
    default: return false;
  }
}

const GAME_DIR = dirname(dirname(fileURLToPath(import.meta.url))); // games/galaxian

async function main() {
  const args = parseEmitArgs(process.argv, {
    defaults: {
      rom: join(GAME_DIR, "rom", "maincpu.bin"),
      framesOut: null,
      writesOut: null,
    },
    extra: extraFlag,
  });
  const rom = new Uint8Array(readFileSync(args.rom));
  // gfx1 is ONE region used as both tile and sprite source; only loaded when a frame buffer is requested.
  const video = args.framesOut
    ? {
        gfx: new Uint8Array(readFileSync(join(dirname(args.rom), "gfx1.bin"))),
        proms: new Uint8Array(readFileSync(join(dirname(args.rom), "proms.bin"))),
      }
    : {};
  const machine = new Machine(rom, { ...video });
  machine.pokes = args.pokes;
  machine.inputTape = args.inputs;
  if (args.writesOut) machine.mem.writeTrace = [];

  const want = args.frames === "all" ? Number.MAX_SAFE_INTEGER : args.frames;
  machine.captureVideo = Boolean(args.framesOut);
  const frames = machine.runFrames(want);
  const stopped = machine.stoppedBy;
  const painted = machine.videoFrames.length;
  const short = (frames.length < want || (args.framesOut && painted < want)) && args.frames !== "all";

  if (short || stopped) {
    const gap = stopped ? /0x([0-9a-f]+)/.exec(stopped.message || "") : null;
    console.error(
      `NOTE: asked for ${args.frames} frames, produced ${frames.length} state(s)` +
        (args.framesOut ? ` / ${painted} images` : "") + "." +
        (stopped ? `\n      stopped${gap ? ` at boot gap 0x${gap[1]}` : ""}: ${stopped.message || stopped} (PC ${hex4(machine.pc)})` : ""),
    );
  }

  if (args.stateOut) {
    const bytes = writeStateArtifact(args.stateOut, frames, {
      stateDumpSize: STATE_DUMP_SIZE, regions: REGIONS,
    });
    console.log(
      `wrote ${frames.length} frame(s) x ${STATE_DUMP_SIZE} bytes (${bytes} bytes) -> ${args.stateOut}/state.bin`,
    );
  }

  if (args.writesOut) {
    mkdirSync(args.writesOut, { recursive: true });
    const lines = machine.mem.writeTrace.map(
      (w) =>
        `${w.cycle} ${w.addr.toString(16).toUpperCase().padStart(4, "0")} ` +
        `${w.value.toString(16).toUpperCase().padStart(2, "0")}`,
    );
    writeFileSync(join(args.writesOut, "writes.txt"), lines.join("\n") + "\n");
    console.log(`wrote ${lines.length} hardware writes -> ${args.writesOut}/writes.txt`);
  }

  if (args.framesOut) {
    const shots = machine.videoFrames;
    if (shots.length === 0) {
      throw new Error(
        "no frame images were completed: a frame is only painted once the following boundary is crossed, " +
          "so --frames N yields N-1 images. Writing an empty frames.rgb would exit 0 and read as complete.",
      );
    }
    mkdirSync(args.framesOut, { recursive: true });
    const buf = Buffer.concat(shots.map((f) => Buffer.from(f)));
    writeFileSync(join(args.framesOut, "frames.rgb"), buf);
    writeFileSync(
      join(args.framesOut, "frames.json"),
      JSON.stringify(
        {
          width: 256, height: 224, bytes_per_frame: 256 * 224 * 3,
          pixel_format: "RGB888", origin: "top-left", count: shots.length,
          frames: shots.map((f, i) => ({ i, sha256: sha256(f) })),
        },
        null, 2,
      ) + "\n",
    );
    console.log(
      `wrote ${shots.length} frame(s) -> ${args.framesOut}/frames.rgb\n` +
        `  ${new Set(shots.map((f) => sha256(f))).size} DISTINCT image(s)`,
    );
  }

  return short || stopped ? 1 : 0;
}

process.exit(await main());
