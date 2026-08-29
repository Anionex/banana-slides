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

async function fetchGitHubReleases(owner, repository, options = {}) {
  const {
    fetchPage = fetchGitHubJson,
    perPage = 100,
    ...requestOptions
  } = options;
  const releases = [];

  for (let page = 1; ; page += 1) {
    const payload = await fetchPage(
      `/repos/${owner}/${repository}/releases?per_page=${perPage}&page=${page}`,
      requestOptions,
    );
    if (!Array.isArray(payload)) {
      throw new Error('GitHub API returned an invalid releases response');
    }

    releases.push(...payload);
    if (payload.length < perPage) {
      return releases;
    }
  }
}

module.exports = { fetchGitHubJson, fetchGitHubReleases };
