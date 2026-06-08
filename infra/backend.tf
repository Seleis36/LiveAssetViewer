terraform {
  backend "s3" {
    bucket         = "pv-tf-state"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "pv-tf-state-lock"
  }
}
