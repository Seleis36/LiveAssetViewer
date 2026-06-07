output "ecr_repository_urls" {
  description = "ECR repository URLs for frontend, backend and kdb"
  value       = module.ecr.repository_urls
}

output "ecr_registry_id" {
  description = "AWS account ID (ECR registry)"
  value       = module.ecr.registry_id
}
