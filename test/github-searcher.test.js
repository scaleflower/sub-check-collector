const test = require('node:test');
const assert = require('node:assert/strict');
const { GitHubSearcher } = require('../dist/github-searcher');

function repository(index, updatedAt) {
  return {
    full_name: `owner/repository-${index}`,
    html_url: `https://github.com/owner/repository-${index}`,
    description: null,
    stargazers_count: index,
    updated_at: updatedAt,
  };
}

test('returns 100 repositories when 100 repositories satisfy the configured filters', async () => {
  const searcher = new GitHubSearcher();
  const recent = new Date().toISOString();
  const stale = new Date('2020-01-01T00:00:00.000Z').toISOString();
  const requests = [];

  searcher.octokit = {
    rest: {
      search: {
        repos: async (request) => {
          requests.push(request);
          const appliesUpdateFilter = request.q.includes('pushed:>=');
          return {
            data: {
              total_count: 200,
              items: appliesUpdateFilter
                ? Array.from({ length: 100 }, (_, index) => repository(index, recent))
                : [
                    ...Array.from({ length: 30 }, (_, index) => repository(index, recent)),
                    ...Array.from({ length: 70 }, (_, index) => repository(index + 30, stale)),
                  ],
            },
          };
        },
      },
    },
  };

  const repositories = await searcher.searchRepositories(
    ['free', 'v2ray', 'clash'],
    100,
    0,
    3
  );

  assert.equal(repositories.length, 100);
  assert.match(requests[0].q, /pushed:>=/);
});

test('fails explicitly when GitHub has fewer repositories than configured', async () => {
  const searcher = new GitHubSearcher();
  const recent = new Date().toISOString();

  searcher.octokit = {
    rest: {
      search: {
        repos: async () => ({
          data: {
            total_count: 80,
            items: Array.from({ length: 80 }, (_, index) => repository(index, recent)),
          },
        }),
      },
    },
  };

  await assert.rejects(
    searcher.searchRepositories(['free', 'v2ray', 'clash'], 100, 0, 3),
    /仅找到 80 个符合条件的仓库，配置要求 100 个/
  );
});

test('combines distinct keyword searches until 100 repositories are collected', async () => {
  const searcher = new GitHubSearcher();
  const recent = new Date().toISOString();
  const requests = [];

  searcher.octokit = {
    rest: {
      search: {
        repos: async (request) => {
          requests.push(request);
          const keyword = ['free', 'v2ray', 'clash'].find((value) =>
            request.q.startsWith(`${value} `)
          );
          const prefix = keyword || 'combined';
          return {
            data: {
              total_count: 50,
              items: Array.from({ length: 50 }, (_, index) => ({
                ...repository(index, recent),
                full_name: `${prefix}/repository-${index}`,
              })),
            },
          };
        },
      },
    },
  };

  const repositories = await searcher.searchRepositories(
    ['free', 'v2ray', 'clash'],
    100,
    0,
    3
  );

  assert.equal(repositories.length, 100);
  assert.equal(new Set(repositories.map((repo) => repo.fullName)).size, 100);
  assert.deepEqual(
    requests.map((request) => request.q.split(' ')[0]),
    ['free', 'v2ray']
  );
});
