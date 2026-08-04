import "server-only";

import {
  parseIntegrationEnvironment,
  parsePlatformEnvironment,
  validateEnvironment,
  type EnvironmentScope,
} from "./schema";

export function getPlatformEnvironment() {
  return parsePlatformEnvironment(process.env);
}

export function getIntegrationEnvironment() {
  return parseIntegrationEnvironment(process.env);
}

export function checkServerEnvironment(scope: EnvironmentScope = "platform") {
  return validateEnvironment(process.env, scope);
}
