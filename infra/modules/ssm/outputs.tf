output "kdb_host_arn" {
  description = "ARN of the /pv/kdb/host SSM parameter"
  value       = aws_ssm_parameter.kdb_host.arn
}

output "kdb_port_arn" {
  description = "ARN of the /pv/kdb/port SSM parameter"
  value       = aws_ssm_parameter.kdb_port.arn
}

output "redis_url_arn" {
  description = "ARN of the /pv/redis/url SSM parameter (SecureString)"
  value       = aws_ssm_parameter.redis_url.arn
  sensitive   = true
}

output "sonar_token_arn" {
  description = "ARN of the /pv/sonar/token SSM parameter (SecureString)"
  value       = aws_ssm_parameter.sonar_token.arn
  sensitive   = true
}

output "parameter_arns" {
  description = "All SSM parameter ARNs (for IAM policy construction)"
  value = [
    aws_ssm_parameter.kdb_host.arn,
    aws_ssm_parameter.kdb_port.arn,
    aws_ssm_parameter.redis_url.arn,
    aws_ssm_parameter.sonar_token.arn,
  ]
  sensitive = true
}
