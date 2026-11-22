import pkg from "../../package.json";

/**
 * The version shown on the About page. The number comes from package.json; the stage is "beta"
 * until APP_STAGE=production is set on the hosting when the site goes live on its real address.
 */
export function appVersion(): { version: string; stage: "beta" | "production" } {
  return { version: pkg.version, stage: process.env.APP_STAGE === "production" ? "production" : "beta" };
}
