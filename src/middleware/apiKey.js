function validateApiKey(req, res, next) {

  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {

    return res.status(401).json({
      success: false,
      code: "API_KEY_REQUIRED",
      message: "API key is required."
    });

  }

  if (apiKey !== process.env.TOOL_API_KEY) {

    return res.status(403).json({
      success: false,
      code: "INVALID_API_KEY",
      message: "Invalid API key."
    });

  }

  next();
}

module.exports = validateApiKey;