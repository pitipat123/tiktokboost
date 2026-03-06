/* ===================================================
   TikTokBoost — Main JavaScript
   =================================================== */

// ============ NAVBAR ============
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');

// Scroll effect
if (navbar) {
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
    });
}

// Mobile toggle
if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('open');
        navToggle.textContent = navMenu.classList.contains('open') ? '✕' : '☰';
    });
}

// ============ COUNT UP ANIMATION ============
function animateCountUp(el) {
    const target = parseInt(el.dataset.count || el.dataset.speed);
    const isFloat = el.dataset.speed !== undefined;
    const floatTarget = parseFloat(el.dataset.speed || 0);
    const duration = 2000;
    const start = performance.now();

    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

        if (isFloat) {
            el.textContent = (floatTarget * eased).toFixed(1);
        } else {
            const current = Math.floor(target * eased);
            el.textContent = current.toLocaleString();
        }

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

// Intersection Observer for count-up
const countObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateCountUp(entry.target);
            countObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('[data-count], [data-speed]').forEach(el => {
    countObserver.observe(el);
});

// ============ SCROLL ANIMATIONS ============
const animateObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.animate-fade-up').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'all 0.6s ease';
    animateObserver.observe(el);
});

// ============ FAQ ACCORDION ============
document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const wasActive = item.classList.contains('active');

        // Close all
        document.querySelectorAll('.faq-item.active').forEach(i => {
            i.classList.remove('active');
        });

        // Toggle current
        if (!wasActive) {
            item.classList.add('active');
        }
    });
});

// ============ TESTIMONIALS CAROUSEL ============
const track = document.getElementById('testimonialTrack');
const prevBtn = document.getElementById('prevTestimonial');
const nextBtn = document.getElementById('nextTestimonial');

if (track && prevBtn && nextBtn) {
    let currentSlide = 0;
    const cards = track.querySelectorAll('.testimonial-card');
    const cardWidth = 366; // card min-width + gap

    function updateCarousel() {
        track.style.transform = `translateX(-${currentSlide * cardWidth}px)`;
    }

    nextBtn.addEventListener('click', () => {
        const maxSlide = Math.max(0, cards.length - Math.floor(track.parentElement.offsetWidth / cardWidth));
        currentSlide = Math.min(currentSlide + 1, maxSlide);
        updateCarousel();
    });

    prevBtn.addEventListener('click', () => {
        currentSlide = Math.max(currentSlide - 1, 0);
        updateCarousel();
    });

    // Auto-scroll
    let autoScroll = setInterval(() => {
        const maxSlide = Math.max(0, cards.length - Math.floor(track.parentElement.offsetWidth / cardWidth));
        currentSlide = currentSlide >= maxSlide ? 0 : currentSlide + 1;
        updateCarousel();
    }, 5000);

    track.parentElement.addEventListener('mouseenter', () => clearInterval(autoScroll));
    track.parentElement.addEventListener('mouseleave', () => {
        autoScroll = setInterval(() => {
            const maxSlide = Math.max(0, cards.length - Math.floor(track.parentElement.offsetWidth / cardWidth));
            currentSlide = currentSlide >= maxSlide ? 0 : currentSlide + 1;
            updateCarousel();
        }, 5000);
    });
}

// ============ SERVICE FILTER ============
document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const filter = tab.dataset.filter;

        // Update active tab
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Filter items
        document.querySelectorAll('.service-row').forEach(row => {
            if (filter === 'all' || row.dataset.platform === filter) {
                row.style.display = '';
                row.style.animation = 'fadeInUp 0.3s ease forwards';
            } else {
                row.style.display = 'none';
            }
        });
    });
});

// ============ PRICE CALCULATOR ============
function updatePriceCalc() {
    const serviceSelect = document.getElementById('orderService');
    const quantityInput = document.getElementById('orderQuantity');
    const totalEl = document.getElementById('orderTotal');
    const chargeEl = document.getElementById('orderCharge');

    if (!serviceSelect || !quantityInput || !totalEl) return;

    const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
    const rate = parseFloat(selectedOption?.dataset?.rate || 0);
    const quantity = parseInt(quantityInput.value) || 0;
    const total = (rate * quantity / 1000);

    if (totalEl) totalEl.textContent = '฿' + total.toFixed(2);
    if (chargeEl) chargeEl.textContent = '฿' + total.toFixed(2);
}

// ============ PRESET SYSTEM ============
const PRESETS_KEY = 'tiktokboost_presets';

function getPresets() {
    try {
        return JSON.parse(localStorage.getItem(PRESETS_KEY)) || [];
    } catch {
        return [];
    }
}

