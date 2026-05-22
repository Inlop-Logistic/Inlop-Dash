import express from "express";
import fetch from "node-fetch";

const app = express();

app.get("/api/torre-control", async (req, res) => {
  try {
    const response = await fetch("https://app.controlt.com.co/apipublic/api/Resume", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        Accept: "application/json"
      }
    });

    const text = await response.text(); // importante para debug real

    res.setHeader("Content-Type", "application/json");
    res.send(text);

  } catch (err) {
    console.error("ERROR CONTROLT:", err);
    res.status(500).json({ error: "Fallo proxy Railway" });
  }
});

app.listen(process.env.PORT || 3000);
