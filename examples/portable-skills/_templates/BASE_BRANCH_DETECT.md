## Detect base branch

```bash
_BASE=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
echo "BASE_BRANCH: $_BASE"
```

Use the `_BASE` value wherever the instructions say `<base>`.
