#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
/**
 * The Pit RENDER emitter — the JS side of the pixel gate (game #2).
 *
 * Boots the JS machine WITH the tile/palette ROMs, runs it for N frames, and at
 * every frame boundary snapshots boards/thepit/video.js renderFrame() into a
 * frames.rgb in the SAME wire format the MAME golden and DK's emit.js use:
 *   256x224 RGB888, row-major, top-left origin, UNROTATED, headerless
 *   concatenation, 172032 bytes/frame + a frames.json index.
 *
 * FRAME MAPPING (matches the frozen framediff offset of +1):
 *   renders[N] = renderFrame() evaluated on the memory at boundary N = render of
 *   state[N] (the image the RAM produces after frames 0..N-1 have executed).
 *   MAME's AVI writer LAGS ONE FRAME, so AVI[N] is the image of emulated frame
 *   N-1 ≈ render(state[N]) = renders[N]. framediff maps JS[M] -> golden[M+1], so
 *   JS[M] must be render(state[M+1]): we DROP the power-on render[0] and write
 *   renders[1..] as the JS frames. Same count relationship as DK — K captured
 *   state frames yield K-1 painted frames.
 *
 * gfx/proms are assembled from the romset parts named in games/thepit/manifest.js
 * (gfx = p9.ic9@0x0000 + p8.ic8@0x1000 in a 0x1800 image with a 0x0800-0x0FFF
 * gap; proms = 82s123.ic4), each verified against the manifest sha256 so a wrong
 * or damaged romset fails loudly rather than mis-rendering.
 *
 *   --frames N     frames to run (default 305 ≈ 5s at 60.606Hz -> 304 painted)
 *   --rom PATH     maincpu image (default <game>/rom/maincpu.bin)
 *   --romset DIR   dir holding the gfx/proms parts
 *   --frames-out D output dir (default <game>/out/emit)
 *
 * HONEST ABOUT SCOPE, like emit.js: a short run (a boot gap before the target)
 * writes the frames it DID produce, prints the stop reason, and exits NON-ZERO.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Machine, UnregisteredRoutine, resolveAllIdiomatic } from "../machine.js";
import { UnmappedAccess } from "../../../boards/thepit/memory.js";
import { installEntropyPin } from "../../../core/entropy-pin.js";
import { runIdiomaticGame } from "../../../core/frame-stepped.js";
import manifest from "../manifest.js";

const GAME_DIR = dirname(dirname(fileURLToPath(import.meta.url))); // games/thepit
const BYTES_PER_FRAME = 256 * 224 * 3; // 172032, the frame contract
const hex4 = (v) => `0x${(v & 0xffff).toString(16).padStart(4, "0")}`;
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

// The romset that carries the gfx/proms parts (session scratchpad by default).
const DEFAULT_ROMSET =
  "/private/tmp/claude-502/-Users-qarl-project-arcade2/" +
  "f4c9de89-1f90-4173-9b14-5c0e5a2e8d2d/scratchpad/mameroms/thepitu1";

function parseArgs(argv) {
  const args = {
    rom: join(GAME_DIR, "rom", "maincpu.bin"),
    romset: DEFAULT_ROMSET,
    frames: 305,
    framesOut: join(GAME_DIR, "out", "emit"),
    inputs: [],
    pokes: [],
    pin: false,
    idiomatic: false,
    tapeOrigin: 0,
  };
  // Same --input/--poke grammar as emit.js so a tape renders identically to how it
  // state-emits: PORT=BITS@FRAME[:hold[N]|once] / ADDR=VAL@FRAME[:hold[N]|once].
  const SPEC = /^(0x[0-9a-fA-F]+|\d+)=(0x[0-9a-fA-F]+|\d+)@(\d+)(?::(hold|once)(\d+)?)?$/;
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case "--rom": args.rom = argv[++i]; break;
      case "--romset": args.romset = argv[++i]; break;
      case "--frames": {
        const v = Number(argv[++i]);
        if (!Number.isInteger(v) || v < 2) {
          throw new Error(`--frames expects an integer >= 2, got ${argv[i]}`);
        }
        args.frames = v;
        break;
      }
      case "--frames-out": args.framesOut = argv[++i]; break;
      case "--pin": args.pin = true; break; // entropy-pin the RNG (match a --pin-entropy MAME golden)
      // --idiomatic renders the IDIOMATIC layer THROUGH THE ENGINE THAT SHIPS (core/frame-stepped.js
      // runIdiomaticGame — the coroutine engine, whose control spine is generators that yield at each
      // vblank), swapping the CLOCK as well as the routine map. The default path runs the frozen
      // translated oracle on the cycle-driven engine (runFrames). --tape-origin is the boot gap: this
      // engine burns NO frames on the power-on settle delay MAME spends ~20 frames on, so the two sides
      // share no frame origin; the tape must ride the golden's numbering. pixel_suite.py measures + pins it.
      case "--idiomatic": args.idiomatic = true; break;
      case "--tape-origin": args.tapeOrigin = Number(argv[++i]); break;
      case "--poke": {
        const mt = argv[++i].match(SPEC);
        if (!mt) throw new Error(`--poke expects ADDR=VAL@FRAME[:hold[N]|once]`);
        const mode = mt[4] || "hold";
        if (mode === "once" && mt[5]) throw new Error(`--poke: "once" takes no count — use hold${mt[5]}`);
        args.pokes.push({ addr: Number(mt[1]) & 0xffff, val: Number(mt[2]) & 0xff,
          frame: Number(mt[3]), dur: mode === "once" ? 1 : mt[5] ? Number(mt[5]) : null });
        break;
      }
      case "--input": {
        const mt = argv[++i].match(SPEC);
        if (!mt) throw new Error(`--input expects PORT=BITS@FRAME[:hold[N]|once]`);
        const mode = mt[4] || "once";
        if (mode === "once" && mt[5]) throw new Error(`--input: "once" takes no count — use hold${mt[5]}`);
        args.inputs.push({ port: Number(mt[1]) & 0xffff, bits: Number(mt[2]) & 0xff,
          frame: Number(mt[3]), dur: mode === "once" ? 1 : mt[5] ? Number(mt[5]) : null });
        break;
      }
      default: throw new Error(`unknown argument: ${argv[i]}`);
    }
  }
  return args;
}

/**
 * Assemble one manifest ROM image from its named parts, placing each part at its
 * declared offset (default: end-to-end) into a `size`-byte buffer, then verify
 * the whole image against the manifest sha256.
 */
