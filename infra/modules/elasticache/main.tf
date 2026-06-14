resource "aws_elasticache_subnet_group" "this" {
  name       = "pv-redis-subnet-group"
  subnet_ids = var.private_data_subnet_ids
  tags       = { Name = "pv-redis-subnet-group", Env = var.environment }
}

resource "aws_elasticache_cluster" "this" {
  cluster_id           = "pv-redis"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = "cache.t4g.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.this.name
  security_group_ids   = [var.data_sg_id]
  tags                 = { Name = "pv-redis", Env = var.environment }
}
