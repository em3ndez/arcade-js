#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
/**
 * Donkey Kong validation-artifact emitter — a thin wrapper over the shared emit
 * machinery in tools/emit-core.js (arg grammar, state.bin/state.json writer, hashing).
 * This file holds only the DK-specific extras: the video/pixel-diff dump (frames.rgb),
 * the hardware-write trace (writes.txt), and the post-boot fingerprint.
 *
 *   --state-out DIR   write state.bin + state.json (5120 bytes/frame)
 *   --frames N        number of frames to emit (default 1; "all" = as far as it runs)
 *   --frames-out DIR  write frames.rgb + frames.json (256x224x3 RGB888, pixel-diff)
 *   --writes-out DIR  write writes.txt (hardware write trace, execution order)
 *   --post-boot       report the post-boot fingerprint (diagnostic)
 *   --pin-entropy     pin the spin-counter RNG (test-only; mirrors the MAME lua)
 *   --poke / --input  ADDR=VAL@FRAME / PORT=BITS@FRAME  (see tools/emit-core.js)
 *   --rom PATH        maincpu image (default rom/maincpu.bin)
 *
 * Writes nothing unless asked. A SHORT run (a stop, or fewer frames than asked) writes
 * what it produced, prints why, and exits NONZERO — a short artifact must never read
 * as complete. (boot spans ~3.52 frames; frames 0-3 are inside it.)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Machine } from "../machine.js";
import { installEntropyPin } from "../../../core/entropy-pin.js";
import manifest from "../manifest.js";
import {
  STATE_DUMP_SIZE,
  WORK_RAM_BASE, WORK_RAM_SIZE,
  SPRITE_RAM_BASE, SPRITE_RAM_SIZE,
  VIDEO_RAM_BASE, VIDEO_RAM_SIZE,
} from "../../../boards/dkong/memory.js";
import {
  parseEmitArgs, writeStateArtifact, sha256, hex4,
} from "../../../tools/emit-core.js";

const REGIONS = [
  { name: "work", start: hex4(WORK_RAM_BASE), len: WORK_RAM_SIZE },
  { name: "sprite", start: hex4(SPRITE_RAM_BASE), len: SPRITE_RAM_SIZE },
  { name: "video", start: hex4(VIDEO_RAM_BASE), len: VIDEO_RAM_SIZE },
];

// DK-specific flags layered onto the shared grammar.
function extraFlag(flag, next, args) {
  switch (flag) {
    case "--frames-out": args.framesOut = next(); return true;
    case "--writes-out": args.writesOut = next(); return true;
    case "--post-boot": args.postBoot = true; return true;
    case "--pin-entropy": args.pinEntropy = true; return true;
    default: return false;
  }
}

async function main() {
  const args = parseEmitArgs(process.argv, {
    defaults: { framesOut: null, writesOut: null, postBoot: false, pinEntropy: false },
    extra: extraFlag,
  });
  const rom = new Uint8Array(readFileSync(args.rom));
  // Video ROMs are only loaded when a frame buffer is requested — not needed for
  // state or write traces.
  const video = args.framesOut
    ? {
        gfx1: new Uint8Array(readFileSync(join(dirname(args.rom), "gfx1.bin"))),
        gfx2: new Uint8Array(readFileSync(join(dirname(args.rom), "gfx2.bin"))),
        proms: new Uint8Array(readFileSync(join(dirname(args.rom), "proms.bin"))),
      }
    : {};
  const machine = new Machine(rom, { ...video });
  // TEST-ONLY: pin the RNG working set deterministically so a JS<->MAME diff isn't
  // polluted by the spin-counter race (see core/entropy-pin.js). Never the shipped game.
  if (args.pinEntropy) installEntropyPin(machine, manifest.entropyPin);
  machine.pokes = args.pokes;
  machine.inputTape = args.inputs;
  if (args.writesOut) machine.mem.writeTrace = [];

  // "all" runs as far as the translation currently reaches (no natural end-of-run yet).
  const want = args.frames === "all" ? Number.MAX_SAFE_INTEGER : args.frames;
  // Opt in BEFORE runFrames: video is captured at frame boundaries during the run.
  machine.captureVideo = Boolean(args.framesOut);
  const frames = machine.runFrames(want);
  const stopped = machine.stoppedBy;
  const painted = machine.videoFrames.length;
  const shortVideo = args.framesOut && painted < want;
  const short = (frames.length < want || shortVideo) && args.frames !== "all";

  if (short || stopped) {
    console.error(
      `NOTE: asked for ${args.frames} frames, produced ${frames.length}` +
        (args.framesOut ? ` states / ${machine.videoFrames.length} images` : "") +
        "." +
        (stopped ? `\n      stopped: ${stopped}` : ""),
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
    // "<cycle> <ADDR4hex> <VAL2hex>", one per line, EXECUTION ORDER.
    const lines = machine.mem.writeTrace.map(
      (w) =>
        `${w.cycle} ${w.addr.toString(16).toUpperCase().padStart(4, "0")} ` +
        `${w.value.toString(16).toUpperCase().padStart(2, "0")}`,
    );
    writeFileSync(join(args.writesOut, "writes.txt"), lines.join("\n") + "\n");
    console.log(`wrote ${lines.length} hardware writes -> ${args.writesOut}/writes.txt`);
  }

  if (args.framesOut) {
    mkdirSync(args.framesOut, { recursive: true });
    // Headerless concatenation, 256*224*3 = 172032 bytes/frame, row-major, top-left,
    // R,G,B, no padding, unrotated. A frame is PAINTED over its own duration, so frame N
    // is complete only once the boundary into N+1 crosses: a run capturing K states
    // finishes K-1 images, and the one in progress is dropped. Only the FINAL frame may
    // be dropped mid-paint; a middle drop would renumber everything after it.
    const shots = machine.videoFrames;
    if (machine.droppedFrames > 1) {
      throw new Error(
        `${machine.droppedFrames} frames abandoned mid-paint; only the final ` +
          "one may be, so frame numbering is no longer trustworthy",
      );
    }
    if (shots.length + machine.droppedFrames !== frames.length - 1) {
      throw new Error(
        `frame accounting: ${shots.length} painted + ${machine.droppedFrames} ` +
          `dropped != ${frames.length - 1} elapsed frames`,
      );
    }
    if (shots.length === 0) {
      throw new Error(
        "no frame images were completed: a frame is only painted once the " +
          "following boundary is crossed, so --frames N yields N-1 images. " +
          "Writing an empty frames.rgb would exit 0 and read as complete.",
      );
    }
    const buf = Buffer.concat(shots.map((f) => Buffer.from(f)));
    writeFileSync(join(args.framesOut, "frames.rgb"), buf);
    writeFileSync(
      join(args.framesOut, "frames.json"),
      JSON.stringify(
        {
          width: 256, height: 224, bytes_per_frame: 172032,
          pixel_format: "RGB888", origin: "top-left", count: shots.length,
          frames: shots.map((f, i) => ({ i, sha256: sha256(f) })),
        },
        null, 2,
      ) + "\n",
    );
    // Print the DISTINCT count next to the inflated one — a frame count is inflated by
    // repetition, a distinct-image count is not.
    console.log(
      `wrote ${shots.length} frame(s) x 172032 bytes -> ${args.framesOut}/frames.rgb\n` +
        `  ${new Set(shots.map((f) => sha256(f))).size} DISTINCT image(s) -- the frame count is ` +
        `inflated by repetition, the distinct count is not`,
    );
  }

  if (args.postBoot) {
    // A FRESH machine: re-resetting the runFrames() one would double discardedWrites
    // and append frames sampled from already-booted memory.
    const fresh = new Machine(rom, {});
    fresh.runBoot();
    const st = fresh.dumpState();
    const distinct = (buf) => [...new Set(buf)].map((v) => `0x${v.toString(16)}`);
    console.log("\npost-boot fingerprint (after reset, before first NMI):");
    console.log(`  work   0x6000-0x6BFF distinct: ${distinct(st.slice(0, 3072))}`);
    console.log(`  sprite 0x7000-0x73FF distinct: ${distinct(st.slice(3072, 4096))}`);
    console.log(`  video  0x7400-0x77FF distinct: ${distinct(st.slice(4096, 5120))}`);
    console.log(`  0x60B0=0x${st[0x0b0].toString(16)} 0x60B1=0x${st[0x0b1].toString(16)}`);
    console.log(`  0x60C0-0x60FF all 0xFF: ${st.slice(0x0c0, 0x100).every((v) => v === 0xff)}`);
    console.log(`  0x6080-0x608B all 0x00: ${st.slice(0x080, 0x08c).every((v) => v === 0x00)}`);
    console.log(
      `  flipscreen=${fresh.io.flipScreen} spriteBank=${fresh.io.spriteBank} ` +
        `paletteBank=${fresh.io.paletteBank} nmiMask=${fresh.io.nmiMask}`,
    );
    console.log(`  discarded writes to 0x6C00-0x6FFF: ${fresh.mem.discardedWrites} (expect 1024)`);
    console.log(`  sha256(state): ${sha256(st)}`);
  }

  return short || stopped ? 1 : 0;
}

process.exit(await main());
