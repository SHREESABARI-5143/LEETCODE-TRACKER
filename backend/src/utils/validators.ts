/**
 * Utility functions for validating and parsing LeetCode profile URLs and usernames
 */

function parseProfileUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return { isValid: false, username: null, fullUrl: null };
  }

  const clean = inputUrl.trim();
  // Match standard LeetCode profile URL patterns:
  // https://leetcode.com/u/username/
  // https://leetcode.com/username/
  const match = clean.match(/leetcode\.com\/(?:u\/)?([a-zA-Z0-9_-]+)\/?/i);
  if (match && match[1]) {
    const username = match[1];
    return {
      isValid: true,
      username,
      fullUrl: `https://leetcode.com/u/${username}/`
    };
  }

  // If input string is just a username (e.g., "john_doe")
  if (/^[a-zA-Z0-9_-]+$/.test(clean)) {
    return {
      isValid: true,
      username: clean,
      fullUrl: `https://leetcode.com/u/${clean}/`
    };
  }

  return { isValid: false, username: null, fullUrl: null };
}

module.exports = {
  parseProfileUrl
};
