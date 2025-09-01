output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "database_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
}

output "database_port" {
  description = "RDS instance port"
  value       = aws_db_instance.postgres.port
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = aws_elasticache_replication_group.redis.configuration_endpoint_address
  sensitive   = true
}

output "redis_port" {
  description = "ElastiCache Redis port"
  value       = aws_elasticache_replication_group.redis.port
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket for recordings"
  value       = aws_s3_bucket.recordings.bucket
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket for recordings"
  value       = aws_s3_bucket.recordings.arn
}

output "load_balancer_dns_name" {
  description = "DNS name of the load balancer"
  value       = aws_lb.main.dns_name
}

output "load_balancer_zone_id" {
  description = "Zone ID of the load balancer"
  value       = aws_lb.main.zone_id
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = aws_ecs_cluster.main.arn
}

output "api_service_name" {
  description = "Name of the API ECS service"
  value       = aws_ecs_service.api.name
}

output "ml_worker_service_name" {
  description = "Name of the ML worker ECS service"
  value       = aws_ecs_service.ml_worker.name
}

output "task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "task_role_arn" {
  description = "ARN of the ECS task role"
  value       = aws_iam_role.ecs_task.arn
}

output "api_target_group_arn" {
  description = "ARN of the API target group"
  value       = aws_lb_target_group.api.arn
}

output "security_group_alb_id" {
  description = "ID of the ALB security group"
  value       = aws_security_group.alb.id
}

output "security_group_ecs_id" {
  description = "ID of the ECS security group"
  value       = aws_security_group.ecs.id
}

output "security_group_rds_id" {
  description = "ID of the RDS security group"
  value       = aws_security_group.rds.id
}

output "security_group_redis_id" {
  description = "ID of the Redis security group"
  value       = aws_security_group.redis.id
}

output "cloudwatch_log_group_api" {
  description = "Name of the API CloudWatch log group"
  value       = aws_cloudwatch_log_group.api.name
}

output "cloudwatch_log_group_ml_worker" {
  description = "Name of the ML worker CloudWatch log group"
  value       = aws_cloudwatch_log_group.ml_worker.name
}

output "service_discovery_namespace_id" {
  description = "ID of the service discovery namespace"
  value       = aws_service_discovery_private_dns_namespace.main.id
}

output "service_discovery_namespace_name" {
  description = "Name of the service discovery namespace"
  value       = aws_service_discovery_private_dns_namespace.main.name
}

# Environment variables for application configuration
output "environment_variables" {
  description = "Environment variables for the application"
  value = {
    DATABASE_URL = "postgresql+asyncpg://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.endpoint}/baby_monitor"
    REDIS_URL    = "redis://:${var.redis_auth_token}@${aws_elasticache_replication_group.redis.configuration_endpoint_address}:6379"
    S3_BUCKET_NAME = aws_s3_bucket.recordings.bucket
    AWS_REGION     = var.aws_region
    ENVIRONMENT    = var.environment
  }
  sensitive = true
}

# Connection information
output "connection_info" {
  description = "Connection information for the deployed infrastructure"
  value = {
    api_url           = "http://${aws_lb.main.dns_name}"
    health_check_url  = "http://${aws_lb.main.dns_name}/health"
    metrics_url       = "http://${aws_lb.main.dns_name}/metrics"
    docs_url          = "http://${aws_lb.main.dns_name}/docs"
    websocket_url     = "ws://${aws_lb.main.dns_name}/ws"
  }
}

# Resource ARNs for reference
output "resource_arns" {
  description = "ARNs of created resources"
  value = {
    vpc                = aws_vpc.main.arn
    database           = aws_db_instance.postgres.arn
    redis_cluster      = aws_elasticache_replication_group.redis.arn
    s3_bucket          = aws_s3_bucket.recordings.arn
    load_balancer      = aws_lb.main.arn
    ecs_cluster        = aws_ecs_cluster.main.arn
    api_task_definition = aws_ecs_task_definition.api.arn
    ml_worker_task_definition = aws_ecs_task_definition.ml_worker.arn
  }
}
