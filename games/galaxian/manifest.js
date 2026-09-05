// SPDX-License-Identifier: GPL-3.0-only
// Namco Galaxian (1979), parent set `galaxian`. Grounded in mame-src/src/mame/galaxian/galaxian.cpp:
// galaxian_base@7486, galaxian_map_base@1746 + galaxian_map_discrete@1739, INPUT_PORTS(galaxian)@3069,
// ROM_START(galaxian)@9749, GAME()@16795 (ROT90); timing in galaxian.h; video in galaxian_v.cpp.
// Custom discrete sound (galaxian_a.cpp) -- NO sound CPU, so audio is record/replay (§5), not emulated.

export default {
  id: "galaxian",
  title: "Galaxian",
  year: 1979,
  manufacturer: "Namco",
  orientation: "vertical",
  screen: { width: 256, height: 224, rot: 90 }, // MAME ROT90 (galaxian.cpp:16795); native raster 256x224

  cpu: "z80", // Z80 @ 3.072MHz (GALAXIAN_PIXEL_CLOCK/3/2). core/cpu/z80.js
  board: "galaxian",
  mameDriver: "galaxian.cpp",

  runtime: "idiomatic", // born-live on the generator engine; translated fallback until each routine lands
  idiomaticComplete: false, // §3/§4 in progress -- skeleton stage

  rom: {
    zip: "galaxian.zip",
    images: {
      // ROM_START(galaxian)@9749. Z80 maps ROM 0x0000-0x3FFF; the board zero-pads this 0x2800 image to
      // that region (MAME ROM_REGION fill 0x00). sha256 is of the raw concatenation (build-rom.mjs).
      maincpu: {
        parts: ["galmidw.u", "galmidw.v", "galmidw.w", "galmidw.y", "7l"],
        size: 0x2800,
        sha256: "d2618302d06493a71fffb3669c12892fe730a200cca992c99944bc6ddcb0d39c",
      },
      // gfx1: two 0x800 halves are the two bitplanes; 8x8 chars + 16x16 sprites both decode from it.
      gfx1: {
        parts: ["1h.bin", "1k.bin"],
        size: 0x1000,
        sha256: "86e4acd03a04edfec437cb22f4e4cd261fb4e116cf9a433a4c8067d5abbcbade",
      },
      // 32-byte color PROM = the whole 32-entry palette (PALETTE(32)). No LUT PROMs.
      proms: {
        parts: ["6l.bpr"],
        size: 0x20,
        sha256: "b92f96ccd00630ab03416df168df36f851bd831483b59a8cdc28b66207cf4257",
      },
    },
  },

  // Direct memory-mapped input ports (no PPI), all IP_ACTIVE_HIGH (pressed=1). Bits from
  // INPUT_PORTS(galaxian)@3069; idle IN0=0 IN1=0 IN2=0x04 (Lives=3), MAME-measured (boards/galaxian/io.js).
  inputs: {
    ports: { in0: 0x6000, in1: 0x6800, in2: 0x7000 },
    actions: {
      coin:   { port: "in0", bit: 0x01 }, // IPT_COIN1
      coin2:  { port: "in0", bit: 0x02 }, // IPT_COIN2
      left:   { port: "in0", bit: 0x04 }, // P1 left (2-way)
      right:  { port: "in0", bit: 0x08 }, // P1 right (2-way)
      fire:   { port: "in0", bit: 0x10 }, // P1 button 1
      start1: { port: "in1", bit: 0x01 }, // IPT_START1
      start2: { port: "in1", bit: 0x02 }, // IPT_START2
    },
    keys: { // KeyboardEvent.code values (web/player.html matches on e.code)
      ArrowLeft: "left", KeyA: "left",
      ArrowRight: "right", KeyD: "right",
      Space: "fire",
      Digit5: "coin", KeyC: "coin",
      Digit1: "start1", Digit2: "start2",
    },
  },

  // audio (§5): recorded from MAME. Sound-write surface 0x6004-7 lfo / 0x6800-7 sound_w / 0x7800 pitch.
  //   audio: { map: "audio/sounds.js", samples: "audio/samples" },
  // convergence (§4 clock-free): nmiReturnPC filled once the main loop is disassembled. Interrupt is the
  //   vblank NMI gated by irq_enable @0x7001 (hardware.json). entropyPin discovered in §4.

  entropyPin: null,
};
