// ========== Supabase Configuration ==========
// 替换为你自己的 Supabase 项目信息
const SUPABASE_URL = 'https://ruexcenfdoikfeesjaad.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_boaa_4qYDh7eduHkxhakmw_MTo2Ex6E';

// ========== Supabase Client ==========
let supabase;

function initSupabase() {
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
}

// ========== State ==========
let currentUser = null;
let allPhotos = [];
let currentFilter = 'latest';
let currentSort = 'created_at';

// ========== Init ==========
document.addEventListener('DOMContentLoaded', async () => {
  initSupabase();

  // Check auth state
  const { data: { session } } = await supabase.auth.getSession();
  currentUser = session?.user || null;

  updateNavUI();
  await loadPhotos();
});

// ========== Auth ==========
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('auth-error');

  errorEl.classList.remove('show');

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    errorEl.textContent = error.message === 'Invalid login credentials' ? '邮箱或密码错误' : error.message;
    errorEl.classList.add('show');
    return;
  }

  currentUser = data.user;
  window.location.href = 'index.html';
}

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('auth-error');

  errorEl.classList.remove('show');

  if (password.length < 6) {
    errorEl.textContent = '密码至少6位';
    errorEl.classList.add('show');
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } }
  });

  if (error) {
    errorEl.textContent = error.message;
    errorEl.classList.add('show');
    return;
  }

  // Insert profile
  if (data.user) {
    await supabase.from('profiles').insert({
      id: data.user.id,
      username,
      email
    });
  }

  showToast('注册成功！请查收邮箱验证后登录', 'success');
  setTimeout(() => window.location.href = 'login.html', 1500);
}

async function handleLogout() {
  await supabase.auth.signOut();
  currentUser = null;
  updateNavUI();
  window.location.href = 'index.html';
}

// ========== Nav UI ==========
function updateNavUI() {
  const userSection = document.getElementById('nav-user');
  const guestSection = document.getElementById('nav-guest');
  const userAvatar = document.getElementById('nav-avatar');
  const userName = document.getElementById('nav-username');

  if (currentUser) {
    if (userSection) userSection.style.display = 'flex';
    if (guestSection) guestSection.style.display = 'none';
    if (userAvatar) {
      const name = currentUser.user_metadata?.username || currentUser.email[0].toUpperCase();
      userAvatar.textContent = name[0].toUpperCase();
    }
    if (userName) {
      userName.textContent = currentUser.user_metadata?.username || currentUser.email.split('@')[0];
    }
  } else {
    if (userSection) userSection.style.display = 'none';
    if (guestSection) guestSection.style.display = 'flex';
  }
}

