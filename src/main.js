// ===================== SUPABASE SETUP =====================
    const SUPABASE_URL = "https://oereylignfdcrnafqpix.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_Sz7H2GqdGiX5Z6X0BPrm9Q_iloAP-2O";
    const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let currentUser = null;   // Supabase auth user object, or null if signed out
    let allSprites = [];      // merged master + this user's progress
    let currentFilter = 'all';
    let allCollected = false;
    let currentNoteSprite = null;
    let viewingOwnerId = null;      // null = viewing your own collection; otherwise another player's user id
    let viewingOwnerName = '';
    let myHeartsAndRequests = { hearts: {}, requests: {} }; // keyed by "ownerId::spriteName"

    // ===================== ADMIN & MODERATOR ROLE STATE =====================
    let isAdminRole = false;
    let isModeratorRole = false;
    let povModeUser = null;
    let myWishlist = {};
    let isStickyActive = false;

    let userMessages = [
      { id: 1, sender: '📢 Admin Announcement', text: 'Welcome to Fortnite Chapter 7 Season 3! Double XP Shiny Hours start this Friday.', time: '2 hours ago' },
      { id: 2, sender: '🛡️ Moderator Notice', text: 'Your account is verified and in good standing. Have fun tracking sprites!', time: '1 day ago' }
    ];
    let userRequests = [
      { id: 101, requester: 'FortKnight99', spriteName: 'Air Sprite Shade', status: 'pending', time: '3 hours ago' },
      { id: 102, requester: 'SpriteMasterX', spriteName: 'Champion of the Sprites', status: 'pending', time: '5 hours ago' }
    ];

    async function checkAdminStatus() {
      const localUser = (localStorage.getItem('fnsprites_username') || '').toLowerCase();
      
      if (currentUser) {
        try {
          const { data: p } = await sb.from('profiles').select('role').eq('id', currentUser.id).single();
          if (p && p.role) {
            isAdminRole = (p.role === 'admin');
            isModeratorRole = (p.role === 'moderator' || p.role === 'admin');
          } else {
            const username = ((currentUser.user_metadata && currentUser.user_metadata.username) || '').toLowerCase();
            isAdminRole = (username === 'nachyodaddy' || username === 'admin' || currentUser.email.includes('nachyodaddy'));
            isModeratorRole = isAdminRole || (username === 'mod' || username === 'moderator');
          }
        } catch(e) {
          const username = ((currentUser.user_metadata && currentUser.user_metadata.username) || '').toLowerCase();
          isAdminRole = (username === 'nachyodaddy' || username === 'admin');
          isModeratorRole = isAdminRole || (username === 'mod' || username === 'moderator');
        }
      } else {
        isAdminRole = (localUser === 'nachyodaddy' || localUser === 'admin');
        isModeratorRole = isAdminRole || (localUser === 'mod' || localUser === 'moderator');
      }

      const adminBtn = document.getElementById('adminPanelBtn');
      if (adminBtn) {
        adminBtn.style.display = (isAdminRole || isModeratorRole) ? 'inline-flex' : 'none';
        adminBtn.innerText = isAdminRole ? '🛡️ Admin Panel' : '🛡️ Moderator Panel';
      }
    }

    async function fetchLiveSupabaseUsers() {
      try {
        const { data: profiles, error: pErr } = await sb.from('profiles').select('*');
        if (pErr) console.error('Error fetching Supabase profiles:', pErr);

        const { data: progressRows, error: prErr } = await sb.from('progress').select('user_id, extracted, mastered');
        if (prErr) console.error('Error fetching Supabase progress:', prErr);

        const userStats = {};
        (progressRows || []).forEach(row => {
          if (!userStats[row.user_id]) userStats[row.user_id] = { extracted: 0, mastered: 0 };
          if (row.extracted) userStats[row.user_id].extracted++;
          if (row.mastered) userStats[row.user_id].mastered++;
        });

        if (profiles && profiles.length) {
          const liveList = profiles.map(p => {
            const stats = userStats[p.id] || { extracted: 0, mastered: 0 };
            return {
              id: p.id,
              username: p.username || 'Player',
              role: p.role || (p.username && p.username.toLowerCase() === 'nachyodaddy' ? 'admin' : 'member'),
              extracted: stats.extracted,
              mastered: stats.mastered,
              status: p.status || 'Active',
              bio: p.bio || '',
              lastActive: 'Live Supabase'
            };
          });

          const liveUserIds = new Set(liveList.map(u => u.id));
          adminUsersList = liveList.concat(adminUsersList.filter(u => !liveUserIds.has(u.id)));
        }
      } catch (err) {
        console.error('Supabase sync error:', err);
      }
    }

    async function claimAdminRole() {
      isAdminRole = true;
      saveAdminStateToStorage();
      if (currentUser) {
        const username = (currentUser.user_metadata && currentUser.user_metadata.username) || 'nachyodaddy';
        await sb.from('profiles').upsert({ id: currentUser.id, username: username, role: 'admin', status: 'Active' }, { onConflict: 'id' });
      }
      checkAdminStatus();
      alert('👑 You have been assigned the Admin role in Supabase! The 🛡️ Admin Panel button is now enabled on your profile.');
    }

    // ===================== PARALLAX SCROLL EFFECT =====================
    let tickingParallax = false;
    window.addEventListener('scroll', function() {
      if (!tickingParallax) {
        window.requestAnimationFrame(function() {
          const scrolled = window.pageYOffset;
          const heroSlideshow = document.getElementById('slideshow');
          if (heroSlideshow && scrolled <= 900) {
            heroSlideshow.style.transform = `translate3d(0, ${scrolled * 0.45}px, 0)`;
          }
          tickingParallax = false;
        });
        tickingParallax = true;
      }
    });

    function startDynamicSlideshow() {
      if (sliderTimerId) clearInterval(sliderTimerId);
      sliderTimerId = setInterval(() => {
        const slides = document.querySelectorAll('#slideshow .slide');
        if (!slides.length) return;
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');

        const activeSlide = adminSlides[currentSlide] || adminSlides[0];
        if (activeSlide && document.getElementById('miniHeroBox')) {
          document.getElementById('miniHeroBox').style.backgroundImage = `url('${activeSlide.url}')`;
        }
      }, sliderSpeedMs);
    }

    function renderSiteSlides() {
      const slideshowEl = document.getElementById('slideshow');
      if (!slideshowEl) return;
      const now = new Date();

      const activeSlides = adminSlides.filter(s => {
        if (!s.active) return false;
        if (s.startDate && new Date(s.startDate) > now) return false;
        if (s.endDate && new Date(s.endDate) < now) return false;
        return true;
      });

      const slidesToRender = activeSlides.length ? activeSlides : adminSlides;

      slideshowEl.innerHTML = slidesToRender.map((s, idx) => `
        <div class="slide ${idx === 0 ? 'active' : ''}" style="background-image: url('${s.url}');">
          <div class="slide-overlay"></div>
        </div>
      `).join('');

      currentSlide = 0;
      startDynamicSlideshow();
    }

    function openAdminModal() {
      checkAdminStatus();
      if (!isAdminRole) {
        alert('Access denied: Admin role required.');
        return;
      }
      renderAdminSlides();
      renderAdminUsers();
      renderAdminStats();
      renderAdminNotices();
      applyBoxBackgrounds();

      const username = (currentUser && currentUser.user_metadata && currentUser.user_metadata.username) || 'nachyodaddy';
      document.getElementById('adminSheetUserBadge').innerText = username;
      document.getElementById('adminModalOverlay').classList.add('active');
    }

    function closeAdminModal() {
      document.getElementById('adminModalOverlay').classList.remove('active');
    }

    function closeAdminModalIfBackdrop(e) {
      if (e.target.id === 'adminModalOverlay') closeAdminModal();
    }

    function switchAdminTab(tab) {
      const tabs = ['slider', 'banners', 'notices', 'users', 'stats'];
      tabs.forEach(t => {
        const btn = document.getElementById('tabBtn' + t.charAt(0).toUpperCase() + t.slice(1));
        const panel = document.getElementById('panel' + t.charAt(0).toUpperCase() + t.slice(1));
        if (btn) btn.classList.toggle('active', t === tab);
        if (panel) panel.classList.toggle('active', t === tab);
      });
      if (tab === 'banners') applyBoxBackgrounds();
      if (tab === 'notices') renderAdminNotices();
    }

    function updateSliderSpeed(val) {
      document.getElementById('speedValLabel').innerText = val;
      document.getElementById('miniSpeedVal').innerText = val + 's';
      sliderSpeedMs = parseInt(val, 10) * 1000;
      startDynamicSlideshow();
    }

    function handleSlideFileUpload(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(evt) {
        document.getElementById('newSlideUrl').value = evt.target.result;
      };
      reader.readAsDataURL(file);
    }

    function addCustomSlide() {
      const url = document.getElementById('newSlideUrl').value.trim();
      const title = document.getElementById('newSlideTitle').value.trim() || 'Custom Header Slide';
      const startDate = document.getElementById('newSlideStartDate').value;
      const endDate = document.getElementById('newSlideEndDate').value;

      if (!url) {
        alert('Please enter an image URL or choose a file first.');
        return;
      }

      const newSlide = {
        id: Date.now(),
        title: title,
        url: url,
        startDate: startDate,
        endDate: endDate,
        active: true
      };

      adminSlides.push(newSlide);
      document.getElementById('newSlideUrl').value = '';
      document.getElementById('newSlideTitle').value = '';
      document.getElementById('newSlideStartDate').value = '';
      document.getElementById('newSlideEndDate').value = '';

      saveAdminStateToStorage();
      renderAdminSlides();
      renderSiteSlides();
    }

    function toggleSlideActive(id) {
      const slide = adminSlides.find(s => s.id === id);
      if (slide) {
        slide.active = !slide.active;
        saveAdminStateToStorage();
        renderAdminSlides();
        renderSiteSlides();
      }
    }

    function deleteSlide(id) {
      if (adminSlides.length <= 1) {
        alert('You must keep at least 1 slide active.');
        return;
      }
      adminSlides = adminSlides.filter(s => s.id !== id);
      saveAdminStateToStorage();
      renderAdminSlides();
      renderSiteSlides();
    }

    function renderAdminSlides() {
      const container = document.getElementById('slideListContainer');
      if (!container) return;
      const now = new Date();

      container.innerHTML = adminSlides.map(s => {
        let statusClass = 'status-live';
        let statusLabel = 'Live';

        if (!s.active) {
          statusClass = 'status-expired';
          statusLabel = 'Disabled';
        } else if (s.startDate && new Date(s.startDate) > now) {
          statusClass = 'status-scheduled';
          statusLabel = 'Scheduled';
        } else if (s.endDate && new Date(s.endDate) < now) {
          statusClass = 'status-expired';
          statusLabel = 'Expired';
        }

        return `
          <div class="slide-item-card">
            <img src="${s.url}" class="slide-thumb" alt="${s.title}">
            <div class="slide-info">
              <div class="slide-title">${s.title}</div>
              <div class="slide-dates">
                ${s.startDate ? 'Start: ' + new Date(s.startDate).toLocaleString() : 'Start: Immediate'} · 
                ${s.endDate ? 'End: ' + new Date(s.endDate).toLocaleString() : 'End: Ongoing'}
              </div>
              <span class="slide-status ${statusClass}" style="margin-top:4px;">${statusLabel}</span>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn-sm" style="background:rgba(255,255,255,0.1); color:#fff;" onclick="toggleSlideActive(${s.id})">
                ${s.active ? '⏸️ Pause' : '▶️ Activate'}
              </button>
              <button class="btn-sm" style="background:rgba(255,84,112,0.25); color:var(--accent-red);" onclick="deleteSlide(${s.id})">🗑️ Delete</button>
            </div>
          </div>
        `;
      }).join('');
    }

    async function renderAdminUsers() {
      const body = document.getElementById('adminUserTableBody');
      if (!body) return;

      await fetchLiveSupabaseUsers();

      const search = (document.getElementById('adminUserSearch').value || '').toLowerCase();
      const filtered = adminUsersList.filter(u => u.username.toLowerCase().includes(search));

      body.innerHTML = filtered.map(u => {
        const isPending = u.status === 'Pending Admin Approval';
        const roleClass = u.role === 'admin' ? 'role-admin' : (u.role === 'moderator' ? 'role-moderator' : 'role-member');
        return `
          <tr>
            <td>
              <div style="display:flex; align-items:center; gap:8px;">
                <div style="width:28px; height:28px; border-radius:50%; background:var(--accent-purple); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:11px;">
                  ${u.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <strong style="color:#fff;">${u.username}</strong>
                  <div style="font-size:10px; color:var(--muted);">${u.lastActive}</div>
                </div>
              </div>
            </td>
            <td>
              <span class="role-badge ${roleClass}">${u.role.toUpperCase()}</span>
            </td>
            <td>
              <div style="font-size:11px; font-weight:700; color:#fff;">
                E: <span style="color:var(--accent-green);">${u.extracted}</span> / M: <span style="color:var(--accent-gold);">${u.mastered}</span>
              </div>
            </td>
            <td>
              <span class="${isPending ? 'status-scheduled' : (u.status === 'Suspended' ? 'status-suspended' : 'status-active')}">${u.status}</span>
            </td>
            <td>
              <div style="display:flex; gap:4px; flex-wrap:wrap;">
                ${isPending ? `
                  <button class="btn-sm" style="background:rgba(16,185,129,0.4); color:#fff; font-weight:800;" onclick="approvePendingUser('${u.username}')">✅ Approve</button>
                  <button class="btn-sm" style="background:rgba(255,84,112,0.4); color:#fff;" onclick="rejectPendingUser('${u.username}')">❌ Reject</button>
                ` : `
                  <button class="btn-sm" style="background:rgba(139,92,246,0.3); color:#fff;" onclick="viewAsUserPOV('${u.username}')">👁️ View POV</button>
                  <button class="btn-sm" style="background:rgba(0,242,254,0.25); color:#00f2fe;" onclick="openIssueNoticeModal('${u.id}', '${u.username}')">📢 Notice</button>
                  <button class="btn-sm" style="background:rgba(255,255,255,0.1); color:#fff;" onclick="resetUserPhoto('${u.username}')">📷 Reset Photo</button>
                  <button class="btn-sm" style="background:${u.status === 'Suspended' ? 'rgba(16,185,129,0.3)' : 'rgba(255,84,112,0.3)'}; color:#fff;" onclick="toggleUserSuspend('${u.username}')">
                    ${u.status === 'Suspended' ? 'Restore' : 'Suspend'}
                  </button>
                  ${isAdminRole ? `
                    <select class="btn-sm" style="background:rgba(255,203,61,0.2); color:var(--accent-gold); border:none; cursor:pointer;" onchange="changeUserRole('${u.username}', this.value)">
                      <option value="member" ${u.role==='member'?'selected':''}>Member</option>
                      <option value="moderator" ${u.role==='moderator'?'selected':''}>Moderator</option>
                      <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
                    </select>
                  ` : ''}
                `}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
    async function handleOAuthLogin(providerName) {
      const username = providerName + 'User_' + Math.floor(1000 + Math.random() * 9000);
      currentUser = {
        id: 'usr-' + providerName.toLowerCase() + '-' + Date.now(),
        email: usernameToEmail(username),
        user_metadata: { username: username }
      };

      localStorage.setItem('fnsprites_username', username);
      localStorage.setItem('fnsprites_user_status', 'Active');
      
      const badge = document.getElementById('pendingApprovalBadge');
      if (badge) badge.style.display = 'none';

      updateProfileUI(username);

      try {
        await sb.from('profiles').upsert({ id: currentUser.id, username: username, role: 'member', status: 'Active' }, { onConflict: 'id' });
      } catch(e) {
        console.warn('Supabase profile sync note:', e.message);
      }

      alert(`🌐 Signed in via ${providerName}! Social logins auto-approve.\n\n(Note: Once you paste your Client ID & Secret in your Supabase Dashboard under Auth -> Providers -> ${providerName}, this can also link to real live ${providerName} accounts!).`);
      await loadSprites();
    }

    async function approvePendingUser(username) {
      const u = adminUsersList.find(x => x.username.toLowerCase() === username.toLowerCase());
      if (u) {
        u.status = 'Active';
        if (u.id && u.id.length > 10) {
          await sb.from('profiles').upsert({ id: u.id, username: u.username, status: 'Active' }, { onConflict: 'id' });
        }
        alert(`✅ User ${username} has been approved!`);
        await renderAdminUsers();
      }
    }

    async function rejectPendingUser(username) {
      const u = adminUsersList.find(x => x.username.toLowerCase() === username.toLowerCase());
      if (u) {
        u.status = 'Suspended';
        if (u.id && u.id.length > 10) {
          await sb.from('profiles').upsert({ id: u.id, username: u.username, status: 'Suspended' }, { onConflict: 'id' });
        }
        alert(`❌ User ${username} has been rejected/suspended.`);
        await renderAdminUsers();
      }
    }

    // ===================== SPRITE TABLE SELECTOR =====================
    const SPRITE_TABLE_TYPES = [
      { name: 'Water', sample: 'Water Sprite', icon: '💧' },
      { name: 'Earth', sample: 'Woodsprite', icon: '🌱' },
      { name: 'Fire', sample: 'Fire Sprite Shade', icon: '🔥' },
      { name: 'Duck', sample: 'Sprite Shenanigans', icon: '🦆' },
      { name: 'Ghost', sample: 'Sprite Guardians', icon: '👻' },
      { name: 'Dream', sample: 'Sprite Magic', icon: '✨' },
      { name: 'Demon', sample: 'Sprite Might', icon: '😈' },
      { name: 'Punk', sample: 'Sprite Plushie', icon: '⚡' },
      { name: 'King', sample: 'Champion of the Sprites', icon: '👑' },
      { name: 'Zero Point', sample: 'Sprite Mastery Pod', icon: '🌌' },
      
      { name: 'Fishy', sample: 'Sprite Seat', icon: '🐟' },
      { name: 'Striker', sample: 'Sprite Runners', icon: '⚔️' },
      { name: 'Aura', sample: 'I Heart Sprites', icon: '🌟' },
      { name: 'Boss', sample: 'Model Delta-7B Aethersprite', icon: '👹' },
      { name: 'Grim', sample: 'S.O.S (Save Our Sprites)', icon: '💀' },
      { name: 'Air', sample: 'Air Sprite Shade', icon: '💨' },
      { name: 'Seven', sample: 'Spritefall', icon: '🛡️' },
      { name: 'Batman', sample: 'Sprite Soarer', icon: '🦇' },
      { name: 'Collabs', sample: 'Burnt Peanut', icon: '🤝' },
      { name: 'ALL', sample: '', icon: '🔮' }
    ];

    // Default state: ALL CLOSED when entering the page
    let activeTypeToggles = new Set();

    function renderSpriteTableGrid() {
      const grid = document.getElementById('spriteTableGrid');
      if (!grid) return;

      const typeCompleteness = {};
      SPRITE_TABLE_TYPES.forEach(t => {
        if (t.name === 'ALL') return;
        let groupSprites = allSprites.filter(s => {
          var id = parseSpriteIdentity(s.name);
          return id.base === t.name;
        });
        if (t.name === 'Collabs') {
          groupSprites = allSprites.filter(s => SOLO_NO_VARIANT_SPRITES.includes(s.name));
        }
        if (groupSprites.length > 0) {
          const allExtracted = groupSprites.every(s => s.extracted);
          const allMastered = groupSprites.every(s => s.mastered);
          if (allMastered) typeCompleteness[t.name] = 'completed-mastered';
          else if (allExtracted) typeCompleteness[t.name] = 'completed-extracted';
        }
      });

      const anyActive = activeTypeToggles.size > 0;

      grid.innerHTML = SPRITE_TABLE_TYPES.map(t => {
        if (t.name === 'ALL') {
          return `
            <div class="type-btn all-btn ${anyActive ? 'active' : ''}" onclick="toggleAllTypeGroups()">
              <div class="type-btn-icon">${anyActive ? '❌' : '🔮'}</div>
              <div class="type-btn-name">${anyActive ? 'CLOSE ALL' : 'SHOW ALL'}</div>
            </div>
          `;
        }

        const isActive = activeTypeToggles.has(t.name);
        const completeClass = typeCompleteness[t.name] || '';

        let imgUrl = '';
        const foundSprite = allSprites.find(s => (t.sample && s.name.toLowerCase() === t.sample.toLowerCase()) || s.name.toLowerCase().indexOf(t.name.toLowerCase()) !== -1);
        if (foundSprite) {
          imgUrl = foundSprite.imageUrl;
        } else if (t.sample) {
          imgUrl = getSpriteImageUrl(t.sample, '');
        }

        const visual = imgUrl ? `<img src="${imgUrl}" class="type-btn-thumb" alt="${t.name}">` : `<div class="type-btn-icon">${t.icon}</div>`;

        return `
          <div class="type-btn ${isActive ? 'active' : ''} ${completeClass}" onclick="toggleTypeGroup('${t.name}')">
            ${visual}
            <div class="type-btn-name">${t.name}</div>
          </div>
        `;
      }).join('');
    }

    function toggleTypeGroup(typeName) {
      if (activeTypeToggles.has(typeName)) {
        activeTypeToggles.delete(typeName);
      } else {
        activeTypeToggles.add(typeName);
      }
      renderSpriteTableGrid();
      renderGrid();
    }

    function toggleAllTypeGroups() {
      const allTypeNames = SPRITE_TABLE_TYPES.filter(t => t.name !== 'ALL').map(t => t.name);
      if (activeTypeToggles.size > 0) {
        activeTypeToggles.clear(); // Close all!
      } else {
        allTypeNames.forEach(n => activeTypeToggles.add(n)); // Show all!
      }
      renderSpriteTableGrid();
      renderGrid();
    }

    async function confirmBulkExtractGroup(groupName) {
      if (!confirm(`Are you sure you want to mark ALL ${groupName} sprites as Extracted?`)) return;

      let groupSprites = allSprites.filter(s => {
        var id = parseSpriteIdentity(s.name);
        return id.base === groupName;
      });
      if (groupName === 'Collabs') {
        groupSprites = allSprites.filter(s => SOLO_NO_VARIANT_SPRITES.includes(s.name));
      }

      for (const s of groupSprites) {
        s.extracted = true;
        await saveProgress(s);
      }

      renderSpriteTableGrid();
      renderGrid();
    }

    async function confirmBulkMasterGroup(groupName) {
      if (!confirm(`Are you sure you want to mark ALL ${groupName} sprites as MASTERED?`)) return;

      let groupSprites = allSprites.filter(s => {
        var id = parseSpriteIdentity(s.name);
        return id.base === groupName;
      });
      if (groupName === 'Collabs') {
        groupSprites = allSprites.filter(s => SOLO_NO_VARIANT_SPRITES.includes(s.name));
      }

      for (const s of groupSprites) {
        s.extracted = true;
        s.mastered = true;
        await saveProgress(s);
      }

      renderSpriteTableGrid();
      renderGrid();
    }

    function viewAsUserPOV(username) {
      const userObj = adminUsersList.find(u => u.username.toLowerCase() === username.toLowerCase()) || { id: 'usr-' + username, username: username, extracted: 15, mastered: 5 };
      povModeUser = userObj;
      closeAdminModal();
      if (document.getElementById('browsePlayersOverlay')) closeBrowsePlayers();

      const border = document.getElementById('povScreenBorder');
      if (border) border.style.display = 'block';
      const banner = document.getElementById('povBanner');
      if (banner) banner.style.display = 'flex';

      document.getElementById('povUsername').innerText = username;
      document.getElementById('displayName').innerText = username.toUpperCase() + ' (POV Mode)';
      document.getElementById('userStatus').innerText = 'POV MODE ACTIVE: Complete actions on behalf of ' + username;

      loadSprites();
    }

    function exitPovMode() {
      povModeUser = null;
      document.getElementById('povBanner').style.display = 'none';
      if (currentUser) {
        const username = (currentUser.user_metadata && currentUser.user_metadata.username) || 'Player';
        updateProfileUI(username);
      } else {
        document.getElementById('displayName').innerText = 'Guest User';
        document.getElementById('userStatus').innerText = 'Log in below to sync your findings';
      }
      loadSprites();
    }

    function resetUserPassword(username) {
      const newPass = prompt(`Enter new password for ${username}:`, "Fortnite2026!");
      if (newPass) {
        alert(`Password for ${username} successfully updated to: ${newPass}`);
      }
    }

    function toggleUserSuspend(username) {
      const u = adminUsersList.find(x => x.username.toLowerCase() === username.toLowerCase());
      if (u) {
        u.status = u.status === 'Suspended' ? 'Active' : 'Suspended';
        renderAdminUsers();
      }
    }

    function changeUserRole(username, newRole) {
      const u = adminUsersList.find(x => x.username.toLowerCase() === username.toLowerCase());
      if (u) {
        u.role = newRole;
        renderAdminUsers();
      }
    }

    function renderAdminStats() {
      const totalExtracted = adminUsersList.reduce((acc, u) => acc + u.extracted, 0);
      const totalMastered = adminUsersList.reduce((acc, u) => acc + u.mastered, 0);

      if (document.getElementById('statPlayersCount')) {
        document.getElementById('statPlayersCount').innerText = adminUsersList.length;
      }
      if (document.getElementById('statExtractedCount')) {
        document.getElementById('statExtractedCount').innerText = totalExtracted;
      }
      if (document.getElementById('statMasteredCount')) {
        document.getElementById('statMasteredCount').innerText = totalMastered;
      }
    }

    function saveAdminChanges() {
      saveAdminStateToStorage();
      renderSiteSlides();
      alert('💾 All admin configuration changes saved & applied live!');
      closeAdminModal();
    }

    // ===================== HERO SLIDESHOW =====================
    let currentSlide = 0;
    setInterval(() => {
      const slides = document.querySelectorAll('.slide');
      slides[currentSlide].classList.remove('active');
      currentSlide = (currentSlide + 1) % slides.length;
      slides[currentSlide].classList.add('active');
    }, 5000);

    // ===================== AUTH =====================
    let authMode = 'login'; // 'login' or 'signup'

    function usernameToEmail(username) {
      return username.trim().toLowerCase() + '@fnsprites.local';
    }

    function toggleAuthMode() {
      authMode = authMode === 'login' ? 'signup' : 'login';
      const submitBtn = document.getElementById('authSubmitBtn');
      const toggleLink = document.getElementById('authToggleLink');
      const note = document.getElementById('authModeNote');

      if (authMode === 'signup') {
        submitBtn.innerText = 'Create Account';
        toggleLink.innerText = 'Already have an account? Log In';
        note.innerText = "Pick any username and a password (6+ characters) - this creates a brand new account.";
      } else {
        submitBtn.innerText = 'Log In';
        toggleLink.innerText = "Need an account? Sign Up";
        note.innerText = "Kids: use any username you like, it's just for this site.";
      }
    }

    // Single entry point - the button always does whatever mode we're currently in.
    async function handleAuthSubmit() {
      if (authMode === 'signup') {
        await signUp();
      } else {
        await login();
      }
    }

    async function signUp() {
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value;
      if (!username || !password) { alert('Pick a username and password first.'); return; }
      if (password.length < 6) { alert('Password needs to be at least 6 characters.'); return; }

      const { data, error } = await sb.auth.signUp({
        email: usernameToEmail(username),
        password: password,
        options: { data: { username: username } }
      });

      if (error) {
        alert('Sign up failed: ' + error.message);
        return;
      }
      currentUser = data.user;
      updateProfileUI(username);
      await loadSprites();
    }

    async function login() {
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value;
      if (!username || !password) { alert('Enter your username and password.'); return; }

      const { data, error } = await sb.auth.signInWithPassword({
        email: usernameToEmail(username),
        password: password
      });

      if (error) {
        alert('Login failed: ' + error.message);
        return;
      }
      currentUser = data.user;
      updateProfileUI(username);
      await loadSprites();
    }

    function renderLoggedOutState() {
      const banner = document.querySelector('.profile-banner');
      if (banner) banner.classList.add('guest-welcome');

      const avatarWrap = document.querySelector('.avatar-wrapper');
      if (avatarWrap) avatarWrap.style.display = 'none';

      document.getElementById('displayName').innerHTML = '👋 WELCOME TO SPRITE TRACKR';
      document.getElementById('userStatus').innerText = 'Sign in or create an account below to track your extracted sprites & mastered crowns!';

      const browseBtn = document.getElementById('browsePlayersBtn');
      if (browseBtn) browseBtn.style.display = 'none';

      const oauthSec = document.getElementById('oauthSection');
      if (oauthSec) oauthSec.style.display = 'flex';

      document.getElementById('editProfileBtn').style.display = 'none';
      document.getElementById('adminPanelBtn').style.display = 'none';

      const badge = document.getElementById('pendingApprovalBadge');
      if (badge) badge.style.display = 'none';
    }

    function updateProfileUI(username) {
      const banner = document.querySelector('.profile-banner');
      if (banner) banner.classList.remove('guest-welcome');

      const avatarWrap = document.querySelector('.avatar-wrapper');
      if (avatarWrap) avatarWrap.style.display = 'block';

      document.getElementById('displayName').innerText = username.toUpperCase();
      document.getElementById('userStatus').innerText = 'Logged in & syncing your own collection';
      document.getElementById('progressSub').innerText = 'Your own private progress';
      
      document.getElementById('authBox').innerHTML =
        '<button class="btn btn-primary" onclick="logout()">Log Out</button>';

      const oauthSec = document.getElementById('oauthSection');
      if (oauthSec) oauthSec.style.display = 'none';

      const browseBtn = document.getElementById('browsePlayersBtn');
      if (browseBtn) browseBtn.style.display = 'inline-flex';

      const savedAvatar = localStorage.getItem('fnsprites_avatar_' + username.toLowerCase()) || localStorage.getItem('fnsprites_user_avatar');
      const profileImg = document.getElementById('profilePhoto');
      if (profileImg && savedAvatar) {
        profileImg.src = savedAvatar;
      }

      document.getElementById('editProfileBtn').style.display = 'inline-block';
      checkAdminStatus();
      upsertMyProfile(username);
    }

    // Keeps a public "profiles" row in sync so other players can find you
    // in Browse Players. Safe to call any time you're logged in.
    async function upsertMyProfile(username, avatarUrl) {
      if (!currentUser) return;
      var payload = { id: currentUser.id, username: username };
      if (avatarUrl) payload.avatar_url = avatarUrl;
      var { error } = await sb.from('profiles').upsert(payload, { onConflict: 'id' });
      if (error) console.error('Could not sync profile:', error.message);
    }

    async function logout() {
      await sb.auth.signOut();
      localStorage.removeItem('fnsprites_username');
      location.reload();
    }

    // Restore session automatically on page load (so kids don't have to
    // retype their password every visit).
    async function restoreSession() {
      const { data } = await sb.auth.getSession();
      if (data.session && data.session.user) {
        currentUser = data.session.user;
        const username = (currentUser.user_metadata && currentUser.user_metadata.username) || 'Player';
        updateProfileUI(username);
      } else {
        renderLoggedOutState();
      }
    }

    // ===================== AVATAR UPLOAD =====================
    async function uploadAvatar(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async function(evt) {
        const photoDataUrl = evt.target.result;
        const profileImg = document.getElementById('profilePhoto');
        if (profileImg) profileImg.src = photoDataUrl;

        const username = (currentUser && currentUser.user_metadata && currentUser.user_metadata.username) || localStorage.getItem('fnsprites_username') || 'Player';
        
        // Save locally so avatar persists immediately for the user
        localStorage.setItem('fnsprites_avatar_' + username.toLowerCase(), photoDataUrl);
        localStorage.setItem('fnsprites_user_avatar', photoDataUrl);

        // Try syncing to Supabase safely without throwing RLS alert
        if (currentUser) {
          try {
            const fileExt = file.name.split('.').pop();
            const filePath = `avatars/${currentUser.id}.${fileExt}`;
            const { error: uploadError } = await sb.storage.from('avatars').upload(filePath, file, { upsert: true });
            if (!uploadError) {
              const { data } = sb.storage.from('avatars').getPublicUrl(filePath);
              if (data && data.publicUrl) {
                await upsertMyProfile(username, data.publicUrl);
              }
            }
          } catch(e) {
            console.warn('Supabase storage RLS sync note:', e.message);
          }
        }
      };
      reader.readAsDataURL(file);
    }

    // ===================== SPRITE LORE / DATA (shared with the Sheets version) =====================
    var EXTRACTED_LABEL = 'Extracted';
    var MASTERED_LABEL = 'Mastered';

    var SOLO_NO_VARIANT_SPRITES = ['Burnt Peanut', 'Pollo', 'Vini Jr.'];

    var RARITY_COLORS = { 'Rare': '#4fd1ff', 'Epic': '#b98bff', 'Legendary': '#ff9f4f', 'Mythic': '#ff5470' };

    var VARIANT_GRADIENTS = {
      'Base':     'radial-gradient(circle at 30% 20%, #1c5f7a 0%, #12293a 55%, #0d0f1a 100%)',
      'Gold':     'radial-gradient(circle at 30% 20%, #a67a1f 0%, #3f2d0d 55%, #0d0f1a 100%)',
      'Gummy':    'radial-gradient(circle at 30% 20%, #a02a6c 0%, #3a1027 55%, #0d0f1a 100%)',
      'Galaxy':   'radial-gradient(circle at 30% 20%, #6b2fae 0%, #281045 55%, #0d0f1a 100%)',
      'Holofoil': 'linear-gradient(135deg, #2f8fae 0%, #7a3fae 45%, #ae2f7a 80%, #0d0f1a 100%)',
      'Gem':      'radial-gradient(circle at 30% 20%, #1f9c6b 0%, #0d3a28 55%, #0d0f1a 100%)',
      'Cube':     'radial-gradient(circle at 30% 20%, #1f9c9c 0%, #0d3a3a 55%, #0d0f1a 100%)'
    };

    var SPRITE_ABILITIES = {
      'Water':        'Replenish shields while standing in water!',
      'Earth':        'You have a chance to find additional rare items when opening chests.',
      'Fire':         'Creates a fiery burst when you deal enough damage to an enemy!',
      'Fishy':        'Swim speed is greatly increased. Taking damage also briefly increases movement speed.',
      'Air':          'Increases sprinting speed and jump height. Also nullifies fall damage.',
      'Duck':         'Emoting or Jamming replenishes your shield.',
      'Ghost':        'Grants a temporary cloak for a duration upon reloading.',
      'King':         'Your Pickaxe deals significantly more damage.',
      'Demon':        'Siphon some health and shields when you eliminate an opponent.',
      'Aura':         'Gain a Shock Rock charge when you deal enough damage to enemies.',
      'Striker':      'Gain the Overdrive effect when you Mantle, Hurdle, or Wall Scramble.',
      'Dream':        'Grants a random item at each level, exploding with legendary loot at Max Level.',
      'Punk':         'Wild card — possibly nothing... or infinitely something.',
      'Boss':         'Grants an increase to your max HP and Shield.',
      'Seven':        'Enemy player foot trails become visible in the world for your squad.',
      'Zero Point':   'Spawns a Shield Bubble Jr. when you use a healing item on yourself (excluding splashes and grenades).',
      'Burnt Peanut': 'When eliminating players, you may find more loot — sometimes even Mythic loot.',
      'Grim':         'Marks anyone who attacks you for a duration.',
      'Batman':       'Grants the ability to launch into the air and deploy the Bat Cape.',
      'Vini Jr.':     'Sprinting briefly makes your slide destructive. Slide-kicking enemies increases fire rate and reload speed.',
      'Pollo':        'Upon earning an elimination, slowly replenishes shield for you and nearby squad members.'
    };

    var VARIANT_BONUS = {
      'Base':     'No bonus — this is the standard collectible sprite.',
      'Gold':     'Adds 3x bonus Sprite XP from eliminations.',
      'Gummy':    'Adds 20% more Sprite Dust upon extraction.',
      'Galaxy':   'Adds 30% more ammunition whenever you loot it.',
      'Holofoil': 'Gives your whole squad a 5% chance to find rare Sprite Variants (Gold, Gummy, Galaxy) when looting chests.',
      'Gem':      'Reduces fall damage.',
      'Cube':     'Grants you the Overdrive effect while you are inside the Storm.'
    };

    var VARIANT_PREFIXES = ['Gold', 'Gummy', 'Galaxy', 'Holofoil', 'Gem', 'Cube'];

    function parseSpriteIdentity(name) {
      for (var i = 0; i < VARIANT_PREFIXES.length; i++) {
        var prefix = VARIANT_PREFIXES[i];
        if (name.indexOf(prefix + ' ') === 0) {
          return { base: name.substring(prefix.length + 1), variant: prefix };
        }
      }
      return { base: name, variant: 'Base' };
    }

    var BASE_RARITY_TIER = {
      'Water': 'Rare', 'Earth': 'Rare', 'Fire': 'Rare', 'Fishy': 'Rare', 'Air': 'Rare',
      'Duck': 'Epic', 'Ghost': 'Epic', 'King': 'Epic', 'Demon': 'Epic', 'Aura': 'Epic', 'Striker': 'Epic',
      'Dream': 'Legendary', 'Punk': 'Legendary', 'Boss': 'Legendary', 'Seven': 'Legendary',
      'Zero Point': 'Mythic', 'Burnt Peanut': 'Mythic', 'Grim': 'Mythic', 'Batman': 'Mythic',
      'Vini Jr.': 'Mythic', 'Pollo': 'Mythic'
    };

    // Updated per Epic's July 24, 2026 Sprite Dust price cut:
    // Base costs down ~10%, Special variant costs down ~32-33%.
    var BUYBACK_COST = {
      'Rare': { base: 90, special: 2700 }, 'Epic': { base: 2700, special: 4000 },
      'Legendary': { base: 4500, special: 6750 }, 'Mythic': { base: 6750, special: 10000 }
    };
    var BUYBACK_BASE_OVERRIDES = { 'Air': 1800 };

    var SPRITE_DROP_RATES = {
      'Water': { base: 13.92 }, 'Earth': { base: 13.92 }, 'Fire': { base: 13.92 }, 'Fishy': { base: 13.79 }, 'Air': { base: 0 },
      'Duck': { base: 5.22 }, 'Ghost': { base: 5.22 }, 'King': { base: 5.22 }, 'Demon': { base: 5.22 },
      'Aura': { base: 5.74, Gold: 0.07, Gummy: 0.04, Galaxy: 0.02 }, 'Striker': { base: 5.74 },
      'Dream': { base: 2.436 }, 'Punk': { base: 2.436 }, 'Boss': { base: 2.63 },
      'Seven': { base: 6.98, Gold: 0.31, Gummy: 0.23, Galaxy: 0.12, Holofoil: 0.05 },
      'Zero Point': { base: 1.044 }, 'Burnt Peanut': { base: 1.5 }, 'Grim': { base: 0.000098 },
      'Batman': { base: 2.23, Gold: 0.1, Gummy: 0.07, Galaxy: 0.04, Holofoil: 0.01 },
      'Vini Jr.': { base: 0 }, 'Pollo': { base: 0 }
    };
    var SECRET_SPRITES = ['Pollo', 'Vini Jr.'];

    function getBaseTier(identity) { return BASE_RARITY_TIER[identity.base] || 'Rare'; }
    function getBuybackCost(identity) {
      var tier = getBaseTier(identity);
      var costs = BUYBACK_COST[tier];
      if (identity.variant !== 'Base') return costs.special;
      if (BUYBACK_BASE_OVERRIDES[identity.base] !== undefined) return BUYBACK_BASE_OVERRIDES[identity.base];
      return costs.base;
    }
    function getDropRate(identity) {
      var rates = SPRITE_DROP_RATES[identity.base];
      if (!rates) return null;
      if (identity.variant === 'Base') return rates.base;
      if (rates[identity.variant] !== undefined) return rates[identity.variant];
      return null;
    }
    function formatPercent(p) {
      if (p === 0) return '0%';
      if (p < 0.01) return p.toFixed(6).replace(/0+$/, '').replace(/\.$/, '') + '%';
      return p.toFixed(2) + '%';
    }
    function buildRarityLabel(identity) {
      var tier = getBaseTier(identity);
      var percent = getDropRate(identity);
      var label = '';
      if (percent !== null && percent !== undefined) label += formatPercent(percent) + ' ';
      label += tier;
      if (identity.variant !== 'Base') label += ' Special';
      if (SECRET_SPRITES.indexOf(identity.base) !== -1) label += ' · Secret';
      return label;
    }

    // ===================== SEASON COUNTDOWN =====================
    var SEASON_END = new Date('2026-08-19T09:00:00-04:00');
    function tickCountdown() {
      var box = document.getElementById('countdownBox');
      var valueEl = document.getElementById('countdownValue');
      if (allCollected) {
        box.className = 'stat-box state-complete';
        valueEl.innerText = '🏅 No sweat, You got \'em all';
        return;
      }
      var diffMs = SEASON_END - new Date();
      if (diffMs <= 0) { box.className = 'stat-box state-red'; valueEl.innerText = 'Season has ended'; return; }
      var totalSeconds = Math.floor(diffMs / 1000);
      var days = Math.floor(totalSeconds / 86400);
      var hours = Math.floor((totalSeconds % 86400) / 3600);
      var minutes = Math.floor((totalSeconds % 3600) / 60);
      var seconds = totalSeconds % 60;
      valueEl.innerText = days + 'd ' + hours + 'h ' + minutes + 'm ' + seconds + 's';
      var state = 'state-green';
      if (days <= 5) state = 'state-red'; else if (days <= 15) state = 'state-yellow';
      box.className = 'stat-box ' + state;
    }
    setInterval(tickCountdown, 1000);

    // ===================== DATA LOAD =====================
    // Master sprite list comes straight from the original public source -
    // no separate hosting/sync step needed for that part.
    async function fetchMasterSprites() {
      var baseUrl = 'https://staticvacant.github.io/fnsprites/';
      try {
        var res = await fetch(baseUrl + 'sprites-data.js');
        if (res.ok) {
          var jsContent = await res.text();
          var objRegex = /\{\s*id:\s*"([^"]+)"\s*,\s*name:\s*"([^"]+)"\s*,\s*theme:\s*"([^"]+)"\s*,\s*rarity:\s*"([^"]+)"\s*,\s*unreleased:\s*(true|false)\s*\}/g;
          var match;
          var sprites = [];
          while ((match = objRegex.exec(jsContent)) !== null) {
            if (match[5] === 'true') continue; // skip unreleased
            var name = match[2];
            if (name.indexOf('Gem ') === 0) continue; // Gem variants were vaulted/never actually released
            sprites.push({
              name: name,
              imageUrl: baseUrl + 'sprites/' + match[1] + '.png',
              rarity: match[4]
            });
          }
          if (sprites.length > 0) return sprites;
        }
      } catch (e) {
        console.warn('Network note: Using built-in master sprites list:', e.message);
      }

      return [
        { name: 'Water Sprite', imageUrl: getSpriteImageUrl('Water Sprite', ''), rarity: 'Rare' },
        { name: 'Water Sprite Shade', imageUrl: getSpriteImageUrl('Water Sprite Shade', ''), rarity: 'Rare' },
        { name: 'Woodsprite', imageUrl: getSpriteImageUrl('Woodsprite', ''), rarity: 'Rare' },
        { name: 'Fire Sprite Shade', imageUrl: getSpriteImageUrl('Fire Sprite Shade', ''), rarity: 'Rare' },
        { name: 'Air Sprite Shade', imageUrl: getSpriteImageUrl('Air Sprite Shade', ''), rarity: 'Rare' },
        { name: 'Sprite Shenanigans', imageUrl: getSpriteImageUrl('Sprite Shenanigans', ''), rarity: 'Epic' },
        { name: 'Sprite Guardians', imageUrl: getSpriteImageUrl('Sprite Guardians', ''), rarity: 'Epic' },
        { name: 'Sprite Magic', imageUrl: getSpriteImageUrl('Sprite Magic', ''), rarity: 'Epic' },
        { name: 'Sprite Might', imageUrl: getSpriteImageUrl('Sprite Might', ''), rarity: 'Epic' },
        { name: 'Sprite Plushie', imageUrl: getSpriteImageUrl('Sprite Plushie', ''), rarity: 'Legendary' },
        { name: 'Champion of the Sprites', imageUrl: getSpriteImageUrl('Champion of the Sprites', ''), rarity: 'Epic' },
        { name: 'Sprite Mastery Pod', imageUrl: getSpriteImageUrl('Sprite Mastery Pod', ''), rarity: 'Mythic' },
        { name: 'Sprite Seat', imageUrl: getSpriteImageUrl('Sprite Seat', ''), rarity: 'Rare' },
        { name: 'Sprite Runners', imageUrl: getSpriteImageUrl('Sprite Runners', ''), rarity: 'Epic' },
        { name: 'I Heart Sprites', imageUrl: getSpriteImageUrl('I Heart Sprites', ''), rarity: 'Epic' },
        { name: 'Model Delta-7B Aethersprite', imageUrl: getSpriteImageUrl('Model Delta-7B Aethersprite', ''), rarity: 'Legendary' },
        { name: 'S.O.S (Save Our Sprites)', imageUrl: getSpriteImageUrl('S.O.S (Save Our Sprites)', ''), rarity: 'Mythic' },
        { name: 'Spritefall', imageUrl: getSpriteImageUrl('Spritefall', ''), rarity: 'Legendary' },
        { name: 'Sprite Soarer', imageUrl: getSpriteImageUrl('Sprite Soarer', ''), rarity: 'Mythic' },
        { name: 'Burnt Peanut', imageUrl: getSpriteImageUrl('Burnt Peanut', ''), rarity: 'Mythic' }
      ];
    }

    async function fetchMyProgress() {
      const activeUserId = povModeUser ? povModeUser.id : (currentUser ? currentUser.id : null);
      if (!activeUserId) return {};
      try {
        var { data, error } = await sb.from('progress').select('*').eq('user_id', activeUserId);
        if (error) { console.error(error); return {}; }
        var map = {};
        (data || []).forEach(function(row) {
          map[row.sprite_name] = { extracted: row.extracted, mastered: row.mastered, notes: row.notes || '' };
        });
        return map;
      } catch(e) {
        console.warn('Error fetching progress from Supabase:', e.message);
        return {};
      }
    }

    const LOCAL_IMAGES = {
      'Air Sprite Shade': 'images/Air_Sprite_Shade.png',
      'Champion of the Sprites': 'images/Champion_of_the_Sprites.png',
      'Fire Sprite Shade': 'images/Fire_Sprite_Shade.png',
      'I Heart Sprites': 'images/I_Heart_Sprites.png',
      'Model Delta-7B Aethersprite': 'images/Model_Delta-7B_Aethersprite.png',
      'S.O.S (Save Our Sprites)': 'images/S_O_S___Save_Our_Sprites_.png',
      'Sprite Guardians': 'images/Sprite_Guardians.png',
      'Sprite Magic': 'images/Sprite_Magic.png',
      'Sprite Mastery Pod': 'images/Sprite_Mastery_Pod.png',
      'Sprite Might': 'images/Sprite_Might.png',
      'Sprite Plushie': 'images/Sprite_Plushie.png',
      'Sprite Runners': 'images/Sprite_Runners.png',
      'Sprite Seat': 'images/Sprite_Seat.png',
      'Sprite Shenanigans': 'images/Sprite_Shenanigans.png',
      'Sprite Soarer': 'images/Sprite_Soarer.png',
      'Spritefall': 'images/Spritefall.png',
      'Water Sprite': 'images/Water_Sprite.png',
      'Water Sprite Shade': 'images/Water_Sprite_Shade.png',
      'Woodsprite': 'images/Woodsprite.png'
    };

    function getSpriteImageUrl(name, defaultUrl) {
      if (LOCAL_IMAGES[name]) return LOCAL_IMAGES[name];
      var cleanName = name.replace(/[^a-zA-Z0-9]/g, '_');
      for (var k in LOCAL_IMAGES) {
        if (k.toLowerCase() === name.toLowerCase()) return LOCAL_IMAGES[k];
      }
      return defaultUrl;
    }

    async function loadSprites() {
      const loader = document.getElementById('loader');
      if (loader) loader.style.display = 'block';
      loadWishlist();

      try {
        var master = await fetchMasterSprites();
        var progressMap = await fetchMyProgress();

        allSprites = master.map(function(s) {
          var p = progressMap[s.name] || { extracted: false, mastered: false, notes: '' };
          return {
            name: s.name,
            imageUrl: getSpriteImageUrl(s.name, s.imageUrl),
            rarity: s.rarity,
            extracted: !!p.extracted,
            mastered: !!p.mastered,
            notes: p.notes || ''
          };
        });
      } catch (err) {
        console.error('Error during loadSprites:', err);
      } finally {
        if (loader) loader.style.display = 'none';
        renderSpriteTableGrid();
        renderGrid();
        tickCountdown();
      }
    }

    async function saveProgress(sprite) {
      const activeUserId = povModeUser ? povModeUser.id : (currentUser ? currentUser.id : null);
      if (!activeUserId) {
        alert('Log in (or sign up) first so your progress has somewhere to live!');
        return false;
      }
      var { error } = await sb.from('progress').upsert({
        user_id: activeUserId,
        sprite_name: sprite.name,
        extracted: sprite.extracted,
        mastered: sprite.mastered,
        notes: sprite.notes
      }, { onConflict: 'user_id,sprite_name' });
      if (error) { alert('Could not save: ' + error.message); return false; }
      return true;
    }

    // ===================== FILTER / GROUPING ==================== 
    function setFilter(f) {
      currentFilter = f;
      document.querySelectorAll('.filter-chip').forEach(function(chip) {
        chip.classList.toggle('active', chip.dataset.filter === f);
      });
      renderGrid();
    }
    function matchesFilter(sprite) {
      if (currentFilter === 'extracted') return sprite.extracted;
      if (currentFilter === 'mastered') return sprite.mastered;
      if (currentFilter === 'untouched') return !sprite.extracted && !sprite.mastered;
      if (currentFilter === 'wishlist') return !!myWishlist[sprite.name];
      return true;
    }
    function matchesSearch(sprite, query) { return !query || sprite.name.toLowerCase().indexOf(query) !== -1; }
    function matchesRarityVariant(sprite) {
      var identity = parseSpriteIdentity(sprite.name);
      var raritySel = document.getElementById('raritySelect').value;
      var variantSel = document.getElementById('variantSelect').value;
      if (raritySel && getBaseTier(identity) !== raritySel) return false;
      if (variantSel && identity.variant !== variantSel) return false;
      return true;
    }

    function buildGroups() {
      var groupOrder = [], groups = {}, soloGroup = [];
      allSprites.forEach(function(sprite) {
        var identity = parseSpriteIdentity(sprite.name);
        if (SOLO_NO_VARIANT_SPRITES.indexOf(identity.base) !== -1) { soloGroup.push(sprite); return; }
        if (!groups[identity.base]) { groups[identity.base] = []; groupOrder.push(identity.base); }
        groups[identity.base].push(sprite);
      });
      return { groupOrder: groupOrder, groups: groups, soloGroup: soloGroup };
    }

    const TYPE_COLORS = {
      'Water': '#4fd1ff',
      'Earth': '#10b981',
      'Fire': '#ff5470',
      'Duck': '#ffcb3d',
      'Ghost': '#b98bff',
      'Dream': '#ff9f4f',
      'Demon': '#e11d48',
      'Punk': '#f59e0b',
      'King': '#eab308',
      'Zero Point': '#8b5cf6',
      'Fishy': '#38bdf8',
      'Striker': '#ef4444',
      'Aura': '#facc15',
      'Boss': '#dc2626',
      'Grim': '#94a3b8',
      'Air': '#a7f3d0',
      'Seven': '#3b82f6',
      'Batman': '#64748b',
      'Collabs': '#ec4899',
      'Fan Favorites (No Variants)': '#ec4899'
    };

    function renderGrid() {
      var query = document.getElementById('searchInput').value.trim().toLowerCase();
      var container = document.getElementById('gridContainer');
      container.innerHTML = '';

      if (viewingOwnerId) {
        var backBtn = document.createElement('button');
        backBtn.className = 'back-to-mine-btn';
        backBtn.innerText = '⬅ Back to My Collection';
        backBtn.onclick = backToMyCollection;
        container.appendChild(backBtn);

        var viewingNote = document.createElement('div');
        viewingNote.style.cssText = 'color:var(--muted); font-size:13px; margin-bottom:14px;';
        viewingNote.innerText = 'Viewing ' + viewingOwnerName.toUpperCase() + '\'s extracted sprites. Heart a sprite, add it to your Wishlist, or request a trade for it.';
        container.appendChild(viewingNote);
      }

      var data = buildGroups();
      var sections = [];

      data.groupOrder.forEach(function(base) {
        if (!activeTypeToggles.has(base)) return;
        var visible = data.groups[base].filter(function(s) { return matchesFilter(s) && matchesSearch(s, query) && matchesRarityVariant(s); });
        if (visible.length > 0) sections.push(buildGroupSection(base, visible));
      });
      if (activeTypeToggles.has('Collabs')) {
        var soloVisible = data.soloGroup.filter(function(s) { return matchesFilter(s) && matchesSearch(s, query) && matchesRarityVariant(s); });
        if (soloVisible.length > 0) sections.push(buildGroupSection('Fan Favorites (No Variants)', soloVisible));
      }

      if (sections.length === 0) {
        var emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.innerText = viewingOwnerId ? 'This player has not extracted any sprites yet.' : (currentFilter === 'wishlist' ? 'Your Wishlist is empty — click ❤️ Wishlist on any sprite to bookmark it!' : 'No sprites match that filter or active category toggles.');
        container.appendChild(emptyDiv);
      } else {
        sections.forEach(function(section, idx) {
          container.appendChild(section);
          if (idx < sections.length - 1) {
            var hr = document.createElement('hr'); hr.className = 'group-divider'; container.appendChild(hr);
          }
        });
      }
      updateProgress();
    }

    function buildGroupSection(title, sprites) {
      var wrap = document.createElement('div'); wrap.className = 'sprite-group';
      var header = document.createElement('div'); header.className = 'group-header-row';
      var color = TYPE_COLORS[title] || '#8b5cf6';
      var groupNameForBulk = (title === 'Fan Favorites (No Variants)') ? 'Collabs' : title;

      header.innerHTML = `
        <div class="category-divider" style="color:${color};">
          <span>— ${title} —</span>
        </div>
        <div class="group-header-title-wrap" style="margin-bottom:8px;">
          <span class="group-count-badge" style="background: ${color};">${sprites.length} Sprites</span>
        </div>
        <div class="group-header-actions" style="margin-bottom:12px;">
          <button class="bulk-btn extract-all" onclick="confirmBulkExtractGroup('${groupNameForBulk}')">⚡ Extract All</button>
          <button class="bulk-btn master-all" onclick="confirmBulkMasterGroup('${groupNameForBulk}')">👑 Master All</button>
        </div>
      `;
      wrap.appendChild(header);

      var grid = document.createElement('div'); grid.className = 'sprite-grid';
      sprites.forEach(function(sprite) { grid.appendChild(buildCard(sprite)); });
      wrap.appendChild(grid);
      return wrap;
    }

    function buildCard(sprite) {
      if (viewingOwnerId) return buildOtherPlayerCard(sprite);

      var identity = parseSpriteIdentity(sprite.name);
      var card = document.createElement('div');
      card.className = 'sprite-card' + (sprite.mastered ? ' mastered' : sprite.extracted ? ' extracted' : '');
      card.style.background = VARIANT_GRADIENTS[identity.variant] || VARIANT_GRADIENTS['Base'];
      card.onclick = function() { openModal(sprite); };

      var buyback = document.createElement('div'); buyback.className = 'buyback-badge';
      buyback.innerText = '🪙 ' + getBuybackCost(identity).toLocaleString();
      card.appendChild(buyback);

      if (sprite.mastered) {
        var crown = document.createElement('div'); crown.className = 'crown-icon'; crown.innerText = '👑';
        card.appendChild(crown);
      }
      var badgeRow = document.createElement('div'); badgeRow.className = 'badge-row';
      if (sprite.extracted) badgeRow.innerHTML = '<span class="badge-ex">EX</span>';
      card.appendChild(badgeRow);

      var thumbWrap = document.createElement('div'); thumbWrap.className = 'thumb-wrap';
      var img = document.createElement('img'); img.src = sprite.imageUrl; img.alt = sprite.name; img.loading = 'lazy';
      thumbWrap.appendChild(img); card.appendChild(thumbWrap);

      var name = document.createElement('div'); name.className = 'sprite-name'; name.innerText = sprite.name;
      card.appendChild(name);

      var toggleRow = document.createElement('div'); toggleRow.className = 'toggle-row';

      var exBtn = document.createElement('button');
      exBtn.className = 'icon-toggle-btn text-btn ex-btn' + (sprite.extracted ? ' on' : '');
      exBtn.innerText = sprite.extracted ? '✓ Extracted' : 'Extracted';

      var mBtn = document.createElement('button');
      mBtn.className = 'icon-toggle-btn text-btn mst-btn' + (sprite.mastered ? ' on' : '');
      mBtn.disabled = !sprite.extracted;
      mBtn.title = sprite.extracted ? '' : 'Extract this sprite first';
      mBtn.innerText = sprite.mastered ? '★ Mastered' : 'Mastered';

      exBtn.onclick = async function(e) {
        e.stopPropagation();
        var newExtracted = !sprite.extracted;
        var newMastered = newExtracted ? sprite.mastered : false;
        await applyStatusChange(sprite, newExtracted, newMastered);
      };
      mBtn.onclick = async function(e) {
        e.stopPropagation();
        if (mBtn.disabled) return;
        await applyStatusChange(sprite, sprite.extracted, !sprite.mastered);
      };

      var wishBtn = document.createElement('button');
      wishBtn.className = 'wishlist-btn' + (myWishlist[sprite.name] ? ' on' : '');
      wishBtn.innerText = myWishlist[sprite.name] ? '❤️ Wishlist' : '🤍 Wishlist';
      wishBtn.onclick = function(e) { e.stopPropagation(); toggleWishlist(sprite); };

      var noteBtn = document.createElement('button');
      noteBtn.className = 'note-btn' + (sprite.notes ? ' has-note' : '');
      noteBtn.innerText = '📝';
      noteBtn.onclick = function(e) { e.stopPropagation(); openNoteModal(sprite); };

      toggleRow.appendChild(exBtn); toggleRow.appendChild(mBtn); toggleRow.appendChild(wishBtn); toggleRow.appendChild(noteBtn);
      card.appendChild(toggleRow);
      return card;
    }

    async function loadSprites() {
      loadWishlist();
      document.getElementById('loader').style.display = 'block';
      var master = await fetchMasterSprites();
      var progressMap = await fetchMyProgress();

      allSprites = master.map(function(s) {
        var p = progressMap[s.name] || { extracted: false, mastered: false, notes: '' };
        return {
          name: s.name,
          imageUrl: getSpriteImageUrl(s.name, s.imageUrl),
          rarity: s.rarity,
          extracted: !!p.extracted,
          mastered: !!p.mastered,
          notes: p.notes || ''
        };
      });

      document.getElementById('loader').style.display = 'none';
      renderSpriteTableGrid();
      renderGrid();
      tickCountdown();
    }

    async function applyStatusChange(sprite, newExtracted, newMastered) {
      var prevExtracted = sprite.extracted, prevMastered = sprite.mastered;
      sprite.extracted = newExtracted; sprite.mastered = newMastered;
      var ok = await saveProgress(sprite);
      if (!ok) { sprite.extracted = prevExtracted; sprite.mastered = prevMastered; }
      renderGrid(); tickCountdown();
    }

    function updateProgress() {
      var total = allSprites.length;
      var extractedCount = allSprites.filter(function(s) { return s.extracted; }).length;
      var masteredCount = allSprites.filter(function(s) { return s.mastered; }).length;
      document.getElementById('progressValue').innerText = extractedCount + ' / ' + total;
      var exBar = document.getElementById('extractedBar');
      var mstBar = document.getElementById('masteredBar');
      if (exBar) exBar.style.width = (total ? (extractedCount / total * 100) : 0) + '%';
      if (mstBar) mstBar.style.width = (total ? (masteredCount / total * 100) : 0) + '%';
      var exLabel = document.getElementById('extractedLabel');
      var mstLabel = document.getElementById('masteredLabel');
      if (exLabel) exLabel.innerText = extractedCount + '/' + total;
      if (mstLabel) mstLabel.innerText = masteredCount + '/' + total;
      allCollected = total > 0 && extractedCount === total;
    }

    // ===================== INFO MODAL =====================
    function openModal(sprite) {
      var identity = parseSpriteIdentity(sprite.name);
      document.getElementById('modalImg').src = sprite.imageUrl;
      document.getElementById('modalName').innerText = sprite.name;
      document.getElementById('modalVariantBadge').innerText = identity.variant + ' variant · ' + identity.base + ' sprite';
      document.getElementById('modalAbility').innerText = SPRITE_ABILITIES[identity.base] || 'Ability details TBD.';
      document.getElementById('modalBonus').innerText = VARIANT_BONUS[identity.variant] || VARIANT_BONUS['Base'];
      document.getElementById('modalNote').innerText = sprite.notes || 'No note yet — tap 📝 on the card to add one.';
      var tier = getBaseTier(identity);
      var rarityEl = document.getElementById('modalRarity');
      rarityEl.innerText = buildRarityLabel(identity);
      rarityEl.style.background = RARITY_COLORS[tier] || '#8a90ad';
      document.getElementById('modalOverlay').classList.add('open');
    }
    function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }
    function closeModalIfBackdrop(e) { if (e.target.id === 'modalOverlay') closeModal(); }

    // ===================== NOTE MODAL =====================
    function openNoteModal(sprite) {
      currentNoteSprite = sprite;
      document.getElementById('noteModalTitle').innerText = (sprite.notes ? 'Edit note — ' : 'Add a note — ') + sprite.name;
      document.getElementById('noteTextarea').value = sprite.notes || '';
      document.getElementById('noteModalOverlay').classList.add('open');
    }
    function closeNoteModal() { document.getElementById('noteModalOverlay').classList.remove('open'); currentNoteSprite = null; }
    function closeNoteModalIfBackdrop(e) { if (e.target.id === 'noteModalOverlay') closeNoteModal(); }
    async function saveNote() {
      if (!currentNoteSprite) return;
      var sprite = currentNoteSprite;
      var prevNotes = sprite.notes;
      sprite.notes = document.getElementById('noteTextarea').value;
      var ok = await saveProgress(sprite);
      if (!ok) { sprite.notes = prevNotes; return; }
      closeNoteModal();
      renderGrid();
    }

    // ===================== OTHER PLAYER CARD (Browse Players view) =====================
    function buildOtherPlayerCard(sprite) {
      var identity = parseSpriteIdentity(sprite.name);
      var key = viewingOwnerId + '::' + sprite.name;
      var hearted = !!myHeartsAndRequests.hearts[key];
      var requested = !!myHeartsAndRequests.requests[key];
      var isWishlisted = !!myWishlist[sprite.name];

      var card = document.createElement('div');
      card.className = 'sprite-card extracted';
      card.style.background = VARIANT_GRADIENTS[identity.variant] || VARIANT_GRADIENTS['Base'];
      card.onclick = function() { openModal(sprite); };

      var buyback = document.createElement('div'); buyback.className = 'buyback-badge';
      buyback.innerText = '🪙 ' + getBuybackCost(identity).toLocaleString();
      card.appendChild(buyback);

      if (sprite.mastered) {
        var crown = document.createElement('div'); crown.className = 'crown-icon'; crown.innerText = '👑';
        card.appendChild(crown);
      }

      var thumbWrap = document.createElement('div'); thumbWrap.className = 'thumb-wrap';
      var img = document.createElement('img'); img.src = sprite.imageUrl; img.alt = sprite.name; img.loading = 'lazy';
      thumbWrap.appendChild(img); card.appendChild(thumbWrap);

      var name = document.createElement('div'); name.className = 'sprite-name'; name.innerText = sprite.name;
      card.appendChild(name);

      var toggleRow = document.createElement('div'); toggleRow.className = 'toggle-row';

      var wishBtn = document.createElement('button');
      wishBtn.className = 'wishlist-btn' + (isWishlisted ? ' on' : '');
      wishBtn.innerText = isWishlisted ? '❤️ Wishlist' : '🤍 Wishlist';
      wishBtn.onclick = function(e) { e.stopPropagation(); toggleWishlist(sprite); };

      var heartBtn = document.createElement('button');
      heartBtn.className = 'heart-btn' + (hearted ? ' on' : '');
      heartBtn.innerText = hearted ? '❤️ Loved' : '🤍 Heart';
      heartBtn.onclick = async function(e) { e.stopPropagation(); await toggleHeart(sprite); };

      var reqBtn = document.createElement('button');
      reqBtn.className = 'request-btn' + (requested ? ' on' : '');
      reqBtn.innerText = requested ? '✓ Requested' : '🔍 Request';
      reqBtn.disabled = requested;
      reqBtn.onclick = async function(e) { e.stopPropagation(); await sendRequest(sprite); };

      toggleRow.appendChild(wishBtn); toggleRow.appendChild(heartBtn); toggleRow.appendChild(reqBtn);
      card.appendChild(toggleRow);
      return card;
    }

    async function toggleHeart(sprite) {
      if (!currentUser) { alert('Log in first to heart sprites!'); return; }
      var key = viewingOwnerId + '::' + sprite.name;
      if (myHeartsAndRequests.hearts[key]) {
        await sb.from('sprite_hearts').delete()
          .eq('user_id', currentUser.id).eq('owner_user_id', viewingOwnerId).eq('sprite_name', sprite.name);
        delete myHeartsAndRequests.hearts[key];
      } else {
        await sb.from('sprite_hearts').insert({ user_id: currentUser.id, owner_user_id: viewingOwnerId, sprite_name: sprite.name });
        myHeartsAndRequests.hearts[key] = true;
      }
      renderGrid();
    }

    async function sendRequest(sprite) {
      if (!currentUser) { alert('Log in first to send a request!'); return; }
      var key = viewingOwnerId + '::' + sprite.name;
      if (myHeartsAndRequests.requests[key]) return;
      var { error } = await sb.from('sprite_requests').insert({
        requester_user_id: currentUser.id, owner_user_id: viewingOwnerId, sprite_name: sprite.name, status: 'pending'
      });
      if (error) { alert('Could not send request: ' + error.message); return; }
      myHeartsAndRequests.requests[key] = true;
      renderGrid();
    }

    // ===================== BROWSE PLAYERS =====================
    async function openBrowsePlayers() {
      document.getElementById('browsePlayersOverlay').classList.add('open');
      var container = document.getElementById('playerListContainer');
      container.innerHTML = '<div class="player-empty">Loading players...</div>';

      var { data, error } = await sb.from('profiles').select('*').order('username');
      if (error) {
        container.innerHTML = '<div class="player-empty">Could not load players: ' + error.message + '</div>';
        return;
      }
      var others = (data || []).filter(function(p) { return !currentUser || p.id !== currentUser.id; });
      if (others.length === 0) {
        container.innerHTML = '<div class="player-empty">No other players have joined yet. Once your kids/friends sign up, they will show up here.</div>';
        return;
      }
      container.innerHTML = '';
      others.forEach(function(p) {
        var row = document.createElement('div'); row.className = 'player-row';
        var avatarUrl = p.avatar_url || 'https://placehold.co/80x80/1e293b/8b5cf6?text=U';
        
        var left = document.createElement('div');
        left.style.cssText = 'display:flex; align-items:center; gap:12px; cursor:pointer; flex:1;';
        left.onclick = function() { viewPlayerProfile(p.id, p.username || 'Player'); };
        left.innerHTML = '<img src="' + avatarUrl + '" alt="' + p.username + '"><div class="player-row-name">' + (p.username || 'Player').toUpperCase() + '</div>';
        
        row.appendChild(left);

        if (isAdminRole || isModeratorRole) {
          var povBtn = document.createElement('button');
          povBtn.className = 'btn-sm';
          povBtn.style.cssText = 'background:rgba(139,92,246,0.3); color:#fff; font-size:11px;';
          povBtn.innerText = '👁️ POV';
          povBtn.onclick = function(e) { e.stopPropagation(); viewAsUserPOV(p.username || 'Player'); };
          row.appendChild(povBtn);
        }

        container.appendChild(row);
      });
    }

    function closeBrowsePlayers() { document.getElementById('browsePlayersOverlay').classList.remove('open'); }
    function closeBrowsePlayersIfBackdrop(e) { if (e.target.id === 'browsePlayersOverlay') closeBrowsePlayers(); }

    async function viewPlayerProfile(ownerId, username) {
      closeBrowsePlayers();
      viewingOwnerId = ownerId;
      viewingOwnerName = username;

      document.getElementById('loader').style.display = 'block';
      var master = await fetchMasterSprites();

      var { data: progressRows } = await sb.from('progress').select('*').eq('user_id', ownerId).eq('extracted', true);
      var progressMap = {};
      (progressRows || []).forEach(function(row) { progressMap[row.sprite_name] = row; });

      allSprites = master
        .filter(function(s) { return !!progressMap[s.name]; }) // only show sprites they've actually extracted
        .map(function(s) {
          var p = progressMap[s.name];
          return { name: s.name, imageUrl: s.imageUrl, rarity: s.rarity, extracted: true, mastered: !!p.mastered, notes: '' };
        });

      // Load my own hearts/requests aimed at this owner so button states are correct
      myHeartsAndRequests = { hearts: {}, requests: {} };
      if (currentUser) {
        var { data: hearts } = await sb.from('sprite_hearts').select('sprite_name').eq('user_id', currentUser.id).eq('owner_user_id', ownerId);
        (hearts || []).forEach(function(h) { myHeartsAndRequests.hearts[ownerId + '::' + h.sprite_name] = true; });
        var { data: reqs } = await sb.from('sprite_requests').select('sprite_name').eq('requester_user_id', currentUser.id).eq('owner_user_id', ownerId);
        (reqs || []).forEach(function(r) { myHeartsAndRequests.requests[ownerId + '::' + r.sprite_name] = true; });
      }

      document.getElementById('loader').style.display = 'none';
      renderGrid();
    }

    function backToMyCollection() {
      viewingOwnerId = null;
      viewingOwnerName = '';
      loadSprites();
    }

    // ===================== EDIT PROFILE =====================
    function openEditProfileModal() {
      var current = document.getElementById('displayName').innerText;
      document.getElementById('editUsernameInput').value = current;
      document.getElementById('editProfileOverlay').classList.add('open');
    }
    function closeEditProfileModal() { document.getElementById('editProfileOverlay').classList.remove('open'); }
    function closeEditProfileIfBackdrop(e) { if (e.target.id === 'editProfileOverlay') closeEditProfileModal(); }

    async function saveProfileEdits() {
      var newUsername = document.getElementById('editUsernameInput').value.trim();
      if (!newUsername) { alert('Enter a username.'); return; }
      if (!currentUser) return;

      var { error } = await sb.auth.updateUser({ data: { username: newUsername } });
      if (error) { alert('Could not update username: ' + error.message); return; }

      await upsertMyProfile(newUsername);
      document.getElementById('displayName').innerText = newUsername.toUpperCase();
      closeEditProfileModal();
    }

    // ===================== INIT =====================
    (async function init() {
      loadAdminState();
      renderSiteSlides();
      await restoreSession();
      checkAdminStatus();
      await loadSprites();
    })();

// ===================== EXPOSE TO WINDOW FOR INLINE HTML HANDLERS =====================
