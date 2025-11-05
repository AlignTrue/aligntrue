// Node.js backend example file
// This file is in the packages/api scope and gets Node.js-specific rules

import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

// Validate userId is safe (alphanumeric only)
function isValidUserId(userId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(userId);
}

// Good: Using async/await (node.async-await)
async function fetchUserData(userId: string): Promise<unknown> {
  // Prevent SSRF by validating userId parameter
  if (!isValidUserId(userId)) {
    throw new Error("Invalid user ID format");
  }

  try {
    // Good: Error handling with try/catch (node.error-handling)
    const response = await fetch(`https://api.example.com/users/${userId}`);
    const data = await response.json();
    return data;
  } catch (_error) {
    console.error("Failed to fetch user data:", _error);
    throw _error;
  }
}

app.get("/api/users/:id", async (req, res) => {
  try {
    const userData = await fetchUserData(req.params.id);
    res.json(userData);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
