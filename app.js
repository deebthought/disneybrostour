// ==========================================
// 1) MARKDOWN & METADATA PARSER
// ==========================================
function parseTourMarkdown(markdownText) {
  const sections = markdownText.split(/\r?\n---\r?\n/);
  
  // Parse global config (first section)
  const configSection = sections[0];
  const globalConfig = {};
  let currentKey = null;
  
  configSection.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (match) {
      currentKey = match[1];
      globalConfig[currentKey] = match[2].trim();
    } else if (currentKey && line.startsWith('  ')) {
      globalConfig[currentKey] += '\n' + line.trim();
    }
  });

  const stops = [];
  
  // Parse stops
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) continue;
    
    const lines = section.split(/\r?\n/);
    let title = "";
    const stopData = {
      photos: []
    };
    
    let lineIdx = 0;
    
    // Parse Title
    if (lines[lineIdx] && lines[lineIdx].startsWith('# Stop:')) {
      title = lines[lineIdx].substring(7).trim();
      lineIdx++;
    }
    
    // Parse metadata
    let inPhotos = false;
    while (lineIdx < lines.length) {
      const line = lines[lineIdx];
      
      // If we reach an empty line or a line that doesn't look like key-value or list item, stop metadata parsing
      if (line.trim() === "") {
        lineIdx++;
        break;
      }
      
      const keyValMatch = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
      if (keyValMatch) {
        const key = keyValMatch[1];
        const val = keyValMatch[2].trim();
        if (key === 'photos') {
          inPhotos = true;
        } else {
          inPhotos = false;
          if (key === 'lat' || key === 'lng') {
            if (!stopData.location) stopData.location = {};
            stopData.location[key] = parseFloat(val);
          } else {
            stopData[key] = val === 'null' ? null : val;
          }
        }
      } else if (inPhotos && line.trim().startsWith('-')) {
        const photoPath = line.trim().replace(/^-\s*/, '');
        stopData.photos.push(photoPath);
      } else {
        // Not a metadata line, break to transcript
        break;
      }
      lineIdx++;
    }
    
    // The rest is the transcript
    const transcriptLines = lines.slice(lineIdx);
    const transcript = transcriptLines.join('\n').trim();
    
    stopData.title = title;
    stopData.transcript = transcript || null;
    
    stops.push(stopData);
  }
  
  return { config: globalConfig, stops };
}

// Global variables to hold active tour data
let TOUR_CONFIG = {};
let TOUR_STOPS = [];

// ==========================================
// 2) ROUTER & APP INITIALIZATION
// ==========================================
const app = document.getElementById('app');

const route = () => {
  // Scroll to top on route change
  window.scrollTo(0, 0);
  
  const h = location.hash.slice(1) || '/';
  const [_, seg, id] = h.split('/');
  if (!seg) return renderHome();
  if (seg === 'stop' && id) return renderStop(id);
  renderHome();
};

// Initialize the application by loading tour.md
async function initApp() {
  try {
    const response = await fetch('tour.md');
    if (!response.ok) {
      throw new Error(`Failed to load tour.md: ${response.status} ${response.statusText}`);
    }
    const markdownText = await response.text();
    const parsed = parseTourMarkdown(markdownText);
    
    TOUR_CONFIG = parsed.config;
    TOUR_STOPS = parsed.stops;

    // Apply global configurations
    if (TOUR_CONFIG.title) {
      document.title = TOUR_CONFIG.title;
    }
    if (TOUR_CONFIG.headerTitle) {
      const hdrTitleEl = document.querySelector('.hdrtitle');
      if (hdrTitleEl) hdrTitleEl.textContent = TOUR_CONFIG.headerTitle;
    }
    if (TOUR_CONFIG.warningText) {
      const warningEl = document.getElementById('footer-warning');
      if (warningEl) warningEl.textContent = TOUR_CONFIG.warningText;
    }
    if (TOUR_CONFIG.attributionHtml) {
      const attributionEl = document.getElementById('footer-attribution');
      if (attributionEl) attributionEl.innerHTML = TOUR_CONFIG.attributionHtml;
    }
    if (TOUR_CONFIG.logoImage) {
      const logoImgEl = document.getElementById('footer-logo-img');
      if (logoImgEl) {
        logoImgEl.src = TOUR_CONFIG.logoImage;
        logoImgEl.alt = TOUR_CONFIG.logoAlt || "";
      }
    }
    if (TOUR_CONFIG.logoUrl) {
      const logoLinkEl = document.getElementById('footer-logo-link');
      if (logoLinkEl) logoLinkEl.href = TOUR_CONFIG.logoUrl;
    }

    // Apply dynamic theme colors if specified in tour.md
    if (TOUR_CONFIG.accentColor) {
      document.documentElement.style.setProperty('--accent', TOUR_CONFIG.accentColor);
    }
    if (TOUR_CONFIG.secondaryColor) {
      document.documentElement.style.setProperty('--secondary', TOUR_CONFIG.secondaryColor);
    }

    // Bind hashchange router
    window.addEventListener('hashchange', route);
    
    // Initial route run
    route();
  } catch (error) {
    console.error('Error initializing tour:', error);
    app.innerHTML = `
      <section class="grid">
        <div class="card" style="border-color: #dc3545;">
          <div class="headline" style="color: #dc3545;">Failed to Load Tour</div>
          <div class="muted">
            <p>We encountered an error loading the tour details:</p>
            <code>${error.message}</code>
            <p style="margin-top: 15px; font-size: 14px;">
              Note: To load tour data from <code>tour.md</code>, this page must be served through an HTTP server (e.g. VS Code Live Server, python http server, etc.) rather than opened directly as a file.
            </p>
          </div>
        </div>
      </section>
    `;
  }
}

