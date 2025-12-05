---
title: Source and remote issues
description: Solutions for common issues with remote git sources and backup destinations
---

# Source and remote issues

This guide helps you resolve common issues when using remote repositories for sources (pulling rules) and remotes (pushing backups) in AlignTrue.

For conceptual guidance, see [Rule sharing & privacy](/docs/01-guides/06-rule-sharing-privacy).

## Quick checks

1. Validate config: `aligntrue check`
2. Get verbose output: `aligntrue sync --verbose`
3. Verify the ref exists: `git ls-remote --heads <url> <ref>`

## Git source issues

### Repository not found

**Error:**

```
fatal: repository 'https://github.com/user/repo.git' not found
```

**Causes:**

1. Repository doesn't exist
2. Wrong URL
3. No access to private repository
4. Using HTTPS without credentials

**Solutions:**

1. Verify the repository exists on your git host

2. Check the URL in your config:

   ```yaml
   sources:
     - type: git
       url: https://github.com/user/repo.git
       ref: main
   ```

3. For private repos, use SSH instead of HTTPS:

   ```yaml
   sources:
     - type: git
       url: git@github.com:user/repo.git
       ref: main
   ```

4. Verify you have access:
   ```bash
   git ls-remote git@github.com:user/repo.git
   ```

### Branch not found

**Error:**

```
fatal: couldn't find remote ref main
```

**Cause:** Branch name mismatch (`main` vs `master`) or a typo in `ref`.

**Solution:**

1. List branches on the remote:

   ```bash
   git ls-remote --heads git@github.com:user/repo.git
   ```

2. Confirm the branch you need exists (`main`, `master`, or a feature branch).

3. Update the branch in your config:

   ```yaml
   sources:
     - type: git
       url: git@github.com:user/repo.git
       ref: master # Set to the actual branch name
   ```

4. Sync again:
   ```bash
   aligntrue sync
   ```

### Clone failure in cache

**Error:**

```
fatal: unable to clone from .aligntrue/.cache/remotes/...
```

**Cause:** Previous clone attempt failed or cache is corrupted.

**Solution:**

1. Clear the cached clone for the affected remote (safe to delete; cache is transient):

   ```bash
   rm -rf .aligntrue/.cache/remotes/<host>/<repo>
   ```

2. Sync again:
   ```bash
   aligntrue sync
   ```

## Remote backup configuration

### Setting up remotes

Remotes route your rules to backup git repositories. Configure in `.aligntrue/config.yaml`:

```yaml
remotes:
  personal: git@github.com:youruser/personal-rules.git
  # or with options:
  shared:
    url: git@github.com:company/shared-rules.git
    branch: main # Set if your backup repo uses a non-default branch
```

**Scopes:**

- Remote keys must match rule scopes:
  - `personal` - Rules with `scope: personal` push here
  - `shared` - Rules with `scope: shared` push here
- `branch` defaults to `main`; set it if the backup repo uses another branch.

### Invalid remotes configuration

**Error:**

```
Error: Invalid remotes configuration
```

**Solution:**

Ensure remotes are properly formatted:

```yaml
remotes:
  personal: git@github.com:user/repo.git # Simple string format
  shared: # Or object format
    url: git@github.com:company/repo.git
    branch: main # Optional, defaults to "main"
```

### Missing remotes.personal

**Error:**

```
personal-scope file(s) have no remote configured. Add remotes.personal to route them.
```

**Cause:** Rules marked `scope: personal` but no personal remote configured.

**Solution:**

Add personal remote to config:

```yaml
remotes:
  personal: git@github.com:youruser/personal-rules.git
```

Or remove `scope: personal` from rules if you don't need remote backup.

## SSH issues

### Permission Denied (publickey)

**Error:**

```
git@github.com: Permission denied (publickey).
fatal: Could not read from remote repository.
```

**Cause:** SSH key not configured or not added to your git host.

**Solution:**

