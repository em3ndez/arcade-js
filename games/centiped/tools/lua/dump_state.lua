-- SPDX-License-Identifier: GPL-3.0-only
-- Centipede (Atari, MOS 6502) per-frame RAM dump: work RAM, video RAM, sprite RAM in that fixed order,
-- 2048 bytes/frame. Bases mirror boards/centiped/hardware.json "stateRegions" AND
-- boards/centiped/memory.js dumpState() (the three banks are contiguous 0x0000-0x07FF), so a golden frame
-- memcmps the renderer's state. SAMPLING: state[0] is power-on (at load, before the CPU runs, verified all
-- zero on this board), state[N] after frames 0..N-1; the notifier fires at a frame's END, hence the extra
-- load-time dump. Retain the subscription in a global or the GC drops the tap (a flatlined/truncated file);
-- unbuffered, so readers truncate to whole frames.

local out = assert(io.open(os.getenv("STATE_OUT") or "state.bin", "wb"))
out:setvbuf("no")

local cpu = manager.machine.devices[":maincpu"]
local mem = cpu.spaces["program"]

-- CONFIGURATION this ran under (a stray MAME cfg silently corrupts every golden). Centipede is Atari 6502
-- hardware: TWO memory-mapped dip ports (DSW1 0x0800 = gameplay bits, DSW2 0x0801 = coinage), NO Konami
-- single-DSW byte. The program ROM is mapped HIGH at 0x2000-0x3FFF (0x0000-0x07FF is RAM), so the "control
-- byte" proving the ROM loaded is read at the ROM base 0x2000 (0x4C = 6502 JMP opcode; unmapped floats read
-- 0x00/0xFF). tools/mame_golden.py's 6502 config-cert reads keys: control_rom2000, dsw1, dsw2, reg_*.
-- All sampled AT SCRIPT LOAD (top-level, runs once) = the values MAME resolved at reset. DSW/ROM reads have
-- no side effects (0x2000 READ = ROM, only the WRITE side is the watchdog).
local cfgf = io.open(os.getenv("CONFIG_OUT") or "config.txt", "w")
if cfgf then
  cfgf:setvbuf("no")
  cfgf:write(string.format(
    "control_rom2000=0x%02X\ndsw1=0x%02X\ndsw2=0x%02X\nreset_vector=0x%04X\n",
    mem:read_u8(0x2000), mem:read_u8(0x0800), mem:read_u8(0x0801),
    mem:read_u8(0x3FFC) + mem:read_u8(0x3FFD) * 256))
  -- 6502 reset registers (recorded, not contract-pinned). MAME m6502 exposes PC/A/X/Y/P/SP.
  for _, rn in ipairs({ "PC", "A", "X", "Y", "P", "SP" }) do
    local ok, v = pcall(function() return cpu.state[rn].value end)
    if ok and v ~= nil then cfgf:write(string.format("reg_%s=0x%04X\n", rn, v)) end
  end
  cfgf:close()
end

-- STATE_ENABLED=0 certifies configuration only; a frames-only golden still records its dips.
if os.getenv("STATE_ENABLED") == "0" then return end

-- Order mirrors dumpState(): work RAM, then video RAM, then sprite RAM. None of these ranges hit a device
-- port or the 0x2000 watchdog; all three banks are plain RAM readable without side effects.
local REGIONS = {
  { 0x0000, 0x03FF, "ram" },      -- work RAM (1024B)
  { 0x0400, 0x07BF, "vram" },     -- video RAM 32x30 tile codes (960B)
  { 0x07C0, 0x07FF, "spriteram" } -- sprite RAM 16 objs x 4 fields (64B)
}

local function sample()
  local parts = {}
  for _, r in ipairs(REGIONS) do
    for a = r[1], r[2] do
      parts[#parts + 1] = string.char(mem:read_u8(a))
    end
  end
  out:write(table.concat(parts))
end

sample()

_G.__frame_count = 1
_G.__state_sub = emu.add_machine_frame_notifier(function()
  sample()
  _G.__frame_count = _G.__frame_count + 1
end)
