import { describe, expect, it } from "vitest";
import {
  isMarketingDeepLinkUrl,
  routeFromMarketingUrl,
} from "./marketingDeepLink";

describe("marketing deep-link routing", () => {
  it("accepts the AppsFlyer custom-scheme home link", () => {
    const url = "carnivorex://home?af_dp=carnivorex%3A%2F%2Fhome";

    expect(isMarketingDeepLinkUrl(url)).toBe(true);
    expect(routeFromMarketingUrl(url)).toBe("/");
  });

  it("keeps authentication links outside marketing routing", () => {
    expect(isMarketingDeepLinkUrl("carnivorex://auth?code=redacted")).toBe(false);
    expect(isMarketingDeepLinkUrl("carnivorex://callback#access_token=redacted")).toBe(false);
  });

  it("routes known destinations from the custom-scheme host", () => {
    expect(routeFromMarketingUrl("carnivorex://recipes")).toBe("/recipes");
    expect(routeFromMarketingUrl("carnivorex://coaching")).toBe("/coaching");
  });

  it("falls back to home for a bare OneLink while awaiting SDK attribution", () => {
    expect(routeFromMarketingUrl("https://carnivorex.onelink.me/kWuX/8q584xo1")).toBe("/");
  });
});