function assembleImage(name, spec, romsetDir) {
  const buf = new Uint8Array(spec.size);
  let cursor = 0;
  spec.parts.forEach((part, i) => {
    const data = new Uint8Array(readFileSync(join(romsetDir, part)));
    const off = spec.offsets ? spec.offsets[i] : cursor;
    buf.set(data, off);
    cursor = off + data.length;
  });
  const got = sha256(buf);
  if (got !== spec.sha256) {
    throw new Error(
      `${name}: assembled image sha256 ${got} != manifest ${spec.sha256} ` +
        `(wrong or damaged romset in ${romsetDir}?)`,
    );
  }
  return buf;
}

function writeFrames(dir, shots) {
  mkdirSync(dir, { recursive: true });
  const buf = Buffer.concat(shots.map((f) => Buffer.from(f)));
  writeFileSync(join(dir, "frames.rgb"), buf);
  writeFileSync(
    join(dir, "frames.json"),
    JSON.stringify(
      {
        width: 256, height: 224, bytes_per_frame: BYTES_PER_FRAME,
        pixel_format: "RGB888", origin: "top-left", count: shots.length,
        frames: shots.map((f, i) => ({ i, sha256: sha256(Buffer.from(f)) })),
      },
      null, 2,
    ) + "\n",
  );
  return buf.length;
}

/**
 * Paint `want` frames of the IDIOMATIC game under runIdiomaticGame (the coroutine engine
 * that ships). The spine (boot, main/wait loops) are GENERATORS yielding at each vblank;
 * onFrame samples at the yield (pre-NMI) and renders the whole frame — The Pit composes a
 * frame in one shot (no beam), so renderFrame() is the snapshot, exactly what the web
 * worker's serviceIdiomaticFrame does for this game.
 *
 * THE TWO SIDES SHARE NO FRAME ORIGIN: this engine burns no frames on the power-on settle
 * delay MAME spends ~20 real frames on (coldBootInit's settle loop touches no memory, so
 * nothing models it). The tape origin is that gap: onFrame applies inputs/pokes at
 * `frame + tapeOrigin` so a coin keyed to the golden's absolute frame number fires on the
 * matching generator frame. pixel_suite.py measures + pins tapeOrigin (LANDMARK).
 */
