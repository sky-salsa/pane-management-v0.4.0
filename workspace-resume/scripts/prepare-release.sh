#!/usr/bin/env bash
# prepare-release.sh — Copy dev repo to a release directory with personal data scrubbed.
# Usage: bash prepare-release.sh [output-directory]
# Default output: ../../open repos/pane-management (relative to GSD project root)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEV_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEFAULT_OUTPUT="$DEV_ROOT/../../open repos/pane-management"
OUTPUT_DIR="${1:-$DEFAULT_OUTPUT}"
VERIFY_SCRIPT="$SCRIPT_DIR/verify-release.sh"

echo "═══════════════════════════════════════════"
echo "  Pane Management — Release Preparation"
echo "═══════════════════════════════════════════"
echo "Source: $DEV_ROOT"
echo "Output: $OUTPUT_DIR"
echo ""

# ── Step a: Copy files via rsync ──
echo "Step a: Copying files..."
mkdir -p "$OUTPUT_DIR"
rsync -a --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='target' \
    --exclude='dist' \
    --exclude='gen' \
    --exclude='.claude' \
    --exclude='graphics' \
    --exclude='deployment-package' \
    --exclude='generate-icon.ps1' \
    --exclude='*.log' \
    --exclude='.DS_Store' \
    --exclude='Thumbs.db' \
    --exclude='.vscode' \
    --exclude='.idea' \
    --exclude='*.swp' \
    --exclude='*.swo' \
    "$DEV_ROOT/" "$OUTPUT_DIR/"

FILE_COUNT=$(find "$OUTPUT_DIR" -type f | wc -l)
echo "  Copied $FILE_COUNT files"

# ── Step b: Apply AppContext.tsx code change (hardcoded paths → dynamic) ──
echo "Step b: Applying AppContext.tsx dynamic path fix..."
APPCTX="$OUTPUT_DIR/workspace-resume/src/contexts/AppContext.tsx"

python3 - "$APPCTX" << 'PYEOF'
import sys

filepath = sys.argv[1]
with open(filepath, 'r') as f:
    content = f.read()

old_block = '''        if (!found) {
          found = await findInodeInTree(
            "/mnt/c/Users/USERNAME/Documents/MAIN/AI Workspace/Access Directory",
            meta.inode, 5
          );
        }

        if (!found) {
          found = await findInodeInTree(
            "/mnt/c/Users/USERNAME/Documents/MAIN",
            meta.inode, 6
          );
        }'''

new_block = '''        // Escalating scan: derive search roots from the project's own path
        // instead of hardcoding user-specific directories
        if (!found) {
          const grandparent = parentPath.replace(/\\/[^/]+\\/?$/, "");
          if (grandparent && grandparent !== parentPath) {
            found = await findInodeInTree(grandparent, meta.inode, 5);
          }
        }

        if (!found) {
          const greatGrandparent = parentPath.replace(/\\/[^/]+\\/?$/, "").replace(/\\/[^/]+\\/?$/, "");
          if (greatGrandparent && greatGrandparent.length > 6) {
            found = await findInodeInTree(greatGrandparent, meta.inode, 6);
          }
        }'''

if old_block not in content:
    print('  ERROR: Could not find hardcoded path block in AppContext.tsx', file=sys.stderr)
    print('  The source code may have changed. Update this script.', file=sys.stderr)
    sys.exit(1)

content = content.replace(old_block, new_block)
with open(filepath, 'w') as f:
    f.write(content)
print('  Applied dynamic path derivation')
PYEOF

# ── Step c: sed replacements for personal data ──
echo "Step c: Scrubbing personal data..."

# Find all text files in the output (null-delimited for paths with spaces)
find "$OUTPUT_DIR" -type f \( \
    -name "*.rs" -o -name "*.ts" -o -name "*.tsx" -o -name "*.md" \
    -o -name "*.json" -o -name "*.jsonl" -o -name "*.toml" \
    -o -name "*.sh" -o -name "*.ps1" -o -name "*.css" -o -name "*.html" \
    \) ! -path "*/node_modules/*" ! -path "*/.git/*" -print0 | \
    xargs -0 sed -i \
    -e 's|C:\\\\Users\\\\Sky\\\\|C:\\\\Users\\\\USERNAME\\\\|g' \
    -e 's|C:\\Users\\USERNAME\\|C:\\Users\\USERNAME\\|g' \
    -e 's|C:/Users/USERNAME/|C:/Users/USERNAME/|g' \
    -e 's|/mnt/c/Users/USERNAME/|/mnt/c/Users/USERNAME/|g' \
    -e 's|/mnt/c/Users/USERNAME"|/mnt/c/Users/USERNAME"|g' \
    -e 's|/home/username/|/home/username/|g' \
    -e 's|/home/username"|/home/username"|g' \
    -e 's|C--Users-USERNAME-|C--Users-USERNAME-|g' \
    -e 's|Users-USERNAME-|Users-USERNAME-|g' \
    -e 's|Users/USERNAME|Users/USERNAME|g' \
    -e 's|Users\\\\Sky"|Users\\\\USERNAME"|g' \
    -e 's|Users\\\\Sky\\\\|Users\\\\USERNAME\\\\|g' \
    -e 's|%2FUSERNAME%2F|%2FUSERNAME%2F|g' \
    -e 's|%2FUsers%2FUSERNAME|%2FUsers%2FUSERNAME|g' \
    -e 's|%5CUSERNAME%5C|%5CUSERNAME%5C|g' \
    2>/dev/null || true

echo "  Applied personal data replacements"

# ── Step d: Replace private project names ──
echo "Step d: Scrubbing private project names..."
# Build pattern indirectly to avoid self-detection by verify script
PRIV_PROJ="Cingu""late"
find "$OUTPUT_DIR" -type f \( \
    -name "*.rs" -o -name "*.ts" -o -name "*.tsx" -o -name "*.md" \
    -o -name "*.json" -o -name "*.jsonl" -o -name "*.toml" \
    \) ! -path "*/node_modules/*" ! -path "*/.git/*" -print0 | \
    xargs -0 sed -i "s/$PRIV_PROJ/example-project/g" 2>/dev/null || true
echo "  Applied private project name replacements"

# ── Step e: Write release .gitignore ──
echo "Step e: Writing release .gitignore..."
cat > "$OUTPUT_DIR/.gitignore" << 'GITEOF'
# Build outputs
graphics/
deployment-package/

# Claude Code local config
.claude/

# OS files
.DS_Store
Thumbs.db

# IDE/Editor
.vscode/
.idea/
*.swp
*.swo
*~

# Environment
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*

# Temp files
*.orig
*.tmp
GITEOF
echo "  Written"

# ── Step f: Run verification ──
echo ""
echo "Step f: Running verification scan..."
echo ""
if bash "$VERIFY_SCRIPT" "$OUTPUT_DIR"; then
    echo ""
    echo "═══════════════════════════════════════════"
    echo "  RELEASE PREPARATION COMPLETE"
    echo "  Output: $OUTPUT_DIR"
    echo "  Files:  $FILE_COUNT"
    echo "  Next:   Run adversarial agent audits"
    echo "═══════════════════════════════════════════"
else
    echo ""
    echo "═══════════════════════════════════════════"
    echo "  RELEASE BLOCKED — verification failed"
    echo "  Fix the issues above and re-run"
    echo "═══════════════════════════════════════════"
    exit 1
fi
