output "dashboard_name" { value = aws_cloudwatch_dashboard.main.dashboard_name }
output "log_group_arns" { value = { for k, v in aws_cloudwatch_log_group.this : k => v.arn } }
