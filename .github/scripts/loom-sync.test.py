"""Run with python3 .github/scripts/loom-sync.test.py; no GitHub access."""

import os
from pathlib import Path
import subprocess
import tempfile

SCRIPT = Path(__file__).with_name("loom-sync.sh").resolve()


def check(case):
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        repo = root / "repo"
        remote = root / "remote.git"
        repo.mkdir()
        git_env = dict(os.environ, GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_NOSYSTEM="1")

        def git(*args):
            return subprocess.check_output(
                ["git", *args], cwd=repo, env=git_env, text=True
            ).strip()

        git("init", "-b", "loom/current")
        git("config", "user.name", "Sync test")
        git("config", "user.email", "sync@example.invalid")
        (repo / "shared").write_text("base\n")
        git("add", "shared")
        git("commit", "-m", "base")
        git("switch", "-c", "upstream")
        (repo / "shared").write_text("upstream\n")
        git("commit", "-am", "upstream release")
        git("tag", "v1.0.1")
        upstream = git("rev-parse", "HEAD")
        git("switch", "loom/current")
        (repo / ("shared" if case == "conflict" else "patch")).write_text("fork patch\n")
        git("add", "shared", "patch" if case != "conflict" else "shared")
        git("commit", "-m", "fork patch")
        patch = git("rev-parse", "HEAD")
        if case == "current":
            git("merge", "--no-edit", "upstream")
        git("clone", "--bare", str(repo), str(remote))
        git("remote", "add", "origin", str(remote))
        if case == "existing":
            git("switch", "-c", "upstream-sync/v1.0.1")
            git("merge", "--no-edit", "upstream")
            git("push", "origin", "HEAD")
            git("switch", "loom/current")

        # Only GitHub's transport is stubbed; merges and pushes use real Git.
        (root / "gh").write_text("""#!/bin/sh
printf '%s\\n' "$*" >> "$CALLS"
case "$*" in
  'release view '*) echo v1.0.1 ;;
  'pr list --base '*) [ "$CASE" != existing ] || echo 9 ;;
  'pr list --state all '*) [ "$CASE" != closed ] || echo 7 ;;
  'pr create '*) echo https://example.invalid/pull/1 ;;
  'pr view '*headRefName*) echo upstream-sync/v1.0.1 ;;
  'pr view '*headRefOid*) git rev-parse refs/remotes/origin/upstream-sync/v1.0.1 ;;
esac
exit 0
""")
        (root / "gh").chmod(0o755)
        calls = root / "calls"
        env = dict(git_env, PATH=f"{root}:{os.environ['PATH']}",
                   PLANNOTATOR_UPSTREAM=str(remote), CALLS=str(calls), CASE=case)
        result = subprocess.run(["bash", str(SCRIPT)], cwd=repo, env=env,
                                capture_output=True, text=True)
        assert result.returncode == 0, result.stdout + result.stderr
        commands = calls.read_text()
        if case in ("current", "closed"):
            assert "pr create" not in commands
            assert "workflow run" not in commands
        else:
            head = git("rev-parse", "refs/remotes/origin/upstream-sync/v1.0.1")
            assert ("pr create" in commands) == (case != "existing")
            if case == "existing":
                assert "pr update-branch 9" in commands
            git("merge-base", "--is-ancestor", upstream, head)
            if case == "conflict":
                assert head == upstream
                assert "workflow run" not in commands and "pr merge" not in commands
            else:
                git("merge-base", "--is-ancestor", patch, head)
                assert "workflow run loom-checks.yml --ref upstream-sync/v1.0.1" in commands
                assert f"--auto --merge --match-head-commit {head}" in commands
        print(f"{case}: passed")


for scenario in ("current", "clean", "conflict", "closed", "existing"):
    check(scenario)
