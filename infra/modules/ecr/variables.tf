variable "environment" {
  description = "Deployment environment tag"
  type        = string
}

variable "image_retention_count" {
  description = "Number of tagged images to keep per repository"
  type        = number
  default     = 10
}
