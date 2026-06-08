resource "aws_security_group" "alb" {
  name        = "sg-alb"
  description = "ALB — public HTTPS/HTTP"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "sg-alb", Env = var.environment }
}

resource "aws_security_group" "app" {
  name        = "sg-app"
  description = "App EC2 — traffic from ALB only"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "sg-app", Env = var.environment }
}

resource "aws_security_group" "kdb" {
  name        = "sg-kdb"
  description = "kdb+ EC2 — IPC from app only"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5010
    to_port         = 5011
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "sg-kdb", Env = var.environment }
}

resource "aws_security_group" "sonar" {
  name        = "sg-sonar"
  description = "SonarQube EC2 — port 9000 from app + allowed CIDRs"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 9000
    to_port         = 9000
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  dynamic "ingress" {
    for_each = length(var.sonar_allowed_cidrs) > 0 ? [1] : []
    content {
      from_port   = 9000
      to_port     = 9000
      protocol    = "tcp"
      cidr_blocks = var.sonar_allowed_cidrs
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "sg-sonar", Env = var.environment }
}

resource "aws_security_group" "data" {
  name        = "sg-data"
  description = "Data tier — Redis from app, EFS from kdb"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
  ingress {
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.kdb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "sg-data", Env = var.environment }
}
