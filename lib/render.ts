import type { ServiceDescriptor } from "../components/service";

// ─────────────────────────────────────────────────────────────
// Renders the provisioned platform into a self-contained catalog —
// a JSON manifest and a static HTML page. The HTML page is what gets
// deployed, so it is the human-readable proof of what `pulumi up`
// actually created.
// ─────────────────────────────────────────────────────────────

export interface CatalogMeta {
  environment: string;
  domain: string;
  networkCidr: string;
  caFingerprint: string;
  generatedAt: string;
}

export function renderCatalogJson(
  meta: CatalogMeta,
  services: ServiceDescriptor[],
): string {
  return JSON.stringify({ ...meta, services }, null, 2) + "\n";
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
}

export function renderCatalogHtml(
  meta: CatalogMeta,
  services: ServiceDescriptor[],
): string {
  const isProd = meta.environment === "prod";
  const replicas = services.reduce((s, x) => s + x.replicas, 0);

  const cards = services
    .map((s) => {
      const tag = s.public
        ? '<span class="tag tag-public">public</span>'
        : '<span class="tag tag-internal">internal</span>';
      return `      <div class="svc">
        <div class="svc-head">
          <span class="svc-name">${esc(s.name)}</span>
          ${tag}
        </div>
        <div class="svc-fqdn">${esc(s.fqdn)}:${s.port}</div>
        <dl>
          <div><dt>replicas</dt><dd>${s.replicas}</dd></div>
          <div><dt>tls&nbsp;cert</dt><dd class="mono">${esc(s.certFingerprint)}</dd></div>
          <div><dt>token</dt><dd class="mono">${esc(s.tokenPreview)}</dd></div>
        </dl>
      </div>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Bedrock — ${esc(meta.environment)} platform catalog</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; margin: 0; }
  body {
    background: #0b0c10; color: #e6e7ee;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased; padding: 48px 20px;
  }
  .wrap { max-width: 880px; margin: 0 auto; }
  .mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  header { display: flex; align-items: center; gap: 12px; }
  .logo {
    width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center;
    background: rgba(129,140,248,0.15); border: 1px solid rgba(129,140,248,0.35);
  }
  .logo svg { width: 20px; height: 20px; }
  h1 { font-size: 19px; font-weight: 600; letter-spacing: -0.01em; }
  .sub { font-size: 12.5px; color: #8b8d9c; margin-top: 1px; }
  .env {
    margin-left: auto; font-size: 11px; font-family: ui-monospace, Menlo, monospace;
    padding: 4px 10px; border-radius: 999px;
    background: ${isProd ? "rgba(248,113,113,0.12)" : "rgba(129,140,248,0.12)"};
    border: 1px solid ${isProd ? "rgba(248,113,113,0.3)" : "rgba(129,140,248,0.3)"};
    color: ${isProd ? "#f87171" : "#818cf8"};
  }
  .meta {
    margin-top: 22px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
  }
  .meta div {
    background: #14151c; border: 1px solid #262833; border-radius: 12px; padding: 12px 14px;
  }
  .meta dt { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #6e7080; }
  .meta dd { font-size: 13px; margin-top: 3px; }
  h2 { font-size: 13px; font-weight: 600; color: #c7c8d4; margin: 28px 0 12px; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .svc { background: #14151c; border: 1px solid #262833; border-radius: 14px; padding: 16px; }
  .svc-head { display: flex; align-items: center; gap: 8px; }
  .svc-name { font-size: 15px; font-weight: 600; }
  .tag { font-size: 10px; font-family: ui-monospace, Menlo, monospace; padding: 2px 7px; border-radius: 999px; }
  .tag-public { color: #818cf8; background: rgba(129,140,248,0.12); border: 1px solid rgba(129,140,248,0.25); }
  .tag-internal { color: #8b8d9c; background: #1c1e27; border: 1px solid #2c2e3a; }
  .svc-fqdn { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: #818cf8; margin-top: 4px; }
  .svc dl { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
  .svc dl div { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; }
  .svc dt { color: #6e7080; }
  .svc dd { color: #c7c8d4; text-align: right; word-break: break-all; }
  footer { margin-top: 32px; font-size: 11px; color: #5b5d6b; line-height: 1.7; }
  @media (max-width: 640px) {
    .meta { grid-template-columns: repeat(2, 1fr); }
    .grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <span class="logo">
      <svg viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2" stroke-linejoin="round">
        <path d="M3 8l9-5 9 5-9 5-9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" />
      </svg>
    </span>
    <div>
      <h1>Bedrock platform catalog</h1>
      <div class="sub">provisioned with Pulumi · ${esc(meta.domain)}</div>
    </div>
    <span class="env">${esc(meta.environment)}</span>
  </header>

  <div class="meta">
    <div><dt>Environment</dt><dd>${esc(meta.environment)}</dd></div>
    <div><dt>Services</dt><dd>${services.length} · ${replicas} replicas</dd></div>
    <div><dt>Network</dt><dd class="mono">${esc(meta.networkCidr)}</dd></div>
    <div><dt>Root CA</dt><dd class="mono" style="font-size:11px">${esc(meta.caFingerprint.slice(0, 23))}…</dd></div>
  </div>

  <h2>Services</h2>
  <div class="grid">
${cards}
  </div>

  <footer>
    Every service above carries a CA-signed TLS certificate and a generated
    token, with rendered config under <span class="mono">dist/config/</span>.
    This page is itself an output of <span class="mono">pulumi up</span> —
    regenerated each time the stack is applied.<br />
    Generated ${esc(meta.generatedAt)}.
  </footer>
</div>
</body>
</html>
`;
}
