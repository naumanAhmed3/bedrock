import { PolicyPack, validateResourceOfType } from "@pulumi/policy";
import * as random from "@pulumi/random";
import * as tls from "@pulumi/tls";

// ─────────────────────────────────────────────────────────────
// Bedrock policy-as-code. Runs during `pulumi preview --policy-pack`
// and fails the plan if the platform drifts below its security bar.
// ─────────────────────────────────────────────────────────────

const ONE_YEAR_HOURS = 8760;

new PolicyPack("bedrock-platform", {
  policies: [
    {
      name: "random-password-strength",
      description: "Generated tokens must be at least 32 characters.",
      enforcementLevel: "mandatory",
      validateResource: validateResourceOfType(
        random.RandomPassword,
        (pw, _args, reportViolation) => {
          if ((pw.length ?? 0) < 32) {
            reportViolation(
              `Generated token length ${pw.length} is below the 32-character minimum.`,
            );
          }
        },
      ),
    },
    {
      name: "private-key-strength",
      description: "Private keys must be ECDSA, ED25519, or RSA-2048+.",
      enforcementLevel: "mandatory",
      validateResource: validateResourceOfType(
        tls.PrivateKey,
        (key, _args, reportViolation) => {
          if (!["ECDSA", "ED25519", "RSA"].includes(key.algorithm)) {
            reportViolation(`Unsupported key algorithm "${key.algorithm}".`);
          }
          if (key.algorithm === "RSA" && (key.rsaBits ?? 2048) < 2048) {
            reportViolation("RSA keys must be at least 2048 bits.");
          }
        },
      ),
    },
    {
      name: "certificate-validity-bounded",
      description: "No certificate may be valid for more than one year.",
      enforcementLevel: "advisory",
      validateResource: (args, reportViolation) => {
        const certTypes = [
          "tls:index/selfSignedCert:SelfSignedCert",
          "tls:index/locallySignedCert:LocallySignedCert",
        ];
        if (!certTypes.includes(args.type)) return;
        const hours: number = args.props.validityPeriodHours ?? 0;
        if (hours > ONE_YEAR_HOURS) {
          reportViolation(
            `Certificate validity ${hours}h exceeds the ${ONE_YEAR_HOURS}h (1 year) ceiling.`,
          );
        }
      },
    },
  ],
});
