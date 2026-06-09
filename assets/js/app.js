// Gallery rendering — data-driven from data/works.json
(async function () {
  const data = await fetch('data/works.json', { cache: 'no-cache' }).then(r => r.json());
  const uploaderById = Object.fromEntries(data.uploaders.map(u => [u.id, u]));
  const initials = (name) => (name || '?').trim().slice(0, 1);

  // Hero
  const courseEl = document.getElementById('hero-course');
  if (data.site.course) courseEl.textContent = data.site.course;
  else courseEl.style.display = 'none';
  document.getElementById('hero-sub').textContent = data.site.subtitle || '';
  document.getElementById('hero-title').textContent = data.site.title || '';
  document.getElementById('hero-intro').textContent = data.site.intro || '';
  document.getElementById('year').textContent = '2026';

  // Works grid
  const grid = document.getElementById('works-grid');
  document.getElementById('works-count').textContent = `共 ${data.works.length} 件`;
  grid.innerHTML = data.works.map(w => {
    const up = uploaderById[w.uploaderId] || {};
    const thumbStyle = w.thumbnail ? `style="background-image:url('${w.thumbnail}')"` : '';
    const ph = w.thumbnail ? '' : `<div class="ph"><span class="ph-seal">閩</span><span class="ph-title">${w.title}</span></div>`;
    const tags = (w.tags || []).slice(0, 3).map(t => `<span class="tag">${t}</span>`).join('');
    return `
      <a class="card" href="work.html?id=${encodeURIComponent(w.id)}">
        <div class="thumb" ${thumbStyle}>
          ${ph}
          <span class="badge3d">3D 模型</span>
        </div>
        <div class="body">
          <h3>${w.title}</h3>
          <div class="meta">${[w.location, w.date].filter(Boolean).join(' · ')}</div>
          <div class="tags">${tags}</div>
          <div class="tags" style="margin-top:12px">
            <span class="meta">展示單位：${up.name || '—'}</span>
          </div>
        </div>
      </a>`;
  }).join('');

  // Uploaders grid
  const ug = document.getElementById('uploaders-grid');
  ug.innerHTML = data.uploaders.map(u => {
    const n = data.works.filter(w => w.uploaderId === u.id).length;
    const students = (u.students || []).map(s => `<span class="tag">${s}</span>`).join('');
    return `
      <div class="card"><div class="body">
        <div class="uploader">
          <div class="ava">${initials(u.name)}</div>
          <div class="who"><b>${u.name}</b><span>${u.title || ''}</span></div>
        </div>
        ${u.bio ? `<p class="meta" style="margin:14px 0 0">${u.bio}</p>` : ''}
        ${students ? `<p class="meta" style="margin:14px 0 6px">學生</p><div class="tags">${students}</div>` : ''}
        <div class="tags" style="margin-top:12px"><span class="tag">${n} 件作品</span></div>
      </div></div>`;
  }).join('');
})();
