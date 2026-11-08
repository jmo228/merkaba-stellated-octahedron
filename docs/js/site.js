// Shared header, footer and small helpers for every page.

const PAGES = [
  ['index.html', 'Home'],
  ['visualizer.html', 'Visualizer'],
  ['specs.html', 'Specs'],
  ['bom.html', 'Bill of Materials'],
  ['wiring.html', 'Wiring & DMX'],
  ['collaborate.html', 'Collaborate'],
];

const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke-width="1.8" stroke-linejoin="round">
<path d="M16 3 L28 23 H4 Z" stroke="#ff9a3c"/><path d="M16 29 L4 9 H28 Z" stroke="#3cc8ff"/></g></svg>`;

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// owner/repo: worked out from the GitHub Pages address when hosted there,
// otherwise taken from project.repo in data/merkaba.json.
export function repoSlug(data) {
  const host = location.hostname;
  if (host.endsWith('.github.io')) {
    const owner = host.split('.')[0];
    const repo = location.pathname.split('/').filter(Boolean)[0];
    if (repo) return `${owner}/${repo}`;
  }
  return data?.project?.repo || 'OWNER/merkaba-stellated-octahedron';
}
export const repoUrl = data => `https://github.com/${repoSlug(data)}`;

export function renderChrome() {
  const here = location.pathname.split('/').pop() || 'index.html';
  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `<div class="inner">
    <a class="brand" href="index.html">${LOGO}<span>Merkaba</span></a>
    <nav class="nav" aria-label="Main">${PAGES.map(([href, label]) =>
      `<a href="${href}"${href === here ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
  </div>`;
  document.body.prepend(header);
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `<div class="inner">
    <span>Merkaba stellated-octahedron LED sculpture — prototype site</span>
    <span>Numbers come from <code>docs/data/merkaba.json</code></span>
    <a id="footer-repo" href="#">GitHub repo</a>
  </div>`;
  document.body.append(footer);
}

export function setRepoLinks(data) {
  const url = repoUrl(data);
  document.querySelectorAll('#footer-repo, [data-repo-link]').forEach(a => {
    const path = a.getAttribute('data-repo-link') || '';
    a.href = url + path;
  });
}

export function showError(target, err) {
  const local = location.protocol === 'file:';
  target.innerHTML = `<p class="error">Could not load the project data: ${esc(err.message)}</p>` +
    (local ? `<p class="muted">Opened straight from disk? Browsers block data loading from <code>file://</code>. Run <code>python -m http.server 8000</code> inside the <code>docs</code> folder and open <code>http://localhost:8000</code>.</p>` : '');
}

renderChrome();
