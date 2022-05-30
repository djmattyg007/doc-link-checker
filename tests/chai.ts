import chai from "chai";

if (process.env.CI === "true") {
  chai.config.truncateThreshold = 0;
}
