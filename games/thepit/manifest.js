// SPDX-License-Identifier: GPL-3.0-only
//
// The Pit — game manifest (game #2 port). Declares which CPU + board this romset runs
// on, how to assemble its (uncommitted, copyrighted) ROM, and metadata for the launcher.
// Modeled on games/dkong/manifest.js.
//
// Romset = `thepitu1` ("The Pit (US set 1)", Zilec/Centuri). Verified against MAME
// 0.288 taito/roundup.cpp by SHA-1 on every part. The user's current loose dump names
// the parts p38b/p39b/... (no .icNN suffix); the canonical MAME zip uses the .icNN
// names below. The assembled-image sha256 verifies the result regardless of part names.

export default {
  id: "thepit",
  title: "The Pit",
  year: 1982,
  manufacturer: "Zilec Electronics",
  orientation: "vertical",     // portrait (display rotated). NB: rotation is OPPOSITE DK — see screen.rot
  screen: { width: 256, height: 224, rot: 90 },  // MAME ROT90 = 90° CW (SWAP_XY|FLIP_X)

  cpu: "z80",                  // core/cpu/z80.js — reused verbatim
  board: "thepit",             // boards/thepit/ (Zilec "roundup" family hardware)
  mameDriver: "roundup.cpp",   // machine `thepitu1`

  // Live runtime: "idiomatic" runs the whole game on the readable idiomatic layer under the
  // cycle-free frame-stepped engine (web/worker.js: runIdiomaticGame + machine.js
  // resolveAllIdiomatic, driven by the watchdog kick — see manifest.convergence.golive).
  // Absent/"translated" (the default, e.g. DK) runs the faithful translated layer on the
  // cycle-driven engine. The idiomatic runtime is validated byte-for-byte against the
  // translated oracle over game state (idiomatic/test/golive.test.js).
  runtime: "idiomatic",

  // Input contract (from MAME INPUT_PORTS_START(thepit)). NOTE the mixed polarity:
  // IN0 (joystick + dig) is ACTIVE-LOW like DK; IN1 (coin/start) is ACTIVE-HIGH —
  // boards/thepit/io.js applies each port's polarity. IN0 is muxed with a cocktail
  // IN2 by mainlatch bit 6 (flip); the web player drives IN0.
  inputs: {
    ports: { in0: 0xa000, in1: 0xa800 },
    actions: {
      left:   { port: 0xa000, bit: 0x01 },
      right:  { port: 0xa000, bit: 0x02 },
      down:   { port: 0xa000, bit: 0x04 },
      up:     { port: 0xa000, bit: 0x08 },
      dig:    { port: 0xa000, bit: 0x10 }, // BUTTON1 — dig / fire
      coin:   { port: 0xa800, bit: 0x01 },
      start2: { port: 0xa800, bit: 0x02 },
      start1: { port: 0xa800, bit: 0x04 },
    },
    keys: {
      ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
      ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
      Space: "dig", KeyZ: "dig", KeyX: "dig",
      Digit5: "coin", KeyC: "coin", Digit1: "start1", Digit2: "start2",
    },
  },

  // ROM assembly: MAME part filenames concatenated in address order into the flat
  // images the engine loads. sha256 verifies each assembled image. ROM bytes are
  // copyrighted and never committed.
  rom: {
    zip: "thepitu1.zip",
    images: {
      maincpu: {
        parts: ["p38b.ic38", "p39b.ic39", "p40b.ic40", "p41b.ic41", "p33b.ic33"],
        size: 20480,
        sha256: "3bf98d469cd542f32cf3f3ef8f594defc9d8dc45cef844854016e3c18ae826f1",
      },
      // gfx region is 0x1800: p9 loads at 0x0000, p8 at 0x1000 (0x0800-0x0FFF is a
      // gap). The two 2bpp planes are gfx 0x0000 and 0x1000 (see boards/thepit video).
      gfx: {
        parts: ["p9.ic9", "p8.ic8"],
        offsets: [0x0000, 0x1000],
        size: 0x1800,
        sha256: "e5fc56777dcb74efe2bbe9baff38db560ce322adc0ad78645006dbae747bacf1",
      },
      proms: {
        parts: ["82s123.ic4"],
        size: 32,
        sha256: "8ca28db76430409265eaedcbaaf48353a5d049bf316eed7d16078e20a6413c14",
      },
      // No audiocpu image (p30.ic30, the second Z80): its chip is NOT emulated — audio is
      // recorded clips played above the emulation (see the `audio` block below).
    },
  },

  // Audio: the "clips" model — one recorded clip per soundlatch command, played
  // ABOVE the emulation (the 2nd Z80 + 2x AY-3-8910 are NOT emulated). `map` is the
  // committed, data-only model description (audio/sounds.js); `samples` is the
  // gitignored directory the recorder fills (games/thepit/tools/record_samples.py)
  // with one WAV per command plus an index.json. Omit both and the game is silent.
  audio: {
    map: "audio/sounds.js",
    samples: "audio/samples",
  },
  // Entropy pin — The Pit's RNG is a pure 16-bit LFSR at 0x800d/0x800e (loc_4b1a); with
  // the frame-stepped engine (no cycle clock) it is advanced a slightly different number
  // of times per frame than MAME, so the seed forks unless pinned. Validated: a frozen seed
  // does NOT reset the game (no watchdog/credit-check trip) and the RNG-independent demo
  // entry converges. A fully-pinned run can later reach an attract state outside the poll
  // set (caught by the step-budget backstop), so the PIXEL gate runs UNPINNED at full length
  // and the pinned STATE gate is diagnostic. Both representations express the SAME intent
  // (see core/entropy-pin.js):
  //   JS  — drop writes to the LFSR working set so it stays at its boot value (0).
  //   MAME — redirect advanceRandom's two stores (`ld (0x800e),a` @0x4b33,
  //          `ld (0x800d),a` @0x4b38) to 0x0000. Alternatively a debugger write-reset
  //          of 0x800d/0x800e at loc_4b1a's ret (0x4b3b) — see the convergence runbook.
  entropyPin: {
    seedBytes: [0x800d, 0x800e],
    romPatches: [
      { at: 0x4b34, to: 0x00 }, { at: 0x4b35, to: 0x00 }, // ld (0x800e),a operand -> 0x0000
      { at: 0x4b39, to: 0x00 }, { at: 0x4b3a, to: 0x00 }, // ld (0x800d),a operand -> 0x0000
    ],
  },

  // Cycle-free convergence config (core/frame-stepped.js + tools/convergence.mjs).
  //   pollPCs      — the vblank-poll yields where the frame-stepped engine fires the NMI:
  //                  the waitFrames spin (0x4c07) and the in-game main-loop top (0x0348).
  //   stateExclude — the free-running cycle-proxy counters + dead Z80 stack scratch that
  //                  legitimately hold a bounded phase offset under frame-stepping, so a
  //                  deterministic-state diff excludes them. The RNG-DRIVEN actor content
  //                  is a separate residual validated by pixels, not this list.
  convergence: {
    pollPCs: [0x4c07, 0x0348],
    stateExclude: {
      cells: [
        0x8006, 0x8007, 0x8008, 0x8009, 0x800a, 0x800b, 0x800c, 0x800d, 0x800e, 0x800f,
        0x8010, 0x804f, 0x805c, 0x8065, 0x8067,
      ],
      // The Z80 stack region: everything above the game-state ceiling (0x829f — the top of
      // the 0x8281-0x829f record; SP inits at 0x83ff and the main loop re-seats it each pass,
      // so nothing game-related lives above it). During the idiomatic MIGRATION the mixed
      // layer leaks dead scratch here: a translated call site runs push16 to model the CALL,
      // but the idiomatic callee returns via a plain JS `return` and omits the routine's final
      // `ret`, so SP drifts ~2 bytes lower per translated->idiomatic call until the main loop
      // re-seats it. Benign — control flow is JS-driven and game state is byte-identical below
      // 0x82a0 (verified). Bounding the exclusion at the game-state ceiling covers the whole
      // migration (worst-case min SP with the current set is ~0x837f) and the leak vanishes at
      // full go-live (no translated callers left to push).
      stack: [0x82a0, 0x8400], // [start, end) — the stack region, above the game-state ceiling
    },
    // Go-live: run the WHOLE game idiomatic (core/frame-stepped.js runIdiomaticGame). The
    // idiomatic layer is cycle-free and never calls m.step, so the poll-PC seam runCycleFree
    // uses does not apply — the frame boundary is the once-per-frame WATCHDOG KICK (a read of
    // watchdogPort) that idiomatic mainLoop/waitFrames already perform. nmiReturnPC is a valid
    // ROM PC for the NMI's pushed return (the mainloop top). gameStateHi is the top of the used
    // game-state region (0x829f = top of SCORE_READOUT_STRIP); everything above it is stack /
    // unused work RAM, so the whole-game gate compares [0x8000, gameStateHi] (minus the
    // cycle-proxy cells) — see idiomatic/test/golive.test.js.
    golive: { watchdogPort: 0xb800, nmiReturnPC: 0x0348, gameStateHi: 0x829f },
  },

  // Idiomatic promotion set: ROM addresses whose readable idiomatic rewrite is promoted to
  // run LIVE under the frame-stepped engine. Each entry is a validated TRANSPARENT swap — the
  // assembled game runs byte-identical to pure translated (assembled-swap.test.js gates it;
  // tools/swap_check.mjs classifies candidates). Grown one leaf at a time, bottom-up. NOT
  // touched: the poll routines (0x0348 mainLoop / 0x4bff waitFrames, which the frame-stepped
  // engine needs translated) and the cycle-driven web player — full go-live is a later capstone.
  idiomatic: [
    // 151 leaf/near-leaf routines validated as TRANSPARENT swaps by tools/swap_check.mjs — the
    // assembled game runs byte-identical to pure translated below the stack region
    // (assembled-swap.test.js gates the set; dead stack scratch is excluded — see stateExclude).
    // Addresses only; names are in ROUTINES (idiomatic/ram.js). Still TRANSLATED (not here):
    // the 2 poll routines 0x0348/0x4bff; 6 structural (0x0000/0x0066/0x01a4/0x0673/0x3a6f/0x3b81);
    // the non-leaf routines (bottom-up, next). Grown by classify + gate, never by hand-assertion.
    0x021c, 0x022d, 0x0278, 0x02a1, 0x03e8, 0x06ac, 0x1362, 0x13c9, 0x13de, 0x1420,
    0x1434, 0x144c, 0x1468, 0x1493, 0x14cd, 0x1515, 0x1568, 0x1659, 0x167f, 0x16b9,
    0x1704, 0x184a, 0x186a, 0x186f, 0x18cf, 0x191f, 0x19d0, 0x19e3, 0x1a02, 0x1b5b,
    0x23e8, 0x241c, 0x24cf, 0x24f3, 0x287a, 0x28ab, 0x2934, 0x29ad, 0x2bd3, 0x2bf2,
    0x2c04, 0x2c91, 0x2cb7, 0x2d06, 0x2d4e, 0x2d6b, 0x2f2f, 0x2f71, 0x2f88, 0x2fb7,
    0x30de, 0x312d, 0x316f, 0x319d, 0x33bc, 0x33da, 0x3410, 0x3425, 0x3458, 0x3476,
    0x347d, 0x3484, 0x348b, 0x34da, 0x34f0, 0x36fe, 0x3748, 0x37cf, 0x384a, 0x38c8,
    0x3945, 0x3968, 0x3984, 0x3a13, 0x3a4c, 0x3ba8, 0x3bec, 0x3cc1, 0x3d49, 0x3d7e,
    0x3d8a, 0x3dae, 0x3dc9, 0x3e01, 0x4632, 0x4644, 0x4673, 0x467b, 0x4683, 0x4689,
    0x46af, 0x46f4, 0x472c, 0x4785, 0x47a1, 0x47e1, 0x4816, 0x483a, 0x4894, 0x48c4,
    0x48e5, 0x492a, 0x4b10, 0x4b14, 0x4b1a, 0x4b3c, 0x4b40, 0x4b44, 0x4b55, 0x4bc7,
    0x4bea, 0x4c11, 0x4c1c, 0x4c27, 0x4c37, 0x4c47, 0x4c4d, 0x4c57, 0x4c5b, 0x4c5f,
    0x4c63, 0x4c67, 0x4c6b, 0x4c6f, 0x4c73, 0x4c77, 0x4c7b, 0x4c7f, 0x4c83, 0x4c8b,
    0x4c8f, 0x4c93, 0x4c97, 0x4c9b, 0x4c9f, 0x4ca3, 0x4ca5, 0x4cbf, 0x4cca, 0x4d0c,
    0x4d3a, 0x4df8, 0x4eea, 0x4f26, 0x4f38, 0x4f47,
    // Register-value-bridged render routines: their idiomatic signatures default each param
    // from the entry register the translated caller passes it in (sourcePtr<-IX for the tile
    // copies, column/columnOffset/boardMode<-A, colour<-C), so they read correct inputs when
    // called live by translated code. Validated transparent (game state byte-identical).
    0x3ddb, 0x3dea, 0x3e13, 0x3e1d, 0x4b46,
  ],
}
