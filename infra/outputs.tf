output "ecr_repository_urls" {
  description = "ECR repository URLs for frontend, backend and kdb"
  value       = module.ecr.repository_urls
}

output "ecr_registry_id" {
  description = "AWS account ID (ECR registry)"
  value       = module.ecr.registry_id
}

output "ssm_parameter_arns" {
  description = "ARNs of all /pv/* SSM parameters (used in IAM policies)"
  value       = module.ssm.parameter_arns
  sensitive   = true
}
