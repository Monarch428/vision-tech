const pickFirst = (...values) => values.find((value) => typeof value === "string" && value.trim());

const normalizeMode = (mode) => {
  const normalized = (mode || process.env.APP_MODE || process.env.NODE_ENV || "dev")
    .toString()
    .trim()
    .toLowerCase();

  return ["prod", "production"].includes(normalized) ? "prod" : "dev";
};

const getMongoUri = (mode) => {
  const resolvedMode = normalizeMode(mode);

  const uri =
    resolvedMode === "prod"
      ? pickFirst(
          process.env.MONGO_URI_PROD,
          process.env.PROD_MONGO_URI,
          process.env.MONGODB_URI_PROD,
          process.env.MONGO_URI
        )
      : pickFirst(
          process.env.MONGO_URI_DEV,
          process.env.DEV_MONGO_URI,
          process.env.MONGODB_URI_DEV,
          process.env.MONGO_URI
        );

  if (!uri) {
    throw new Error(
      `Mongo URI not configured for ${resolvedMode} mode. Set ${
        resolvedMode === "prod" ? "MONGO_URI_PROD" : "MONGO_URI_DEV"
      } or MONGO_URI.`
    );
  }

  return {
    mode: resolvedMode,
    uri,
  };
};

module.exports = getMongoUri;
