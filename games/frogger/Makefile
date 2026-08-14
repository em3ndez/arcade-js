# games/frogger — assemble your own ROM (copyrighted; never committed).
# Uses the GAME-LOCAL assembler (not ../../tools/build-rom.mjs): the maincpu image is padded to
# 0x4000 and the gfx plane1 ROM (frogger.606) gets a D0<->D1 data-line swap (decode_frogger_gfx,
# galaxian.cpp:8705) — transforms the generic concat tool cannot do. Override the source location
# with ROMZIP=/path/to/frogger.zip (or a set dir); default is ~/Downloads/frogger.

.PHONY: rom
rom:
	node tools/build-rom.mjs $(ROMZIP)
