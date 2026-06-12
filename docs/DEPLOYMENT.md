# Manual Deployment Runbook — AWS + SonarQube

CI (GitHub Actions) only runs lint, tests and the SonarQube scan.
Because no IAM OIDC provider is available, **everything that touches AWS is done
locally** with your own credentials: Terraform/OpenTofu provisions, a shell script
pushes images to ECR, Ansible configures the EC2 instances.

Region for everything: **us-east-1**.

---

## 0. Local prerequisites

| Tool | Check |
|---|---|
| AWS CLI v2, credentials configured | `aws sts get-caller-identity` |
| OpenTofu ≥ 1.9 | `tofu version` |
| Docker | `docker info` |
| Ansible ≥ 2.15 + boto3 | `ansible --version`, `python3 -c "import boto3"` |
| Ansible collections | `ansible-galaxy collection install amazon.aws community.aws community.docker ansible.posix` |
| kdb+ binaries + licence | `q` in PATH (or `QBIN`/`QHOME` set), `kc.lic` on disk |

IAM permissions needed: EC2, VPC, ELB, ECR, ElastiCache, EFS, SSM,
Secrets Manager, CloudWatch, SNS, S3, DynamoDB, IAM (instance profiles).

## 1. One-time AWS bootstrap

```sh
cd infra/bootstrap
tofu init && tofu apply        # creates S3 bucket pv-tf-state + DynamoDB lock table
```

Store the kdb+ licence in Secrets Manager (the kdb Ansible role reads it):

```sh
aws secretsmanager create-secret \
  --name pv/kdb/license \
  --secret-string file://$HOME/.kx/kc.lic \
  --region us-east-1
```

(Optional, HTTPS) Request an ACM certificate in us-east-1 for your domain,
validate it via DNS, note the ARN. Skip for HTTP-only.

## 2. Provision infrastructure — phase 1

Edit `infra/terraform.tfvars`:

```hcl
aws_region          = "us-east-1"
environment         = "production"
alarm_email         = "axel.maral@gmail.com"
sonar_allowed_cidrs = ["<your-ip>/32"]      # who may reach SonarQube :9000
acm_certificate_arn = ""                     # or the ACM ARN for HTTPS
```

```sh
cd infra
tofu init && tofu apply
```

Note the outputs: `alb_dns_name`, `ecr_repository_urls`, `efs_dns_name`,
`redis_url`, `ec2_kdb_private_ip`.

## 3. Provision — phase 2 (SSM parameters)

`kdb_host` and `redis_url` only exist after phase 1. Feed them back:

```hcl
# append to terraform.tfvars (never commit — gitignored)
kdb_host    = "<ec2_kdb_private_ip output>"
redis_url   = "<redis_url output>"
sonar_token = "<token — see step 6, PLACEHOLDER until then>"
```

```sh
tofu apply        # populates /pv/kdb/host, /pv/redis/url, /pv/sonar/token in SSM
```

## 4. Build and push Docker images

```sh
./scripts/push-images.sh v1
```

Builds frontend, backend and kdb images and pushes them to ECR.
The frontend is intentionally built **without** `VITE_API_URL`/`VITE_WS_URL`:
it uses same-origin `/api` + `/ws` URLs, which the ALB routes to the backend.

## 5. Configure instances with Ansible

⚠️ **Network path**: `ansible.cfg` connects over SSH to **private IPs**
(dynamic inventory tag `Env=production`, groups by `Role`). From your machine
this only works through one of:
- an SSM port-forwarding session / SSM default host management,
- a bastion host in the public subnet (`ProxyJump` in `~/.ssh/config`),
- running Ansible from a small EC2/Cloud9 inside the VPC.

Then:

```sh
export ECR_REGISTRY=<account_id>.dkr.ecr.us-east-1.amazonaws.com
export EFS_DNS_NAME=<efs_dns_name output>

cd ansible
ansible-inventory --graph                          # sanity-check inventory
ansible-playbook playbooks/site.yml -e image_tag=v1   # first full provisioning
```

`site.yml` runs: common → kdb (licence from Secrets Manager, EFS mount,
container) → app (SSM params → .env → docker compose) → sonarqube.

## 6. SonarQube

The sonarqube role starts SonarQube on `ec2-sonar:9000` (private subnet,
reachable only from `sonar_allowed_cidrs` via your VPC path).

1. Open `http://<ec2_sonar_private_ip>:9000` (through the same tunnel/bastion),
   log in `admin/admin`, change the password.
2. Create project with key **`price-viewer`** (must match `sonar-project.properties`).
3. My Account → Security → Generate token (type: *Project Analysis Token*).
4. GitHub repo → Settings → Secrets and variables → Actions → add:
   - `SONAR_TOKEN` = the token
   - `SONAR_HOST_URL` = SonarQube URL **reachable from GitHub runners**

⚠️ **GitHub-hosted runners cannot reach a private-subnet SonarQube.**
Pick one:
- **SonarCloud** (simplest): use sonarcloud.io, `SONAR_HOST_URL=https://sonarcloud.io`,
  add `sonar.organization` to `sonar-project.properties`;
- expose SonarQube publicly (new ALB rule/listener + open SG to 0.0.0.0/0 — weak);
- a **self-hosted GitHub runner** inside the VPC.

5. Update `sonar_token` in `terraform.tfvars` and `tofu apply` (SSM param, step 3).

Until the secrets are set, the CI sonarqube job runs but its steps self-skip.

## 7. Verify the deployment

```sh
ALB=$(cd infra && tofu output -raw alb_dns_name)
curl http://$ALB/health          # frontend nginx → "ok"
curl http://$ALB/api/symbols     # 5 symbols through the backend
# browser: http://$ALB → chart renders, candles update, indicator green
```

CloudWatch: dashboard + alarms went out with phase 1; confirm the SNS
subscription email and click the confirmation link.

## 8. Rolling updates (every release)

```sh
./scripts/push-images.sh v2
cd ansible && ansible-playbook playbooks/deploy.yml -e image_tag=v2
```

## 9. Teardown

```sh
cd infra && tofu destroy
# bootstrap bucket/table survive on purpose; empty the bucket before
# destroying infra/bootstrap if you want a full cleanup
```

---

## Known gaps / decisions still open

- **SonarQube reachability from CI** (step 6) — needs your decision.
- **Ansible network path** (step 5) — bastion, SSM tunnel, or in-VPC runner.
- The kdb personal licence may be machine/hostname-bound — confirm `kc.lic`
  is valid on the EC2 host (check `docker logs kdb` after the kdb play).
- `tofu validate` runs in CI without AWS credentials (`-backend=false`);
  a full `tofu plan` needs local credentials and is not exercised by CI.
- NAT Gateway + ALB + 3 EC2 + ElastiCache ≈ several $/day — destroy when idle.
