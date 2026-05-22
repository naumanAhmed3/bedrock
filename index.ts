import * as path from "path";
import { loadConfig } from "./lib/config";
import { Platform } from "./components/platform";

// ─────────────────────────────────────────────────────────────
// Bedrock — the program entry point. Reads the stack configuration
// and stands up one Platform; `pulumi up` provisions the CA, every
// service's certificate and secrets, and renders the catalog.
// ─────────────────────────────────────────────────────────────

const config = loadConfig();
const outputDir = path.join(__dirname, "dist");

const platform = new Platform("bedrock", { config, outputDir });

// Stack outputs.
export const environment = config.environment;
export const domain = config.domain;
export const networkCidr = config.networkCidr;
export const caFingerprint = platform.caFingerprint;
export const services = platform.services;
export const catalog = platform.catalogPath;
