#!/usr/bin/env bash
set -euo pipefail

# Called from a disposable checkout of loom/current. Never execute upstream code
# here: this job can push; the separate Loom checks job has a read-only token.
tag=$(gh release view --repo backnotprop/plannotator --json tagName --jq .tagName)
[[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Unexpected stable release tag: $tag" >&2; exit 1; }
git fetch --no-tags "${PLANNOTATOR_UPSTREAM:-https://github.com/backnotprop/plannotator.git}" "refs/tags/$tag"
upstream_sha=$(git rev-parse 'FETCH_HEAD^{commit}')
if git merge-base --is-ancestor "$upstream_sha" HEAD; then
  echo "$tag is already included."
  exit 0
fi

# Keep one update PR open. Updating its base preserves any manual resolutions.
pr=$(gh pr list --base loom/current --json number,headRefName --jq '[.[] | select(.headRefName | startswith("upstream-sync/"))][0].number // empty')
if [[ -n "$pr" ]]; then
  gh pr update-branch "$pr"
  branch=$(gh pr view "$pr" --json headRefName --jq .headRefName)
else
  branch="upstream-sync/$tag"
  previous=$(gh pr list --state all --head "$branch" --base loom/current --json number --jq '.[0].number // empty')
  if [[ -n "$previous" ]]; then
    echo "PR #$previous already handled $tag; leaving the human decision intact."
    exit 0
  fi
  git config user.name 'github-actions[bot]'
  git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
  git switch -c "$branch"
  clean=true
  if ! git merge --no-ff --no-edit "$upstream_sha"; then
    git merge --abort
    # A raw upstream head still opens a useful conflict PR. Only this temporary
    # local branch moves; no published branch is ever force-pushed.
    git switch -C "$branch" "$upstream_sha"
    clean=false
  fi
  git push origin "HEAD:refs/heads/$branch"
  body=$(mktemp)
  trap 'rm -f "$body"' EXIT
  cat > "$body" <<EOF
Merge upstream release $tag into the Loom fork, preserving our small patches.

Source: https://github.com/backnotprop/plannotator/releases/tag/$tag
Upstream commit: $upstream_sha

Requires Loom checks: typecheck, tests, and the production UI/CLI build.
Conflicts require manual resolution; failed checks keep this PR open.
EOF
  pr=$(gh pr create --base loom/current --head "$branch" --title "chore: sync upstream $tag" --body-file "$body")
  if [[ "$clean" == false ]]; then
    echo "Conflicts need resolving in $pr; automerge remains off."
    exit 0
  fi
fi

# Token-created PR events can require human approval; workflow_dispatch runs
# checks without a PAT. Required checks on loom/current gate the actual merge.
gh workflow run loom-checks.yml --ref "$branch"
head_sha=$(gh pr view "$pr" --json headRefOid --jq .headRefOid)
gh pr merge "$pr" --auto --merge --match-head-commit "$head_sha"
