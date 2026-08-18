// Backend/src/server.js
const http = require("http");
const app = require("./app");
const connectDB = require("./conifg/db");

const PORT = process.env.PORT || 5000;

connectDB();

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});