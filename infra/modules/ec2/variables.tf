variable "environment" { type = string }
variable "private_app_subnet_ids" { type = list(string) }
variable "app_sg_id" { type = string }
variable "kdb_sg_id" { type = string }
variable "runner_sg_id" { type = string }
variable "app_instance_profile" { type = string }
variable "kdb_instance_profile" { type = string }
variable "runner_instance_profile" { type = string }
variable "ec2_key_name" { type = string; default = "" }
