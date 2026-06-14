output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer — use as VITE_API_URL base"
  value       = module.alb.alb_dns_name
}

output "ecr_repository_urls" {
  description = "ECR repository URLs for frontend, backend and kdb"
  value       = module.ecr.repository_urls
}

output "ecr_registry_id" {
  description = "AWS account ID (ECR registry)"
  value       = module.ecr.registry_id
}

output "efs_dns_name" {
  description = "EFS DNS name for kdb+ data mount (use as efs_dns_name in Ansible)"
  value       = module.efs.dns_name
}

output "redis_url" {
  description = "ElastiCache Redis connection URL (use as redis_url in SSM)"
  value       = module.elasticache.redis_url
  sensitive   = true
}

output "ec2_app_private_ip" {
  description = "Private IP of ec2-app"
  value       = module.ec2.app_private_ip
}

output "ec2_kdb_private_ip" {
  description = "Private IP of ec2-kdb (use as kdb_host in SSM)"
  value       = module.ec2.kdb_private_ip
}

output "ec2_runner_private_ip" {
  description = "Private IP of ec2-runner (GitLab CI runner)"
  value       = module.ec2.runner_private_ip
}

output "ssm_parameter_arns" {
  description = "ARNs of all /pv/* SSM parameters"
  value       = module.ssm.parameter_arns
  sensitive   = true
}
