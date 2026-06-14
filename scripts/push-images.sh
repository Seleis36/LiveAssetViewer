#!/usr/bin/env bash
# Build all three Docker images and push them to ECR.
# Run this locally (with AWS credentials) before ansible-playbook deploy.yml.
#
# Usage:
#   ./scripts/push-images.sh [image_tag]
#   image_tag defaults to "latest"
#
# Prerequisites:
#   - aws cli configured (aws sts get-caller-identity must succeed)
#   - QBIN env var pointing to the q binary  (or q in PATH)
#   - QHOME env var pointing to the dir containing q.k
#   - docker running

set -euo pipefail

TAG=${1:-latest}
REGION=us-east-1
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

# Resolve q binary and q.k paths
QBIN=${QBIN:-$(which q)}
QHOME=${QHOME:-$(dirname "$QBIN")}

if [[ ! -x "$QBIN" ]]; then
  echo "ERROR: q binary not found. Set QBIN or ensure q is in PATH."
  exit 1
fi
if [[ ! -f "$QHOME/q.k" ]]; then
  echo "ERROR: q.k not found in QHOME=$QHOME"
  exit 1
fi

echo "Using q binary : $QBIN"
echo "Using q.k from : $QHOME/q.k"
echo "ECR registry   : $ECR"
echo "Tag            : $TAG"

# Copy binaries into kdb/bin/ so the Dockerfile can COPY them
mkdir -p kdb/bin
cp "$QBIN"       kdb/bin/q
cp "$QHOME/q.k"  kdb/bin/q.k

# ECR login
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$ECR"

# Build and push all three images
for SERVICE in frontend backend kdb; do
  IMAGE="$ECR/price-viewer/$SERVICE:$TAG"
  echo ""
  echo "==> Building $SERVICE → $IMAGE"
  docker build -t "$IMAGE" "./$SERVICE"
  echo "==> Pushing $IMAGE"
  docker push "$IMAGE"
done

# Clean up copied binaries
rm -f kdb/bin/q kdb/bin/q.k

echo ""
echo "Done. Deploy with:"
echo "  ansible-playbook ansible/playbooks/site.yml -e image_tag=$TAG"
