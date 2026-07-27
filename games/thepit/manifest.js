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
  // entropyPin only if The Pit couples its RNG to timing (unknown until translation).
}
