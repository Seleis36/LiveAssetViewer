variable "environment" {
  type = string
}

variable "alarm_email" {
  description = "Email address for CloudWatch alarm SNS notifications (leave empty to skip)"
  type        = string
  default     = ""
}

variable "alb_arn_suffix" {
  description = "ALB ARN suffix for CloudWatch metrics"
  type        = string
  default     = ""
}

variable "tg_backend_arn_suffix" {
  description = "Backend target group ARN suffix"
  type        = string
  default     = ""
}

variable "tg_frontend_arn_suffix" {
  description = "Frontend target group ARN suffix"
  type        = string
  default     = ""
}