async function renderIdiomatic(args, rom, gfx, proms) {
  const overrides = await resolveAllIdiomatic(new URL("../machine.js", import.meta.url));
  const machine = await Machine.create(rom, { gfx, proms, overrides });
  if (args.pin) installEntropyPin(machine, manifest.entropyPin); // freeze RNG to match a --pin-entropy golden
  machine.inputTape = args.inputs.length ? args.inputs : null;
  machine.pokes = args.pokes.length ? args.pokes : null;

  const shots = [];
  const want = args.frames;
  const r = runIdiomaticGame(machine, {
    nmiReturnPC: manifest.convergence.idiomatic.nmiReturnPC,
    maxFrames: want,
    onFrame: (m, f) => {
      if (f === 0) return; // power-on, before the boot generator runs: no golden frame matches it
      m.applyInputs(f + args.tapeOrigin);
      m.applyPokes(f + args.tapeOrigin);
      shots.push(m.renderFrame());
    },
  });

  if (shots.length === 0) throw new Error("no frames painted by the idiomatic generator");
  const bytes = writeFrames(args.framesOut, shots);
  const distinct = new Set(shots.map((fr) => sha256(Buffer.from(fr)))).size;
  console.log(
    `wrote ${shots.length} idiomatic frame(s) x ${BYTES_PER_FRAME} bytes (${bytes} bytes) ` +
      `-> ${join(args.framesOut, "frames.rgb")}\n  ${distinct} DISTINCT image(s)`,
  );

  const err = r.stopError;
  if (err instanceof UnregisteredRoutine) {
    console.error(`\nBOOT GAP: unregistered routine at ${hex4(err.addr)} after ${shots.length} painted frames.`);
    return 1;
  }
  if (err instanceof UnmappedAccess) {
    console.error(`\nSTOP: unmapped memory access — ${err.message}.`);
    return 1;
  }
  if (err) {
    console.error(`\nSTOP: ${r.stop}.`);
    return 1;
  }
  if (shots.length < want - 1) {
    console.error(
      `\nNOTE: asked for ${want} frames, painted only ${shots.length} (stop: ${r.stop}) — ` +
        "investigate before trusting this run.",
    );
    return 1;
  }
  console.log(
    `\nCLEAN: painted ${shots.length} idiomatic frames (vblank yields, ${machine.nmiCount} NMI(s)) ` +
      "with no translation gap. Pixel-diff frames.rgb against the MAME golden.",
  );
  return 0;
}

async function main() {
  const args = parseArgs(process.argv);
  const rom = new Uint8Array(readFileSync(args.rom));
  const gfx = assembleImage("gfx", manifest.rom.images.gfx, args.romset);
  const proms = assembleImage("proms", manifest.rom.images.proms, args.romset);

  if (args.idiomatic) return renderIdiomatic(args, rom, gfx, proms);

  const machine = await Machine.create(rom, { gfx, proms });
  if (args.pin) installEntropyPin(machine, manifest.entropyPin); // freeze RNG to match a --pin-entropy golden
  machine.inputTape = args.inputs.length ? args.inputs : null;
  machine.pokes = args.pokes.length ? args.pokes : null;

  // Capture a rendered frame at every state boundary by piggy-backing on the
  // dumpState the boundary loop already calls (state[0] power-on, then one per
  // frame). renders[] stays in exact lockstep with machine.frames[].
  const renders = [];
  const origDump = machine.dumpState.bind(machine);
  machine.dumpState = () => {
    renders.push(machine.renderFrame());
    return origDump();
  };

  const want = args.frames;
  const frames = machine.runFrames(want);
  const err = machine.stopError;

  if (renders.length !== frames.length) {
    throw new Error(
      `render/state lockstep broken: ${renders.length} renders vs ${frames.length} states`,
    );
  }

  // Drop the power-on render[0]; JS[M] = renders[M+1] to line up with AVI[M+1]
  // under the frozen +1 offset. A K-state run yields K-1 painted frames.
  const shots = renders.slice(1);
  if (shots.length === 0) {
    throw new Error("no frames painted: a render is dropped for power-on, so N states -> N-1 frames");
  }
  const bytes = writeFrames(args.framesOut, shots);
  const distinct = new Set(shots.map((f) => sha256(Buffer.from(f)))).size;
  console.log(
    `wrote ${shots.length} frame(s) x ${BYTES_PER_FRAME} bytes (${bytes} bytes) ` +
      `-> ${join(args.framesOut, "frames.rgb")}\n` +
      `  ${distinct} DISTINCT image(s) — the frame count is inflated by repetition, ` +
      "the distinct count is not",
  );

  if (err instanceof UnregisteredRoutine) {
    console.error(
      `\nBOOT GAP: unregistered routine at ${hex4(err.addr)} after ` +
        `${frames.length} states / ${shots.length} painted frames.`,
    );
    return 1;
  }
  if (err instanceof UnmappedAccess) {
    console.error(`\nSTOP: unmapped memory access — ${err.message}.`);
    return 1;
  }
  if (err) {
    console.error(`\nSTOP: ${machine.stoppedBy}.`);
    return 1;
  }
  if (frames.length < want) {
    console.error(
      `\nNOTE: asked for ${want} states, produced only ${frames.length} with no ` +
        "recorded stop reason — investigate before trusting this run.",
    );
    return 1;
  }

  console.log(
    `\nCLEAN: rendered ${shots.length} frames with no translation gap. ` +
      "Pixel-diff frames.rgb against the MAME golden to validate.",
  );
  return 0;
}

process.exit(await main());
