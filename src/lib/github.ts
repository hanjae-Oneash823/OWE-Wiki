import { Octokit } from 'octokit';

interface PublishNoteParams {
  domain: string;
  slug: string;
  noteId: string;
  title: string;
  content: string;
  publishedDate: string;
}

function buildMdx(params: PublishNoteParams): string {
  return [
    '---',
    `noteId: ${params.noteId}`,
    `title: ${JSON.stringify(params.title)}`,
    `domain: ${params.domain}`,
    'tags: []',
    'aliases: []',
    `publishedDate: ${params.publishedDate}`,
    '---',
    '',
    params.content.trim(),
    '',
  ].join('\n');
}

function getRepoConfig(): { token: string; owner: string; repo: string; branch: string } {
  const token = import.meta.env.GITHUB_TOKEN;
  const owner = import.meta.env.GITHUB_REPO_OWNER;
  const repo = import.meta.env.GITHUB_REPO_NAME;
  const branch = import.meta.env.GITHUB_BRANCH ?? 'main';

  if (!token || !owner || !repo) {
    throw new Error('GitHub publishing is not configured (missing GITHUB_TOKEN/GITHUB_REPO_OWNER/GITHUB_REPO_NAME)');
  }

  return { token, owner, repo, branch };
}

export async function publishNoteToGitHub(params: PublishNoteParams): Promise<void> {
  const { token, owner, repo, branch } = getRepoConfig();
  const octokit = new Octokit({ auth: token });
  const path = `src/content/notes/${params.domain}/${params.slug}.mdx`;

  let sha: string | undefined;
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref: branch });
    if (!Array.isArray(data) && data.type === 'file') sha = data.sha;
  } catch (error: unknown) {
    const status = (error as { status?: number }).status;
    if (status !== 404) throw error;
  }

  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    branch,
    message: `Publish note: ${params.title}`,
    content: Buffer.from(buildMdx(params), 'utf-8').toString('base64'),
    sha,
  });
}
