import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import type { ServiceSpec } from "../lib/config";
import { Pki } from "./pki";
import { ServiceSecrets } from "./secrets";

// ─────────────────────────────────────────────────────────────
// Service — composes the pieces a single service needs: a CA-signed
// TLS certificate, a generated token, and a rendered config file.
// The config file references the secret rather than embedding it —
// the token's value stays only in encrypted Pulumi state.
// ─────────────────────────────────────────────────────────────

export interface ServiceArgs {
  spec: ServiceSpec;
  domain: string;
  environment: string;
  pki: Pki;
  outputDir: string;
}

/** A fully-resolved, display-safe description of a provisioned service. */
export interface ServiceDescriptor {
  name: string;
  fqdn: string;
  port: number;
  replicas: number;
  public: boolean;
  certFingerprint: string;
  tokenPreview: string;
}

export class Service extends pulumi.ComponentResource {
  /** The provisioned service, resolved for rendering / stack output. */
  public readonly descriptor: pulumi.Output<ServiceDescriptor>;

  constructor(
    name: string,
    args: ServiceArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("bedrock:platform:Service", name, {}, opts);
    const { spec, domain, environment, pki, outputDir } = args;
    const fqdn = `${spec.name}.${domain}`;

    const leaf = pki.issue(spec.name, fqdn);
    const secrets = new ServiceSecrets(`${spec.name}-secrets`, {
      parent: this,
    });

    // Rendered config — references the secret, never embeds its value.
    const configFile = pulumi.interpolate`# bedrock · ${environment} · ${spec.name}
SERVICE_NAME=${spec.name}
SERVICE_FQDN=${fqdn}
SERVICE_PORT=${spec.port}
SERVICE_REPLICAS=${spec.replicas}
SERVICE_EXPOSURE=${spec.public ? "public" : "internal"}
TLS_CERT_FINGERPRINT=${leaf.fingerprint}
SERVICE_TOKEN_REF=secret://bedrock/${environment}/${spec.name}/token
`;

    new command.local.Command(
      `${spec.name}-config`,
      {
        create: `mkdir -p '${outputDir}/config' && cat > '${outputDir}/config/${spec.name}.env'`,
        delete: `rm -f '${outputDir}/config/${spec.name}.env'`,
        stdin: configFile,
        triggers: [configFile],
      },
      { parent: this },
    );

    this.descriptor = pulumi
      .all([leaf.fingerprint, secrets.tokenPreview])
      .apply(([certFingerprint, tokenPreview]) => ({
        name: spec.name,
        fqdn,
        port: spec.port,
        replicas: spec.replicas,
        public: spec.public,
        certFingerprint,
        tokenPreview,
      }));

    this.registerOutputs({ descriptor: this.descriptor });
  }
}
