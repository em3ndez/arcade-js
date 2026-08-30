# SPDX-License-Identifier: GPL-3.0-only
# `make -C games/pooyan rom` assembles + sha256-verifies the Pooyan ROM from YOUR dump
# (bring-your-own-ROM; parts + sha256 are in manifest.js). Mirrors games/dkong/Makefile.
.PHONY: rom
rom:
	node ../../tools/build-rom.mjs pooyan $(ROMZIP)
