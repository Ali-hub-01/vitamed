/* Vitamed — интерактив лэндинга (чистый JS, без библиотек) */
(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Header: состояние при скролле ---------- */
  var header = document.getElementById('header');
  function onScroll() {
    if (window.scrollY > 24) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Мобильное меню ---------- */
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');
  function closeMenu() {
    nav.classList.remove('open');
    burger.classList.remove('open');
    header.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    burger.classList.toggle('open', open);
    header.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  });
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) closeMenu();
  });

  /* ---------- Reveal-анимации ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------- Счётчики ---------- */
  var counters = document.querySelectorAll('.count');
  function animateCount(el) {
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;
    if (prefersReducedMotion) { el.textContent = String(target); return; }
    var duration = 1600;
    var start = null;
    function tick(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3); /* easeOutCubic */
      el.textContent = String(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          countObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { countObserver.observe(el); });
  } else {
    counters.forEach(function (el) { el.textContent = el.getAttribute('data-count'); });
  }

  /* ---------- Фильтр врачей ---------- */
  var filterChips = document.querySelectorAll('.doc-filter .chip');
  var docCards = document.querySelectorAll('.doc-card');
  var docEmpty = document.getElementById('docEmpty');
  filterChips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      filterChips.forEach(function (c) { c.classList.remove('is-active'); });
      chip.classList.add('is-active');
      var filter = chip.getAttribute('data-filter');
      var visible = 0;
      docCards.forEach(function (card) {
        var specs = (card.getAttribute('data-spec') || '').split(/\s+/);
        var show = filter === 'all' || specs.indexOf(filter) !== -1;
        card.classList.toggle('hidden-by-filter', !show);
        if (show) {
          visible++;
          card.classList.add('in'); /* карточки уже показывались — не прятать заново */
        }
      });
      if (docEmpty) docEmpty.hidden = visible > 0;
    });
  });

  /* ---------- Форма заявки → WhatsApp ---------- */
  var WHATSAPP_NUMBER = '77078141226';
  var form = document.getElementById('leadForm');
  var success = document.getElementById('formSuccess');

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var name = form.elements.name.value.trim();
      var phone = form.elements.phone.value.trim();
      var service = form.elements.service.value;
      var address = form.elements.address.value.trim();
      var comment = form.elements.comment.value.trim();

      /* простая валидация обязательных полей */
      var valid = true;
      [form.elements.name, form.elements.phone].forEach(function (input) {
        if (!input.value.trim()) {
          input.classList.add('invalid');
          valid = false;
        } else {
          input.classList.remove('invalid');
        }
      });
      if (!valid) {
        (name ? form.elements.phone : form.elements.name).focus();
        return;
      }

      var lines = [
        'Здравствуйте! Заявка с сайта Vitamed:',
        'Имя: ' + name,
        'Телефон: ' + phone
      ];
      if (service) lines.push('Услуга: ' + service);
      if (address) lines.push('Район/адрес: ' + address);
      if (comment) lines.push('Комментарий: ' + comment);

      var url = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(lines.join('\n'));
      window.open(url, '_blank', 'noopener');

      form.hidden = true;
      success.hidden = false;

      /* хук для аналитики (gtag повесят позже) */
      trackConversion('lead_form_submit', { service: service || 'not_selected' });

      /* дублируем заявку боту (Telegram через Cloudflare Worker); конверсию уже отправили выше */
      if (window.medhomeSendLead) {
        window.medhomeSendLead({ name: name, phone: phone, service: service, source: 'форма на сайте', fireConversion: false });
      }
    });

    /* снятие подсветки ошибки при вводе */
    form.addEventListener('input', function (e) {
      if (e.target.classList && e.target.classList.contains('invalid') && e.target.value.trim()) {
        e.target.classList.remove('invalid');
      }
    });
  }

  /* ---------- Делегированные клики: tel / WhatsApp (хуки под gtag) ---------- */
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a');
    if (!link) return;
    var href = link.getAttribute('href') || '';
    if (href.indexOf('tel:') === 0) {
      trackConversion('phone_click', { href: href });
    } else if (href.indexOf('wa.me') !== -1) {
      trackConversion('whatsapp_click', { href: href });
    }
  });

  /* Единая точка конверсий → Google Ads (AW-18395260701) */
  function trackConversion(eventName, params) {
    if (typeof window.gtag !== 'function') return;
    if (eventName === 'phone_click' && typeof window.gtag_report_phone === 'function') {
      window.gtag_report_phone();            // Интерактивные номера телефонов
    } else if (eventName === 'whatsapp_click' && typeof window.gtag_report_contact === 'function') {
      window.gtag_report_contact();          // Контакт
    } else if (eventName === 'lead_form_submit' && typeof window.gtag_report_lead === 'function') {
      window.gtag_report_lead();             // Отправка формы для потенциальных клиентов
    }
    /* console.log('[conversion]', eventName, params); */
  }

  /* ---------- Текущий год в футере ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
