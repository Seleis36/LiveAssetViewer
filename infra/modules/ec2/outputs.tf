output "app_private_ip"    { value = aws_instance.app.private_ip }
output "kdb_private_ip"    { value = aws_instance.kdb.private_ip }
output "runner_private_ip" { value = aws_instance.runner.private_ip }
output "app_instance_id"   { value = aws_instance.app.id }
output "kdb_instance_id"   { value = aws_instance.kdb.id }
output "runner_instance_id" { value = aws_instance.runner.id }
