module "ssm" {
  source      = "./modules/ssm"
  environment = var.environment
  kdb_host    = var.kdb_host
  redis_url   = var.redis_url
  sonar_token = var.sonar_token
}
