require("dotenv").config();

//for test -----> using development db
if (process.env.NODE_ENV == "development") {
  console.log("connecting to development db...");
  module.exports = {
    mongoURI: "mongodb://localhost:27017/test",
    JWT_SECRET: "FoxTraining",
    TAB_JWT_SECRET: "AdminCreatingTab",
  };
} else {
  console.log("connecting to production db...");
  module.exports = {
    mongoURI:
      "mongodb+srv://lakevieweast:lPjjAxsoOx7Snzxs@cluster0.t8er9bk.mongodb.net/",
    JWT_SECRET: "FoxTraining",
    TAB_JWT_SECRET: "AdminCreatingTab",
  };
}
