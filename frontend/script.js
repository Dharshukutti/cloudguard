/*
  CloudGuard Frontend Controller
  - Client-side data model built from inline DOM if local API unavailable
  - Implements: login/session, notifications, mailbox, filtering, modals,
    pagination, policy management, compliance/audit/github/settings/api pages,
    and persistence via localStorage.
*/

(() => {
  // Utilities
  const qs = (s, el = document) => el.querySelector(s);
  const qsa = (s, el = document) => Array.from(el.querySelectorAll(s));
  const uid = (n = 6) => Math.random().toString(36).slice(2, 2 + n);

  // LocalStorage keys
  const LS = {
    session: 'cloudguard.session',
    users: 'cloudguard.users',
    policies: 'cloudguard.policies',
    settings: 'cloudguard.settings',
    apiKeys: 'cloudguard.apikeys',
    audit: 'cloudguard.auditlogs'
  };

  // Modal helper
  function createModal(contentHtml, opts = {}){
    const root = document.getElementById('modalRoot') || document.body;
    const overlay = document.createElement('div');
    overlay.className = 'cg-modal-overlay';
    overlay.style = `position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:center;padding:60px 16px;z-index:2000;`;

    const box = document.createElement('div');
    box.className = 'cg-modal-box';
    box.style = 'background:var(--bg-glass);backdrop-filter:blur(12px);border:1px solid var(--border-glass);padding:18px;border-radius:12px;max-width:760px;width:100%;color:var(--text-primary);box-shadow:var(--shadow-card);';

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.style = 'position:absolute;right:12px;top:12px;background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;';
    closeBtn.onclick = () => { document.body.removeChild(overlay); };

    box.innerHTML = contentHtml;
    box.style.position = 'relative';
    box.prepend(closeBtn);
    overlay.appendChild(box);

    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) document.body.removeChild(overlay);
    });

    document.addEventListener('keydown', function esc(e){ if (e.key === 'Escape' && document.body.contains(overlay)) { document.body.removeChild(overlay); document.removeEventListener('keydown', esc); } });

    document.body.appendChild(overlay);
    return { overlay, box };
  }

  // Read users from DOM table if localStorage empty
  function parseUsersFromDOM(){
    const rows = qsa('#userTable tr');
    const users = rows.map((tr, idx) => {
      try {
        const name = qs('.user-name', tr)?.textContent?.trim() || `user${idx}`;
        const email = qs('.user-email', tr)?.textContent?.trim() || '';
        const riskBadge = qs('.risk-badge', tr)?.textContent?.trim() || 'Low';
        const score = qs('.risk-score', tr)?.textContent?.trim() || '0';
        const policies = qsa('.policy-tag', tr).map(s => s.textContent.trim());
        const lastActivity = tr.cells[5]?.textContent?.trim() || '';
        return { id: uid(8), username: name, email, risk: riskBadge.toLowerCase(), score: parseFloat(score) || 0, policies, lastActivity, blocked:false };
      } catch(e){ return null; }
    }).filter(Boolean);
    return users;
  }

  function saveUsers(users){ localStorage.setItem(LS.users, JSON.stringify(users)); }
  function loadUsers(){
    const raw = localStorage.getItem(LS.users);
    if (raw) return JSON.parse(raw);
    const parsed = parseUsersFromDOM(); saveUsers(parsed); return parsed;
  }

  function savePolicies(policies){ localStorage.setItem(LS.policies, JSON.stringify(policies)); }
  function loadPolicies(){
    const raw = localStorage.getItem(LS.policies);
    if (raw) return JSON.parse(raw);
    // Build from existing DOM policy cards
    const cards = qsa('.policy-cards-grid .policy-card-glass');
    const policies = cards.map(card => {
      const name = qs('.policy-card-name', card)?.textContent?.trim() || 'Unnamed';
      const arn = qs('.policy-card-arn', card)?.textContent?.trim() || '';
      const risk = qs('.policy-card-risk .risk-badge', card)?.textContent?.trim() || '';
      const usersCount = parseInt(qs('.pc-stat .pc-stat-value', card)?.textContent) || 0;
      return { id: uid(8), name, arn, risk, usersCount, cardHtml: card.outerHTML };
    });
    savePolicies(policies);
    return policies;
  }

  // Update KPI counts
  function updateKPIs(users){
    const total = users.length;
    const critical = users.filter(u=>u.risk==='critical').length;
    const high = users.filter(u=>u.risk==='high').length;
    const medium = users.filter(u=>u.risk==='medium').length;
    const low = users.filter(u=>u.risk==='low').length;
    const el = document.getElementById('totalUsers'); if (el) el.innerText = total;
    // keep other KPI cards as-is but update table info
    const info = document.getElementById('usersTableInfo'); if (info) info.innerText = `Showing 1-${Math.min(usersPerPage, total)} of ${total} users`;
    // render charts if present
    if (window.Chart && qs('#riskChart')){
      const ctx = qs('#riskChart').getContext('2d');
      if (window._cgRiskChart) window._cgRiskChart.destroy();
      window._cgRiskChart = new Chart(ctx, { type:'pie', data:{ labels:['Critical','High','Medium','Low'], datasets:[{ data:[critical,high,medium,low], backgroundColor:[getComputedStyle(document.documentElement).getPropertyValue('--danger')||'#ef4444', getComputedStyle(document.documentElement).getPropertyValue('--warning')||'#f59e0b', getComputedStyle(document.documentElement).getPropertyValue('--info')||'#0ea5e9', getComputedStyle(document.documentElement).getPropertyValue('--success')||'#10b981'] }] } });
    }
  }

  // Notifications
  const notifications = [
    {level:'critical', title:'Critical: MFA disabled for john.doe', time:'2 minutes ago'},
    {level:'high', title:'High: Access key older than 90 days', time:'15 minutes ago'},
    {level:'medium', title:'Medium: Policy review required', time:'1 hour ago'}
  ];

  function renderNotifPanel(){
    const panel = document.getElementById('notifPanel'); if (!panel) return;
    panel.innerHTML = '';
    const header = document.createElement('div'); header.style = 'padding:12px 14px;border-bottom:1px solid var(--border-glass);font-weight:700'; header.textContent = 'Notifications'; panel.appendChild(header);
    notifications.slice(0,6).forEach(n => {
      const item = document.createElement('div'); item.style = 'padding:12px;display:flex;gap:10px;border-bottom:1px solid rgba(255,255,255,0.02);';
      const icon = document.createElement('div'); icon.style = 'width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;';
      if (n.level==='critical') icon.innerHTML = '<i class="fas fa-radiation" style="color:var(--danger)"></i>';
      else if (n.level==='high') icon.innerHTML = '<i class="fas fa-exclamation-circle" style="color:var(--warning)"></i>';
      else icon.innerHTML = '<i class="fas fa-info-circle" style="color:var(--info)"></i>';
      const body = document.createElement('div'); body.innerHTML = `<div style="font-weight:700;color:var(--text-primary);">${n.title}</div><div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${n.time}</div>`;
      item.appendChild(icon); item.appendChild(body); panel.appendChild(item);
    });
    const footer = document.createElement('div'); footer.style='padding:10px;text-align:center;'; footer.innerHTML = '<button class="btn btn-secondary" style="width:90%;">View All Alerts</button>';
    panel.appendChild(footer);
  }

  // Mailbox
  const mailboxes = [
    {from:'Security Team', subject:'Weekly Security Summary'},
    {from:'CloudWatch Alerts', subject:'EC2 high CPU detected'},
    {from:'IAM Recommendations', subject:'Review permissions for robert.jones'}
  ];
  function renderMailPanel(){
    const panel = document.getElementById('mailPanel'); if (!panel) return;
    panel.innerHTML = '';
    const header = document.createElement('div'); header.style='padding:12px 14px;border-bottom:1px solid var(--border-glass);font-weight:700'; header.textContent = 'Messages'; panel.appendChild(header);
    mailboxes.forEach(m => {
      const item = document.createElement('div'); item.style='padding:10px;border-bottom:1px solid rgba(255,255,255,0.02);'; item.innerHTML = `<div style="font-weight:700;color:var(--text-primary);">${m.from}</div><div style="font-size:12px;color:var(--text-muted);">${m.subject}</div>`; panel.appendChild(item);
    });
    const footer = document.createElement('div'); footer.style='padding:10px;text-align:center;'; footer.innerHTML = '<button class="btn btn-primary" style="width:90%;">Open Mailbox</button>';
    panel.appendChild(footer);
  }

  // Users management + filtering + pagination
  let users = loadUsers();
  let policies = loadPolicies();
  const usersPerPage = 2;
  let currentPage = 1;
  let activeFilter = 'all';

  function renderUsers(){
    const tbody = document.getElementById('userTable'); if (!tbody) return;
    // apply filter
    const filtered = users.filter(u=> activeFilter==='all' ? true : u.risk===activeFilter);
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / usersPerPage));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage-1)*usersPerPage;
    const pageRows = filtered.slice(start, start+usersPerPage);

    tbody.innerHTML = '';
    pageRows.forEach(u => {
      const tr = document.createElement('tr');
      const badges = u.policies.map(p=>`<span class="policy-tag">${p}</span>`).join(' ');
      const blockedBadge = u.blocked ? '<span class="policy-tag" style="background:rgba(239,68,68,0.12);color:var(--danger);border-color:rgba(239,68,68,0.2);">Blocked</span>' : '';
      tr.innerHTML = `
        <td>
            <div class="user-cell">
                <div class="user-avatar-sm">${u.username.split('.').map(s=>s[0]).join('').toUpperCase().slice(0,2)}</div>
                <div class="user-details">
                    <div class="user-name">${u.username} ${blockedBadge}</div>
                    <div class="user-email">${u.email}</div>
                </div>
            </div>
        </td>
        <td><span class="risk-badge risk-${u.risk}">${capitalize(u.risk)}</span></td>
        <td>
            <div class="risk-score" style="color:${riskColor(u.risk)}">${u.score}</div>
            <div class="score-bar"><div class="score-fill" style="width:${Math.min(100,Math.round(u.score))}%;background:${riskColor(u.risk)}"></div></div>
        </td>
        <td><div class="policy-tags">${badges}</div></td>
        <td style="max-width:250px;font-size:12px;">${u.reason || ''}</td>
        <td>${u.lastActivity || ''}</td>
        <td>
            <div class="action-btns">
                <button class="action-btn" data-action="view" data-id="${u.id}"><i class="fas fa-eye"></i></button>
                <button class="action-btn" data-action="edit" data-id="${u.id}"><i class="fas fa-edit"></i></button>
                <button class="action-btn" data-action="block" data-id="${u.id}"><i class="fas fa-ban"></i></button>
            </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // update pagination UI
    const info = document.getElementById('usersTableInfo'); if (info) info.innerText = `Showing ${start+1}-${Math.min(start+pageRows.length, total)} of ${total} users`;
    renderPagination(Math.max(1, Math.ceil(total / usersPerPage)));
  }

  function renderPagination(totalPages){
    const container = qs('.table-pagination'); if (!container) return;
    container.innerHTML = '';
    const prev = document.createElement('button'); prev.className='page-btn'; prev.innerHTML='<i class="fas fa-chevron-left"></i>'; prev.disabled = currentPage===1; prev.onclick = () => { currentPage--; renderUsers(); };
    container.appendChild(prev);
    for(let i=1;i<=Math.min(5,totalPages);i++){
      const btn = document.createElement('button'); btn.className='page-btn'; if (i===currentPage) btn.classList.add('active'); btn.textContent=i; btn.onclick = ()=>{ currentPage=i; renderUsers(); };
      container.appendChild(btn);
    }
    if (totalPages>5){ const dots = document.createElement('button'); dots.className='page-btn'; dots.textContent='...'; container.appendChild(dots); const last = document.createElement('button'); last.className='page-btn'; last.textContent=totalPages; last.onclick = ()=>{ currentPage=totalPages; renderUsers(); }; container.appendChild(last); }
    const next = document.createElement('button'); next.className='page-btn'; next.innerHTML='<i class="fas fa-chevron-right"></i>'; next.disabled = currentPage===totalPages; next.onclick = ()=>{ currentPage++; renderUsers(); };
    container.appendChild(next);
  }

  function capitalize(s){ return s? s.charAt(0).toUpperCase()+s.slice(1):''; }
  function riskColor(r){ if (r==='critical') return 'var(--danger)'; if (r==='high') return 'var(--warning)'; if (r==='medium') return 'var(--info)'; return 'var(--success)'; }

  // User actions: view, edit, block
  function onUserAction(e){
    const btn = e.target.closest('[data-action]'); if (!btn) return;
    const action = btn.dataset.action; const id = btn.dataset.id;
    const user = users.find(u=>u.id===id);
    if (!user) return;
    if (action==='view'){
      openViewModal(user);
    } else if (action==='edit'){
      openEditModal(user);
    } else if (action==='block'){
      if (confirm(`Block user ${user.username}?`)){
        user.blocked = true; saveUsers(users); renderUsers();
      }
    }
  }

  function openViewModal(user){
    const html = `
      <h3 style="margin-bottom:8px;">User Details</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div><strong>Username</strong><div style="color:var(--text-muted)">${user.username}</div></div>
        <div><strong>Email</strong><div style="color:var(--text-muted)">${user.email}</div></div>
        <div><strong>Risk</strong><div style="color:${riskColor(user.risk)};font-weight:700">${capitalize(user.risk)}</div></div>
        <div><strong>Last Activity</strong><div style="color:var(--text-muted)">${user.lastActivity}</div></div>
        <div style="grid-column:1/3"><strong>Policies</strong><div class="policy-tags" style="margin-top:6px;">${user.policies.map(p=>`<span class="policy-tag">${p}</span>`).join(' ')}</div></div>
      </div>
    `;
    createModal(html);
  }

  function openEditModal(user){
    const html = `
      <h3 style="margin-bottom:8px;">Edit User</h3>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <label>Username<input id="cg_edit_username" value="${user.username}" style="width:100%;padding:8px;border-radius:6px;background:transparent;border:1px solid var(--border-glass);color:var(--text-primary);"></label>
        <label>Risk<select id="cg_edit_risk" style="width:100%;padding:8px;border-radius:6px;background:transparent;border:1px solid var(--border-glass);color:var(--text-primary);">
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select></label>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;"><button id="cg_save_user" class="btn btn-primary">Save</button><button id="cg_cancel_user" class="btn btn-secondary">Cancel</button></div>
      </div>
    `;
    const modal = createModal(html);
    qs('#cg_edit_risk', modal.box).value = user.risk;
    qs('#cg_save_user', modal.box).onclick = () => {
      user.username = qs('#cg_edit_username', modal.box).value.trim() || user.username;
      user.risk = qs('#cg_edit_risk', modal.box).value;
      saveUsers(users); document.body.removeChild(modal.overlay); renderUsers();
    };
    qs('#cg_cancel_user', modal.box).onclick = ()=> document.body.removeChild(modal.overlay);
  }

  // Policy actions: view, clone, detach, create
  function wirePolicyActions(){
    document.addEventListener('click', (e)=>{
      const view = e.target.closest('.policy-card-actions .btn-secondary');
      const clone = e.target.closest('.policy-card-actions .btn-sm .fa-copy, .policy-card-actions .btn-primary');
      // generic approach: find nearest policy card
      const cardBtn = e.target.closest('.policy-card-glass');
      if (!cardBtn) return;
      const card = cardBtn;
      const name = qs('.policy-card-name', card)?.textContent?.trim();
      if (e.target.closest('.policy-card-actions .btn-secondary')){
        const html = `<h3>Policy: ${name}</h3><pre style="white-space:pre-wrap;color:var(--text-muted);">${qs('.policy-card-arn', card)?.textContent||''}</pre>`;
        createModal(html);
      }
      if (e.target.closest('.policy-card-actions .btn-danger')){
        // detach: decrement users count in card
        const valEl = qs('.pc-stat .pc-stat-value', card);
        if (valEl){ const val = parseInt(valEl.textContent)||0; valEl.textContent = Math.max(0,val-1); }
      }
      if (e.target.closest('.policy-card-actions .btn-secondary .fa-copy') || e.target.closest('.policy-card-actions .btn-secondary[data-clone]') || e.target.closest('.policy-card-actions .btn-primary')){
        // clone flow handled by Create Policy below when Create Policy used
      }
    });
    // Create policy button
    const createBtn = qsa('.btn-primary').find(b=> b.textContent && b.textContent.includes('Create Policy'));
    if (createBtn) createBtn.addEventListener('click', ()=>{
      const html = `
        <h3>Create Policy</h3>
        <label>Policy Name<input id="cg_policy_name" style="width:100%;padding:8px;margin-top:6px;border-radius:6px;background:transparent;border:1px solid var(--border-glass);color:var(--text-primary);"></label>
        <label>Actions<textarea id="cg_policy_actions" style="width:100%;height:80px;padding:8px;margin-top:6px;border-radius:6px;background:transparent;border:1px solid var(--border-glass);color:var(--text-primary);"></textarea></label>
        <label>Resources<input id="cg_policy_resources" style="width:100%;padding:8px;margin-top:6px;border-radius:6px;background:transparent;border:1px solid var(--border-glass);color:var(--text-primary);"></label>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;"><button id="cg_create_policy" class="btn btn-primary">Create</button><button id="cg_cancel_policy" class="btn btn-secondary">Cancel</button></div>
      `;
      const modal = createModal(html);
      qs('#cg_create_policy', modal.box).onclick = ()=>{
        const name = qs('#cg_policy_name', modal.box).value.trim() || `Policy-${uid(4)}`;
        const actions = qs('#cg_policy_actions', modal.box).value.trim();
        const resources = qs('#cg_policy_resources', modal.box).value.trim();
        // create a simple card node appended to policy-cards-grid
        const grid = qs('.policy-cards-grid');
        if (grid){
          const newCard = document.createElement('div'); newCard.className='policy-card-glass success animate-in';
          newCard.innerHTML = `
            <div class="policy-card-header"><div class="policy-card-icon success"><i class="fas fa-shield-alt"></i></div><div class="policy-card-risk"><span class="risk-badge risk-low">Low</span></div></div>
            <div class="policy-card-name">${name}</div>
            <div class="policy-card-arn">Custom</div>
            <div class="policy-card-stats"><div class="pc-stat"><i class="fas fa-users"></i><span class="pc-stat-value">0</span><span class="pc-stat-label">Users</span></div><div class="pc-stat"><i class="fas fa-key"></i><span class="pc-stat-value">Custom</span><span class="pc-stat-label">Access</span></div><div class="pc-stat"><i class="fas fa-globe"></i><span class="pc-stat-value">${resources||'*'}</span><span class="pc-stat-label">Resource</span></div></div>
            <div class="policy-card-rec"><i class="fas fa-lightbulb"></i><span>${actions||'No actions specified'}</span></div>
            <div class="policy-card-actions"><button class="btn btn-secondary btn-sm"><i class="fas fa-eye"></i> View</button><button class="btn btn-secondary btn-sm" data-clone><i class="fas fa-copy"></i> Clone</button><button class="btn btn-danger btn-sm"><i class="fas fa-user-minus"></i> Detach</button></div>
          `;
          grid.prepend(newCard);
          // persist
          policies.unshift({ id: uid(6), name, arn:'custom', risk:'low', usersCount:0 }); savePolicies(policies);
        }
        document.body.removeChild(modal.overlay);
      };
      qs('#cg_cancel_policy', modal.box).onclick = ()=> document.body.removeChild(modal.overlay);
    });
  }

  // Replace Coming Soon sections
  function populatePages(){
    // Compliance
    const compliance = document.getElementById('compliance');
    if (compliance){
      compliance.innerHTML = `
        <div class="chart-card" style="margin-bottom:20px;">
          <div style="display:flex;gap:20px;align-items:center;">
            <div style="flex:1"><h3>Compliance Score</h3><div style="font-size:36px;font-weight:800;color:var(--success)">87%</div><div style="color:var(--text-muted);">Based on sample checks</div></div>
            <div style="flex:1"><canvas id="complianceChart" style="max-width:300px"></canvas></div>
          </div>
          <div style="display:flex;gap:16px;margin-top:18px;">
            <div style="flex:1;background:var(--bg-glass);padding:12px;border-radius:8px;border:1px solid var(--border-glass)"><strong>Passed Checks</strong><div style="font-size:20px;font-weight:700;color:var(--success)">42</div></div>
            <div style="flex:1;background:var(--bg-glass);padding:12px;border-radius:8px;border:1px solid var(--border-glass)"><strong>Failed Checks</strong><div style="font-size:20px;font-weight:700;color:var(--danger)">6</div></div>
            <div style="flex:1;background:var(--bg-glass);padding:12px;border-radius:8px;border:1px solid var(--border-glass)"><strong>Checks Total</strong><div style="font-size:20px;font-weight:700;color:var(--text-primary)">48</div></div>
          </div>
        </div>
      `;
      if (window.Chart){ const ctx = qs('#complianceChart').getContext('2d'); new Chart(ctx,{type:'doughnut',data:{labels:['Passed','Failed'],datasets:[{data:[42,6],backgroundColor:['var(--success)','var(--danger)']}]}}); }
    }

    // Audit
    const audit = document.getElementById('audit');
    if (audit){
      audit.innerHTML = `
        <div class="chart-card" style="margin-bottom:20px;">
          <h3>Audit Logs</h3>
          <div style="margin:12px 0"><input id="auditSearch" placeholder="Search logs..." style="width:100%;padding:8px;border-radius:6px;background:transparent;border:1px solid var(--border-glass);color:var(--text-primary);"></div>
          <table class="data-table" id="auditTable"><thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Status</th></tr></thead><tbody></tbody></table>
        </div>
      `;
      const sample = [
        {t:'2026-06-19 10:12:34',u:'john.doe',a:'Login',s:'Success'},
        {t:'2026-06-18 16:03:10',u:'alice.smith',a:'Detach Policy',s:'Success'},
        {t:'2026-06-17 09:22:41',u:'system',a:'Scan',s:'Completed'}
      ];
      localStorage.setItem(LS.audit, JSON.stringify(sample));
      renderAuditTable(sample);
      qs('#auditSearch').addEventListener('input', (e)=>{
        const q = e.target.value.toLowerCase(); const data = JSON.parse(localStorage.getItem(LS.audit)||'[]'); renderAuditTable(data.filter(r=> JSON.stringify(r).toLowerCase().includes(q)));
      });
    }

    // GitHub
    const gh = document.getElementById('github');
    if (gh){
      gh.innerHTML = `
        <div class="chart-card" style="margin-bottom:20px;">
          <h3>GitHub Repositories</h3>
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;">
            <div style="background:var(--bg-glass);padding:12px;border-radius:8px;border:1px solid var(--border-glass);width:220px;"><strong>cloudguard</strong><div style="font-size:12px;color:var(--text-muted);">Last Scan: 2026-06-18</div><div style="margin-top:8px;color:var(--danger);font-weight:700">Vulnerabilities: 3</div></div>
            <div style="background:var(--bg-glass);padding:12px;border-radius:8px;border:1px solid var(--border-glass);width:220px;"><strong>iam-scanner</strong><div style="font-size:12px;color:var(--text-muted);">Last Scan: 2026-06-17</div><div style="margin-top:8px;color:var(--success);font-weight:700">Vulnerabilities: 0</div></div>
          </div>
        </div>
      `;
    }

    // Settings
    const settings = document.getElementById('settings');
    if (settings){
      const cfg = JSON.parse(localStorage.getItem(LS.settings)||'{}');
      settings.innerHTML = `
        <div class="chart-card" style="margin-bottom:20px;">
          <h3>Settings</h3>
          <div style="display:flex;flex-direction:column;gap:12px;margin-top:12px;">
            <label><input type="checkbox" id="cg_theme_toggle"> Theme Toggle (dark/light)</label>
            <label><input type="checkbox" id="cg_notify_toggle"> Notifications</label>
            <label><input type="checkbox" id="cg_autoscan_toggle"> Auto Scan</label>
            <div style="display:flex;gap:8px;justify-content:flex-end;"><button id="cg_save_settings" class="btn btn-primary">Save</button></div>
          </div>
        </div>
      `;
      qs('#cg_theme_toggle').checked = !!cfg.theme;
      qs('#cg_notify_toggle').checked = cfg.notifications !== false;
      qs('#cg_autoscan_toggle').checked = !!cfg.autoscan;
      qs('#cg_save_settings').onclick = ()=>{
        const newCfg = { theme: qs('#cg_theme_toggle').checked, notifications: qs('#cg_notify_toggle').checked, autoscan: qs('#cg_autoscan_toggle').checked };
        localStorage.setItem(LS.settings, JSON.stringify(newCfg)); alert('Settings saved');
      };
    }

    // API Keys
    const api = document.getElementById('api');
    if (api){
      api.innerHTML = `
        <div class="chart-card" style="margin-bottom:20px;">
          <h3>API Key Manager</h3>
          <div style="display:flex;gap:8px;margin-top:12px;">
            <button id="cg_gen_key" class="btn btn-primary">Generate API Key</button>
            <div id="cg_api_list" style="flex:1"></div>
          </div>
        </div>
      `;
      qs('#cg_gen_key').onclick = ()=>{
        const key = generateApiKey(); const list = JSON.parse(localStorage.getItem(LS.apiKeys)||'[]'); list.unshift({id:uid(8),key,created:new Date().toISOString()}); localStorage.setItem(LS.apiKeys, JSON.stringify(list)); renderApiKeys();
      };
      function renderApiKeys(){ const list = JSON.parse(localStorage.getItem(LS.apiKeys)||'[]'); qs('#cg_api_list').innerHTML = list.map(k=>`<div style="display:flex;gap:8px;align-items:center;padding:8px;border-bottom:1px solid rgba(255,255,255,0.02);"><div style="flex:1;font-family:monospace;">${k.key}</div><button data-copy="${k.key}" class="btn btn-secondary">Copy</button><button data-revoke="${k.id}" class="btn btn-danger">Revoke</button></div>`).join(''); qs('#cg_api_list').addEventListener('click',(e)=>{ const cp = e.target.closest('[data-copy]'); if (cp){ navigator.clipboard.writeText(cp.dataset.copy).then(()=>alert('Copied')); } const rv = e.target.closest('[data-revoke]'); if (rv){ if (confirm('Revoke this key?')){ const arr = JSON.parse(localStorage.getItem(LS.apiKeys)||'[]').filter(x=>x.id!==rv.dataset.revoke); localStorage.setItem(LS.apiKeys, JSON.stringify(arr)); renderApiKeys(); } } }); }
      renderApiKeys();
    }
  }

  function generateApiKey(){
    const r = crypto && crypto.getRandomValues ? crypto.getRandomValues(new Uint8Array(24)) : Array.from({length:24},()=>Math.floor(Math.random()*256));
    return Array.from(r).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
  }

  function renderAuditTable(data){ const tbody = qs('#auditTable tbody'); if (!tbody) return; tbody.innerHTML = data.map(r=>`<tr><td>${r.t}</td><td>${r.u}</td><td>${r.a}</td><td>${r.s}</td></tr>`).join(''); }

  // Wire top header buttons
  function wireHeader(){
    const notifBtn = document.getElementById('notifBtn'); const mailBtn = document.getElementById('mailBtn'); const notifPanel = document.getElementById('notifPanel'); const mailPanel = document.getElementById('mailPanel');
    if (notifBtn){ notifBtn.addEventListener('click', (e)=>{ e.stopPropagation(); const shown = notifPanel.style.display==='block'; notifPanel.style.display = shown? 'none':'block'; renderNotifPanel(); mailPanel.style.display='none'; }); }
    if (mailBtn){ mailBtn.addEventListener('click', (e)=>{ e.stopPropagation(); const shown = mailPanel.style.display==='block'; mailPanel.style.display = shown? 'none':'block'; renderMailPanel(); notifPanel.style.display='none'; }); }
    document.addEventListener('click', ()=>{ if (notifPanel) notifPanel.style.display='none'; if (mailPanel) mailPanel.style.display='none'; });
  }

  // initial boot
  function boot(){ updateKPIs(users); renderUsers(); wireHeader(); document.addEventListener('click', onUserAction); wirePolicyActions(); populatePages(); }

  // ensure login session exists (simple)
  function ensureAuth(){
    try{ const s = JSON.parse(localStorage.getItem(LS.session)||'null'); if (!s || !s.username) { if (!location.pathname.includes('login.html')) { location.href = '../login.html'; } } else { // user present
        // nothing
      }
    } catch(e){ if (!location.pathname.includes('login.html')) location.href = '../login.html'; }
  }

  // Only run ensureAuth for the dashboard
  if (!location.pathname.includes('login.html')) ensureAuth();

  // start
  document.addEventListener('DOMContentLoaded', boot);

})();