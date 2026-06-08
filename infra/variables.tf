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
  description = "Private IP of ec2-kdb — set to PLACEHOLDER before first apply; update after EC2 provisioned"
  type        = string
  default     = "PLACEHOLDER"
}

variable "redis_url" {
  description = "ElastiCache Redis connection URL (output of elasticache module after apply)"
  type        = string
  sensitive   = true
  default     = "redis://PLACEHOLDER:6379"
}

variable "sonar_token" {
  description = "SonarQube token stored in SSM for CI scans"
  type        = string
  sensitive   = true
  default     = "PLACEHOLDER"
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for ALB HTTPS listener (leave empty for HTTP-only)"
  type        = string
  default     = ""
}

variable "alarm_email" {
  description = "Email address for CloudWatch alarm SNS notifications"
  type        = string
  default     = ""
}

variable "sonar_allowed_cidrs" {
  description = "CIDRs allowed to reach SonarQube port 9000"
  type        = list(string)
  default     = []
}
