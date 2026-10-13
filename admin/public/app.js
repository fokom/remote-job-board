(function () {
  'use strict';

  // ---------- tiny helpers ----------
  const view = document.getElementById('view');
  const tabsEl = document.getElementById('tabs');
  const noticeEl = document.getElementById('notice');
  const btnFetch = document.getElementById('btn-fetch');
  const btnDeploy = document.getElementById('btn-deploy');

  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    const after = {};
    for (const [k, v] of Object.entries(props || {})) {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'value' || k === 'checked' || k === 'disabled') after[k] = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    for (const [k, v] of Object.entries(after)) e[k] = v;
    return e;
  }

  function safeUrl(u) {
    try {
      const url = new URL(u);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '#';
    } catch {
      return '#';
    }
  }

  function hostOf(u) {
    try {
      return new URL(u).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  function fmtDate(iso) {
    if (!iso) return 'date unknown';
    const d = new Date(iso);
    return isNaN(d) ? 'date unknown' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async function api(path, body) {
    const opts =
      body === undefined
        ? {}
        : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin': '1' }, body: JSON.stringify(body) };
    const res = await fetch(path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Request failed (' + res.status + ')');
      err.data = data;
      throw err;
    }
    return data;
  }

  function notice(kind, text, log) {
    noticeEl.className = 'notice ' + (kind || '');
    noticeEl.replaceChildren(
      h('div', null, h('strong', { text }), log ? h('pre', { text: log }) : null),
      h('button', { title: 'Dismiss', onclick: () => noticeEl.classList.add('hidden'), text: '×' })
    );
  }

  // ---------- state ----------
  let state = { pending: [], pool: [], published: [], categories: [], sites: [], rejectedCount: 0 };
  let tab = 'review';
  const selected = { review: new Set(), pool: new Set(), live: new Set() };
  const filters = {
    review: { q: '', source: '', remote: '', limit: 50 },
    pool: { q: '', source: '', remote: '', limit: 50 },
    live: { q: '', source: '', remote: '', limit: 50 },
  };
  let siteDraft = [];

  const listFor = (t) => ({ review: state.pending, pool: state.pool, live: state.published }[t] || []);
  const catName = (slug) => (state.categories.find((c) => c.slug === slug) || { name: slug }).name;

  async function reload() {
    state = await api('/api/state');
    siteDraft = state.sites.map((s) => ({ ...s }));
    for (const t of ['review', 'pool', 'live']) {
      const ids = new Set(listFor(t).map((j) => j.id));
      for (const id of [...selected[t]]) if (!ids.has(id)) selected[t].delete(id);
    }
    render();
  }

  // ---------- rendering ----------
  function renderTabs() {
    const defs = [
      ['review', 'Review', state.pending.length],
      ['pool', 'Pool', state.pool.length],
      ['live', 'Live', state.published.length],
      ['sources', 'Sources', null],
    ];
    tabsEl.replaceChildren(
      ...defs.map(([key, label, count]) =>
        h(
          'button',
          { class: 'tab' + (tab === key ? ' active' : ''), onclick: () => { tab = key; render(); window.scrollTo(0, 0); } },
          label,
          count === null ? null : h('span', { class: 'count', text: String(count) })
        )
      )
    );
  }

  function remoteBadge(job) {
    if (job.remote_status === 'worldwide') return h('span', { class: 'badge worldwide', text: 'Remote · Worldwide' });
    if (job.remote_status === 'restricted') {
      return h('span', { class: 'badge restricted', text: 'Remote · ' + (job.location || 'region limited') });
    }
    return h('span', { class: 'badge unclear', text: 'Check remote status' });
  }

  function matches(job, f) {
    if (f.source && job.source !== f.source) return false;
    if (f.remote && job.remote_status !== f.remote) return false;
    if (f.q) {
      const hay = [job.title, job.company, job.location, job.source, job.salary].join(' ').toLowerCase();
      if (!f.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  }

  function chipRow(job, onChange) {
    return h(
      'div',
      { class: 'chips' },
      state.categories.map((c) => {
        const btn = h('button', {
          class: 'chip' + (job.categories.includes(c.slug) ? ' on' : ''),
          type: 'button',
          text: c.name,
          onclick: () => {
            const had = job.categories.includes(c.slug);
            const next = had ? job.categories.filter((s) => s !== c.slug) : [...job.categories, c.slug];
            Promise.resolve(onChange(next)).then((accepted) => {
              if (accepted === false) return;
              job.categories = next;
              btn.classList.toggle('on', !had);
            });
          },
        });
        return btn;
      })
    );
  }

  function detailsEditor(job, t) {
    const inputs = {
      title: h('input', { value: job.title }),
      company: h('input', { value: job.company }),
      salary: h('input', { value: job.salary || '', placeholder: 'e.g. $60,000 - $80,000 / year' }),
      location: h('input', { value: job.location || '' }),
      remote_status: h(
        'select',
        { value: job.remote_status },
        h('option', { value: 'worldwide', text: 'Remote · Worldwide' }),
        h('option', { value: 'restricted', text: 'Remote · Region limited' }),
        h('option', { value: 'unclear', text: 'Unclear' })
      ),
    };
    const field = (label, input) => h('div', { class: 'field' }, h('label', { text: label }), input);
    return h(
      'div',
      null,
      h(
        'div',
        { class: 'edit-grid' },
        field('Title', inputs.title),
        field('Company', inputs.company),
        field('Salary', inputs.salary),
        field('Location', inputs.location),
        field('Remote status', inputs.remote_status)
      ),
      h('div', { class: 'job-actions' },
        h('button', {
          class: 'btn small primary',
          text: 'Save details',
          onclick: async () => {
            try {
              await api('/api/update', {
                id: job.id,
                categories: job.categories,
                title: inputs.title.value,
                company: inputs.company.value,
                salary: inputs.salary.value,
                location: inputs.location.value,
                remote_status: inputs.remote_status.value,
              });
              notice('ok', 'Saved.');
              await reload();
            } catch (e) {
              notice('error', e.message);
            }
          },
        })
      )
    );
  }

  function jobCard(job, t) {
    const checkbox = h('input', {
      type: 'checkbox',
      checked: selected[t].has(job.id),
      onchange: (e) => {
        e.target.checked ? selected[t].add(job.id) : selected[t].delete(job.id);
        card.classList.toggle('selected', e.target.checked);
        updateBulk();
      },
    });

    const metaDate = t === 'live' ? 'Published ' + fmtDate(job.published_at) : 'Posted ' + fmtDate(job.posted_at);
    const detailsHolder = h('div');

    const actions = h('div', { class: 'job-actions' });
    if (t === 'review') {
      actions.append(
        h('button', { class: 'btn small primary', text: 'Add to pool', onclick: () => addToPool([job]) }),
        h('button', { class: 'btn small danger', text: 'Reject', onclick: () => rejectJobs([job.id]) })
      );
    } else if (t === 'pool') {
      actions.append(
        h('button', { class: 'btn small primary', text: 'Publish', onclick: () => doAction('/api/publish', { ids: [job.id] }, 'Published.') }),
        h('button', { class: 'btn small', text: 'Edit details', onclick: () => toggleDetails() }),
        h('button', { class: 'btn small', text: 'Back to review', onclick: () => doAction('/api/pool/remove', { ids: [job.id] }, 'Moved back to review.') })
      );
    } else {
      actions.append(
        h('button', { class: 'btn small', text: 'Edit details', onclick: () => toggleDetails() }),
        h('button', { class: 'btn small danger', text: 'Unpublish', onclick: () => doAction('/api/unpublish', { ids: [job.id] }, 'Moved back to pool.') })
      );
    }

    function toggleDetails() {
      if (detailsHolder.firstChild) detailsHolder.replaceChildren();
      else detailsHolder.append(detailsEditor(job, t));
    }

    const onChipChange =
      t === 'review'
        ? () => true
        : async (next) => {
            if (!next.length) {
              notice('error', 'A job needs at least one category.');
              return false;
            }
            try {
              await api('/api/update', { id: job.id, categories: next });
              return true;
            } catch (e) {
              notice('error', e.message);
              return false;
            }
          };

    const card = h(
      'div',
      { class: 'job' + (selected[t].has(job.id) ? ' selected' : '') },
      checkbox,
      h(
        'div',
        null,
        h(
          'div',
          null,
          h('a', { class: 'job-title', href: safeUrl(job.link), target: '_blank', rel: 'noopener noreferrer', text: job.title + ' ↗' }),
          ' ',
          h('span', { class: 'host', text: hostOf(job.link) })
        ),
        h(
          'div',
          { class: 'job-meta' },
          h('span', null, h('strong', { text: job.company })),
          remoteBadge(job),
          h('span', { text: job.salary ? job.salary : 'Salary not listed' }),
          h('span', { text: job.source }),
          job.job_type ? h('span', { text: job.job_type }) : null,
          h('span', { text: metaDate })
        ),
        job.description ? h('p', { class: 'job-desc', text: job.description }) : null,
        chipRow(job, onChipChange),
        actions,
        detailsHolder
      )
    );
    return card;
  }

  // bulk bar is rebuilt in place so counts stay current
  let bulkEl = null;
  function updateBulk() {
    if (!bulkEl) return;
    const n = selected[tab] ? selected[tab].size : 0;
    const label = bulkEl.querySelector('.muted');
    if (label) label.textContent = n + ' selected';
    bulkEl.querySelectorAll('[data-needs-selection]').forEach((b) => (b.disabled = n === 0));
  }

  function renderJobTab(t) {
    const f = filters[t];
    const all = listFor(t);
    const sources = [...new Set(all.map((j) => j.source))].sort();
    const shown = all.filter((j) => matches(j, f));
    const visible = shown.slice(0, f.limit);

    const toolbar = h(
      'div',
      { class: 'toolbar' },
      h('input', {
        type: 'search',
        placeholder: 'Search title, company, location…',
        value: f.q,
        oninput: (e) => {
          f.q = e.target.value;
          f.limit = 50;
          rerenderList();
        },
      }),
      h(
        'select',
        { value: f.source, onchange: (e) => { f.source = e.target.value; f.limit = 50; rerenderList(); } },
        h('option', { value: '', text: 'All sources' }),
        sources.map((s) => h('option', { value: s, text: s }))
      ),
      h(
        'select',
        { value: f.remote, onchange: (e) => { f.remote = e.target.value; f.limit = 50; rerenderList(); } },
        h('option', { value: '', text: 'Any remote status' }),
        h('option', { value: 'worldwide', text: 'Worldwide' }),
        h('option', { value: 'restricted', text: 'Region limited' }),
        h('option', { value: 'unclear', text: 'Unclear' })
      )
    );

    const bulk = h('div', { class: 'bulk' }, h('span', { class: 'muted', text: '0 selected' }));
    bulkEl = bulk;

    const selectShown = h('button', {
      class: 'btn small',
      text: 'Select shown',
      onclick: () => {
        shownNow().forEach((j) => selected[t].add(j.id));
        rerenderList();
      },
    });
    const clearSel = h('button', {
      class: 'btn small',
      text: 'Clear',
      onclick: () => {
        selected[t].clear();
        rerenderList();
      },
    });
    bulk.append(selectShown, clearSel);

    if (t === 'review') {
      const tagSelect = h(
        'select',
        null,
        h('option', { value: '', text: 'Tag selected as…' }),
        state.categories.map((c) => h('option', { value: c.slug, text: c.name }))
      );
      bulk.append(
        tagSelect,
        h('button', {
          class: 'btn small',
          text: 'Add tag',
          'data-needs-selection': true,
          onclick: () => {
            if (!tagSelect.value) return;
            state.pending.forEach((j) => {
              if (selected.review.has(j.id) && !j.categories.includes(tagSelect.value)) j.categories.push(tagSelect.value);
            });
            rerenderList();
          },
        }),
        h('button', {
          class: 'btn small primary',
          text: 'Add selected to pool',
          'data-needs-selection': true,
          onclick: () => addToPool(state.pending.filter((j) => selected.review.has(j.id))),
        }),
        h('button', {
          class: 'btn small danger',
          text: 'Reject selected',
          'data-needs-selection': true,
          onclick: () => rejectJobs([...selected.review]),
        })
      );
    } else if (t === 'pool') {
      bulk.append(
        h('button', {
          class: 'btn small primary',
          text: 'Publish selected',
          'data-needs-selection': true,
          onclick: () => doAction('/api/publish', { ids: [...selected.pool] }, 'Published.'),
        }),
        h('button', {
          class: 'btn small primary',
          text: 'Publish all (' + state.pool.length + ')',
          disabled: state.pool.length === 0,
          onclick: () => confirm('Publish all ' + state.pool.length + ' jobs in the pool?') && doAction('/api/publish', { all: true }, 'Published.'),
        }),
        h('button', {
          class: 'btn small',
          text: 'Back to review',
          'data-needs-selection': true,
          onclick: () => doAction('/api/pool/remove', { ids: [...selected.pool] }, 'Moved back to review.'),
        })
      );
    } else {
      bulk.append(
        h('button', {
          class: 'btn small danger',
          text: 'Unpublish selected',
          'data-needs-selection': true,
          onclick: () => doAction('/api/unpublish', { ids: [...selected.live] }, 'Moved back to pool.'),
        })
      );
    }

    const listEl = h('div');
    const moreEl = h('div');

    function shownNow() {
      return listFor(t).filter((j) => matches(j, f)).slice(0, f.limit);
    }

    function rerenderList() {
      const matchesAll = listFor(t).filter((j) => matches(j, f));
      const vis = matchesAll.slice(0, f.limit);
      listEl.replaceChildren(
        ...(vis.length
          ? vis.map((j) => jobCard(j, t))
          : [h('div', { class: 'empty', text: emptyText(t, listFor(t).length > 0) })])
      );
      moreEl.replaceChildren(
        ...(matchesAll.length > vis.length
          ? [
              h('button', {
                class: 'btn',
                text: 'Show more (' + (matchesAll.length - vis.length) + ' left)',
                onclick: () => { f.limit += 50; rerenderList(); },
              }),
            ]
          : [])
      );
      updateBulk();
    }

    view.replaceChildren(toolbar, bulk, listEl, moreEl);
    rerenderList();
  }

  function emptyText(t, filtered) {
    if (filtered) return 'No jobs match these filters.';
    if (t === 'review') return 'Nothing to review. Click “Fetch new jobs” to pull the latest listings.';
    if (t === 'pool') return 'The pool is empty. Add jobs from the Review tab, then publish them from here.';
    return 'Nothing is live yet. Publish jobs from the Pool tab, then click “Deploy to site”.';
  }

  // ---------- sources tab ----------
  function renderSources() {
    const builtIn = [
      ['Remotive', 'https://remotive.com'],
      ['Remote OK', 'https://remoteok.com'],
      ['We Work Remotely', 'https://weworkremotely.com'],
      ['Arbeitnow', 'https://www.arbeitnow.com'],
      ['Jobicy', 'https://jobicy.com'],
    ];

    const popular = h(
      'div',
      { class: 'panel' },
      h('h2', { text: 'Popular sources (built in)' }),
      h('p', { text: 'Fetched on every run. Each job links back to its original listing, and the public site credits the source.' }),
      h('div', { class: 'source-list' }, builtIn.map(([n, u]) => h('a', { href: u, target: '_blank', rel: 'noopener', text: n + ' ↗' })))
    );

    const rows = h('div');
    function renderRows() {
      rows.replaceChildren(
        h('div', { class: 'site-head', text: 'Name  ·  Careers page or job board URL  ·  Type' }),
        ...siteDraft.map((s, i) =>
          h(
            'div',
            { class: 'site-row' },
            h('input', { placeholder: 'Company name', value: s.name || '', oninput: (e) => (s.name = e.target.value) }),
            h('input', { placeholder: 'https://boards.greenhouse.io/company', value: s.url || '', oninput: (e) => (s.url = e.target.value) }),
            h(
              'select',
              { value: s.type || 'auto', onchange: (e) => (s.type = e.target.value) },
              ['auto', 'greenhouse', 'lever', 'ashby', 'workable', 'rss', 'html'].map((t) => h('option', { value: t, text: t }))
            ),
            h('label', null, h('input', { type: 'checkbox', checked: !!s.all_remote, onchange: (e) => (s.all_remote = e.target.checked) }), 'All jobs remote'),
            h('label', null, h('input', { type: 'checkbox', checked: s.enabled !== false, onchange: (e) => (s.enabled = e.target.checked) }), 'On'),
            h('button', { class: 'btn small danger', text: 'Remove', onclick: () => { siteDraft.splice(i, 1); renderRows(); } })
          )
        )
      );
    }
    renderRows();

    const saveSites = async () => {
      const res = await api('/api/sites', { sites: siteDraft });
      state.sites = res.sites;
      siteDraft = res.sites.map((s) => ({ ...s }));
      return res.sites.length;
    };

    const sitesPanel = h(
      'div',
      { class: 'panel' },
      h('h2', { text: 'Your company sites' }),
      h('p', {
        text:
          'Add career pages you want checked. Greenhouse, Lever, Ashby and Workable boards work best (type “auto” detects them). Other pages are read through their job markup or links. Tick “All jobs remote” for fully remote companies; otherwise only jobs that mention remote are kept.',
      }),
      rows,
      h(
        'div',
        { class: 'job-actions' },
        h('button', { class: 'btn small', text: '+ Add site', onclick: () => { siteDraft.push({ name: '', url: '', type: 'auto', all_remote: false, enabled: true }); renderRows(); } }),
        h('button', {
          class: 'btn small primary',
          text: 'Save sites',
          onclick: async () => {
            try {
              const n = await saveSites();
              notice('ok', 'Saved ' + n + ' site(s).');
              renderRows();
            } catch (e) { notice('error', e.message); }
          },
        }),
        h('button', {
          class: 'btn small',
          text: 'Save & fetch these sites now',
          onclick: async (e) => {
            e.target.disabled = true;
            try {
              await saveSites();
              const res = await api('/api/fetch', { skipSources: true });
              notice(res.ok ? 'ok' : 'error', res.ok ? 'Company sites checked.' : 'Fetch failed.', res.log);
              await reload();
            } catch (err) { notice('error', err.message); }
            e.target.disabled = false;
          },
        })
      )
    );

    const nameInput = h('input', { placeholder: 'New category name', maxlength: '40' });
    const catPanel = h(
      'div',
      { class: 'panel' },
      h('h2', { text: 'Categories' }),
      h('p', { text: 'Shown as tags on every job and as filters on the public site. Add new ones any time.' }),
      h('div', { class: 'chips' }, state.categories.map((c) => h('span', { class: 'chip on', text: c.name }))),
      h(
        'div',
        { class: 'inline-form' },
        nameInput,
        h('button', {
          class: 'btn primary',
          text: 'Add category',
          onclick: async () => {
            try {
              await api('/api/categories', { name: nameInput.value });
              notice('ok', 'Category added.');
              await reload();
            } catch (e) { notice('error', e.message); }
          },
        })
      )
    );

    bulkEl = null;
    view.replaceChildren(popular, sitesPanel, catPanel);
  }

  function render() {
    renderTabs();
    if (tab === 'sources') renderSources();
    else renderJobTab(tab);
  }

  // ---------- actions ----------
  async function doAction(path, body, okText) {
    try {
      const res = await api(path, body);
      notice('ok', (res.moved != null ? res.moved + ' job(s). ' : '') + okText);
      selected[tab].clear();
      await reload();
    } catch (e) {
      notice('error', e.message);
    }
  }

  async function addToPool(jobs) {
    if (!jobs.length) return;
    const lacking = jobs.filter((j) => !j.categories.length);
    if (lacking.length) {
      notice('error', lacking.length + ' job(s) have no category yet. Pick at least one tag for each, then add them.');
      return;
    }
    try {
      const res = await api('/api/pool/add', { items: jobs.map((j) => ({ id: j.id, categories: j.categories })) });
      notice('ok', res.moved + ' job(s) added to the pool.');
      selected.review.clear();
      await reload();
    } catch (e) {
      notice('error', e.message);
    }
  }

  async function rejectJobs(ids) {
    if (!ids.length) return;
    if (ids.length > 1 && !confirm('Reject ' + ids.length + ' jobs? They will not be offered again.')) return;
    await doAction('/api/reject', { ids }, 'Rejected.');
  }

  btnFetch.addEventListener('click', async () => {
    btnFetch.disabled = true;
    const old = btnFetch.textContent;
    btnFetch.textContent = 'Fetching…';
    try {
      const res = await api('/api/fetch', {});
      notice(res.ok ? 'ok' : 'error', res.ok ? 'Fetch finished.' : 'Fetch failed.', res.log);
      tab = 'review';
      await reload();
    } catch (e) {
      notice('error', e.message);
    }
    btnFetch.textContent = old;
    btnFetch.disabled = false;
  });

  btnDeploy.addEventListener('click', async () => {
    if (!confirm('Commit the data folder and push it so your site rebuilds with the live jobs?')) return;
    btnDeploy.disabled = true;
    try {
      const res = await api('/api/deploy', {});
      notice(res.ok ? 'ok' : 'error', res.ok ? 'Deploy step finished.' : 'Deploy did not complete.', res.log);
    } catch (e) {
      notice('error', e.message);
    }
    btnDeploy.disabled = false;
  });

  reload().catch((e) => notice('error', 'Could not load data: ' + e.message));
})();
