const jwt = require("jsonwebtoken");
const { TAB_JWT_SECRET } = require("../config/config");

const verifyTabToken = (req, res, next) => {
  const token = req.headers["authorization"].split(" ")[1];
  console.log(req.headers["tab_token"]);

  if (!token) return res.status(401).json({ message: "Unauthorized" });

  jwt.verify(token, TAB_JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid token" });
    req.tabId = decoded.tabId;
    next();
  });
};

module.exports = verifyTabToken;
