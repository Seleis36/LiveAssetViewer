resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { Name = "pv-vpc", Env = var.environment }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "pv-igw", Env = var.environment }
}

locals {
  public_cidrs      = ["10.0.0.0/24", "10.0.1.0/24"]
  private_app_cidrs = ["10.0.10.0/24", "10.0.11.0/24"]
  private_data_cidrs = ["10.0.20.0/24", "10.0.21.0/24"]
}

resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.this.id
  cidr_block        = local.public_cidrs[count.index]
  availability_zone = var.azs[count.index]
  map_public_ip_on_launch = true
  tags = { Name = "pv-public-${count.index}", Env = var.environment }
}

resource "aws_subnet" "private_app" {
  count             = 2
  vpc_id            = aws_vpc.this.id
  cidr_block        = local.private_app_cidrs[count.index]
  availability_zone = var.azs[count.index]
  tags = { Name = "pv-private-app-${count.index}", Env = var.environment }
}

resource "aws_subnet" "private_data" {
  count             = 2
  vpc_id            = aws_vpc.this.id
  cidr_block        = local.private_data_cidrs[count.index]
  availability_zone = var.azs[count.index]
  tags = { Name = "pv-private-data-${count.index}", Env = var.environment }
}

resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = { Name = "pv-nat-eip", Env = var.environment }
}

resource "aws_nat_gateway" "this" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  tags          = { Name = "pv-nat", Env = var.environment }
  depends_on    = [aws_internet_gateway.this]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
  tags = { Name = "pv-rt-public", Env = var.environment }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this.id
  }
  tags = { Name = "pv-rt-private", Env = var.environment }
}

resource "aws_route_table_association" "private_app" {
  count          = 2
  subnet_id      = aws_subnet.private_app[count.index].id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "private_data" {
  count          = 2
  subnet_id      = aws_subnet.private_data[count.index].id
  route_table_id = aws_route_table.private.id
}
