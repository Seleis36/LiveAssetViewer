variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment tag"
  type        = string
  default     = "production"
}

variable "kdb_host" {
  description = "Private IP of ec2-kdb (set after EC2 is provisioned)"
  type        = string
  default     = "PLACEHOLDER"
}

variable "redis_url" {
  description = "ElastiCache Redis connection URL"
  type        = string
  sensitive   = true
  default     = "redis://PLACEHOLDER:6379"
}

variable "sonar_token" {
  description = "SonarQube token for GitHub Actions CI scans"
  type        = string
  sensitive   = true
  default     = "PLACEHOLDER"
}
