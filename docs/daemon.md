# Running Launcher as a daemon (Ubuntu)

Keep the launcher running in the background, start it on boot, and restart on failure.

**Default port:** `9555` (override with `PORT`).

**Data directory:** SQLite is created at `./data/launcher.db` relative to the project root. Always start the app with `WorkingDirectory` / `cwd` set to the project directory (e.g. `/path/to/launcher`).

---

## PM2 (recommended if you use nvm)

### 1. Build the app

```bash
cd /path/to/launcher
npm install
npm run build
```

### 2. Install PM2

```bash
npm install -g pm2
```

### 3. Start the app

```bash
cd /path/to/launcher
pm2 start npm --name launcher -- start
```

Production mode uses `npm start` (`NODE_ENV=production`).

### 4. Save the process list

So PM2 remembers `launcher` across PM2 restarts:

```bash
pm2 save
```

### 5. Start on boot (systemd)

Run:

```bash
pm2 startup
```

PM2 prints a **single command** to copy and run. It looks like this (paths depend on your Node/nvm install):

```bash
sudo env PATH=$PATH:$HOME/.nvm/versions/node/v22.0.0/bin \
  $HOME/.nvm/versions/node/v22.0.0/lib/node_modules/pm2/bin/pm2 \
  startup systemd -u $USER --hp $HOME
```

**Important:** Run the exact command PM2 prints. Do **not** run `sudo pm2 startup` — `sudo` does not see `pm2` on your PATH and will fail with `command not found`.

Enter your password when prompted. PM2 installs a systemd unit that restores your saved processes at boot.

### 6. Verify

```bash
pm2 list
pm2 logs launcher
pm2 status launcher
```

Open [http://localhost:9555](http://localhost:9555).

### After code changes

```bash
cd /path/to/launcher
npm run build
pm2 restart launcher
```

### Useful commands

| Action | Command |
|--------|---------|
| Status | `pm2 list` or `pm2 status launcher` |
| Logs (follow) | `pm2 logs launcher` |
| Stop | `pm2 stop launcher` |
| Restart | `pm2 restart launcher` |
| Remove from PM2 | `pm2 delete launcher` then `pm2 save` |

### Custom port

Default is `9555`. To run on another port:

```bash
pm2 delete launcher
PORT=3000 pm2 start npm --name launcher -- start
pm2 save
```

---

## systemd user service (alternative)

No PM2 required. Runs as your user.

### 1. Build

```bash
cd /path/to/launcher
npm install
npm run build
```

### 2. Create unit file

`~/.config/systemd/user/launcher.service`:

```ini
[Unit]
Description=Launcher (browser-based command runner)
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/launcher
ExecStart=/usr/bin/env npm start
Restart=on-failure
RestartSec=5
Environment=PORT=9555
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
```

If you use **nvm**, set `ExecStart` to the full path to `npm`, for example:

```ini
ExecStart=/home/youruser/.nvm/versions/node/v22.0.0/bin/npm start
```

### 3. Enable and start

```bash
systemctl --user daemon-reload
systemctl --user enable launcher
systemctl --user start launcher
systemctl --user status launcher
```

### 4. Run at boot without being logged in

```bash
loginctl enable-linger $USER
```

### Useful commands

```bash
systemctl --user status launcher
systemctl --user restart launcher
systemctl --user stop launcher
journalctl --user -u launcher -f
```

---

## Security note

This app is intended for **local use only** (`localhost`). Do not expose it to the network without authentication.
