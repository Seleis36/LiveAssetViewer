# User Stories — Live Asset Price Viewer

**Team:** Baptiste · Axel · Samy  
**Project type:** School project — DevOps / AWS  
**Aligned with:** [live-asset-price-viewer-spec.md](live-asset-price-viewer-spec.md) (v3.0.0)

Stories are ordered to be executed **as sequentially as possible**: every phase depends on the
previous one being complete, and within a phase the stories are listed in the order they should be
done. The "Depends on" line under each phase makes the critical path explicit.

---

## Phase 1 — Foundation (Project setup)

*Depends on: nothing — this is the starting point.*

| ID | Owner | Story |
|----|-------|-------|
| US-01 | Axel | Set up the mono-repo structure (`frontend/`, `backend/`, `kdb/`, `infra/`, `ansible/`) with a root `docker-compose.yml` so the whole stack runs locally with one command. |
| US-02 | Baptiste | Write the root README documenting how to start each service, required env vars and how the components connect to each other. |
| US-03 | Samy | Create a `.gitlab-ci.yml` skeleton declaring the stages in order (`lint` → `test` → `sonarqube` → `build` → `deploy`) so the pipeline shape is agreed before any job is filled in. |

---

## Phase 2 — Data layer (kdb+/q)

*Depends on: Phase 1 (repo + compose to run kdb+ locally).*

| ID | Owner | Story |
|----|-------|-------|
| US-04 | Baptiste | Define the `trade` and `bar` table schemas in `schemas.q` so all kdb+ processes share the same canonical data model from the start. |
| US-05 | Axel | Stand up a tickerplant and RDB (`tick.q` / `r.q`) fed by `synthetic.q`, keeping today's trades in memory and writing a replayable on-disk log. |
| US-06 | Samy | Write the `buildBars` q function that aggregates raw trades into OHLCV candles for any symbol, granularity and time range. |

---

## Phase 3 — Backend (Express gateway)

*Depends on: Phase 2 (the backend reads schemas and `buildBars` over kdb+ IPC).*

| ID | Owner | Story |
|----|-------|-------|
| US-07 | Samy | Bootstrap an Express + TypeScript server with `/health`, `/ready`, `GET /api/symbols` and `GET /api/history/:symbol` endpoints returning the JSON shapes from the spec, with the symbol list cached in Redis (60 s TTL). |
| US-08 | Baptiste | Add a WebSocket server that accepts `subscribe`/`unsubscribe` messages and pushes live `candle_update` events by bridging kdb+ `.u.sub` `upd` events to connected sockets, with ping/pong heartbeats. |
| US-09 | Axel | Package the backend in a multi-stage Dockerfile (build → lean `node:20-alpine` runtime, non-root user, healthcheck) so it runs as a container alongside kdb+ and Redis. |

---

## Phase 4 — Frontend (React SPA)

*Depends on: Phase 3 (the SPA consumes the REST + WebSocket API).*

| ID | Owner | Story |
|----|-------|-------|
| US-10 | Axel | Bootstrap a Vite + React 18 + TypeScript project with Zustand, ESLint and Vitest configured so components can be built and tested immediately. |
| US-11 | Samy | Build the AssetSelector dropdown (data from `/api/symbols`) and a Recharts candlestick chart (green/red candles + wicks + volume sub-chart) that displays OHLCV history fetched from `/api/history`. |
| US-12 | Baptiste | Connect the chart to the backend WebSocket (`wsClient.ts`, reconnect with back-off) so candles update in real time, and show a ConnectionIndicator reflecting socket status. |
| US-13 | Samy | Package the React app in a two-stage Dockerfile (`node` build → `nginx` serve) with the API/WS URLs injected as build args and SPA routing configured in `nginx.conf`. |

---

## Phase 5 — AWS Infrastructure (Terraform / OpenTofu)

> All resources in this phase are managed through Terraform (OpenTofu ≥ 1.7).  
> **Note:** US-14 (remote-state bucket + lock table) must be bootstrapped manually once before any
> other Terraform in this phase can run.

*Depends on: Phase 4 (all three images exist and are ready to be hosted; ECR repos created here).*

