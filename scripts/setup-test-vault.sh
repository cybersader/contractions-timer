#!/bin/bash
# Set up the test vault structure around this plugin folder
# Run from the plugin directory (git repo root)
# This creates the parent test vault that Obsidian opens

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

PLUGIN_DIR=$(pwd)
VAULT_DIR=$(realpath "$PLUGIN_DIR/../../..")

echo -e "${BLUE}Setting up test vault at: ${VAULT_DIR}${NC}"

# Create community-plugins.json to auto-enable this plugin
cat > "$PLUGIN_DIR/../../community-plugins.json" << 'EOF'
[
	"obsidian-contractions-timer"
]
EOF

# Create minimal app.json
cat > "$PLUGIN_DIR/../../app.json" << 'EOF'
{}
EOF

# Create a sample test note
cat > "$VAULT_DIR/My Contraction Session.md" << 'NOTEEOF'
# My Contraction Session

Use the timer below to track contractions. Tap "Start" when a contraction begins, "Stop" when it ends.

```contraction-timer
{"contractions":[]}
```

## Notes

- Remember the 5-1-1 rule: contractions 5 minutes apart, lasting 1 minute, for 1 hour
- Rate intensity after each contraction (1=mild, 5=intense)
- Note the location: front-only may be Braxton Hicks, wrapping suggests real labor
NOTEEOF

echo -e "${GREEN}Test vault created!${NC}"
echo ""
echo "Next steps:"
echo "1. Open Obsidian"
echo "2. Open vault: ${VAULT_DIR}"
echo "3. Go to Settings > Community Plugins > Enable community plugins"
echo "4. The Contractions Timer plugin should appear in the list"
echo "5. Open 'My Contraction Session.md' to see the timer"
