import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";

// ─────────────────────────────────────────────────────────────
// ServiceSecrets — a component resource that mints a service's
// credentials. The full token is a real (encrypted-in-state) Pulumi
// secret; only a short, non-sensitive preview is exposed for display.
// ─────────────────────────────────────────────────────────────

export class ServiceSecrets extends pulumi.ComponentResource {
  /** The full service token — a Pulumi secret. */
  public readonly token: pulumi.Output<string>;
  /** A short, safe-to-display preview of the token. */
  public readonly tokenPreview: pulumi.Output<string>;

  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super("bedrock:platform:ServiceSecrets", name, {}, opts);

    const token = new random.RandomPassword(
      `${name}-token`,
      { length: 40, special: false },
      { parent: this },
    );

    this.token = token.result;
    this.tokenPreview = token.result.apply(
      (t) => `${t.slice(0, 6)}…${t.slice(-2)}`,
    );

    this.registerOutputs({ tokenPreview: this.tokenPreview });
  }
}
