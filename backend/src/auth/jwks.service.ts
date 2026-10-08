import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet } from "jose";

@Injectable()
export class JwksService {
  private keySet?: ReturnType<typeof createRemoteJWKSet>;
  private currentUrl?: string;

  constructor(private readonly config: ConfigService) {}

  getKeySet() {
    const url = this.config.getOrThrow<string>("CORE_HUB_JWKS_URL");
    if (!this.keySet || this.currentUrl !== url) {
      this.keySet = createRemoteJWKSet(new URL(url), {
        cacheMaxAge: Number(this.config.get<string>("JWKS_CACHE_TTL_MS", "600000")),
        cooldownDuration: Number(this.config.get<string>("JWKS_MIN_REFRESH_INTERVAL_MS", "30000")),
        timeoutDuration: Number(this.config.get<string>("JWKS_REQUEST_TIMEOUT_MS", "5000")),
      });
      this.currentUrl = url;
    }
    return this.keySet;
  }
}
