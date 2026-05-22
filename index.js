import express from "express";
import fetch from "node-fetch";

const app = express();

app.get("/api/torre-control", async (req, res) => {
  const response = await fetch("API_URL_CONTROL_T", {
    headers: {
      Authorization: `Bearer ${process.env.API_TOKEN}`,
    },
  });

  const data = await response.json();
  res.json(data);
});

app.listen(process.env.PORT || 3000);
