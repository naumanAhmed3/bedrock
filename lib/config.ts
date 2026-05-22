import * as pulumi from "@pulumi/pulumi";

// ─────────────────────────────────────────────────────────────
// Typed configuration. Each stack (Pulumi.dev.yaml / Pulumi.prod.yaml)
// supplies these values; loadConfig turns the loosely-typed Pulumi
// config bag into a checked BedrockConfig the program can rely on.
// ─────────────────────────────────────────────────────────────

export interface ServiceSpec {
  /** Short service name — also the config-file and DNS label. */
  name: string;
  /** TCP port the service listens on. */
  port: number;
  /** Desired replica count for the environment. */
  replicas: number;
  /** Whether the service is exposed at the network edge. */
  public: boolean;
}

export interface BedrockConfig {
  environment: string;
  domain: string;
  networkCidr: string;
  certValidityHours: number;
  services: ServiceSpec[];
}

export function loadConfig(): BedrockConfig {
  const cfg = new pulumi.Config();
  const config: BedrockConfig = {
    environment: cfg.get("environment") ?? pulumi.getStack(),
    domain: cfg.require("domain"),
    networkCidr: cfg.get("networkCidr") ?? "10.0.0.0/16",
    certValidityHours: cfg.getNumber("certValidityHours") ?? 2160,
    services: cfg.requireObject<ServiceSpec[]>("services"),
  };

  if (config.services.length === 0) {
    throw new Error("bedrock:services must define at least one service");
  }
  return config;
}
