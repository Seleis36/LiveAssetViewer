resource "aws_ssm_parameter" "kdb_host" {
  name  = "/pv/kdb/host"
  type  = "String"
  value = var.kdb_host

  tags = { Env = var.environment }
}

resource "aws_ssm_parameter" "kdb_port" {
  name  = "/pv/kdb/port"
  type  = "String"
  value = var.kdb_port

  tags = { Env = var.environment }
}

resource "aws_ssm_parameter" "redis_url" {
  name  = "/pv/redis/url"
  type  = "SecureString"
  value = var.redis_url

  tags = { Env = var.environment }
}

resource "aws_ssm_parameter" "sonar_token" {
  name  = "/pv/sonar/token"
  type  = "SecureString"
  value = var.sonar_token

  tags = { Env = var.environment }
}
