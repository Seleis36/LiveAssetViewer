resource "aws_efs_file_system" "this" {
  encrypted        = true
  performance_mode = "generalPurpose"
  throughput_mode  = "bursting"
  tags             = { Name = "pv-efs", Env = var.environment }
}

resource "aws_efs_mount_target" "this" {
  count           = length(var.private_data_subnet_ids)
  file_system_id  = aws_efs_file_system.this.id
  subnet_id       = var.private_data_subnet_ids[count.index]
  security_groups = [var.data_sg_id]
}
