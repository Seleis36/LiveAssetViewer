variable "environment" { type = string }
variable "private_app_subnet_ids" { type = list(string) }
variable "app_sg_id" { type = string }
variable "kdb_sg_id" { type = string }
variable "sonar_sg_id" { type = string }
variable "app_instance_profile" { type = string }
variable "kdb_instance_profile" { type = string }
variable "sonar_instance_profile" { type = string }
