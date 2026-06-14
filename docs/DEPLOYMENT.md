# Manual Deployment Runbook — AWS

CI (GitLab CI, `.gitlab-ci.yml`) runs lint, tests, and the SonarQube scan.
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

Store the kdb+ licence and the GitLab runner registration token in Secrets Manager
(read by Ansible roles):

```sh
aws secretsmanager create-secret \
  --name pv/kdb/license \
  --secret-string file://$HOME/.kx/kc.lic \
  --region us-east-1

# GitLab runner registration token
# (GitLab project → Settings → CI/CD → Runners → registration token)
aws secretsmanager create-secret \
  --name pv/gitlab/runner-token \
  --secret-string "glrt-YOURTOKEN" \
  --region us-east-1
```

Create an EC2 key pair (used by Ansible SSH from the runner to other instances):

```sh
aws ec2 create-key-pair --key-name pv-key --query KeyMaterial --output text > ~/.ssh/pv-key.pem
chmod 600 ~/.ssh/pv-key.pem
```

(Optional, HTTPS) Request an ACM certificate in us-east-1 for your domain,
validate it via DNS, note the ARN. Skip for HTTP-only.

## 2. Set up SonarQube / SonarCloud

1. Sign in at sonarcloud.io with your GitLab account (or use a self-hosted SonarQube server).
2. Create a new project for this repo; note the **organization key**.
3. Set `sonar.organization=<your-org-key>` in `sonar-project.properties`.
4. My Account → Security → Generate token.
5. GitLab project → Settings → CI/CD → Variables → add `SONAR_TOKEN`
   (mask it; the `sonarqube` job self-skips until this variable exists).
   `SONAR_HOST_URL` defaults to `https://sonarcloud.io`; set it as a CI/CD
   variable only when pointing at a self-hosted SonarQube server.

## 3. Provision infrastructure

Edit `infra/terraform.tfvars`:

```hcl
aws_region          = "us-east-1"
environment         = "production"
alarm_email         = "axel.maral@gmail.com"
ec2_key_name        = "pv-key"          # the key pair created in step 1
acm_certificate_arn = ""                # or the ACM ARN for HTTPS
sonar_token         = "<SonarCloud token from step 2>"
```

```sh
cd infra
tofu init && tofu apply
```

A single `tofu apply` is now sufficient — `kdb_host` and `redis_url` are wired
directly from module outputs; no manual two-phase apply is needed.

Note the outputs: `alb_dns_name`, `ecr_repository_urls`, `efs_dns_name`,
`ec2_runner_private_ip`.

## 4. Build and push Docker images

```sh
./scripts/push-images.sh v1
```

Builds frontend, backend, and kdb images and pushes them to ECR.
The frontend is intentionally built **without** `VITE_API_URL`/`VITE_WS_URL`:
it uses same-origin `/api` + `/ws` URLs, which the ALB routes to the backend.

## 5. Configure instances with Ansible

The runner (ec2-runner) lives inside the VPC and can reach all other instances.
For the **initial** bootstrap you still run Ansible from your local machine:

```sh
export ECR_REGISTRY=<account_id>.dkr.ecr.us-east-1.amazonaws.com
export EFS_DNS_NAME=<efs_dns_name output>
export SSH_KEY_PATH=~/.ssh/pv-key.pem

cd ansible
ansible-inventory --graph                          # sanity-check inventory
ansible-playbook playbooks/site.yml \
  -e image_tag=v1 \
  --private-key $SSH_KEY_PATH
```

`site.yml` runs: common → kdb → app → runner.

The `runner` role:
- Installs Docker, the `gitlab-runner` package, Ansible, boto3, and the AWS
  collections on ec2-runner.
- Fetches the GitLab runner registration token from Secrets Manager, then
  registers the runner (shell executor, tag `vpc-runner`) and starts the
  `gitlab-runner` systemd service.
- After this, Ansible deploy jobs in CI run **on the runner** inside the VPC with
  full access to all private IPs.

## 6. Verify the deployment

```sh
ALB=$(cd infra && tofu output -raw alb_dns_name)
curl http://$ALB/health          # frontend nginx → "ok"
curl http://$ALB/api/symbols     # 5 symbols through the backend
# browser: http://$ALB → chart renders, candles update, indicator green
```

CloudWatch: dashboard + alarms went out with `tofu apply`; confirm the SNS
subscription email and click the confirmation link.

## 7. Rolling updates (every release)

```sh
./scripts/push-images.sh v2
cd ansible && ansible-playbook playbooks/deploy.yml -e image_tag=v2
```

After the runner is bootstrapped, this can also run via GitLab CI in a deploy
job with `tags: [vpc-runner]`.

## 8. Teardown and restart (cost management)

NAT Gateway + ALB + 3 EC2 + ElastiCache ≈ several $/day — destroy when idle.

```sh
# Destroy everything (bootstrap bucket/table survive)
cd infra && tofu destroy

# Re-provision from scratch with one command:
./scripts/cycle.sh v1
# optionally: ./scripts/cycle.sh v2 (uses that image tag)
```

`cycle.sh` runs: destroy → apply → push-images → ansible site.yml, then prints the ALB URL.
Set `SSH_KEY_PATH=~/.ssh/pv-key.pem` in your environment (the runner registration
token is read from Secrets Manager, not passed in).

---

## Architecture decisions

- **SonarCloud** (not self-hosted): scan job uses `https://sonarcloud.io` — no EC2 needed,
  reachable from GitLab-hosted (shared) runners. Set `sonar.organization` in `sonar-project.properties`.
- **In-VPC GitLab CI runner** (ec2-runner, t3.small): Ansible deploy jobs run inside the
  VPC so they can SSH to private instances without a bastion or SSM tunnel.
- **Single `tofu apply`**: `kdb_host` and `redis_url` are now wired as module-to-module
  references; the SSM parameters are populated automatically in one pass.
- **kdb+ licence**: stored in Secrets Manager at `pv/kdb/license`; read by the kdb Ansible
  role at deploy time. Confirm licence is valid on the EC2 host via `docker logs kdb`.
