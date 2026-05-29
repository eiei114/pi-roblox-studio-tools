# GitHub Repository Setup

This repository was scaffolded from `eiei114/pi-extension-template`.

Create the public GitHub repository when ready:

```bash
gh repo create eiei114/pi-roblox-studio-tools \
  --public \
  --source . \
  --remote origin \
  --push
```

Recommended topics:

- `pi`
- `pi-package`
- `roblox`
- `roblox-studio`
- `mcp`
- `typescript`

After creation:

```bash
npm run ci
pi -e .
```