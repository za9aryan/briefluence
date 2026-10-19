# Deploy on Oracle Cloud (Always Free)

Everything runs on one free ARM server: Postgres, the API (with its daily jobs), the website and
Caddy (automatic HTTPS). The files are in [`deploy/oracle/`](../deploy/oracle).

```
visitor ──https──▶ Caddy :443 ──▶ website (Next.js :3000) ──/api/v1──▶ API (:4000) ──▶ Postgres
```

Time: about an hour the first time. You need: a card for Oracle sign-up (Always Free is not
charged), and ideally a domain (you can start without one, see step 8).

---

## 1. Put the latest code on GitHub (on your Mac)

```bash
cd ~/Desktop/projects/briefluence
git push origin main
```

## 2. Create the Oracle Cloud account

1. Go to <https://signup.cloud.oracle.com> and sign up.
2. **Home region: Germany Central (Frankfurt)** — closest to Armenia. It cannot be changed later.
3. Verify the card (a small hold that is released). You stay on Always Free unless you upgrade.

## 3. Create the server

Menu ☰ → **Compute → Instances → Create instance**.

| Setting     | Value                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------- |
| Name        | `briefluence`                                                                               |
| Image       | **Canonical Ubuntu 24.04** (the aarch64 build is picked automatically for Ampere)           |
| Shape       | **Ampere → VM.Standard.A1.Flex**, **2 OCPU, 12 GB memory** (Always Free)                    |
| Networking  | Create new virtual cloud network + **public subnet**, **Assign a public IPv4 address: yes** |
| SSH keys    | **Generate a key pair for me → Save private key** (keep this file safe)                     |
| Boot volume | 100 GB (Always Free includes 200 GB in total)                                               |

Click **Create**. When it is _Running_, copy the **Public IP address**.

> "Out of capacity for shape VM.Standard.A1.Flex": Frankfurt's free ARM servers are busy. Try
> another _availability domain_ in the same form, or try again a bit later.

## 4. Open web ports in Oracle's firewall

Instance page → **Primary VNIC → Subnet → Security → Default security list → Add ingress rules**,
three rules, each with _Source CIDR_ `0.0.0.0/0`:

| IP protocol | Destination port |
| ----------- | ---------------- |
| TCP         | 80               |
| TCP         | 443              |
| UDP         | 443              |

(Port 22 for SSH is already open.)

## 5. Connect to the server (from your Mac)

```bash
chmod 400 ~/Downloads/ssh-key-*.key
ssh -i ~/Downloads/ssh-key-*.key ubuntu@YOUR_SERVER_IP
```

Answer `yes` to the fingerprint question. You are now on the server; every command below runs there.

## 6. Get the code on the server

**If the GitHub repository is private** (recommended), give the server read-only access:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github -N "" -C oracle-briefluence
cat ~/.ssh/github.pub
```

Copy the printed line → GitHub → the repository → **Settings → Deploy keys → Add deploy key** →
paste, name it `oracle`, leave _Allow write access_ **off** → **Add key**. Then:

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/github\n' >> ~/.ssh/config
git clone git@github.com:za9aryan/briefluence.git ~/briefluence
```

(If the repository is public: `git clone https://github.com/za9aryan/briefluence.git ~/briefluence`.)

## 7. One-time server setup

```bash
cd ~/briefluence
./deploy/oracle/setup.sh
exit
```

This installs Docker, opens ports 80/443 in Ubuntu's own firewall, turns on automatic security
updates and schedules a daily backup at 03:30. Log in again (step 5) so Docker works without `sudo`.

## 8. Your address

- **With a domain** (e.g. `briefluence.am`): at your DNS provider add an **A record** for the name
  pointing to the server IP. On Cloudflare set it to **DNS only** (grey cloud) for now so the
  HTTPS certificate can be issued; you can turn the orange cloud on later with SSL mode
  _Full (strict)_.
- **No domain yet**: use `<ip-with-dashes>.sslip.io`, e.g. IP `158.180.12.34` →
  `158-180-12-34.sslip.io`. It works with real HTTPS right away; switch to your domain later
  (change `.env`, re-run step 10).

## 9. Settings

```bash
cd ~/briefluence/deploy/oracle
cp .env.example .env
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
echo "JWT_ACCESS_SECRET=$(openssl rand -hex 32)"
echo "JWT_EMAIL_SECRET=$(openssl rand -hex 32)"
echo "TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)"
nano .env
```

In `nano`, replace every `CHANGE_ME`:

- `DOMAIN`, `WEB_URL`, `API_URL`, `CORS_ORIGINS` — your address from step 8 (the URLs with `https://`).
- The four secrets — paste the values printed above.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` — your admin login (strong password, at least 8 characters).
- `EMAIL_FROM` — e.g. `briefluence <no-reply@briefluence.am>`.

Save with **Ctrl+O, Enter**, exit with **Ctrl+X**. Keep `.env` private; it never goes to GitHub.

## 10. Start

```bash
cd ~/briefluence
./deploy/oracle/deploy.sh
```

The first build takes 10–20 minutes. Then all four services show **Up**. Watch the API start:

```bash
cd ~/briefluence/deploy/oracle && docker compose logs -f api
```

Wait for `Nest application successfully started`, then **Ctrl+C**.

## 11. Create the admin

```bash
./deploy/oracle/admin.sh
```

Open `https://YOUR_ADDRESS` and log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Done.

---

## Everyday tasks

**Release a new version** — on your Mac `git push`, then on the server:

```bash
cd ~/briefluence && ./deploy/oracle/deploy.sh
```

Database changes are applied automatically when the API starts.

**Logs**: `cd ~/briefluence/deploy/oracle && docker compose logs -f api` (or `web`, `caddy`, `db`).

**Restart**: `docker compose restart api web`.

**Backups**: every night in `~/briefluence/backups` (database + uploaded images, 14 days). Copy
them off the server now and then, from your Mac:

```bash
scp -i ~/Downloads/ssh-key-*.key "ubuntu@YOUR_SERVER_IP:~/briefluence/backups/*" ~/briefluence-backups/
```

Manual backup: `./deploy/oracle/backup.sh`. Restore (asks for confirmation, backs up first):
`./deploy/oracle/restore.sh backups/db-YYYY-MM-DD_HHMM.dump`.

**Going live for real**: as Instagram/TikTok/Google/Apple apps and Ameriabank are approved, put
their keys in `.env`, set the matching mock switch to `false` (`SOCIAL_MOCK`, `OAUTH_LOGIN_MOCK`,
`PAYMENT_PROVIDER=ameriabank`), and once all are real set `ALLOW_MOCKS_IN_PRODUCTION=false`. For
real emails create a free Resend account, verify the domain, set `EMAIL_TRANSPORT=resend` and
`RESEND_API_KEY`. Then `docker compose up -d` in `deploy/oracle`.

## Troubleshooting

| Problem                                   | Check                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Site does not open at all                 | Step 4 rules exist; `sudo iptables -L INPUT -n \| head` shows ACCEPT for 80/443; `docker compose ps` shows `caddy` Up    |
| Browser warns about the certificate       | DNS A record points to this IP (`dig +short YOUR_DOMAIN`), Cloudflare is _DNS only_; see `docker compose logs caddy`     |
| `api` keeps restarting                    | `docker compose logs api` — usually a missing or invalid value in `.env` (the error names it)                            |
| Build stops with "killed" / out of memory | Add swap: `sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |
| Oracle emails that the instance is idle   | Oracle may reclaim Always Free servers with very low use; a running site normally stays above the threshold              |

Oracle's free limits change from time to time — check the current
[Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm) page.
