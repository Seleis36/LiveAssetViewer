# Live Asset Price Viewer

Real-time financial data viewer backed by kdb+/q, served via Express + WebSocket, and displayed in a React/Recharts frontend. The entire stack runs locally with Docker Compose and deploys to AWS via Terraform + Ansible.

---

## Architecture

```
Browser (React/Vite)
  └─ WebSocket ──► Express (Node 20)
                     └─ node-q IPC ──► kdb+ RDB (r.q)
                                           └─ Tickerplant (tick.q) ◄── synthetic.q
```

AWS deployment: ALB → EC2 private subnets, kdb+ data on EFS, symbols cached in ElastiCache Redis.

---

## Prerequisites

- Docker + Docker Compose v2
- Node 20 (for local frontend/backend work without Docker)
- kdb+ 4.x free license — place `kc.lic` at `kdb/kc.lic`
- OpenTofu ≥ 1.9 (for infra changes)

---

## Running locally

```bash
# Copy and edit env (WS + API URLs stay at localhost defaults)
cp .env.example .env

# Start everything
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend (nginx) | http://localhost:8080 |
| Backend (Express) | http://localhost:3000 |
| kdb+ tickerplant | localhost:5010 |
| kdb+ RDB | localhost:5011 |

---

## Required environment variables

| Variable | Description |
|---|---|
| `VITE_WS_URL` | WebSocket endpoint (`ws://localhost:3000/ws` locally) |
| `VITE_API_URL` | REST base URL (`http://localhost:3000` locally) |
| `PORT` | Backend listen port (default `3000`) |
| `LOG_LEVEL` | Pino log level (default `info`) |
| `KDB_HOST` | kdb+ RDB hostname (default `kdb`) |
| `KDB_PORT` | kdb+ RDB port (default `5011`) |
| `REDIS_URL` | Redis connection URL (default `redis://redis:6379`) |

---

## Project layout

```
frontend/    React 18 + Vite + TypeScript + Zustand + Recharts
backend/     Express 4 + WebSocket + node-q + Pino
kdb/q/       tick.q · r.q · schemas.q · bars.q · feed/synthetic.q
infra/       OpenTofu modules (vpc, sg, iam, ec2, alb, ecr, efs, elasticache, ssm, cloudwatch)
ansible/     Roles: common · app · kdb · sonarqube
.github/     CI/CD workflow (lint → test → sonar → build → deploy)
```

---

## CI/CD pipeline

| Trigger | Jobs |
|---|---|
| PR → `main` | lint · test · sonarqube |
| Push → `main` | lint · test · sonarqube · build (×3) · deploy |

AWS credentials are obtained via OIDC — no long-lived secrets stored in GitHub.

---

## Deploying to AWS

```bash
# 1. Bootstrap remote state (one-time)
cd infra/bootstrap && tofu init && tofu apply

# 2. Provision infrastructure
cd infra && tofu init && tofu apply

# 3. Provision instances (first time)
ansible-playbook ansible/playbooks/site.yml

# 4. Deploy only (subsequent pushes — handled by CI)
ansible-playbook ansible/playbooks/deploy.yml -e "image_tag=<sha>"
```

---

## Connecting components

- **kdb+ → Express**: `node-q` IPC on `KDB_HOST:KDB_PORT`; Express calls `.u.sub` on startup and receives `upd` callbacks.
- **Express → Browser**: WebSocket at `/ws`; clients send `{ type: "subscribe", symbol, granularity }` and receive `snapshot` + `candle_update` frames.
- **Redis**: symbol list cached 60 s (`GET /api/symbols`).
- **EFS**: kdb+ mounts `/data` (tickerplant log + HDB) for crash recovery and historical queries.
