// SPDX-License-Identifier: GPL-3.0-only
// Atari Tempest (1981), set `tempest` (rev 3). MOS 6502 + Atari Vector Generator (QuadraScan color VECTOR).
// Driver atari/tempest.cpp; board spec boards/tempest/hardware.json + scratch machine-notes.md.
// ⚠ §2 SKELETON IN PROGRESS: the vector render pipeline (boards/tempest/{avg.js,vector-raster.js}) is built
// and byte-exact-verified vs MAME; the board device layer (memory/io/video) is up; machine.js boot + the
// §3 lift are pending, so this game is NOT yet registered in games/registry.js and NOT yet bootable.
//
// VECTOR display: no tilemap/framebuffer. The 6502 builds a display list in vector RAM (0x2000-0x2FFF), the
// AVG walks it (256B state PROM), and the render is byte-exact vs MAME's headless AVI (480x640). ROT270 is
// baked into the render transform (vector-raster.js), so the frame is already display-oriented -> rot: 0.
// maincpu image = 5 program ROMs concatenated (0x5000); machine.js maps it at 0x9000 + reloads the last
// 4K at 0xF000 (reset/IRQ vectors), per MAME's ROM_RELOAD.

export default {
  id: "tempest",
  title: "Tempest",
  year: 1981,
  manufacturer: "Atari",
  orientation: "vertical",
  screen: { width: 480, height: 640, rot: 0 }, // ROT270 already baked into the vector transform

  cpu: "6502", // MOS 6502 @ 1.512MHz (12.096MHz/8)
  board: "tempest",
  mameDriver: "tempest.cpp",

  rom: {
    zip: "tempest.zip",
    images: {
      maincpu: {
        parts: ["136002-133.d1", "136002-134.f1", "136002-235.j1", "136002-136.lm1", "136002-237.p1"],
        size: 0x5000,
        sha256: "3697ff0d18a8d3114e4cc023b2af76a7054712b1cb7536628c56838a2a0d3399",
      },
      vectorrom: {
        parts: ["136002-138.np3"],
        size: 0x1000,
        sha256: "c9d7fc0469085d04682dfba3f6f3730bfd818d613207fbf211b3232eb23fb321",
      },
      avgprom: {
        parts: ["136002-125.d7"],
        size: 0x100,
        sha256: "45fdce76e631695940da6a1d94517177403591046e83bbabdbb72c674906d361",
      },
      // mathbox user2 (136002.126); user3 (127-132) is nibble-interleaved -> a dedicated assembler,
      // added when the mathbox is implemented.
      mathbox_user2: {
        parts: ["136002.126"],
        size: 0x20,
        sha256: "14efb14ac87a8db219fb998e4ce14fa62488f1c9cfd882b41b9eb09efffee373",
      },
    },
  },

  // Inputs (pending grounding): spinner (4-bit rotary, IN1 0x0D00 b0-3), fire + superzapper (POKEY pots),
  // start1/2, coins on IN0. Wired exactly once §3 reaches the input reads.
  inputs: {
    ports: { in0: 0, in1: 1, dsw2: 2 },
    actions: {
      coin: { port: 0, bit: 0x04 }, // IN0 b2 COIN1 (active-low)
    },
    keys: { Digit5: "coin" },
  },

  // audio (§5): 2x POKEY @ 1.512MHz -> SYNTH model (like centiped/galaxian). Grounded from a play-time
  // register write-tap before choosing clips-vs-synth (runbook §5). Placeholder until the audio pass.
  audio: null,

  entropyPin: null,
};
