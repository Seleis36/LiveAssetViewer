locals {
  log_groups = {
    app   = "/ec2/price-viewer/app"
    kdb   = "/ec2/price-viewer/kdb"
    sonar = "/ec2/price-viewer/sonar"
  }
}

resource "aws_cloudwatch_log_group" "this" {
  for_each          = local.log_groups
  name              = each.value
  retention_in_days = 30
  tags              = { Env = var.environment }
}

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "PriceViewer"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          title  = "ALB Request Count"
          period = 60
          stat   = "Sum"
          metrics = var.alb_arn_suffix != "" ? [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix]
          ] : []
          view = "timeSeries"
        }
      },
      {
        type = "metric"
        properties = {
          title  = "ALB 5XX Errors"
          period = 60
          stat   = "Sum"
          metrics = var.alb_arn_suffix != "" ? [
            ["AWS/ApplicationELB", "HTTPCode_ELB_5XX_Count", "LoadBalancer", var.alb_arn_suffix]
          ] : []
          view = "timeSeries"
        }
      },
      {
        type = "metric"
        properties = {
          title  = "EC2 CPU Utilisation"
          period = 60
          stat   = "Average"
          metrics = [
            ["AWS/EC2", "CPUUtilization", "AutoScalingGroupName", "pv-app", { label = "app" }],
            ["AWS/EC2", "CPUUtilization", "AutoScalingGroupName", "pv-kdb", { label = "kdb" }],
            ["AWS/EC2", "CPUUtilization", "AutoScalingGroupName", "pv-sonar", { label = "sonar" }],
          ]
          view = "timeSeries"
        }
      },
      {
        type = "metric"
        properties = {
          title  = "EC2 Memory Used %"
          period = 60
          stat   = "Average"
          metrics = [
            ["PriceViewer/EC2", "mem_used_percent", "Role", "app", { label = "app" }],
            ["PriceViewer/EC2", "mem_used_percent", "Role", "kdb", { label = "kdb" }],
            ["PriceViewer/EC2", "mem_used_percent", "Role", "sonar", { label = "sonar" }],
          ]
          view = "timeSeries"
        }
      },
      {
        type = "metric"
        properties = {
          title  = "Active WebSocket Connections"
          period = 60
          stat   = "Average"
          metrics = [
            ["PriceViewer/Backend", "ActiveWebSocketConnections"]
          ]
          view = "timeSeries"
        }
      },
    ]
  })
}
