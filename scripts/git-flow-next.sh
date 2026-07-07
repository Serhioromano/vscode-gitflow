#!/usr/bin/env bash
# Wrapper: runs git-flow-next inside the gitflow-next container.
# Usage: git-flow-next.sh <subcommand> [args...]
#
# Set this path in VS Code settings: "gitflow.path"
# Example: /home/sergey/www/vscode-gitflow/scripts/git-flow-next.sh

CONTAINER="vscode-gitflow-next"

# Ensure container is running
if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    echo "ERROR: Container '$CONTAINER' is not running. Run: docker compose up -d gitflow-next" >&2
    exit 1
fi

# Forward all arguments to git-flow inside the container, from /repo
exec docker exec -w /repo "$CONTAINER" git flow "$@"
