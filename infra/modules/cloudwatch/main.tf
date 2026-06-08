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

resource "aws_sns_topic" "alarms" {
  name = "pv-alarms"
  tags = { Env = var.environment }
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alarm_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

resource "aws_cloudwatch_metric_alarm" "backend_5xx" {
  alarm_name          = "pv-backend-5xx-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Backend 5XX count > 10 over 5 min"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions = var.alb_arn_suffix != "" ? {
    LoadBalancer = var.alb_arn_suffix
  } : {}
  tags = { Env = var.environment }
}

resource "aws_cloudwatch_metric_alarm" "app_cpu" {
  alarm_name          = "pv-app-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "ec2-app CPU > 80% over 5 min"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions          = { AutoScalingGroupName = "pv-app" }
  tags                = { Env = var.environment }
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
