import identity from "./reconstructed-identity.json" with { type: "json" };

export const OFFICIAL_BUNDLE_ID = identity.official.bundleId;
export const OFFICIAL_PRODUCT_NAME = identity.official.productName;
export const OFFICIAL_URL_SCHEMES = identity.official.urlSchemes;

export const RECONSTRUCTED_BUNDLE_ID = identity.reconstructed.bundleId;
export const RECONSTRUCTED_PRODUCT_NAME = identity.reconstructed.productName;
export const RECONSTRUCTED_DISPLAY_NAME = identity.reconstructed.displayName;
export const RECONSTRUCTED_URL_SCHEME = identity.reconstructed.urlScheme;
export const RECONSTRUCTED_USER_DATA_DIR_NAME = identity.reconstructed.userDataDirName;
export const RECONSTRUCTED_PRODUCTION_DATA_DIRNAME = identity.reconstructed.productionDataDirname;
export const RECONSTRUCTED_LEGACY_DATA_RELATIVE = identity.reconstructed.legacyDataRelative;
export const RECONSTRUCTED_WINDOWS_LEGACY_PROFILE_NAME = identity.reconstructed.windowsLegacyProfileName;
export const RECONSTRUCTED_MCP_OAUTH_LOOPBACK_PORT = identity.reconstructed.mcpOAuthLoopbackPort;
export const RECONSTRUCTED_MCP_OAUTH_LOOPBACK_CALLBACK_URL = `http://localhost:${RECONSTRUCTED_MCP_OAUTH_LOOPBACK_PORT}/callback`;

export const LOCAL_DOCKER_BOX_CONTAINER = identity.reconstructed.localDocker.containerName;
export const LOCAL_DOCKER_VOLUME_WORKSPACE = identity.reconstructed.localDocker.volumeWorkspace;
export const LOCAL_DOCKER_VOLUME_DATA = identity.reconstructed.localDocker.volumeData;
export const LOCAL_DOCKER_OWNER_LABEL_KEY = identity.reconstructed.localDocker.ownerLabelKey;
export const LOCAL_DOCKER_OWNER_LABEL = `${LOCAL_DOCKER_OWNER_LABEL_KEY}=1`;
export const LOCAL_DOCKER_HOST_PORTS = identity.reconstructed.localDocker.hostPorts;
export const LOCAL_DOCKER_CONTAINER_PORTS = identity.reconstructed.localDocker.containerPorts;
export const LOCAL_DOCKER_GATEWAY_URL = `http://127.0.0.1:${LOCAL_DOCKER_HOST_PORTS.gateway}`;

export const reconstructedIdentity = identity;
