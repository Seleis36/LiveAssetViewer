#!/usr/bin/env bash
# Tear down and re-provision the full stack (infra only — bootstrap bucket/table survive).
# Usage: ./scripts/cycle.sh [image_tag]   (default tag: v1)
set -euo pipefail

IMAGE_TAG="${1:-v1}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Destroying infra..."
cd "$REPO_ROOT/infra"
tofu destroy -auto-approve

echo "==> Provisioning infra..."
tofu apply -auto-approve

echo "==> Pushing Docker images (tag: $IMAGE_TAG)..."
cd "$REPO_ROOT"
./scripts/push-images.sh "$IMAGE_TAG"

echo "==> Running Ansible site playbook..."
cd "$REPO_ROOT/ansible"
ECR_REGISTRY=$(cd "$REPO_ROOT/infra" && tofu output -raw ecr_registry_id).dkr.ecr.us-east-1.amazonaws.com
EFS_DNS_NAME=$(cd "$REPO_ROOT/infra" && tofu output -raw efs_dns_name)
export ECR_REGISTRY EFS_DNS_NAME

ansible-playbook playbooks/site.yml \
  -e image_tag="$IMAGE_TAG" \
  --private-key "${SSH_KEY_PATH:-~/.ssh/pv-key.pem}"

ALB=$(cd "$REPO_ROOT/infra" && tofu output -raw alb_dns_name)
echo ""
echo "==> Stack is up. ALB: http://$ALB"
echo "    Health: curl http://$ALB/health"
