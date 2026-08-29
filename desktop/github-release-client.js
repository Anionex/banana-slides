const https = require('https');

function fetchGitHubJson(requestPath, options = {}) {
  const {
    token = '',
    timeoutMs = 10000,
    userAgent = 'BananaSlides',
  } = options;

  return new Promise((resolve, reject) => {
    const headers = {
      Accept: 'application/vnd.github+json',
      'User-Agent': userAgent,
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const req = https.get({
      hostname: 'api.github.com',
      path: requestPath,
      headers,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => { chunks.push(chunk); });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API returned HTTP ${res.statusCode}`));
          return;
        }

        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          reject(new Error('GitHub API returned invalid JSON'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('GitHub API request timed out'));
    });
  });
}

module.exports = { fetchGitHubJson };
