/**
 * True in local dev (Vite dev server) AND in the deployed dev environment
 * (hourly-dev.vercel.app, where VITE_APP_ENV=development is injected at build time).
 * Never true in production (goodhours.app).
 */
export const IS_DEV_ENV: boolean =
  import.meta.env.DEV === true || import.meta.env.VITE_APP_ENV === "development";