1. Check if you have an SSH key:

   ```bash
   ls -la ~/.ssh
   ```

2. If no key exists, generate one:

   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```

3. Add the key to your SSH agent:

   ```bash
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_ed25519
   ```

4. Copy your public key:

   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```

5. Add it to your git host:
   - **GitHub:** [github.com/settings/keys](https://github.com/settings/keys)
   - **GitLab:** Profile → SSH Keys
   - **Bitbucket:** Personal settings → SSH keys

6. Test the connection:
   ```bash
   ssh -T git@github.com
   ```

### SSH Key Passphrase Prompts

**Problem:** SSH keeps asking for passphrase on every operation.

**Solution:**

Add your key to the SSH agent permanently:

**macOS:**

```bash
ssh-add --apple-use-keychain ~/.ssh/id_ed25519
```

Add to `~/.ssh/config`:

```
Host *
  AddKeysToAgent yes
  UseKeychain yes
  IdentityFile ~/.ssh/id_ed25519
```

**Linux:**

```bash
ssh-add ~/.ssh/id_ed25519
```

Add to `~/.bashrc` or `~/.zshrc`:

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519 2>/dev/null
```

**Windows:**

```powershell
# Start SSH agent service
Get-Service ssh-agent | Set-Service -StartupType Automatic
Start-Service ssh-agent

# Add key
ssh-add $HOME\.ssh\id_ed25519
```

### Wrong host key

**Error:**

```
WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!
```

**Cause:** Server's SSH key changed (or potential security issue).

**Solution:**

1. Verify the change is legitimate (check with your git host)

2. Remove the old key:

   ```bash
   ssh-keygen -R github.com
   ```

3. Reconnect and accept the new key:
   ```bash
   ssh -T git@github.com
   ```

## Push/Pull issues

### Push Rejected

**Error:**

```
! [rejected]        main -> main (fetch first)
error: failed to push some refs
```

**Cause:** Remote has changes you don't have locally.

**Solution:**

1. Pull changes first:

   ```bash
   git pull origin main
   ```

2. If there are conflicts, resolve them:

   ```bash
   git status
   # Edit conflicting files
   git add .
   git commit -m "Resolve conflicts"
   ```

3. Verify clean state, then push:
   ```bash
   git status
   aligntrue check
   aligntrue sync
   ```

### Merge Conflicts

**Error:**

```
CONFLICT (content): Merge conflict in rules.md
Automatic merge failed
```

**Solution:**

1. Pull and inspect the conflict:

   ```bash
   git pull origin main
   git status
   ```

2. Edit conflicting files:

   ```bash
   # Open conflicting files and resolve
   # Remove conflict markers: <<<<<<<, =======, >>>>>>>
   ```

3. Complete the merge:

   ```bash
   git add .
   git commit -m "Resolve merge conflict"
   git status
   aligntrue sync
   # If you get stuck, you can abort the merge:
   # git merge --abort
   ```

### Diverged Branches

**Error:**

```
Your branch and 'origin/main' have diverged
```

**Cause:** Local and remote have different commits.

**Solution:**

1. Pull with rebase:

   ```bash
   git pull --rebase origin main
   ```

2. If conflicts, resolve them and continue:

   ```bash
   git rebase --continue
   ```

3. Push:
   ```bash
   git push origin main
   ```

## HTTPS issues

### Authentication Failed

**Error:**

```
fatal: Authentication failed for 'https://github.com/user/repo.git'
```

**Solutions:**

**Option 1: Use SSH (Recommended)**

```yaml
sources:
  - type: git
    url: git@github.com:user/repo.git
    ref: main

remotes:
  personal: git@github.com:user/repo.git
```

**Option 2: Use Personal Access Token**

1. Create a token (minimum scopes: `repo` for private GitHub repos):
   - **GitHub:** Settings → Developer settings → Personal access tokens
   - **GitLab:** Profile → Access Tokens
   - **Bitbucket:** Personal settings → App passwords

2. Configure a secure credential helper:

   ```bash
   # macOS
   git config --global credential.helper osxkeychain

   # Windows
   git config --global credential.helper manager-core

   # Linux (temporary cache for 1 hour)
   git config --global credential.helper 'cache --timeout=3600'
   ```

3. On next push, enter:
   - Username: your username
   - Password: your token (not your actual password)

**Option 3: Use temporary credential cache (short-lived)**

```bash
git config --global credential.helper 'cache --timeout=3600'
```

### Token Expired

**Error:**

```
remote: Invalid username or password.
```

**Cause:** Personal access token expired.

**Solution:**

1. Generate a new token on your git host

2. Update stored credentials:

   ```bash
   # Remove old credentials
   git credential reject <<EOF
   protocol=https
   host=github.com
   EOF

   # Next push will prompt for new token
   ```

## Network issues

### Connection Timeout

**Error:**

```
fatal: unable to access 'https://github.com/user/repo.git/':
Failed to connect to github.com port 443: Connection timed out
```

**Solutions:**

1. Check your internet connection

2. Check if git host is accessible:

   ```bash
   ping github.com
   ```

3. Try SSH instead of HTTPS:

   ```yaml
   url: git@github.com:user/repo.git
   ```

4. Check firewall/proxy settings

5. If behind corporate proxy, configure git:
   ```bash
   git config --global http.proxy http://proxy.company.com:8080
   ```

### SSL Certificate Problem

**Error:**

```
SSL certificate problem: unable to get local issuer certificate
```

**Solutions:**

**Option 1: Update CA certificates (Recommended)**

```bash
# macOS
brew install ca-certificates

# Ubuntu/Debian
sudo apt-get update && sudo apt-get install ca-certificates

# Windows
# Download and install latest Git for Windows
```

**Option 2: Disable SSL verification (Not Recommended)**

> Warning: Disable only while diagnosing, and re-enable after fixing CA issues.

```bash
git config --global http.sslVerify false
# Re-enable once fixed
git config --global --unset http.sslVerify
```

**Option 3: Use SSH**

SSH doesn't use SSL certificates, so this avoids the issue entirely.

## Permission issues

### Permission Denied (Repository)

**Error:**

```
remote: Permission to user/repo.git denied
```

**Cause:** No write access to the repository.

**Solutions:**

1. Verify you own the repository or have write access

2. Check repository settings on your git host

3. If using organization repo, ensure you're a member

4. Create a new repository under your account:

   ```bash
   # On GitHub
   gh repo create aligntrue-personal-rules --private

   # Update remotes config with new URL
   ```

### File permission errors

**Error:**

```
error: unable to create file rules.md: Permission denied
```

**Cause:** File system permissions issue.

**Solution:**

```bash
# Check ownership
ls -la .aligntrue/.cache/remotes/

# Fix ownership (replace USER with your username)
chown -R "$USER":"$USER" .aligntrue/.cache/ # use sudo only if required

# Or clear cache and retry
rm -rf .aligntrue/.cache/remotes
aligntrue sync
```

## Getting more help

If you're still stuck:

1. **Validate configuration:**

   ```bash
   aligntrue check
   ```

2. **Check AlignTrue logs:**

   ```bash
   aligntrue sync --verbose
   ```

3. **Test git access directly:**

   ```bash
   git remote -v
   git fetch origin
   ```

4. **Check git configuration:**

   ```bash
   git config --list
   ```

5. **Review git host status:**
   - GitHub: [githubstatus.com](https://www.githubstatus.com/)
   - GitLab: [status.gitlab.com](https://status.gitlab.com/)

## Related documentation

- [Personal Repository Setup](/docs/04-reference/personal-repo-setup)
- [Joining a Team](/docs/01-guides/03-join-team)
- [Team Mode Concepts](/docs/03-concepts/team-mode)
