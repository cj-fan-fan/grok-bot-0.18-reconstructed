import { RECONSTRUCTED_PRODUCT_NAME } from "./reconstructed-identity.js";

export const SAND_PRODUCT_DISPLAY_NAME = RECONSTRUCTED_PRODUCT_NAME;
export const SAND_PRODUCT_HTTP_TOKEN = SAND_PRODUCT_DISPLAY_NAME.replaceAll(/\s+/g, "");
