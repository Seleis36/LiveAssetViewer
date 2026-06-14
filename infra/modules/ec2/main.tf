data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-2023*-x86_64"]
  }
}

locals {
  key_name = var.ec2_key_name != "" ? var.ec2_key_name : null
}

resource "aws_instance" "app" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = "t3.medium"
  subnet_id              = var.private_app_subnet_ids[0]
  vpc_security_group_ids = [var.app_sg_id]
  iam_instance_profile   = var.app_instance_profile
  key_name               = local.key_name
  tags                   = { Name = "ec2-app", Role = "app", Env = var.environment }
}

resource "aws_instance" "kdb" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = "t3.large"
  subnet_id              = var.private_app_subnet_ids[0]
  vpc_security_group_ids = [var.kdb_sg_id]
  iam_instance_profile   = var.kdb_instance_profile
  key_name               = local.key_name
  tags                   = { Name = "ec2-kdb", Role = "kdb", Env = var.environment }
}

resource "aws_instance" "runner" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = "t3.small"
  subnet_id              = var.private_app_subnet_ids[1]
  vpc_security_group_ids = [var.runner_sg_id]
  iam_instance_profile   = var.runner_instance_profile
  key_name               = local.key_name
  tags                   = { Name = "ec2-runner", Role = "runner", Env = var.environment }
}
