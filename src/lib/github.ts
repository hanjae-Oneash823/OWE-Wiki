import { Octokit } from 'octokit';
import { dump as dumpYaml, load as parseYaml } from 'js-yaml';
import { slugify } from './slugify';

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

interface RenameNoteParams {
  domain: string;
  oldSlug: string;
  oldTitle: string;
  newTitle: string;
}

interface RenameNoteResult {
  href: string;
}

/** Serializes a YAML-parsed frontmatter Date back to `YYYY-MM-DD` so publishedDate/updatedDate keep their original shape. */
function serializeFrontmatterValue(value: unknown): unknown {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function buildRenamedMdx(frontmatter: Record<string, unknown>, body: string): string {
  const normalized = Object.fromEntries(
    Object.entries(frontmatter).map(([key, value]) => [key, serializeFrontmatterValue(value)]),
  );
  const yamlBlock = dumpYaml(normalized, { lineWidth: -1 }).trimEnd();
  return `---\n${yamlBlock}\n---\n\n${body.trim()}\n`;
}

/**
 * Renames a published note's title, moving its old title into `aliases` so existing
 * [[Old Title]] wikilinks elsewhere keep resolving. Moves the file if the slug changes.
 */
export async function renameNoteOnGitHub(params: RenameNoteParams): Promise<RenameNoteResult> {
  const { token, owner, repo, branch } = getRepoConfig();
  const octokit = new Octokit({ auth: token });
  const oldPath = `src/content/notes/${params.domain}/${params.oldSlug}.mdx`;

  const { data: fileData } = await octokit.rest.repos.getContent({ owner, repo, path: oldPath, ref: branch });
  if (Array.isArray(fileData) || fileData.type !== 'file' || !('content' in fileData)) {
    throw new Error('Note not found');
  }

  const raw = Buffer.from(fileData.content, 'base64').toString('utf-8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error('Note not found');

  const [, frontmatterBlock, body] = match;
  const frontmatter = parseYaml(frontmatterBlock) as Record<string, unknown>;

  const existingAliases = Array.isArray(frontmatter.aliases) ? (frontmatter.aliases as string[]) : [];
  const aliases = existingAliases.includes(params.oldTitle) ? existingAliases : [...existingAliases, params.oldTitle];

  const newSlug = slugify(params.newTitle);
  const newPath = `src/content/notes/${params.domain}/${newSlug}.mdx`;
  const slugChanged = newSlug !== params.oldSlug;

  if (slugChanged) {
    const collision = await octokit.rest.repos.getContent({ owner, repo, path: newPath, ref: branch }).then(
      () => true,
      (error: unknown) => {
        const status = (error as { status?: number }).status;
        if (status === 404) return false;
        throw error;
      },
    );
    if (collision) throw new Error('A note with that title already exists');
  }

  const updatedFrontmatter = {
    ...frontmatter,
    title: params.newTitle,
    aliases,
    updatedDate: new Date().toISOString().slice(0, 10),
  };

  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: newPath,
    branch,
    message: `Rename note: ${params.oldTitle} → ${params.newTitle}`,
    content: Buffer.from(buildRenamedMdx(updatedFrontmatter, body), 'utf-8').toString('base64'),
    sha: slugChanged ? undefined : fileData.sha,
  });

  if (slugChanged) {
    await octokit.rest.repos.deleteFile({
      owner,
      repo,
      path: oldPath,
      branch,
      message: `Remove old path after renaming: ${params.oldTitle} → ${params.newTitle}`,
      sha: fileData.sha,
    });
  }

  return { href: `/notes/${params.domain}/${newSlug}` };
}