// ==========================================
// 3) HELPERS
// ==========================================
const getStop = (id) => TOUR_STOPS.find(s => s.id === id);

const gmapsTo = (stop) => {
  if (!stop || !stop.location || isNaN(stop.location.lat) || isNaN(stop.location.lng)) return '#';
  const {lat,lng} = stop.location; 
  const dest = encodeURIComponent(`${lat},${lng}`);
  return `https://www.google.com/maps/dir/?api=1&origin=My+Location&destination=${dest}&travelmode=walking`;
};

const fmt = (sec)=>{ if(!isFinite(sec)) return '0:00'; const m=Math.floor(sec/60); const s=String(Math.floor(sec%60)).padStart(2,'0'); return `${m}:${s}`; };

// ==========================================
// 4) VIEWS
// ==========================================
function renderHome(){
  app.innerHTML = `
    <section class="grid">
      <div class="card">
        <div class="headline">${TOUR_CONFIG.title || 'Welcome to the Tour!'}</div>
        <div class="muted">${TOUR_CONFIG.description || ''}</div>
      </div>
      <ul class="list" id="stoplist"></ul>
    </section>
  `;
  const ul = document.getElementById('stoplist');
  TOUR_STOPS.forEach((s, i)=>{
    const li = document.createElement('li');
    li.innerHTML = `
      <a class="list-item" href="#/stop/${s.id}" aria-label="Open ${s.title}">
        <div class="row">
          <div class="thumb">${s.photos && s.photos.length > 0 ? `<img src="${s.photos[0]}" alt="">` : `<div class="placeholder">📍</div>`}</div>
          <div style="min-width:0;flex:1">
            <div style="font-weight:700;overflow:hidden;text-overflow:ellipsis">${i+1}. ${s.title}</div>
          </div>
        </div>
      </a>`;
    ul.appendChild(li);
  });
}

