/*
 * WHAT IS THIS FILE?
 * It's the entry point for Qwik City SSR when building for a Node server.
 */
import {
  createQwikCity,
  type PlatformNode,
} from "@builder.io/qwik-city/middleware/node";
import qwikCityPlan from "@qwik-city-plan";
import { manifest } from "@qwik-client-manifest";
import render from "./entry.ssr";

declare global {
  interface QwikCityPlatform extends PlatformNode {}
}

export default createQwikCity({ render, qwikCityPlan, manifest });
