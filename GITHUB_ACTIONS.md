# GitHub Actions - Automated Agent Building

## Setup Date: February 6, 2026

### Overview
Automated agent building using GitHub Actions and GitHub Releases, eliminating the need for a dedicated build droplet.

### Workflow Configuration
**File**: `.github/workflows/build-release.yml`

**Triggers:**
- Push to `main` branch
- Push of version tags (`v*`)
- Pull requests to `main`
- Manual dispatch (workflow_dispatch)

### Build Process
1. **Checkout code**
2. **Setup Node.js 18**
3. **Install dependencies**: `npm install` + global `pkg`
4. **Build core agent**: Creates executables for Windows, Linux, macOS using `pkg`
5. **Build helpers**: Platform-specific helper executables
6. **Create packages**: Distribution archives (zip/tar.gz)
7. **Upload artifacts**: 30-day retention
8. **Create GitHub Release**: On version tags only

### Permissions
```yaml
permissions:
  contents: write  # Required to create releases
```

### Artifacts
Generated artifacts are uploaded with 30-day retention:
- `agent-v2-windows`: Windows executable + helpers
- `agent-v2-linux`: Linux executable + helpers
- `agent-v2-macos`: macOS executable + helpers
- `agent-v2-packages`: Distribution packages

### Release Creation
On version tags (e.g., `v2.0.0`):
1. Workflow builds all platforms
2. Creates GitHub Release
3. Uploads all build artifacts to release
4. Generates release notes automatically

### Creating a New Release
```bash
# Tag and push
git tag -a v2.0.1 -m "Release v2.0.1"
git push origin v2.0.1

# Workflow automatically:
# - Builds all platforms
# - Creates release
# - Uploads binaries
```

### Backend Integration
Backend proxies downloads from GitHub Releases via `/api/releases/*` endpoints:
- `/api/releases/info` - Latest release information
- `/api/releases/download/windows` - Redirect to Windows download
- `/api/releases/download/linux` - Redirect to Linux download
- `/api/releases/download/macos` - Redirect to macOS download
- `/api/releases/versions` - List all releases

### Cost Savings
- **Eliminated**: Build droplet ($12+/month)
- **Eliminated**: DO Spaces for binaries ($5-20/month)
- **Total Savings**: ~$20-30/month

### Workflow Status
Monitor builds at: https://github.com/Independent-Business-Group/rmm-psa-agent-v2/actions

### Current Release
- **Version**: v2.0.0
- **Created**: February 6, 2026
- **Available Platforms**: Windows (Linux and macOS builds need workflow fixes)
- **Release URL**: https://github.com/Independent-Business-Group/rmm-psa-agent-v2/releases/tag/v2.0.0

### Notes
- Workflow has `fail_on_unmatched_files: false` for resilience
- Artifacts are flattened before release upload
- Only Windows binary currently included in releases (workflow needs updates for Linux/macOS)
- GitHub provides unlimited bandwidth for public release downloads
- Private repo requires GITHUB_TOKEN in backend environment variables
