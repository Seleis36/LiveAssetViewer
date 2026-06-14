module "vpc" {
  source      = "./modules/vpc"
  environment = var.environment
}

module "sg" {
  source      = "./modules/sg"
  environment = var.environment
  vpc_id      = module.vpc.vpc_id
}

module "iam" {
  source      = "./modules/iam"
  environment = var.environment
  efs_arn     = module.efs.arn
}

module "ecr" {
  source      = "./modules/ecr"
  environment = var.environment
}

module "efs" {
  source                  = "./modules/efs"
  environment             = var.environment
  private_data_subnet_ids = module.vpc.private_data_subnet_ids
  data_sg_id              = module.sg.data_sg_id
}

module "elasticache" {
  source                  = "./modules/elasticache"
  environment             = var.environment
  private_data_subnet_ids = module.vpc.private_data_subnet_ids
  data_sg_id              = module.sg.data_sg_id
}

module "ec2" {
  source                  = "./modules/ec2"
  environment             = var.environment
  private_app_subnet_ids  = module.vpc.private_app_subnet_ids
  app_sg_id               = module.sg.app_sg_id
  kdb_sg_id               = module.sg.kdb_sg_id
  runner_sg_id            = module.sg.runner_sg_id
  app_instance_profile    = module.iam.app_instance_profile_name
  kdb_instance_profile    = module.iam.kdb_instance_profile_name
  runner_instance_profile = module.iam.runner_instance_profile_name
  ec2_key_name            = var.ec2_key_name
}

module "alb" {
  source              = "./modules/alb"
  environment         = var.environment
  vpc_id              = module.vpc.vpc_id
  public_subnet_ids   = module.vpc.public_subnet_ids
  alb_sg_id           = module.sg.alb_sg_id
  app_instance_id     = module.ec2.app_instance_id
  acm_certificate_arn = var.acm_certificate_arn
}

# kdb_host and redis_url are wired from module outputs — no manual two-phase apply needed
module "ssm" {
  source      = "./modules/ssm"
  environment = var.environment
  kdb_host    = module.ec2.kdb_private_ip
  redis_url   = module.elasticache.redis_url
  sonar_token = var.sonar_token
}

module "cloudwatch" {
  source                 = "./modules/cloudwatch"
  environment            = var.environment
  alarm_email            = var.alarm_email
  alb_arn_suffix         = module.alb.alb_arn
  tg_backend_arn_suffix  = module.alb.backend_tg_arn
  tg_frontend_arn_suffix = module.alb.frontend_tg_arn
}
