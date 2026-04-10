#!/usr/bin/env bash
# Source this file to set up MSVC environment for Rust builds in Git Bash.
# Usage: source scripts/msvc-env.sh

MSVC_VER="14.44.35207"
WIN_SDK_VER="10.0.26100.0"
MSVC_ROOT="/c/Program Files (x86)/Microsoft Visual Studio/2022/BuildTools/VC/Tools/MSVC/${MSVC_VER}"
WIN_SDK="/c/Program Files (x86)/Windows Kits/10"

export PATH="${MSVC_ROOT}/bin/Hostx64/x64:${HOME}/.cargo/bin:${PATH}"
export INCLUDE="C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Tools\\MSVC\\${MSVC_VER}\\include;C:\\Program Files (x86)\\Windows Kits\\10\\Include\\${WIN_SDK_VER}\\ucrt;C:\\Program Files (x86)\\Windows Kits\\10\\Include\\${WIN_SDK_VER}\\um;C:\\Program Files (x86)\\Windows Kits\\10\\Include\\${WIN_SDK_VER}\\shared"
export LIB="C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Tools\\MSVC\\${MSVC_VER}\\lib\\x64;C:\\Program Files (x86)\\Windows Kits\\10\\Lib\\${WIN_SDK_VER}\\ucrt\\x64;C:\\Program Files (x86)\\Windows Kits\\10\\Lib\\${WIN_SDK_VER}\\um\\x64"

echo "MSVC environment configured (MSVC ${MSVC_VER}, SDK ${WIN_SDK_VER})"
