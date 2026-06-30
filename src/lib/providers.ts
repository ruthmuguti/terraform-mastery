export type Provider = "aws" | "gcp" | "azure";

export interface ProviderResources {
  storage_bucket: string;
  compute_instance: string;
  database: string;
  network: string;
  subnet: string;
  security_group: string;
  secret: string;
  storage_object: string;
  iam_role: string;
  function: string;
  resource_group: string; // azure only — maps to "" for aws/gcp
}

export interface ProviderConfig {
  id: Provider;
  name: string;
  shortName: string;
  tfSource: string;
  tfProvider: string;
  color: string;
  bgColor: string;
  borderColor: string;
  defaultRegion: string;
  regionAttr: string;
  resources: ProviderResources;
  versionConstraint: string;
  providerBlockHCL: string;
  terraformBlockHCL: string;
}

export const PROVIDERS: Record<Provider, ProviderConfig> = {
  aws: {
    id: "aws",
    name: "Amazon Web Services",
    shortName: "AWS",
    tfSource: "hashicorp/aws",
    tfProvider: "aws",
    color: "#FF9900",
    bgColor: "rgba(255,153,0,0.08)",
    borderColor: "rgba(255,153,0,0.35)",
    defaultRegion: "us-east-1",
    regionAttr: "region",
    versionConstraint: "~> 5.0",
    resources: {
      storage_bucket: "aws_s3_bucket",
      compute_instance: "aws_instance",
      database: "aws_db_instance",
      network: "aws_vpc",
      subnet: "aws_subnet",
      security_group: "aws_security_group",
      secret: "aws_secretsmanager_secret",
      storage_object: "aws_s3_object",
      iam_role: "aws_iam_role",
      function: "aws_lambda_function",
      resource_group: "",
    },
    providerBlockHCL: `provider "aws" {
  region = "us-east-1"
}`,
    terraformBlockHCL: `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}`,
  },

  gcp: {
    id: "gcp",
    name: "Google Cloud Platform",
    shortName: "GCP",
    tfSource: "hashicorp/google",
    tfProvider: "google",
    color: "#4285F4",
    bgColor: "rgba(66,133,244,0.08)",
    borderColor: "rgba(66,133,244,0.35)",
    defaultRegion: "us-central1",
    regionAttr: "region",
    versionConstraint: "~> 5.0",
    resources: {
      storage_bucket: "google_storage_bucket",
      compute_instance: "google_compute_instance",
      database: "google_sql_database_instance",
      network: "google_compute_network",
      subnet: "google_compute_subnetwork",
      security_group: "google_compute_firewall",
      secret: "google_secret_manager_secret",
      storage_object: "google_storage_bucket_object",
      iam_role: "google_project_iam_member",
      function: "google_cloudfunctions2_function",
      resource_group: "",
    },
    providerBlockHCL: `provider "google" {
  project = "my-gcp-project"
  region  = "us-central1"
}`,
    terraformBlockHCL: `terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}`,
  },

  azure: {
    id: "azure",
    name: "Microsoft Azure",
    shortName: "Azure",
    tfSource: "hashicorp/azurerm",
    tfProvider: "azurerm",
    color: "#0078D4",
    bgColor: "rgba(0,120,212,0.08)",
    borderColor: "rgba(0,120,212,0.35)",
    defaultRegion: "East US",
    regionAttr: "location",
    versionConstraint: "~> 3.0",
    resources: {
      storage_bucket: "azurerm_storage_account",
      compute_instance: "azurerm_linux_virtual_machine",
      database: "azurerm_mssql_server",
      network: "azurerm_virtual_network",
      subnet: "azurerm_subnet",
      security_group: "azurerm_network_security_group",
      secret: "azurerm_key_vault_secret",
      storage_object: "azurerm_storage_blob",
      iam_role: "azurerm_role_assignment",
      function: "azurerm_linux_function_app",
      resource_group: "azurerm_resource_group",
    },
    providerBlockHCL: `provider "azurerm" {
  features {}
}`,
    terraformBlockHCL: `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}`,
  },
};

export function getProvider(id: Provider): ProviderConfig {
  return PROVIDERS[id];
}

/** Returns the resource type string for a concept on the given provider */
export function resourceType(provider: Provider, concept: keyof ProviderResources): string {
  return PROVIDERS[provider].resources[concept];
}