// ========== Photos ==========
async function loadPhotos() {
  const container = document.getElementById('photo-grid');
  if (!container) return;

  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  let query = supabase
    .from('photos')
    .select('*, profiles:profiles(username), ratings(rating), votes(id, vote_type)')
    .eq('is_approved', true);

  // Sort
  if (currentSort === 'rating') {
    query = query.order('avg_rating', { ascending: false, nullsFirst: false });
  } else if (currentSort === 'votes') {
    query = query.order('vote_count', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">🌅</div>
        <h3>还没有夕阳照片</h3>
        <p>成为第一个分享夕阳的人吧！</p>
      </div>`;
    return;
  }

  allPhotos = data;
  renderPhotos(data);
}

function renderPhotos(photos) {
  const container = document.getElementById('photo-grid');
  container.innerHTML = '';

  photos.forEach(photo => {
    const username = photo.profiles?.username || '匿名';
    const avgRating = photo.ratings?.length
      ? (photo.ratings.reduce((s, r) => s + r.rating, 0) / photo.ratings.length).toFixed(1)
      : '—';
    const upVotes = photo.votes?.filter(v => v.vote_type === 'up').length || 0;
    const downVotes = photo.votes?.filter(v => v.vote_type === 'down').length || 0;

    const card = document.createElement('div');
    card.className = 'photo-card';
    card.onclick = () => openPhotoDetail(photo.id);
    card.innerHTML = `
      <img src="${photo.image_url}" alt="${photo.title || '夕阳'}" loading="lazy">
      <div class="card-info">
        <div class="card-user">
          <div class="card-avatar">${username[0].toUpperCase()}</div>
          <span class="card-username">${username}</span>
        </div>
        <div class="card-stats">
          <span><span class="icon">⭐</span> ${avgRating}</span>
          <span><span class="icon">👍</span> ${upVotes}</span>
          <span><span class="icon">👎</span> ${downVotes}</span>
        </div>
      </div>`;
    container.appendChild(card);
  });
}

// ========== Photo Detail Modal ==========
async function openPhotoDetail(photoId) {
  const { data: photo, error } = await supabase
    .from('photos')
    .select('*, profiles:profiles(username), ratings(rating, user_id), votes(user_id, vote_type)')
    .eq('id', photoId)
    .single();

  if (error || !photo) { showToast('加载失败', 'error'); return; }

  const username = photo.profiles?.username || '匿名';
  const avgRating = photo.ratings?.length
    ? (photo.ratings.reduce((s, r) => s + r.rating, 0) / photo.ratings.length).toFixed(1)
    : '—';
  const ratingCount = photo.ratings?.length || 0;

  // Find current user's rating
  let userRating = 0;
  let userVote = null;
  if (currentUser) {
    const myRating = photo.ratings?.find(r => r.user_id === currentUser.id);
    userRating = myRating?.rating || 0;
    const myVote = photo.votes?.find(v => v.user_id === currentUser.id);
    userVote = myVote?.vote_type || null;
  }

  const modal = document.getElementById('photo-modal');
  const modalContent = document.getElementById('modal-content');

  modalContent.innerHTML = `
    <button class="modal-close" onclick="closePhotoDetail()">✕</button>
    <img class="modal-image" src="${photo.image_url}" alt="${photo.title || '夕阳'}">
    <div class="modal-body">
      <div class="modal-user">
        <div class="modal-avatar">${username[0].toUpperCase()}</div>
        <div>
          <div class="modal-username">${username}</div>
          <div class="modal-date">${new Date(photo.created_at).toLocaleDateString('zh-CN')}</div>
        </div>
      </div>
      ${photo.title ? `<h3 style="margin-bottom:8px">${photo.title}</h3>` : ''}
      ${photo.description ? `<p class="modal-description">${photo.description}</p>` : ''}

      <div class="rating-section">
        <div>
          <div class="stars" id="detail-stars">
            ${[1,2,3,4,5].map(i => `
              <span class="star ${i <= userRating ? 'active' : ''}" data-rating="${i}"
                onclick="ratePhoto(${photoId}, ${i})"
                onmouseenter="hoverStars(${i})"
                onmouseleave="unhoverStars(${userRating})">★</span>
            `).join('')}
          </div>
        </div>
        <div class="rating-info">
          <div class="rating-average">${avgRating}</div>
          <div class="rating-count">${ratingCount} 人评分</div>
        </div>
      </div>

      <div class="vote-section">
        <button class="vote-btn ${userVote === 'up' ? 'voted' : ''}"
          onclick="votePhoto(${photoId}, 'up')">
          <span class="icon">👍</span> ${photo.votes?.filter(v => v.vote_type === 'up').length || 0}
        </button>
        <button class="vote-btn ${userVote === 'down' ? 'voted' : ''}"
          onclick="votePhoto(${photoId}, 'down')">
          <span class="icon">👎</span> ${photo.votes?.filter(v => v.vote_type === 'down').length || 0}
        </button>
      </div>
    </div>`;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closePhotoDetail() {
  const modal = document.getElementById('photo-modal');
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

// ========== Star Hover ==========
function hoverStars(n) {
  document.querySelectorAll('#detail-stars .star').forEach((star, i) => {
    star.classList.toggle('hover', i < n);
  });
}

function unhoverStars(userRating) {
  document.querySelectorAll('#detail-stars .star').forEach((star, i) => {
    star.classList.remove('hover');
    star.classList.toggle('active', i < userRating);
  });
}

// ========== Rate ==========
async function ratePhoto(photoId, rating) {
  if (!currentUser) { showToast('请先登录', 'info'); return; }

  // Upsert rating
  const { error } = await supabase
    .from('ratings')
    .upsert({
      photo_id: photoId,
      user_id: currentUser.id,
      rating
    }, { onConflict: 'photo_id,user_id' });

  if (error) { showToast('评分失败', 'error'); return; }

  // Update photo avg_rating
  const { data: allRatings } = await supabase.from('ratings').select('rating').eq('photo_id', photoId);
  if (allRatings) {
    const avg = allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length;
    await supabase.from('photos').update({ avg_rating: Math.round(avg * 10) / 10 }).eq('id', photoId);
  }

  showToast('评分成功 ⭐', 'success');
  openPhotoDetail(photoId); // Refresh
}

// ========== Vote ==========
async function votePhoto(photoId, voteType) {
  if (!currentUser) { showToast('请先登录', 'info'); return; }

  // Check existing vote
  const { data: existing } = await supabase
    .from('votes')
    .select('id, vote_type')
    .eq('photo_id', photoId)
    .eq('user_id', currentUser.id)
    .single();

  if (existing) {
    if (existing.vote_type === voteType) {
      // Remove vote
      await supabase.from('votes').delete().eq('id', existing.id);
    } else {
      // Change vote
      await supabase.from('votes').update({ vote_type: voteType }).eq('id', existing.id);
    }
  } else {
    await supabase.from('votes').insert({
      photo_id: photoId,
      user_id: currentUser.id,
      vote_type: voteType
    });
  }

  // Update vote count
  const { data: allVotes } = await supabase.from('votes').select('vote_type').eq('photo_id', photoId);
  if (allVotes) {
    const upCount = allVotes.filter(v => v.vote_type === 'up').length;
    const downCount = allVotes.filter(v => v.vote_type === 'down').length;
    await supabase.from('photos').update({ vote_count: upCount - downCount }).eq('id', photoId);
  }

  showToast(voteType === 'up' ? '👍 已赞' : '👎 已踩', 'success');
  openPhotoDetail(photoId);
}

// ========== Upload ==========
async function handleUpload(e) {
  e.preventDefault();

  if (!currentUser) { showToast('请先登录', 'info'); return; }

  const fileInput = document.getElementById('photo-file');
  const file = fileInput.files[0];
  const title = document.getElementById('photo-title').value.trim();
  const description = document.getElementById('photo-desc').value.trim();

  if (!file) { showToast('请选择图片', 'error'); return; }

  // Validate file
  if (!file.type.startsWith('image/')) { showToast('只能上传图片文件', 'error'); return; }
  if (file.size > 5 * 1024 * 1024) { showToast('图片不能超过5MB', 'error'); return; }

  const submitBtn = document.getElementById('upload-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = '上传中...';

  try {
    // Upload to Supabase Storage
    const ext = file.name.split('.').pop();
    const fileName = `${currentUser.id}/${Date.now()}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('sunset-photos')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('sunset-photos')
      .getPublicUrl(fileName);

    // Insert photo record
    const { error: insertError } = await supabase.from('photos').insert({
      user_id: currentUser.id,
      image_url: urlData.publicUrl,
      title: title || null,
      description: description || null,
      is_approved: true
    });

    if (insertError) throw insertError;

    showToast('上传成功！🌅', 'success');
    setTimeout(() => window.location.href = 'index.html', 1000);
  } catch (err) {
    showToast('上传失败：' + err.message, 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = '发布';
  }
}

// File preview
function previewFile(input) {
  const file = input.files[0];
  const preview = document.getElementById('upload-preview');
  const previewImg = document.getElementById('preview-img');

  if (file && file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      preview.classList.add('show');
    };
    reader.readAsDataURL(file);
  } else {
    preview.classList.remove('show');
  }
}

// ========== Leaderboard ==========
async function loadLeaderboard() {
  const container = document.getElementById('leaderboard-list');
  if (!container) return;

  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  const { data, error } = await supabase
    .from('photos')
    .select('*, profiles:profiles(username)')
    .eq('is_approved', true)
    .order('avg_rating', { ascending: false, nullsFirst: false })
    .limit(20);

  if (error || !data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">🏆</div>
        <h3>暂无排行数据</h3>
        <p>有评分后自动生成排行榜</p>
      </div>`;
    return;
  }

  container.innerHTML = '';
  data.forEach((photo, index) => {
    const username = photo.profiles?.username || '匿名';
    const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';

    const item = document.createElement('div');
    item.className = 'leaderboard-item';
    item.onclick = () => openPhotoDetail(photo.id);
    item.innerHTML = `
      <div class="leaderboard-rank ${rankClass}">${index + 1}</div>
      <img class="leaderboard-thumb" src="${photo.image_url}" alt="">
      <div class="leaderboard-info">
        <div class="leaderboard-title">${photo.title || '无标题'}</div>
        <div class="leaderboard-meta">
          <span>📷 ${username}</span>
          <span>📅 ${new Date(photo.created_at).toLocaleDateString('zh-CN')}</span>
        </div>
      </div>
      <div class="leaderboard-score">
        <span class="icon">⭐</span> ${photo.avg_rating || '—'}
      </div>`;
    container.appendChild(item);
  });
}

// ========== Sorting ==========
function setSort(sortBy) {
  currentSort = sortBy;
  loadPhotos();
}

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');

  if (filter === 'leaderboard') {
    document.getElementById('photo-grid').style.display = 'none';
    document.getElementById('leaderboard-section').style.display = 'block';
    loadLeaderboard();
  } else {
    document.getElementById('photo-grid').style.display = '';
    document.getElementById('leaderboard-section').style.display = 'none';
    loadPhotos();
  }
}

// ========== Toast ==========
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    closePhotoDetail();
  }
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePhotoDetail();
});
