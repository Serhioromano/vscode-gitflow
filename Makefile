.PHONY: sync

sync:
	@echo "==> Fetching latest from origin..."
	git fetch origin
	@echo "==> Updating main to match origin/main..."
	git checkout main
	git pull --ff-only origin main
	@echo "==> Rebasing develop onto main..."
	git checkout develop
	git rebase main
	@echo "==> Force-pushing develop to origin..."
	git push --force-with-lease origin develop
	@echo "==> Done. develop is now rebased on main and synced."
