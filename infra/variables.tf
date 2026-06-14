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

variable "sonar_token" {
  description = "SonarCloud token stored in SSM for CI scans"
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

variable "ec2_key_name" {
  description = "Name of an existing EC2 key pair to attach to all instances (for SSH/Ansible from runner)"
  type        = string
  default     = ""
}