| ID | Owner | Story |
|----|-------|-------|
| US-14 | Axel | Create the S3 bucket + DynamoDB lock table for Terraform remote state, and the three ECR repositories (`frontend`, `backend`, `kdb`) with a basic lifecycle policy. |
| US-15 | Baptiste | Provision a VPC with public, private-app and private-data subnets across two AZs, including an Internet Gateway, NAT Gateway and route tables. |
| US-16 | Samy | Define the security groups (`sg-alb`, `sg-app`, `sg-kdb`, `sg-sonar`, `sg-data`) and the IAM instance profiles granting each instance least-privilege access to ECR, SSM, CloudWatch Logs and EFS. |
| US-17 | Axel | Provision the three EC2 instances on Amazon Linux 2023 in the private-app subnets — `ec2-app` (t3.medium), `ec2-kdb` (t3.large), `ec2-sonar` (t3.small) — tagged by `Role`, with SSM Session Manager instead of SSH. |
| US-18 | Baptiste | Provision ElastiCache Redis (single `cache.t4g.micro`) and an EFS file system with mount targets for kdb+ historical data and the tickerplant log in the private-data subnets. |
| US-19 | Samy | Add an ALB with an HTTPS listener (ACM cert, HTTP→HTTPS redirect) and two target groups pointing at `ec2-app`: `/ws` and `/api/*` → backend (3000), default → frontend (80). |
| US-20 | Axel | Create the SSM Parameter Store hierarchy (`/pv/kdb/host`, `/pv/kdb/port`, `/pv/redis/url`, `/pv/sonar/token`) so runtime config and secrets are available to Ansible at deploy time. |

---

## Phase 6 — Configuration Management (Ansible)

*Depends on: Phase 5 (instances must exist and be tagged before Ansible can configure them).*

| ID | Owner | Story |
|----|-------|-------|
| US-21 | Baptiste | Set up the AWS EC2 dynamic inventory (`aws_ec2.yml`, keyed by the `Role` tag) and `ansible.cfg` so playbooks target `role_app`, `role_kdb` and `role_sonar` with no static host list. |
| US-22 | Samy | Write the `common` role: OS updates, Docker + Compose plugin install, and the CloudWatch Agent installed and configured on every instance. |
| US-23 | Axel | Write the `kdb` role: fetch the kdb+ license from AWS Secrets Manager, mount EFS at `/data`, and start the kdb+ container bind-mounting the license and data dirs. |
| US-24 | Baptiste | Write the `app` role: authenticate Docker to ECR, read SSM parameters, render the `.env`, and `docker compose up` the frontend + backend; expose `site.yml` (full) and `deploy.yml` (deploy-only) playbooks. |
| US-25 | Samy | Write the `sonarqube` role to run SonarQube Community Edition as a container on `ec2-sonar` with persistent data/logs volumes, reachable on port 9000 from allowed CIDRs only. |

---

## Phase 7 — CI/CD (GitLab CI)

*Depends on: Phase 6 (the deploy job invokes the Ansible `deploy.yml` playbook).*

> GitLab CI authenticates to AWS via masked/protected CI/CD variables; the deploy job runs on the in-VPC self-hosted runner (`tags: [vpc-runner]`).

| ID | Owner | Story |
|----|-------|-------|
| US-26 | Baptiste | Implement the `lint` and `test` jobs: ESLint on frontend and backend, `tofu validate` on the infra, and Vitest with coverage uploaded as an artifact, failing the pipeline on errors. |
| US-27 | Axel | Add the `sonarqube` job that runs the Sonar scan with the coverage artifact and enforces the quality gate (≥ 80% coverage on new code, 0 vulnerabilities), failing the pipeline if breached. |
| US-28 | Samy | Add the `build` job (matrix over frontend/backend/kdb) that assumes the OIDC role, logs in to ECR and pushes each image tagged with the commit SHA and `latest`, on `main` only. |
| US-29 | Axel | Add the `deploy` job that assumes the OIDC role, installs Ansible + AWS collections, and runs `ansible-playbook deploy.yml -e image_tag=<sha>` to roll out the new images, on `main` only. |

---

## Phase 8 — Observability (CloudWatch)

*Depends on: Phase 7 (a real deployment must be running to produce logs and metrics).*

| ID | Owner | Story |
|----|-------|-------|
| US-30 | Axel | Confirm the CloudWatch Agent (from the `common` role) ships each container's logs to the `/ec2/price-viewer/{app,kdb,sonar}` log groups (30-day retention) and that the backend emits structured Pino logs. |
| US-31 | Baptiste | Create a Terraform-managed CloudWatch dashboard showing ALB request count + 5XX, EC2 CPU/memory per instance, and the active-WebSocket-connections custom metric. |
| US-32 | Samy | Set up CloudWatch alarms (backend 5XX rate > 5% over 5 min; `ec2-app` CPU > 80% over 5 min) wired to a single SNS topic that sends an email notification, to experience the alerting flow end to end. |

---

## Summary

| Owner | Stories |
|-------|---------|
| Baptiste | US-02, US-04, US-08, US-12, US-15, US-18, US-21, US-24, US-26, US-31 |
| Axel | US-01, US-05, US-09, US-10, US-14, US-17, US-20, US-23, US-27, US-29, US-30 |
| Samy | US-03, US-06, US-07, US-11, US-13, US-16, US-19, US-22, US-25, US-28, US-32 |

**Critical path:** Phase 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Each phase is a hard prerequisite for the
next; within a phase, do the stories top-to-bottom. The only off-path manual step is the one-time
remote-state bootstrap noted in US-14.
