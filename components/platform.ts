import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import type { BedrockConfig } from "../lib/config";
import { renderCatalogHtml, renderCatalogJson } from "../lib/render";
import { Pki } from "./pki";
import { Service, type ServiceDescriptor } from "./service";

// ─────────────────────────────────────────────────────────────
// Platform — the top-level component. It composes the certificate
// authority and every Service for an environment, then renders the
// whole topology to a catalog (HTML + JSON) under dist/.
// ─────────────────────────────────────────────────────────────

export interface PlatformArgs {
  config: BedrockConfig;
  /** Absolute directory the catalog + config files are rendered into. */
  outputDir: string;
}

export class Platform extends pulumi.ComponentResource {
  public readonly caFingerprint: pulumi.Output<string>;
  public readonly services: pulumi.Output<ServiceDescriptor[]>;
  public readonly catalogPath: string;

  constructor(
    name: string,
    args: PlatformArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("bedrock:platform:Platform", name, {}, opts);
    const { config, outputDir } = args;

    const pki = new Pki(
      `${name}-pki`,
      {
        organization: `Bedrock ${config.environment}`,
        validityHours: config.certValidityHours,
      },
      { parent: this },
    );

    const services = config.services.map(
      (spec) =>
        new Service(
          `${name}-${spec.name}`,
          {
            spec,
            domain: config.domain,
            environment: config.environment,
            pki,
            outputDir,
          },
          { parent: this },
        ),
    );

    this.caFingerprint = pki.caFingerprint;
    this.services = pulumi.all(services.map((s) => s.descriptor));

    // Render the platform catalog. The content is a function of every
    // service's resolved descriptor, so the file is rewritten whenever
    // the topology changes.
    const catalog = pulumi
      .all([pki.caFingerprint, this.services])
      .apply(([caFingerprint, descriptors]) => {
        const meta = {
          environment: config.environment,
          domain: config.domain,
          networkCidr: config.networkCidr,
          caFingerprint,
          generatedAt: new Date().toISOString(),
        };
        return {
          html: renderCatalogHtml(meta, descriptors),
          json: renderCatalogJson(meta, descriptors),
        };
      });

    new command.local.Command(
      `${name}-catalog-html`,
      {
        create: `mkdir -p '${outputDir}' && cat > '${outputDir}/index.html'`,
        delete: `rm -f '${outputDir}/index.html'`,
        stdin: catalog.html,
        triggers: [catalog.html],
      },
      { parent: this },
    );

    new command.local.Command(
      `${name}-catalog-json`,
      {
        create: `mkdir -p '${outputDir}' && cat > '${outputDir}/platform.json'`,
        delete: `rm -f '${outputDir}/platform.json'`,
        stdin: catalog.json,
        triggers: [catalog.json],
      },
      { parent: this },
    );

    this.catalogPath = `${outputDir}/index.html`;
    this.registerOutputs({
      caFingerprint: this.caFingerprint,
      catalogPath: this.catalogPath,
    });
  }
}
