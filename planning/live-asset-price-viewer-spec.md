# Live Asset Price Viewer — Technical Specification

**Version**: 3.0.0  
**Status**: Draft  
**Last updated**: May 2026  
**Team**: Baptiste · Axel · Samy

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Frontend — React](#3-frontend--react)
4. [Backend — Express / Node.js](#4-backend--expressjs)
5. [Database — kdb+/q](#5-database--kdbq)
6. [Data Flow & Real-Time Pipeline](#6-data-flow--real-time-pipeline)
7. [API Contract](#7-api-contract)
8. [AWS Infrastructure](#8-aws-infrastructure)
9. [Infrastructure as Code — Terraform / OpenTofu](#9-infrastructure-as-code--terraformopentofu)
10. [Configuration Management — Ansible](#10-configuration-management--ansible)
11. [CI/CD — GitLab CI](#11-cicd--gitlab-ci)
12. [Code Quality — SonarQube](#12-code-quality--sonarqube)
13. [Observability — CloudWatch](#13-observability--cloudwatch)
14. [Appendix — Directory Layout](#14-appendix--directory-layout)

---

## 1. Product Overview

A real-time asset price viewer that ingests tick data, aggregates it into OHLCV candles in kdb+, and streams rendered candlestick charts to users through a React SPA backed by an Express gateway.

### 1.1 Core User Features

| Feature | Description |
|---|---|
| Asset selector | Dropdown of tradeable symbols sourced from the backend |
| Candle chart | Interactive OHLCV candlestick chart (Recharts) with green/red coloring and wick rendering |
| Live streaming | WebSocket push for new candle updates; no manual refresh needed |
| Connection indicator | Visible dot showing whether the WebSocket stream is live or disconnected |

### 1.2 Personas

Primary user is a student or developer learning how real-time financial data flows from a time-series database through a backend gateway to a browser chart. Secondary persona is the same person acting as a DevOps engineer deploying and observing the system on AWS.

---

## 2. Architecture Overview

```
+-----------------------------------------------------------------+
|                           AWS VPC                               |
|                                                                 |
|  +--------+   +--------------+   +---------------------------+ |
|  | Users  |-->| ALB (HTTPS)  |-->|  Private App Subnets      | |
|  +--------+   +--------------+   |                           | |
|                                  |  +---------------------+  | |
|                                  |  | ec2-app (t3.medium) |  | |
|                                  |  | Docker Compose:     |  | |
|                                  |  | - nginx (frontend)  |  | |
|                                  |  | - Express (backend) |  | |
|                                  |  +----------+----------+  | |
|                                  |             | kdb+ IPC    | |
|                                  |  +----------v----------+  | |
|                                  |  | ec2-kdb (t3.large)  |  | |
|                                  |  | Docker: kdb+ + EFS  |  | |
|                                  |  +---------------------+  | |
|                                  |                           | |
|                                  |  +---------------------+  | |
|                                  |  | ec2-sonar (t3.small)|  | |
|                                  |  | Docker: SonarQube   |  | |
|                                  |  +---------------------+  | |
|                                  +---------------------------+ |
|                                                                 |
|  ElastiCache Redis  |  EFS  |  S3 (tf state)  |  CloudWatch   |
+-----------------------------------------------------------------+
```

### 2.1 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Zustand, Recharts |
| API Gateway | Node.js 20, Express 4, `ws` library, `node-q` |
| Tick DB | kdb+ 4.0 |
| Cache | ElastiCache Redis 7 |
| Compute | EC2 on Amazon Linux 2023 (Docker + Docker Compose) |
| IaC | Terraform / OpenTofu >= 1.7 |
| Config management | Ansible 10 |
| CI/CD | GitLab CI |
| Code quality | SonarQube Community Edition (self-hosted on EC2) |
| Monitoring | CloudWatch Agent + CloudWatch Logs + CloudWatch Metrics |

---

## 3. Frontend — React

### 3.1 Project Bootstrap

```bash
npm create vite@latest price-viewer -- --template react-ts
```

Key dependencies:

```json
{
  "dependencies": {
    "react": "^18.3",
    "react-dom": "^18.3",
    "zustand": "^4.5",
    "recharts": "^2.12",
    "dayjs": "^1.11"
  },
  "devDependencies": {
    "vite": "^5.3",
    "@vitejs/plugin-react": "^4.3",
    "typescript": "^5.5",
    "vitest": "^2.0",
    "@testing-library/react": "^16.0",
    "eslint": "^9.0"
  }
}
```

### 3.2 Component Tree

```
App
+-- <Header>
|   +-- <AssetSelector>        -- symbol dropdown (data from /api/symbols)
|   +-- <ConnectionIndicator>  -- green/red WS health dot
|
+-- <ChartPanel>
    +-- <CandleChart>          -- Recharts ComposedChart with custom CandleShape
    |   +-- <CandleSeries>     -- OHLCV bars, bull #26a69a / bear #ef5350
    |   +-- <VolumeBars>       -- 20% sub-chart, semi-transparent
    |   +-- <XYAxes>
    +-- <StatusBar>            -- last update timestamp
```

### 3.3 State Management (Zustand)

**`useMarketStore`**

```typescript
interface MarketStore {
  selectedAsset: string;
  candles: Candle[];
  setSelectedAsset: (sym: string) => void;
  pushCandles: (candles: Candle[]) => void;
  updateLastCandle: (candle: Candle) => void;
}
```

**`useConnectionStore`**

```typescript
interface ConnectionStore {
  status: 'connecting' | 'open' | 'closed' | 'error';
}
```

### 3.4 WebSocket Client

Located at `src/services/wsClient.ts`. Handles:

- Reconnection with exponential back-off (base 500 ms, max 30 s)
- Heartbeat ping/pong (30 s interval)
- JSON message framing: `{ type, payload }`
- Subscription: sends `{ type: 'subscribe', symbol }` on connect
- Incoming message types: `snapshot`, `candle_update`, `error`

### 3.5 Candlestick Chart Implementation

Use `recharts` `ComposedChart`. Candles use a custom `<CandleShape>` component via the `shape` prop of a `Bar`. Wicks are drawn as `ReferenceLine` elements.

Candle coloring: `#26a69a` (bull) / `#ef5350` (bear).

Volume bars render in a 20% height sub-chart sharing the same x-axis.

### 3.6 Environment Variables

```
VITE_WS_URL=wss://api.example.com/ws
VITE_API_URL=https://api.example.com
```

Injected at Docker build time as `--build-arg`. Never ship `.env.production` inside the image.

### 3.7 Frontend Docker Image

```dockerfile
# Stage 1 -- build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --frozen-lockfile
COPY . .
ARG VITE_WS_URL VITE_API_URL
RUN npm run build

# Stage 2 -- serve
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://localhost/health || exit 1
```

`nginx.conf` must include `try_files $uri /index.html` for SPA routing and `Cache-Control: no-cache` for `index.html`.

---

## 4. Backend — Express/Node.js

### 4.1 Responsibilities

The Express service bridges the React frontend and the kdb+ tick plant. It:

- Exposes REST endpoints for symbol list and candle history
- Runs a WebSocket server that fans out kdb+ `upd` events to subscribed clients
- Connects to kdb+ via `node-q` IPC
- Logs structured JSON to stdout

### 4.2 Project Structure

```
backend/
+-- src/
|   +-- server.ts          -- Express + WS bootstrap
|   +-- config.ts          -- env variable validation
|   +-- routes/
|   |   +-- symbols.ts     -- GET /api/symbols
|   |   +-- history.ts     -- GET /api/history/:symbol
|   |   +-- health.ts      -- GET /health, GET /ready
|   +-- ws/
|   |   +-- wsServer.ts    -- ws.Server setup
|   |   +-- dispatcher.ts  -- fan-out kdb+ events to WS clients
|   +-- kdb/
|       +-- client.ts      -- node-q connection
|       +-- queries.ts     -- q query builders
|       +-- subscriber.ts  -- .u.sub tickerplant subscriber
+-- Dockerfile
+-- package.json
+-- tsconfig.json
```

### 4.3 Key Dependencies

```json
{
  "express": "^4.19",
  "ws": "^8.17",
  "node-q": "^2.5",
  "ioredis": "^5.3",
  "pino": "^9.2",
  "pino-http": "^10.2"
}
```

### 4.4 kdb+ IPC via `node-q`

`kdb/client.ts` opens a persistent IPC connection to the kdb+ RDB. A keepalive ping runs every 15 s. On failure the client reconnects with exponential back-off.

### 4.5 kdb+ Subscriber

```typescript
// Register as a tickerplant subscriber on startup
await kdbClient.execute(`.u.sub[\`trade; \`]`);

// kdb+ pushes upd messages; node-q fires an event
kdbClient.on('upd', (table: string, data: KTable) => {
  dispatcher.fanOut(table, data);
});
```

### 4.6 Backend Docker Image

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --frozen-lockfile
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json .
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/server.js"]
```

---

## 5. Database — kdb+/q

### 5.1 Tick Plant Architecture

```
Synthetic feed (synthetic.q)
       |  .u.upd[`trade; ...]
       v
Tickerplant (tick.q)
  +-- writes on-disk log (replay on restart)
  +-- publishes to RDB (r.q) -- today's trades in memory
  +-- publishes to Express backend subscriber
```

### 5.2 Schema Definitions

```q
// trade table -- schemas.q
trade:([]
  time:`timestamp$();
  sym:`symbol$();
  price:`float$();
  size:`long$();
  side:`symbol$()   / `buy or `sell
)

// OHLCV bar table
bar:([]
  time:`timestamp$();
  sym:`symbol$();
  open:`float$();
  high:`float$();
  low:`float$();
  close:`float$();
  volume:`long$()
)
```

### 5.3 Core q Functions

```q
// Candle aggregation -- bars.q
buildBars:{[sym;gran;startTime;endTime]
  data: select from trade where sym=sym, time within (startTime;endTime);
  gran_ns: granToNs gran;
  select
    open:  first price,
    high:  max   price,
    low:   min   price,
    close: last  price,
    volume: sum  size
    by time: gran_ns xbar time, sym
  from data
 }

// Symbol list
getSymbols:{[] select sym, description from symbolRef}
```

### 5.4 kdb+ on EC2

kdb+ requires a license file (`kc.lic`). Ansible fetches it from AWS Secrets Manager at deploy time and writes it to `/opt/kdb/kc.lic` on `ec2-kdb`. The Docker container bind-mounts that path and the `QLIC` environment variable points to it.

Data is persisted to EFS, mounted on the host at `/data` and bind-mounted into the container.

---

## 6. Data Flow & Real-Time Pipeline

```
synthetic.q  -->  tickerplant  -->  RDB (in-memory)
                      |
                      +--> Express (.u.sub subscriber)
                                |
                                +--> WebSocket clients (browser)
```

For local development the synthetic feed replays a static tick file at 1x speed. The normalised `trade` schema is identical to what a live feed handler would produce, so swapping sources requires no downstream changes.

---

## 7. API Contract

### 7.1 REST Endpoints

#### `GET /health`
Returns `200 OK` with `{ "status": "ok" }`. Used by the ALB health check.

#### `GET /ready`
Returns `200` when the kdb+ connection is established, `503` otherwise.

#### `GET /api/symbols`

```json
{
  "symbols": [
    { "sym": "AAPL", "description": "Apple Inc." },
    { "sym": "EURUSD", "description": "Euro / US Dollar" }
  ]
}
```

Cached in Redis with a 60 s TTL.

#### `GET /api/history/:symbol`

Query params: `granularity` (required), `from` (ISO8601), `to` (ISO8601).

```json
{
  "sym": "AAPL",
  "granularity": "5m",
  "candles": [
    { "t": "2025-01-10T09:30:00Z", "o": 185.12, "h": 185.90, "l": 184.80, "c": 185.55, "v": 12043210 }
  ]
}
```

### 7.2 WebSocket Protocol

Upgrade path: `wss://api.example.com/ws`

#### Client to Server

```json
{ "type": "subscribe",   "symbol": "AAPL", "granularity": "1m" }
{ "type": "unsubscribe", "symbol": "AAPL" }
{ "type": "ping", "ts": 1723456789000 }
```

#### Server to Client

```json
{ "type": "snapshot",     "sym": "AAPL", "candles": [...] }
{ "type": "candle_update","sym": "AAPL", "candle": { "t":..., "o":..., "h":..., "l":..., "c":..., "v":... } }
{ "type": "pong",         "ts": 1723456789000 }
{ "type": "error",        "code": "INVALID_SYMBOL", "message": "Unknown symbol: FOOBAR" }
```

---

## 8. AWS Infrastructure

All resources are provisioned through Terraform (OpenTofu >= 1.7). The only manual step is creating the remote state S3 bucket and DynamoDB table once before the first `tofu apply`.

### 8.1 Region & Account

Single AWS account, region `eu-west-1`.

### 8.2 VPC Design

CIDR: `10.0.0.0/16`, two AZs (`a`, `b`).

| Subnet tier | CIDR | Purpose |
|---|---|---|
| Public | `10.0.0.0/24`, `10.0.1.0/24` | ALB, NAT Gateway |
| Private App | `10.0.10.0/24`, `10.0.11.0/24` | EC2 instances |
| Private Data | `10.0.20.0/24`, `10.0.21.0/24` | Redis, EFS |

### 8.3 Load Balancer

ALB in public subnets with an HTTPS listener (ACM certificate). HTTP/80 redirects to HTTPS.

Routing rules (priority order):

1. Path `/ws` -> `tg-backend` (WebSocket upgrade, port 3000)
2. Path `/api/*` -> `tg-backend` (Express REST, port 3000)
3. Default -> `tg-frontend` (nginx, port 80)

Both target groups point at `ec2-app` on their respective ports.

### 8.4 EC2 Instances

| Instance | Type | Purpose |
|---|---|---|
| `ec2-app` | t3.medium | Docker Compose: nginx (frontend) + Express (backend) |
| `ec2-kdb` | t3.large | Docker: kdb+ tickerplant + RDB, EFS mount |
| `ec2-sonar` | t3.small | Docker: SonarQube Community Edition |

All instances run Amazon Linux 2023 in private app subnets. Internet access is via NAT Gateway. An IAM instance profile grants each instance least-privilege access to ECR, SSM, CloudWatch Logs and EFS.

SSH access is managed through **AWS Systems Manager Session Manager** — no port 22 is open to the internet. Ansible connects via the `community.aws.aws_ssm` connection plugin.

### 8.5 Security Groups

| Security Group | Inbound rule |
|---|---|
| `sg-alb` | 443 + 80 from `0.0.0.0/0` |
| `sg-app` | 80 + 3000 from `sg-alb` only |
| `sg-kdb` | 5010 from `sg-app` only |
| `sg-sonar` | 9000 from `sg-app` + allowed team CIDRs |
| `sg-data` | 6379 (Redis) from `sg-app` only |

### 8.6 ECR

Three repositories: `price-viewer/frontend`, `price-viewer/backend`, `price-viewer/kdb`.

Lifecycle policy: keep the last 10 tagged images, delete untagged images after 1 day.

### 8.7 ElastiCache Redis

```
Engine:    Redis 7.2
Node type: cache.t4g.micro
Mode:      Single node
```

Used to cache the symbol list (60 s TTL).

### 8.8 EFS

Mounted on `ec2-kdb` at `/data`. Two directories inside:

- `/data/hdb` - kdb+ historical data files
- `/data/tp-log` - tickerplant log for crash recovery

### 8.9 S3 & Remote State

One S3 bucket (`pv-tf-state`) for Terraform remote state with versioning enabled. One DynamoDB table (`pv-tf-state-lock`) for state locking.

---

## 9. Infrastructure as Code — Terraform / OpenTofu

### 9.1 Repository Layout

```
infra/
+-- modules/
|   +-- vpc/           -- VPC, subnets, IGW, NAT GW, route tables
|   +-- alb/           -- ALB, listeners, target groups
|   +-- ec2/           -- launch template, instances, instance profiles
|   +-- sg/            -- security groups
|   +-- ecr/           -- ECR repos + lifecycle policies
|   +-- elasticache/   -- Redis node
|   +-- efs/           -- EFS + mount targets
|   +-- iam/           -- instance profiles, IAM roles + policies
|   +-- ssm/           -- parameter hierarchy
|   +-- cloudwatch/    -- log groups, dashboard, alarms
|
+-- main.tf
+-- variables.tf
+-- outputs.tf
+-- terraform.tfvars
+-- backend.tf
+-- versions.tf
```

### 9.2 Remote State

```hcl
terraform {
  backend "s3" {
    bucket         = "pv-tf-state"
    key            = "terraform.tfstate"
    region         = "eu-west-1"
    encrypt        = true
    dynamodb_table = "pv-tf-state-lock"
  }
}
```

> **Bootstrap note (US-14):** Create the S3 bucket and DynamoDB table manually once before running `tofu init`. This is a standard first-time setup step and a known chicken-and-egg situation with Terraform remote state.

### 9.3 EC2 Module Interface

```hcl
module "ec2_app" {
  source        = "./modules/ec2"
  name          = "app"
  instance_type = "t3.medium"
  ami           = data.aws_ami.amazon_linux_2023.id
  subnet_id     = module.vpc.private_app_subnet_ids[0]
  sg_ids        = [aws_security_group.app.id]
  iam_profile   = module.iam.app_instance_profile_name

  tags = {
    Role = "app"
    Env  = var.environment
  }
}
```

Terraform outputs the private IPs of each instance. Ansible reads them via the AWS dynamic inventory plugin, filtering by the `Role` tag.

### 9.4 SSM Parameters

Runtime configuration is stored in SSM Parameter Store. Ansible reads these at deploy time and writes them into a `.env` file on each EC2 instance for Docker Compose to consume.

```
/pv/
+-- kdb/host        (String -- private IP of ec2-kdb)
+-- kdb/port        (String: "5010")
+-- redis/url       (SecureString)
+-- sonar/token     (SecureString -- used by GitLab CI)
```

Secrets are never committed to the repository or baked into Docker images.

---

## 10. Configuration Management — Ansible

Ansible handles everything that happens **inside** the EC2 instances after Terraform provisions them: installing Docker, deploying containers, and configuring SonarQube.

### 10.1 Repository Layout

```
ansible/
+-- inventories/
|   +-- aws_ec2.yml          -- dynamic inventory (AWS EC2 plugin, filter by tag)
|
+-- roles/
|   +-- common/              -- OS updates, Docker + Compose install, CW agent
|   +-- app/                 -- pull images from ECR, write .env, docker compose up
|   +-- kdb/                 -- pull kdb+ image, mount EFS, start container
|   +-- sonarqube/           -- run SonarQube Community Edition container
|
+-- playbooks/
|   +-- site.yml             -- full provisioning (all roles, run once)
|   +-- deploy.yml           -- deploy only (app + kdb, called by GitLab CI)
|
+-- group_vars/
|   +-- all.yml              -- shared vars (region, ECR registry URL)
|   +-- role_app.yml         -- app-specific vars (ports, image names)
|   +-- role_kdb.yml         -- kdb-specific vars (EFS path, port)
|
+-- ansible.cfg
```

### 10.2 Dynamic Inventory

```yaml
# inventories/aws_ec2.yml
plugin: amazon.aws.aws_ec2
regions:
  - eu-west-1
filters:
  tag:Env: production
keyed_groups:
  - key: tags.Role
    prefix: role
```

This automatically creates Ansible groups `role_app`, `role_kdb` and `role_sonar` from EC2 tags. No static host list to maintain.

### 10.3 Common Role (key tasks)

```yaml
# roles/common/tasks/main.yml
- name: Install Docker
  dnf:
    name: docker
    state: present

- name: Start and enable Docker
  systemd:
    name: docker
    state: started
    enabled: yes

- name: Install Docker Compose plugin
  dnf:
    name: docker-compose-plugin
    state: present

- name: Install CloudWatch Agent
  dnf:
    name: amazon-cloudwatch-agent
    state: present

- name: Configure CloudWatch Agent
  template:
    src: cw-agent-config.json.j2
    dest: /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
  notify: restart cloudwatch agent
```

### 10.4 App Role (key tasks)

```yaml
# roles/app/tasks/main.yml
- name: Authenticate Docker to ECR
  shell: >
    aws ecr get-login-password --region eu-west-1
    | docker login --username AWS --password-stdin {{ ecr_registry }}

- name: Read SSM parameters
  community.aws.aws_ssm_parameter_store:
    name: "{{ item }}"
    region: eu-west-1
  register: ssm_params
  loop:
    - /pv/redis/url
    - /pv/kdb/host
    - /pv/kdb/port

- name: Write .env file for Docker Compose
  template:
    src: app.env.j2
    dest: /opt/price-viewer/.env
    mode: '0600'

- name: Pull latest images and restart services
  community.docker.docker_compose_v2:
    project_src: /opt/price-viewer
    pull: always
    state: present
```

### 10.5 Secrets

Sensitive values (ECR credentials, SSM paths, SonarQube admin password) are stored in **Ansible Vault**, encrypted with a password retrieved from AWS Secrets Manager at runtime via a vault password script (`vault_pass.py`).

---

## 11. CI/CD — GitLab CI

### 11.1 Pipeline Overview

```
.gitlab-ci.yml

Triggers:
  push --> main          lint --> test --> sonarqube --> build --> deploy
  merge request --> main lint --> test --> sonarqube (no build, no deploy)
```

The `build` and `deploy` stages authenticate to AWS using credentials supplied as
**masked/protected GitLab CI/CD variables** (`AWS_ACCESS_KEY_ID` /
`AWS_SECRET_ACCESS_KEY`) scoped to ECR push, SSM read and EC2 describe. The
deploy job runs on the in-VPC self-hosted GitLab runner (`tags: [vpc-runner]`).

### 11.2 Full `.gitlab-ci.yml`

```yaml
stages:
  - lint
  - test
  - sonarqube
  - build
  - deploy

variables:
  AWS_REGION: eu-west-1
  ECR_REGISTRY: <account_id>.dkr.ecr.eu-west-1.amazonaws.com

.node:
  image: node:20
  cache:
    key: "$CI_COMMIT_REF_SLUG-npm"
    paths:
      - frontend/.npm/
      - backend/.npm/

# ---- LINT -------------------------------------------------
lint:
  extends: .node
  stage: lint
  before_script:
    - apt-get update && apt-get install -y curl unzip
    - curl -fsSL https://get.opentofu.org/install-opentofu.sh -o install-opentofu.sh
    - chmod +x install-opentofu.sh && ./install-opentofu.sh --install-method standalone --opentofu-version 1.8.5
  script:
    - cd frontend && npm ci --cache .npm --prefer-offline && npm run lint && cd ..
    - cd backend && npm ci --cache .npm --prefer-offline && npm run lint && cd ..
    - cd infra && tofu init -backend=false && tofu validate

# ---- TEST -------------------------------------------------
test:
  extends: .node
  stage: test
  needs: ["lint"]
  script:
    - cd frontend && npm ci --cache .npm --prefer-offline && npm run test -- --coverage && cd ..
    - cd backend && npm ci --cache .npm --prefer-offline && npm run test -- --coverage && cd ..
  artifacts:
    paths:
      - frontend/coverage/lcov.info
      - backend/coverage/lcov.info
    expire_in: 1 week

# ---- SONARQUBE --------------------------------------------
sonarqube:
  stage: sonarqube
  needs: ["test"]
  image:
    name: sonarsource/sonar-scanner-cli:latest
    entrypoint: [""]
  variables:
    SONAR_HOST_URL: "${SONAR_HOST_URL}"
    SONAR_USER_HOME: "${CI_PROJECT_DIR}/.sonar"
    GIT_DEPTH: "0"
  rules:
    - if: '$SONAR_TOKEN'
  script:
    - sonar-scanner

# ---- BUILD ------------------------------------------------
build:
  stage: build
  needs: ["sonarqube"]
  image: docker:24
  services:
    - docker:24-dind
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'
  parallel:
    matrix:
      - SERVICE: [frontend, backend, kdb]
  before_script:
    - apk add --no-cache aws-cli
    - aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"
  script:
    - docker build -t "$ECR_REGISTRY/price-viewer/$SERVICE:$CI_COMMIT_SHA" -t "$ECR_REGISTRY/price-viewer/$SERVICE:latest" "./$SERVICE"
    - docker push "$ECR_REGISTRY/price-viewer/$SERVICE:$CI_COMMIT_SHA"
    - docker push "$ECR_REGISTRY/price-viewer/$SERVICE:latest"

# ---- DEPLOY -----------------------------------------------
deploy:
  stage: deploy
  needs: ["build"]
  tags: [vpc-runner]          # runs on the in-VPC self-hosted runner
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'
  variables:
    AWS_DEFAULT_REGION: "$AWS_REGION"
  before_script:
    - echo "$ANSIBLE_VAULT_PASSWORD" > .vault_pass
  script:
    - ansible-playbook ansible/playbooks/deploy.yml
        --vault-password-file .vault_pass
        -e "image_tag=$CI_COMMIT_SHA"
  after_script:
    - rm -f .vault_pass
```

### 11.3 Branch Strategy

| Event | Jobs run |
|---|---|
| Merge request to `main` | lint, test, sonarqube |
| Push to `main` | lint, test, sonarqube, build (x3), deploy |

---

## 12. Code Quality — SonarQube

### 12.1 Deployment

SonarQube Community Edition runs as a Docker container on `ec2-sonar`, managed by the `sonarqube` Ansible role.

```yaml
# roles/sonarqube/tasks/main.yml
- name: Run SonarQube container
  community.docker.docker_container:
    name: sonarqube
    image: sonarqube:community
    state: started
    restart_policy: always
    ports:
      - "9000:9000"
    volumes:
      - sonarqube_data:/opt/sonarqube/data
      - sonarqube_logs:/opt/sonarqube/logs
```

The SonarQube UI is reachable on port 9000, from allowed team CIDRs only (enforced by `sg-sonar`).

### 12.2 Project Configuration

```properties
# sonar-project.properties (repo root)
sonar.projectKey=price-viewer
sonar.projectName=Live Asset Price Viewer
sonar.sources=frontend/src,backend/src
sonar.tests=frontend/src,backend/src
sonar.test.inclusions=**/*.test.ts,**/*.spec.ts
sonar.javascript.lcov.reportPaths=frontend/coverage/lcov.info,backend/coverage/lcov.info
sonar.qualitygate.wait=true
```

### 12.3 Quality Gate

The pipeline fails (via the `sonarqube-quality-gate-action` step) if any of these thresholds are breached on new code:

| Metric | Threshold |
|---|---|
| Coverage on new code | >= 80% |
| Duplicated lines | <= 3% |
| Reliability rating | A |
| Security vulnerabilities | 0 |

---

## 13. Observability — CloudWatch

### 13.1 Logging

The **CloudWatch Agent** runs on every EC2 instance, installed by the `common` Ansible role. It ships Docker container logs to CloudWatch Logs.

Log groups:
- `/ec2/price-viewer/app` - frontend + backend container logs
- `/ec2/price-viewer/kdb` - kdb+ container logs
- `/ec2/price-viewer/sonar` - SonarQube container logs

Log retention: 30 days.

The backend uses Pino with these fields on every line: `timestamp`, `level`, `service`, `requestId`, `durationMs`.

### 13.2 Host Metrics

The CloudWatch Agent also collects EC2 host-level metrics not available in the default namespace (memory, disk), via a JSON config deployed by Ansible:

```json
{
  "metrics": {
    "metrics_collected": {
      "mem":  { "measurement": ["mem_used_percent"] },
      "disk": { "measurement": ["disk_used_percent"], "resources": ["/"] }
    }
  }
}
```

### 13.3 Dashboard

A Terraform-managed CloudWatch dashboard `price-viewer` with:

- ALB: RequestCount, HTTPCode_Target_5XX
- EC2: CPUUtilization, mem_used_percent per instance
- Custom metric: active WebSocket connections (emitted by the backend via the AWS SDK)

### 13.4 Alarms

| Alarm | Threshold | Action |
|---|---|---|
| Backend 5XX rate | > 5% over 5 min | SNS -> email |
| ec2-app CPU | > 80% over 5 min | SNS -> email |

Both alarms share a single SNS topic with an email subscription.

---

## 14. Appendix — Directory Layout

```
price-viewer/
|
+-- frontend/                  # React SPA (Vite + TypeScript)
|   +-- src/
|   |   +-- components/
|   |   +-- services/          # wsClient.ts, apiClient.ts
|   |   +-- stores/            # Zustand stores
|   +-- public/
|   +-- Dockerfile
|   +-- nginx.conf
|   +-- vite.config.ts
|   +-- package.json
|
+-- backend/                   # Express gateway
|   +-- src/
|   +-- Dockerfile
|   +-- package.json
|
+-- kdb/                       # kdb+ tick plant
|   +-- q/
|   |   +-- tick.q
|   |   +-- r.q
|   |   +-- schemas.q
|   |   +-- bars.q
|   |   +-- feed/
|   |       +-- synthetic.q
|   +-- scripts/
|   |   +-- startup.sh
|   +-- Dockerfile
|
+-- infra/                     # Terraform / OpenTofu
|   +-- modules/
|   |   +-- vpc/
|   |   +-- alb/
|   |   +-- ec2/
|   |   +-- sg/
|   |   +-- ecr/
|   |   +-- elasticache/
|   |   +-- efs/
|   |   +-- iam/
|   |   +-- ssm/
|   |   +-- cloudwatch/
|   +-- main.tf
|   +-- variables.tf
|   +-- outputs.tf
|   +-- backend.tf
|   +-- terraform.tfvars
|
+-- ansible/                   # Configuration management
|   +-- inventories/
|   |   +-- aws_ec2.yml        # Dynamic inventory (EC2 tags)
|   +-- roles/
|   |   +-- common/            # Docker, CloudWatch agent
|   |   +-- app/               # Deploy frontend + backend
|   |   +-- kdb/               # Deploy kdb+
|   |   +-- sonarqube/         # Deploy SonarQube
|   +-- playbooks/
|   |   +-- site.yml           # Full provisioning (run once)
|   |   +-- deploy.yml         # Deploy only (called by GitLab CI)
|   +-- group_vars/
|   +-- ansible.cfg
|
+-- .gitlab-ci.yml             # GitLab CI pipeline
|
+-- sonar-project.properties   # SonarQube project config
+-- docker-compose.yml         # Local dev stack
+-- user-stories.md
+-- README.md
```

### Local Development

```bash
# Start all services locally
docker compose up

# Available at:
# frontend  -> http://localhost:5173  (Vite HMR)
# backend   -> http://localhost:3000
# kdb+      -> localhost:5010 (synthetic feed)
# redis     -> localhost:6379
```

---

*End of specification.*
