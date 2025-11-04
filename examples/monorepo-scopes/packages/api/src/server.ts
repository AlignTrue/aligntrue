// Node.js backend example file
// This file is in the packages/api scope and gets Node.js-specific rules

import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

// Good: Using async/await (node.async-await)
async function fetchUserData(userId: string): Promise<any> {
  try {
    // Good: Error handling with try/catch (node.error-handling)
    const response = await fetch(`https://api.example.com/users/${userId}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch user data:", error);
    throw error;
  }
}

app.get("/api/users/:id", async (req, res) => {
  try {
    const userData = await fetchUserData(req.params.id);
    res.json(userData);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