function savePresets(presets) {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

function addPreset(name, service, quantity) {
    const presets = getPresets();
    presets.push({
        id: Date.now(),
        name,
        service,
        quantity,
        createdAt: new Date().toISOString()
    });
    savePresets(presets);
    renderPresets();
}

function deletePreset(id) {
    let presets = getPresets();
    presets = presets.filter(p => p.id !== id);
    savePresets(presets);
    renderPresets();
}

function loadPreset(id) {
    const presets = getPresets();
    const preset = presets.find(p => p.id === id);
    if (!preset) return;

    const serviceSelect = document.getElementById('orderService');
    const quantityInput = document.getElementById('orderQuantity');

    if (serviceSelect) {
        for (let i = 0; i < serviceSelect.options.length; i++) {
            if (serviceSelect.options[i].value === preset.service) {
                serviceSelect.selectedIndex = i;
                break;
            }
        }
    }

    if (quantityInput) quantityInput.value = preset.quantity;
    updatePriceCalc();

    // Highlight active preset
    document.querySelectorAll('.preset-item').forEach(item => {
        item.classList.toggle('active', item.dataset.id == id);
    });
}

function renderPresets() {
    const container = document.getElementById('presetList');
    if (!container) return;

    const presets = getPresets();
    if (presets.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; padding: var(--space-md);">ยังไม่มีพรีเซ็ต — สร้างพรีเซ็ตเพื่อสั่งซื้อได้เร็วขึ้น!</p>';
        return;
    }

    container.innerHTML = presets.map(p => `
    <div class="preset-item" data-id="${p.id}" onclick="loadPreset(${p.id})">
      <div class="preset-info">
        <span style="font-size: 1.25rem;">📋</span>
        <div>
          <div class="preset-name">${p.name}</div>
          <div class="preset-details">${p.service} • จำนวน ${parseInt(p.quantity).toLocaleString()}</div>
        </div>
      </div>
      <div class="preset-actions">
        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); loadPreset(${p.id})">ใช้</button>
        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); deletePreset(${p.id})" style="color: var(--red-500);">✕</button>
      </div>
    </div>
  `).join('');
}

// Save preset button handler
const savePresetBtn = document.getElementById('savePresetBtn');
if (savePresetBtn) {
    savePresetBtn.addEventListener('click', () => {
        const serviceSelect = document.getElementById('orderService');
        const quantityInput = document.getElementById('orderQuantity');
        const name = prompt('ตั้งชื่อพรีเซ็ต:');
        if (!name) return;

        const service = serviceSelect?.options[serviceSelect.selectedIndex]?.text || '';
        const quantity = quantityInput?.value || '1000';
        addPreset(name, service, quantity);
    });
}

// Init presets on page load
renderPresets();

// ============ MOCK AUTH ============
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        // Mock login
        localStorage.setItem('tiktokboost_user', JSON.stringify({
            name: 'Demo User',
            email: document.getElementById('loginEmail')?.value || 'demo@test.com',
            balance: 1250.50,
            tier: 'Pro'
        }));
        window.location.href = 'dashboard.html';
    });
}

const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        localStorage.setItem('tiktokboost_user', JSON.stringify({
            name: document.getElementById('regName')?.value || 'New User',
            email: document.getElementById('regEmail')?.value || 'new@test.com',
            balance: 0,
            tier: 'Basic'
        }));
        window.location.href = 'dashboard.html';
    });
}

// ============ SMOOTH SCROLL ============
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        if (href === '#') return;

        const target = document.querySelector(href);
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // Close mobile menu
            if (navMenu) navMenu.classList.remove('open');
            if (navToggle) navToggle.textContent = '☰';
        }
    });
});

// ============ SIDEBAR TOGGLE (Dashboard) ============
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.getElementById('sidebar');

if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });
}

// ============ ORDER STATUS MOCK ============
function getOrderStatus(orderId) {
    const statuses = ['สำเร็จ', 'กำลังดำเนินการ', 'รอดำเนินการ', 'บางส่วน'];
    return statuses[orderId % statuses.length];
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'สำเร็จ': return 'badge-success';
        case 'กำลังดำเนินการ': return 'badge-info';
        case 'รอดำเนินการ': return 'badge-warning';
        case 'บางส่วน': return 'badge-error';
        default: return 'badge-info';
    }
}

// ============ DASHBOARD STATS ANIMATION ============
document.querySelectorAll('.stat-card').forEach((card, i) => {
    card.style.animationDelay = `${i * 0.1}s`;
});
