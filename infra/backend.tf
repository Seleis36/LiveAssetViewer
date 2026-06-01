terraform {
  backend "s3" {
    bucket         = "pv-tf-state"
    key            = "terraform.tfstate"
    region         = "eu-west-1"
    encrypt        = true
    dynamodb_table = "pv-tf-state-lock"
  }
}
