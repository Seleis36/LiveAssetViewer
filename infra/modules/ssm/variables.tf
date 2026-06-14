variable "environment" {
  description = "Deployment environment tag"
  type        = string
}

variable "kdb_host" {
  description = "Private IP of ec2-kdb (populated after EC2 is provisioned)"
  type        = string
  default     = "PLACEHOLDER"
}

variable "kdb_port" {
  description = "kdb+ IPC port"
  type        = string
  default     = "5010"
}

variable "redis_url" {
  description = "Redis connection URL (ElastiCache endpoint)"
  type        = string
  sensitive   = true
}

variable "sonar_token" {
  description = "SonarQube authentication token for GitLab CI"
  type        = string
  sensitive   = true
}
