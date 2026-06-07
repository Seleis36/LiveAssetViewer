output "alb_sg_id"   { value = aws_security_group.alb.id }
output "app_sg_id"   { value = aws_security_group.app.id }
output "kdb_sg_id"   { value = aws_security_group.kdb.id }
output "sonar_sg_id" { value = aws_security_group.sonar.id }
output "data_sg_id"  { value = aws_security_group.data.id }
