output "app_instance_profile_name"    { value = aws_iam_instance_profile.ec2["app"].name }
output "kdb_instance_profile_name"    { value = aws_iam_instance_profile.ec2["kdb"].name }
output "runner_instance_profile_name" { value = aws_iam_instance_profile.ec2["runner"].name }