function renderStop(id){
  const stop = getStop(id); if(!stop){ location.hash = '#/'; return; }
  const stopIdx = TOUR_STOPS.findIndex(s => s.id === stop.id);
  const next = stop.nextId ? getStop(stop.nextId) : null;
  
  app.innerHTML = `
<section class="grid">
  <div class="title-row">
    <h1 class="headline">${stop.title}</h1>
    <div class="chip">Stop ${stop.id}</div>
  </div>

  ${stop.address ? `
    <div class="address-line">
      ${stop.location
        ? `<a class="address-link" target="_blank" rel="noreferrer" href="${gmapsTo(stop)}" aria-label="Walking directions to ${stop.address}">${stop.address}</a>`
        : `<span class="address-text">${stop.address}</span>`}
    </div>
  ` : ``}

  <div class="carousel-container">
    <div class="carousel" id="carousel-${stop.id}">
      ${stop.photos && stop.photos.length > 0 ? stop.photos.map((photo, index) => `
        <div class="carousel-slide ${index === 0 ? 'active' : ''}" data-slide="${index}">
          <img src="${photo}" alt="${stop.title} - Image ${index + 1}" style="width:100%;height:100%;object-fit:cover">
        </div>
      `).join('') : `<div class="carousel-slide active"><div class="placeholder">Add a photo</div></div>`}
    </div>
    ${stop.photos && stop.photos.length > 1 ? `
      <div class="carousel-controls">
        <button class="carousel-btn prev" id="prev-${stop.id}" aria-label="Previous image">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"></polyline>
          </svg>
        </button>
        <button class="carousel-btn next" id="next-${stop.id}" aria-label="Next image">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6"></polyline>
          </svg>
        </button>
      </div>
      <div class="carousel-indicators" id="indicators-${stop.id}">
        ${stop.photos.map((_, index) => `
          <button class="carousel-indicator ${index === 0 ? 'active' : ''}" data-slide="${index}" aria-label="Go to image ${index + 1}"></button>
        `).join('')}
      </div>
    ` : ''}
  </div>

  <div class="card" id="player">
    ${stop.audio ? `<audio id="audio" src="${stop.audio}" preload="metadata"></audio>` : `<div class="muted">Upload your audio file for this stop to enable playback.</div>`}
    ${stop.audio ? `
    <div class="audio-player">
      <div class="audio-controls">
        <button class="control-btn" id="rewind" aria-label="Rewind 10 seconds">
          <img class="control-icon" src="icons/rw.svg" alt="Rewind 10 seconds">
        </button>
        <button class="control-btn play-btn" id="pp" aria-label="Play narration">
          <img class="control-icon" id="play-icon" src="icons/play.svg" alt="Play">
        </button>
        <button class="control-btn" id="fastforward" aria-label="Fast forward 10 seconds">
          <img class="control-icon" src="icons/ff.svg" alt="Fast forward 10 seconds">
        </button>
      </div>
      <div class="audio-progress">
        <input id="seek" type="range" min="0" max="1" step="0.1" value="0" aria-label="Seek" class="progress-bar">
      </div>
      <div class="audio-times">
        <div class="audio-time" id="time">0:00</div>
        <div class="audio-time" id="time-left">-0:00</div>
      </div>
    </div>` : ''}
  </div>

  ${stop.transcript ? `
  <div class="disclosure" id="disc">
    <button type="button" aria-expanded="false"><span style="font-family: 'Montserrat', sans-serif; color:var(--accent); font-weight:600">Transcript</span><span class="arrow">▶</span></button>
    <div class="panel" style="display:none"><div class="transcript-text">${stop.transcript}</div></div>
  </div>` : ''}

  <div class="inline-buttons single" style="margin-top:8px">
    ${next ? (next.location ? `<a class="btn" target="_blank" rel="noreferrer" href="${gmapsTo(next)}">Directions to Next Stop</a>` : `<div class="btn" style="opacity:0.5;pointer-events:none;background:#e9ecef;border-color:#d1d5db;color:#6c757d;box-shadow:none">Directions to Next Stop</div>`) : `<div class="card muted" style="text-align:center">Thank you for taking our tour!</div>`}
  </div>

  <div class="inline-buttons">
    ${stopIdx > 0 ? `<a class="btn" href="#/stop/${TOUR_STOPS[stopIdx - 1].id}">Previous Stop</a>` : `<div class="btn" style="opacity:0.5;pointer-events:none">Previous Stop</div>`}
   
    ${next ? `<a class="btn" href="#/stop/${next.id}">Next Stop</a>` : `<div class="btn" style="opacity:0.5;pointer-events:none">Next Stop</div>`}
  </div>
</section>
  `;

  // Wire up transcript disclosure
  const disc = document.getElementById('disc');
  if (disc){
    const btn = disc.querySelector('button');
    const panel = disc.querySelector('.panel');
    const arrow = disc.querySelector('.arrow');
    btn.addEventListener('click', ()=>{
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      panel.style.display = open ? 'none' : 'block';
      if (arrow) {
        arrow.textContent = open ? '▶' : '▼';
      }
    });
  }

  // Wire up audio controls
  const audio = document.getElementById('audio');
  if (audio){
    const pp = document.getElementById('pp');
    const seek = document.getElementById('seek');
    const time = document.getElementById('time');
    const timeLeft = document.getElementById('time-left');

    audio.addEventListener('loadedmetadata', ()=>{
      seek.max = Math.max(1, audio.duration || 1);
      if (timeLeft) timeLeft.textContent = `-${fmt(audio.duration || 0)}`;
    });
    audio.addEventListener('timeupdate', ()=>{
      seek.value = audio.currentTime;
      time.textContent = fmt(audio.currentTime);
      if (timeLeft) timeLeft.textContent = `-${fmt((audio.duration||0) - audio.currentTime)}`;
    });
    audio.addEventListener('ended', ()=>{ 
      const playIcon = document.getElementById('play-icon');
      if (playIcon) playIcon.setAttribute('src', 'icons/play.svg'); 
    });

    pp.addEventListener('click', async ()=>{
      if (audio.paused){
        try{ 
          await audio.play(); 
          const playIcon = document.getElementById('play-icon');
          if (playIcon) playIcon.setAttribute('src', 'icons/pause.svg'); 
        }catch(e){ console.warn('Playback failed', e); }
      } else { 
        audio.pause(); 
        const playIcon = document.getElementById('play-icon');
        if (playIcon) playIcon.setAttribute('src', 'icons/play.svg'); 
      }
    });
    seek.addEventListener('input', ()=>{ audio.currentTime = Number(seek.value); });

    // Add rewind and fast forward functionality
    const rewind = document.getElementById('rewind');
    const fastforward = document.getElementById('fastforward');
    
    rewind.addEventListener('click', ()=>{
      audio.currentTime = Math.max(0, audio.currentTime - 10);
    });
    
    fastforward.addEventListener('click', ()=>{
      audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
    });
  }

  // Wire up carousel controls
  const carousel = document.getElementById(`carousel-${stop.id}`);
  const prevBtn = document.getElementById(`prev-${stop.id}`);
  const nextBtn = document.getElementById(`next-${stop.id}`);
  const indicators = document.getElementById(`indicators-${stop.id}`);
  
  if (carousel && stop.photos && stop.photos.length > 1) {
    const slides = carousel.querySelectorAll('.carousel-slide');
    const indicatorBtns = indicators ? indicators.querySelectorAll('.carousel-indicator') : [];
    let currentSlide = 0;
    
    const showSlide = (index) => {
      // Hide all slides
      slides.forEach(slide => slide.classList.remove('active'));
      indicatorBtns.forEach(btn => btn.classList.remove('active'));
      
      // Show current slide
      if (slides[index]) {
        slides[index].classList.add('active');
      }
      if (indicatorBtns[index]) {
        indicatorBtns[index].classList.add('active');
      }
      
      currentSlide = index;
      
      // Update button states
      if (prevBtn) prevBtn.disabled = currentSlide === 0;
      if (nextBtn) nextBtn.disabled = currentSlide === slides.length - 1;
    };
    
    // Previous button
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        const newIndex = currentSlide > 0 ? currentSlide - 1 : slides.length - 1;
        showSlide(newIndex);
      });
    }
    
    // Next button
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const newIndex = currentSlide < slides.length - 1 ? currentSlide + 1 : 0;
        showSlide(newIndex);
      });
    }
    
    // Indicator buttons
    indicatorBtns.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        showSlide(index);
      });
    });
    
    // Touch/swipe support for mobile
    let startX = 0;
    let startY = 0;
    let isScrolling = false;
    
    carousel.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isScrolling = false;
    });
    
    carousel.addEventListener('touchmove', (e) => {
      if (!startX || !startY) return;
      
      const diffX = startX - e.touches[0].clientX;
      const diffY = startY - e.touches[0].clientY;
      
      if (Math.abs(diffX) > Math.abs(diffY)) {
        isScrolling = true;
        e.preventDefault();
      }
    });
    
    carousel.addEventListener('touchend', (e) => {
      if (!isScrolling) return;
      
      const endX = e.changedTouches[0].clientX;
      const diffX = startX - endX;
      
      if (Math.abs(diffX) > 50) { // Minimum swipe distance
        if (diffX > 0) {
          // Swipe left - next image
          const newIndex = currentSlide < slides.length - 1 ? currentSlide + 1 : 0;
          showSlide(newIndex);
        } else {
          // Swipe right - previous image
          const newIndex = currentSlide > 0 ? currentSlide - 1 : slides.length - 1;
          showSlide(newIndex);
        }
      }
      
      startX = 0;
      startY = 0;
      isScrolling = false;
    });
    
    // Initialize
    showSlide(0);
  }
}

// Start execution
window.addEventListener('DOMContentLoaded', initApp);
