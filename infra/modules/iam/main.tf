locals {
  roles = ["app", "kdb", "sonar"]
}

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ec2" {
  for_each           = toset(local.roles)
  name               = "pv-ec2-${each.key}-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
  tags               = { Env = var.environment }
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  for_each   = aws_iam_role.ec2
  role       = each.value.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "cw_agent" {
  for_each   = aws_iam_role.ec2
  role       = each.value.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

data "aws_iam_policy_document" "ecr_pull" {
  statement {
    actions = [
      "ecr:GetAuthorizationToken",
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "ecr_pull" {
  name   = "pv-ecr-pull"
  policy = data.aws_iam_policy_document.ecr_pull.json
}

resource "aws_iam_role_policy_attachment" "ecr_pull" {
  for_each   = aws_iam_role.ec2
  role       = each.value.name
  policy_arn = aws_iam_policy.ecr_pull.arn
}

data "aws_iam_policy_document" "ssm_params" {
  statement {
    actions   = ["ssm:GetParameter", "ssm:GetParametersByPath"]
    resources = ["arn:aws:ssm:*:*:parameter/pv/*"]
  }
}

resource "aws_iam_policy" "ssm_params" {
  name   = "pv-ssm-params-read"
  policy = data.aws_iam_policy_document.ssm_params.json
}

resource "aws_iam_role_policy_attachment" "ssm_params" {
  for_each   = aws_iam_role.ec2
  role       = each.value.name
  policy_arn = aws_iam_policy.ssm_params.arn
}

data "aws_iam_policy_document" "efs_kdb" {
  count = var.efs_arn != "" ? 1 : 0
  statement {
    actions   = ["elasticfilesystem:ClientMount", "elasticfilesystem:ClientWrite"]
    resources = [var.efs_arn]
  }
}

resource "aws_iam_policy" "efs_kdb" {
  count  = var.efs_arn != "" ? 1 : 0
  name   = "pv-efs-kdb"
  policy = data.aws_iam_policy_document.efs_kdb[0].json
}

resource "aws_iam_role_policy_attachment" "efs_kdb" {
  count      = var.efs_arn != "" ? 1 : 0
  role       = aws_iam_role.ec2["kdb"].name
  policy_arn = aws_iam_policy.efs_kdb[0].arn
}

resource "aws_iam_instance_profile" "ec2" {
  for_each = aws_iam_role.ec2
  name     = "pv-ec2-${each.key}-profile"
  role     = each.value.name
}
