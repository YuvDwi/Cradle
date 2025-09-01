# ECS Task Definitions
resource "aws_ecs_task_definition" "api" {
  family                   = "${var.project_name}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn           = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "api"
      image = var.ecr_repository_url != "" ? "${var.ecr_repository_url}:${var.api_image_tag}" : "baby-monitor-api:latest"
      
      portMappings = [
        {
          containerPort = 8000
          protocol      = "tcp"
        }
      ]
      
      environment = [
        {
          name  = "DATABASE_URL"
          value = "postgresql+asyncpg://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.endpoint}/baby_monitor"
        },
        {
          name  = "REDIS_URL"
          value = "redis://:${var.redis_auth_token}@${aws_elasticache_replication_group.redis.configuration_endpoint_address}:6379"
        },
        {
          name  = "AWS_REGION"
          value = var.aws_region
        },
        {
          name  = "S3_BUCKET_NAME"
          value = aws_s3_bucket.recordings.bucket
        },
        {
          name  = "ENVIRONMENT"
          value = var.environment
        }
      ]
      
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.api.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
      
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
      
      essential = true
    }
  ])

  tags = {
    Name = "${var.project_name}-api-task"
  }
}

resource "aws_ecs_task_definition" "ml_worker" {
  family                   = "${var.project_name}-ml-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ml_worker_cpu
  memory                   = var.ml_worker_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn           = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "ml-worker"
      image = var.ecr_repository_url != "" ? "${var.ecr_repository_url}:${var.ml_worker_image_tag}" : "baby-monitor-ml-worker:latest"
      
      command = ["python", "-m", "app.ml.inference_service"]
      
      environment = [
        {
          name  = "DATABASE_URL"
          value = "postgresql+asyncpg://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.endpoint}/baby_monitor"
        },
        {
          name  = "REDIS_URL"
          value = "redis://:${var.redis_auth_token}@${aws_elasticache_replication_group.redis.configuration_endpoint_address}:6379"
        },
        {
          name  = "AWS_REGION"
          value = var.aws_region
        },
        {
          name  = "S3_BUCKET_NAME"
          value = aws_s3_bucket.recordings.bucket
        },
        {
          name  = "AUDIO_MODEL_PATH"
          value = "/app/models/audio_classifier.onnx"
        },
        {
          name  = "VIDEO_MODEL_PATH"
          value = "/app/models/yolo_detector.onnx"
        }
      ]
      
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ml_worker.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
      
      essential = true
    }
  ])

  tags = {
    Name = "${var.project_name}-ml-worker-task"
  }
}

# ECS Services
resource "aws_ecs_service" "api" {
  name            = "${var.project_name}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    security_groups  = [aws_security_group.ecs.id]
    subnets          = aws_subnet.private[*].id
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 8000
  }

  depends_on = [aws_lb_listener.api]

  tags = {
    Name = "${var.project_name}-api-service"
  }
}

resource "aws_ecs_service" "ml_worker" {
  name            = "${var.project_name}-ml-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.ml_worker.arn
  desired_count   = var.ml_worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    security_groups  = [aws_security_group.ecs.id]
    subnets          = aws_subnet.private[*].id
    assign_public_ip = false
  }

  tags = {
    Name = "${var.project_name}-ml-worker-service"
  }
}

# Auto Scaling
resource "aws_appautoscaling_target" "api" {
  count = var.auto_scaling_enabled ? 1 : 0

  max_capacity       = var.auto_scaling_max_capacity
  min_capacity       = var.auto_scaling_min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_cpu" {
  count = var.auto_scaling_enabled ? 1 : 0

  name               = "${var.project_name}-api-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api[0].resource_id
  scalable_dimension = aws_appautoscaling_target.api[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.api[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = var.auto_scaling_target_cpu
  }
}

resource "aws_appautoscaling_policy" "api_memory" {
  count = var.auto_scaling_enabled ? 1 : 0

  name               = "${var.project_name}-api-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api[0].resource_id
  scalable_dimension = aws_appautoscaling_target.api[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.api[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value = var.auto_scaling_target_memory
  }
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "api_high_cpu" {
  alarm_name          = "${var.project_name}-api-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "120"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors API ECS CPU utilization"
  alarm_actions       = []

  dimensions = {
    ServiceName = aws_ecs_service.api.name
    ClusterName = aws_ecs_cluster.main.name
  }

  tags = {
    Name = "${var.project_name}-api-high-cpu-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "api_high_memory" {
  alarm_name          = "${var.project_name}-api-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "120"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors API ECS memory utilization"
  alarm_actions       = []

  dimensions = {
    ServiceName = aws_ecs_service.api.name
    ClusterName = aws_ecs_cluster.main.name
  }

  tags = {
    Name = "${var.project_name}-api-high-memory-alarm"
  }
}

# Service Discovery
resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = "${var.project_name}.local"
  description = "Private DNS namespace for baby monitor services"
  vpc         = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-dns-namespace"
  }
}

resource "aws_service_discovery_service" "api" {
  name = "api"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      ttl  = 10
      type = "A"
    }
  }

  health_check_grace_period_seconds = 30

  tags = {
    Name = "${var.project_name}-api-discovery"
  }
}
