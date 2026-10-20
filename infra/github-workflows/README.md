# GitHub Actions workflows (not active yet)

- `ci.yml` runs the web and backend tests on every push.
- `pages.yml` builds and deploys the site to GitHub Pages automatically.

The site is currently published from the `gh-pages` branch (see the README).
To switch on automatic CI and deploys:

1. Give your GitHub CLI login the workflow permission: `gh auth refresh -h github.com -s workflow`
2. Copy these files to `.github/workflows/`, then commit and push.
3. In the repo settings, set Pages → Source to "GitHub Actions".
