import * as crypto from "crypto";
import * as pulumi from "@pulumi/pulumi";
import * as tls from "@pulumi/tls";

// ─────────────────────────────────────────────────────────────
// Pki — a component resource that stands up a private certificate
// authority and issues CA-signed leaf certificates for services.
// Everything here is a real Pulumi resource (the `tls` provider):
// a `pulumi up` generates genuine keys and certificates and tracks
// them in state.
// ─────────────────────────────────────────────────────────────

export interface PkiArgs {
  organization: string;
  validityHours: number;
}

export interface LeafCert {
  certPem: pulumi.Output<string>;
  fingerprint: pulumi.Output<string>;
}

/** SHA-256 fingerprint of a PEM certificate, colon-grouped. */
function fingerprint(pem: string): string {
  const der = Buffer.from(
    pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""),
    "base64",
  );
  const hash = crypto.createHash("sha256").update(der).digest("hex");
  return (hash.match(/.{2}/g) ?? []).slice(0, 16).join(":").toUpperCase();
}

export class Pki extends pulumi.ComponentResource {
  public readonly caCertPem: pulumi.Output<string>;
  public readonly caFingerprint: pulumi.Output<string>;

  private readonly caKey: tls.PrivateKey;
  private readonly caCert: tls.SelfSignedCert;
  private readonly organization: string;
  private readonly validityHours: number;

  constructor(
    name: string,
    args: PkiArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("bedrock:platform:Pki", name, {}, opts);
    this.organization = args.organization;
    this.validityHours = args.validityHours;

    this.caKey = new tls.PrivateKey(
      `${name}-ca-key`,
      { algorithm: "ECDSA", ecdsaCurve: "P256" },
      { parent: this },
    );

    this.caCert = new tls.SelfSignedCert(
      `${name}-ca-cert`,
      {
        privateKeyPem: this.caKey.privateKeyPem,
        isCaCertificate: true,
        validityPeriodHours: args.validityHours,
        allowedUses: ["cert_signing", "crl_signing", "digital_signature"],
        subject: {
          commonName: `${args.organization} Root CA`,
          organization: args.organization,
        },
      },
      { parent: this },
    );

    this.caCertPem = this.caCert.certPem;
    this.caFingerprint = this.caCert.certPem.apply(fingerprint);
    this.registerOutputs({ caFingerprint: this.caFingerprint });
  }

  /** Issue a CA-signed server/client certificate for a service. */
  public issue(serviceName: string, dnsName: string): LeafCert {
    const key = new tls.PrivateKey(
      `${serviceName}-key`,
      { algorithm: "ECDSA", ecdsaCurve: "P256" },
      { parent: this },
    );

    const csr = new tls.CertRequest(
      `${serviceName}-csr`,
      {
        privateKeyPem: key.privateKeyPem,
        dnsNames: [dnsName],
        subject: { commonName: dnsName, organization: this.organization },
      },
      { parent: this },
    );

    const cert = new tls.LocallySignedCert(
      `${serviceName}-cert`,
      {
        certRequestPem: csr.certRequestPem,
        caPrivateKeyPem: this.caKey.privateKeyPem,
        caCertPem: this.caCert.certPem,
        validityPeriodHours: this.validityHours,
        allowedUses: [
          "server_auth",
          "client_auth",
          "digital_signature",
          "key_encipherment",
        ],
      },
      { parent: this },
    );

    return {
      certPem: cert.certPem,
      fingerprint: cert.certPem.apply(fingerprint),
    };
  }
}
