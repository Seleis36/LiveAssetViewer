variable "environment" {
  type = string
}

variable "efs_arn" {
  description = "ARN of the EFS file system (used in kdb instance profile policy)"
  type        = string
  default     = ""
}
