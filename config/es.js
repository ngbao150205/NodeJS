// config/es.js
const { Client } = require("@elastic/elasticsearch");

// 👉 URL ES: nhớ cài biến môi trường ELASTICSEARCH_URL nếu không dùng docker
// Ví dụ: http://localhost:9200 hoặc http://elasticsearch:9200 trong docker-compose
const ES_URL = process.env.ELASTICSEARCH_URL || "http://elasticsearch:9200";

// Nếu có user/pass (khi ES bật security) thì set thêm:
// process.env.ELASTICSEARCH_USERNAME, process.env.ELASTICSEARCH_PASSWORD
const esConfig = {
  node: ES_URL,
};

if (process.env.ELASTICSEARCH_USERNAME) {
  esConfig.auth = {
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD || "",
  };
}

const esClient = new Client(esConfig);

// Test kết nối
esClient
  .info()
  .then(() => {
    console.log("[ES] Connected to Elasticsearch at:", ES_URL);
  })
  .catch((err) => {
    console.error("[ES] Cannot connect to Elasticsearch:", err && err.message ? err.message : err);
  });

module.exports = esClient;
