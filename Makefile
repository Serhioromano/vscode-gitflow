.PHONY: sync

# Sync develop with main, optionally merging GitHub PRs first.
#
# Usage:
#   make sync                  # just rebase develop onto main
#   make sync PRS=84,86,83     # squash-merge those PRs on GitHub, pull main, then rebase

PRS ?=

sync:
	@echo "🔽 ==> Fetching latest from origin..."
	git fetch origin
	@echo "🔀 ==> Switching to main..."
	git checkout main
	@if [ -n "$(PRS)" ]; then \
		echo "🔗 ==> Merging PRs on GitHub: $(PRS)..."; \
		IFS=','; \
		for pr in $(PRS); do \
			echo "  🫧 -> Squash-merging PR #$$pr into main..."; \
			gh pr merge $$pr --squash --delete-branch || { echo "❌ ERROR: Failed to merge PR #$$pr."; exit 1; }; \
		done; \
	fi
	@echo "📥 ==> Pulling main (now includes merged PRs)..."
	git pull --ff-only origin main
	@echo "🧬 ==> Rebasing develop onto main..."
	git checkout develop
	git rebase main
	@echo "🚀 ==> Force-pushing develop to origin..."
	git push --force-with-lease origin develop
	@echo "✅ ==> Done. develop is now rebased on main and synced."
