variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "sonar_allowed_cidrs" {
  description = "CIDRs allowed to reach SonarQube port 9000"
  type        = list(string)
  default     = []
}
