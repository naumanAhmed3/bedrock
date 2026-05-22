# Bedrock — Infrastructure as Code with Pulumi

Bedrock provisions the foundational layer of a multi-service platform —
**network topology, a TLS certificate authority, per-service secrets, and
rendered configuration** — entirely in TypeScript with [Pulumi](https://www.pulumi.com).
It is built from **reusable component resources** and runs across **multiple
environments** from typed, per-stack configuration.

**Live demo:** https://bedrock-ecru.vercel.app

> The demo is the platform catalog — a static page **rendered by `pulumi up`
> itself**. Every service, certificate fingerprint and replica count on it is a
> real output of provisioning the `prod` stack.

---

## Why it runs without a cloud account

Infrastructure-as-code normally targets a billed cloud. Bedrock is deliberately
buildable by anyone: it provisions with providers that need **no cloud account
and no credentials** —

- **`tls`** — a real private CA and CA-signed leaf certificates (genuine keys
  and X.509 certs, tracked in state),
- **`random`** — cryptographically-strong service tokens,
- **`command`** — rendered config files and the catalog, written to `dist/`.

The Pulumi mechanics on display — component resources, typed multi-stack
config, resource dependencies, secrets, stack outputs, and policy-as-code — are
exactly the same ones you would use against AWS or GCP. Only the providers
differ.

---

## The component model

```
Platform                         (bedrock:platform:Platform)
├── Pki                          (bedrock:platform:Pki)
│   ├── tls.PrivateKey  ─ CA key
│   └── tls.SelfSignedCert ─ root CA      … .issue() → CA-signed leaf certs
│
├── Service ×4                   (bedrock:platform:Service)
│   ├── Pki.issue()  → tls.PrivateKey + CertRequest + LocallySignedCert
│   ├── ServiceSecrets → random.RandomPassword       (token, a Pulumi secret)
│   └── command.local.Command → dist/config/<svc>.env
│
└── command.local.Command ×2 → dist/index.html  +  dist/platform.json
```

Each box is a real `pulumi.ComponentResource`. `Pki` exposes an `issue()` method
so services request certificates from the CA without knowing how it works —
encapsulation, the same way you would wrap a VPC or a database.

Rendered config files reference the secret (`SERVICE_TOKEN_REF=secret://…`)
rather than embedding it: **the token's value lives only in encrypted Pulumi
state and a secret stack output**, never in a plaintext file.

---

## Multi-environment

Two stacks, two config files, one program:

| | `dev` | `prod` |
|---|---|---|
| domain | `dev.bedrock.internal` | `bedrock.example.com` |
| network | `10.10.0.0/16` | `10.20.0.0/16` |
| cert validity | 720 h | 2160 h |
| replicas (total) | 4 | 12 |

`lib/config.ts` turns the loose Pulumi config bag into a checked
`BedrockConfig`, so a malformed stack file fails fast with a clear error.

---

## Policy as code

`policy/` is a Pulumi **CrossGuard** policy pack — security rules enforced at
`pulumi preview` time:

| Policy | Rule | Level |
|---|---|---|
| `random-password-strength` | tokens ≥ 32 characters | mandatory |
| `private-key-strength` | ECDSA / ED25519 / RSA-2048+ only | mandatory |
| `certificate-validity-bounded` | no cert valid > 1 year | advisory |

```
$ pulumi preview --stack prod --policy-pack ./policy
Policies:
    ✅ bedrock-platform@v1.0.0 (local: policy)
```

---

## Run it

Requires Node 20+ and the [Pulumi CLI](https://www.pulumi.com/docs/install/).

```bash
pnpm install
pulumi login --local                 # state on the local filesystem
export PULUMI_CONFIG_PASSPHRASE=...   # encrypts secrets in state

pulumi stack select dev               # or: pulumi stack init dev
pulumi up

# enforce the policy pack
pulumi preview --policy-pack ./policy
```

`pulumi up` provisions the CA, every service's key + certificate + token, and
renders the catalog to `dist/` — which is what the live demo serves.

```
$ pulumi up --stack prod
 +  tls:index:SelfSignedCert    bedrock-pki-ca-cert   created
 +  tls:index:LocallySignedCert api-cert              created
 +  random:index:RandomPassword api-secrets-token     created
 +  command:local:Command       api-config            created
 +  command:local:Command       bedrock-catalog-html  created
 ...
Outputs:
    caFingerprint: "49:D2:54:8F:26:D3:B2:E2:1D:31:62:E1:46:3B:C9:C6"
    environment  : "prod"
Resources:
    + 35 created
```

---

## Project structure

```
bedrock/
├── Pulumi.yaml             project definition
├── Pulumi.dev.yaml         dev stack config
├── Pulumi.prod.yaml        prod stack config
├── index.ts                program entry — builds one Platform
├── lib/
│   ├── config.ts           typed multi-stack configuration
│   └── render.ts           catalog HTML + JSON rendering
├── components/
│   ├── pki.ts              the certificate authority component
│   ├── secrets.ts          per-service secret generation
│   ├── service.ts          one service: cert + secrets + config
│   └── platform.ts         composes the whole environment
└── policy/                 Pulumi CrossGuard policy pack
```

---

## Design notes

- **`dist/` is build output, not source.** It is git-ignored and produced by
  `pulumi up`. The deployed demo is the `prod` stack's rendered catalog.
- **State is local** (`pulumi login --local`) so the project is self-contained;
  pointing it at Pulumi Cloud or an S3 backend is a one-line change.
- **Secrets never touch disk in the clear** — only `secret://` references are
  rendered; values stay in encrypted state.
- Swapping `tls` / `random` / `command` for `aws` / `gcp` providers would not
  change the component structure — the topology, config and policy layers stay
  exactly as they are.

---

## License

MIT
