output "ssm_parameter_arns" {
  description = "ARNs of all /pv/* SSM parameters (used in IAM policies)"
  value       = module.ssm.parameter_arns
  sensitive   = true
}
