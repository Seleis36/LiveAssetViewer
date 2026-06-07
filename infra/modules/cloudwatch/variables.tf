variable "environment" {
  type = string
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
