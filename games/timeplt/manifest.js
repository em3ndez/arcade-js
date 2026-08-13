// SPDX-License-Identifier: GPL-3.0-only

export default {
  id: "timeplt",
  title: "Time Pilot",
  year: 1982,
  manufacturer: "Konami",
  orientation: "vertical",
  screen: { width: 256, height: 224, rot: 90 }, // MAME ROT90

  cpu: "z80",
  board: "timeplt",
  mameDriver: "timeplt.cpp",

  runtime: "idiomatic",

  rom: {
    zip: "timeplt.zip",
    images: {
      maincpu: {
        parts: ["tm1", "tm2", "tm3"],
        size: 0x6000,
        sha256: "ec89258096bfcf64f5940f85cc58a67b89b6061834fb13f6829e88534a8e9066",
      },
      // A SECOND Z80 with its own program, unlike DK's i8035 sample player. Not modelled;
      // declared because it is a disassembly target of its own. MAME: "timeplt_audio:tpsound".
      tpsound: {
        parts: ["tm7"],
        size: 0x1000,
        sha256: "d98da26e5ae670504d48b610d1956907c17fd8ecb9e3f0192b010bcb351023e8",
      },
      tiles: {
        parts: ["tm6"],
        size: 0x2000,
        sha256: "c557f9c38a04c15c11c981708a59510d50f00e86bb920831595d41260584bf95",
      },
      sprites: {
        parts: ["tm4", "tm5"],
        size: 0x4000,
        sha256: "e92b2ffbe01ee8ede0f0a1df0ef5b3c31776a2ac140cd46959d65535006588c5",
      },
      // b4 and b5 are the palette PROMs, e9 the sprite lookup, e12 the char lookup.
      proms: {
        parts: ["timeplt.b4", "timeplt.b5", "timeplt.e9", "timeplt.e12"],
        size: 0x0240,
        sha256: "09aae834a5310925d8700fbbaececbcee7868177634bbcb4314df0b57f129a66",
      },
    },
  },

  // Audio: the "clips" model — one recorded clip per soundlatch command, played ABOVE the
  // emulation (the 2nd Z80 `tpsound` + its 2x AY-3-8910 are NOT emulated). The main CPU writes
  // the command to 0xC000 and pulses 0xC304 to wake the audio CPU; the player keys off the
  // 0xC000 write. `map` is the committed, data-only model (audio/sounds.js); `samples` is the
  // gitignored directory the recorder fills (games/timeplt/tools/record_samples.py) with one
  // WAV per command plus an index.json. Omit both and the game is silent.
  audio: {
    map: "audio/sounds.js",
    samples: "audio/samples",
  },

  // ALL BITS ARE ACTIVE LOW -- a pressed control clears its bit, so IN0/IN1/IN2 idle at 0xFF.
  // DSW0 also reads 0xFF, but DSW1 reads 0x4B: that is its default SETTINGS, not an idle-high
  // port (see the dips block). Bit assignments are KONAMI8_SYSTEM_10 and KONAMI8_MONO_8WAY.
  inputs: {
    ports: { in0: 0xc300, in1: 0xc320, in2: 0xc340 },
    actions: {
      left:   { port: 0xc320, bit: 0x01 },
      right:  { port: 0xc320, bit: 0x02 },
      up:     { port: 0xc320, bit: 0x04 },
      down:   { port: 0xc320, bit: 0x08 },
      fire:   { port: 0xc320, bit: 0x10 },
      coin:   { port: 0xc300, bit: 0x01 },
      coin2:  { port: 0xc300, bit: 0x02 },
      service:{ port: 0xc300, bit: 0x04 },
      start1: { port: 0xc300, bit: 0x08 },
      start2: { port: 0xc300, bit: 0x10 },
      // IN2 is the cocktail player-2 stick, same layout as IN1; nothing binds to it.
    },
    keys: {
      ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
      ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
      Space: "fire", KeyZ: "fire", KeyX: "fire",
      Digit5: "coin", KeyC: "coin", Digit1: "start1", Digit2: "start2",
    },
  },

  convergence: {
    // idiomatic -- nmiReturnPC is what the interrupt PUSHES; at a yield the counter is stale, so the
    // engine is told where control ACTUALLY is. It lands in the excluded stack window.
    idiomatic: { nmiReturnPC: 0x0b93 },
    pollPCs: [0x0b93],
    stateExclude: { stack: [0xafd6, 0xb000] }, // [start, end) -- the measured stack, nothing more
  },

  // MEASURED from MAME under -noreadconfig. DSW1's 0x4B decomposes exactly as the driver's
  // table says: 3 lives (0x03), upright (0x04 clear), bonus at 10000/50000 (0x08),
  // difficulty 4 (0x40), demo sounds on (0x80 clear).
  dipswitches: { dsw0: 0xff, dsw1: 0x4b },
};
