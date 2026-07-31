declare const __APP_VERSION__: string;
declare const __BUILD_SHA__: string;

export const APP_VERSION = __APP_VERSION__;
export const BUILD_SHA = __BUILD_SHA__;
export const BUILD_LABEL = `Version ${APP_VERSION} · ${BUILD_SHA}`;
