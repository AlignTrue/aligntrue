---
title: Remote access issues
description: Solutions for common remote repository access issues
---

# Remote access issues

This guide helps you resolve common issues when using remote repositories for sources and remotes in AlignTrue.

For conceptual guidance, see [Rule Privacy and Sharing](/docs/01-guides/09-rule-privacy-sharing).

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

## Clone issues

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

2. Check the URL in your config (sources or remote_backup)

3. For private repos, use SSH instead of HTTPS:

   ```yaml
   # Change from:
   url: https://github.com/user/repo.git

   # To:
   url: git@github.com:user/repo.git
   ```

4. Verify you have access:
   ```bash
   git ls-remote git@github.com:user/repo.git
   ```

### Already Exists

**Error:**

```
fatal: destination path '.aligntrue/.remotes/personal' already exists
```

**Cause:** Previous clone attempt failed or directory exists.

**Solution:**

1. Remove the directory:

   ```bash
   rm -rf .aligntrue/.remotes/personal
   ```

2. Sync again:
   ```bash
   aligntrue sync
   ```

## Push/Pull Issues

### Push Rejected

**Error:**

```
! [rejected]        main -> main (fetch first)
error: failed to push some refs
```

**Cause:** Remote has changes you don't have locally.

**Solution:**

1. Navigate to the remote directory:

   ```bash
   cd .aligntrue/.remotes/personal
   ```

2. Pull changes:

   ```bash
   git pull origin main
   ```

3. If there are conflicts, resolve them:

   ```bash
   git status
   # Edit conflicting files
   git add .
   git commit -m "Resolve conflicts"
   ```

4. Return to project root and sync:
   ```bash
   cd ../../../
   aligntrue sync
   ```

### Merge Conflicts

**Error:**

```
CONFLICT (content): Merge conflict in rules.md
Automatic merge failed
```

**Solution:**

1. Navigate to the remote:

   ```bash
   cd .aligntrue/.remotes/personal
   ```

2. Check status:

   ```bash
   git status
   ```

3. Edit conflicting files:

   ```bash
   # Open rules.md and resolve conflicts
   # Remove conflict markers: <<<<<<<, =======, >>>>>>>
   ```

4. Complete the merge:

   ```bash
   git add rules.md
   git commit -m "Resolve merge conflict"
   git push origin main
   ```

5. Return and sync:
   ```bash
   cd ../../../
   aligntrue sync
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
   cd .aligntrue/.remotes/personal
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
# In .aligntrue/config.yaml - for sources
sources:
  - type: git
    url: git@github.com:user/repo.git # SSH URL
    personal: true

# Or for remote_backup
remote_backup:
  default:
    url: git@github.com:user/repo.git # SSH URL
```

**Option 2: Use Personal Access Token**

1. Create a token:
   - **GitHub:** Settings → Developer settings → Personal access tokens
   - **GitLab:** Profile → Access Tokens
   - **Bitbucket:** Personal settings → App passwords

2. Configure git credential helper:

   ```bash
   git config --global credential.helper store
   ```

3. On next push, enter:
   - Username: your username
   - Password: your token (not your actual password)

**Option 3: Use SSH Credential Helper**

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

```bash
git config --global http.sslVerify false
```

**Option 3: Use SSH**

SSH doesn't use SSL certificates, so this avoids the issue entirely.

## Branch issues

### Branch not found

**Error:**

```
fatal: couldn't find remote ref main
```

**Cause:** Repository uses `master` instead of `main` (or vice versa).

**Solution:**

1. Check the default branch on your git host

2. Update the branch in your config:

   ```yaml
   # For sources
   sources:
     - type: git
       url: git@github.com:user/repo.git
       ref: master # Changed from main

   # Or for remote_backup
   remote_backup:
     default:
       url: git@github.com:user/repo.git
       branch: master # Changed from main
   ```

3. Sync again:
   ```bash
   aligntrue sync
   ```

### Detached HEAD

**Problem:** Remote repository is in detached HEAD state.

**Solution:**

```bash
cd .aligntrue/.remotes/personal
git checkout main
cd ../../../
aligntrue sync
```

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

   # Update config with new URL
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
ls -la .aligntrue/.remotes/personal

# Fix ownership (replace USER with your username)
sudo chown -R USER:USER .aligntrue/.remotes/personal

# Or remove and re-clone
rm -rf .aligntrue/.remotes/personal
aligntrue sync
```

## Configuration issues

### Invalid URL Format

**Error:**

```
fatal: invalid URL 'user/repo.git'
```

**Cause:** URL is not complete.

**Solution:**

Use full URL format:

```yaml
# SSH (Recommended)
url: git@github.com:user/repo.git

# HTTPS
url: https://github.com/user/repo.git
```

### Missing URL

**Error:**

```
Error: Remote backup requires a 'url'
```

**Solution:**

Add URL to your config:

```yaml
remote_backup:
  default:
    url: git@github.com:yourusername/aligntrue-personal-rules.git
    branch: main
```

## Getting more help

If you're still stuck:

1. **Check AlignTrue logs:**

   ```bash
   aligntrue sync --verbose
   ```

2. **Validate configuration:**

   ```bash
   aligntrue check
   ```

3. **Test git access directly:**

   ```bash
   cd .aligntrue/.remotes/personal
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
