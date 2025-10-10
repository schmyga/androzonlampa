/*!
 * SerVik — кнопка рядом с "Смотреть" на экране фильма
 * Переделка от z01.online/live с Tizen-фиксами и CUB auth
 */

(function () {
  'use strict';

  if (!window.Lampa) return;

  const PLUGIN_ID = 'servik_button';
  const PLUGIN_TITLE = 'SerVik';
  const DEBUG = true;

  const isTizen = typeof tizen !== 'undefined';
  const CUB_API = 'https://cub.rip/api/v2';
  const CUB_TOKEN = Lampa.Storage.get('cub_token') || '';

  const BALANCERS = {
    'bwa': { name: 'BWA', url: 'https://bwa.to/rc', search: '/search.php?q=', parse: '/parse.php?url=' },
    'rezka': { name: 'Rezka', url: 'https://rezka.ag', search: '/search/?do=search&subaction=search&q=' },
    'filmix': { name: 'Filmix', url: 'https://filmix.ac', search: '/search/' }
  };

  function log(...args) { if (DEBUG) console.log('[SerVik]', ...args); }

  function safeNoty(text) { try { Lampa.Noty.show(text); } catch (e) { console.log('[SerVik]', text); } }

  function createButton() {
    const button = $('<div class="full-start__button selector" style="background: linear-gradient(135deg, #ff7e00, #ffb700); border-radius: 50px; padding: 0 20px; margin-left: 10px;">')
      .html('<span>SerVik</span>');

    button.on('hover:enter', openSerVik);

    if (isTizen) {
      button.on('keydown', function(e) {
        if (e.code === 'Enter' || e.code === 'OK') {
          e.preventDefault();
          openSerVik();
        }
      });
    }

    return button;
  }

  function getMovieInfo() {
    const title = $('.full-start-new__title').text().trim();
    const year = $('.full-start__details').text().match(/\d{4}/)?.[0] || '';
    const originalTitle = $('.full-start__original').text().trim() || title;
    const urlParams = new URLSearchParams(window.location.search);
    const kpId = urlParams.get('card') || '';
    return { title, originalTitle, year, kpId, searchQuery: `${title} ${year}`.trim() };
  }

  async function searchBWA(movieInfo) {
    try {
      safeNoty('Поиск через BWA...');
      const searchUrl = `${BALANCERS.bwa.url}${BALANCERS.bwa.search}${encodeURIComponent(movieInfo.searchQuery)}`;
      const response = await fetch(searchUrl);
      const data = await response.json();
      if (data.results?.length) {
        const parseUrl = `${BALANCERS.bwa.url}${BALANCERS.bwa.parse}${encodeURIComponent(data.results[0].url)}`;
        const parseResponse = await fetch(parseUrl);
        const parseData = await parseResponse.json();
        if (parseData.stream) playVideo(parseData.stream, `${BALANCERS.bwa.name} - ${movieInfo.title}`);
      } else safeNoty('Ничего не найдено через BWA');
    } catch (e) { console.error('BWA error:', e); safeNoty('Ошибка BWA'); }
  }

  async function searchUniversal(balancerId, movieInfo) {
    try {
      safeNoty(`Поиск через ${BALANCERS[balancerId].name}...`);
      const searchUrl = `${BALANCERS[balancerId].url}${BALANCERS[balancerId].search}${encodeURIComponent(movieInfo.searchQuery)}`;
      const proxyUrl = CUB_TOKEN ? `${CUB_API}/search?query=${encodeURIComponent(movieInfo.searchQuery)}` : `https://corsproxy.io/?${encodeURIComponent(searchUrl)}`;
      const headers = CUB_TOKEN ? { Authorization: `Bearer ${CUB_TOKEN}` } : {};
      const response = await fetch(proxyUrl, { headers });
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const videoLinks = findVideoLinks(doc, balancerId);
      if (videoLinks.length) showVideoLinks(videoLinks, BALANCERS[balancerId].name, movieInfo.title);
      else safeNoty(`Не найдено ссылок через ${BALANCERS[balancerId].name}`);
    } catch (e) { console.error(`${balancerId} error:`, e); safeNoty(`Ошибка ${BALANCERS[balancerId].name}`); }
  }

  function findVideoLinks(doc, balancerId) {
    const links = [];
    const selectors = balancerId === 'rezka' ? 'a[href*="/films/"], a[href*="/series/"]' : 'a[href*="/film/"], a[href*="/movie/"]';
    doc.querySelectorAll(selectors).forEach(link => {
      if (link.href && !link.href.includes('/search/')) links.push({ url: link.href, title: link.textContent.trim(), balancer: balancerId });
    });
    return links.slice(0, 5);
  }

  function showVideoLinks(links, balancerName, movieTitle) {
    const html = $(`
      <div style="padding: 1em;">
        <h3 style="margin: 0 0 15px 0; color: #ff7e00;">${balancerName}</h3>
        <div style="color: #888; margin-bottom: 15px;">Найдено вариантов: ${links.length}</div>
        <div class="video-links" style="max-height: 300px; overflow-y: auto;">
          ${links.map((link, index) => `
            <div class="selector video-link" data-url="${link.url}" data-balancer="${link.balancer}"
                 style="background: #3a3a3a; padding: 12px; margin: 5px 0; border-radius: 8px; border: 2px solid transparent; cursor: pointer;">
              <div style="font-weight: bold;">${link.title || 'Без названия'}</div>
              <div style="font-size: 12px; color: #888; margin-top: 5px;">${link.url}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `);

    html.find('.video-link').on('hover:enter', function() {
      const url = $(this).data('url'), balancer = $(this).data('balancer');
      Lampa.Modal.close();
      parseAndPlayVideo(url, balancer, movieTitle);
    });

    if (isTizen) {
      html.find('.video-link').on('keydown', function(e) {
        if (e.code === 'Enter' || e.code === 'OK') {
          const url = $(this).data('url'), balancer = $(this).data('balancer');
          Lampa.Modal.close();
          parseAndPlayVideo(url, balancer, movieTitle);
        }
      }).on('hover:focus', function() {
        html.find('.video-link').css('border-color', 'transparent');
        $(this).css('border-color', '#ff7e00');
      });
    }

    Lampa.Modal.open({
      title: `Выбор ссылки - ${balancerName}`,
      html: html,
      size: 'medium',
      buttons: [{ title: 'Назад', action: () => { Lampa.Modal.close(); setTimeout(openSerVik, 300); } }]
    });
  }

  async function parseAndPlayVideo(url, balancerId, title) {
    try {
      safeNoty('Парсинг видео...');
      let videoUrl = url;
      if (balancerId === 'bwa') videoUrl = url;
      else {
        const parseUrl = `${CUB_API}/parse?url=${encodeURIComponent(url)}&balancer=${balancerId}`;
        const headers = CUB_TOKEN ? { Authorization: `Bearer ${CUB_TOKEN}` } : {};
        const response = await fetch(parseUrl, { headers });
        const data = await response.json();
        videoUrl = data.stream || (await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`).then(r => r.text()).then(extractVideoUrl));
      }
      if (videoUrl) playVideo(videoUrl, `${BALANCERS[balancerId].name} - ${title}`);
      else safeNoty('Не удалось извлечь видео');
    } catch (e) { console.error('Parse error:', e); safeNoty('Ошибка парсинга'); }
  }

  function extractVideoUrl(html, balancerId) {
    const regexMap = { 'rezka': /(https?:[^"']*\.(mp4|m3u8|mkv)[^"']*)/i, 'filmix': /(https?:[^"']*\.(mp4|m3u8)[^"']*)/i };
    const match = html.match(regexMap[balancerId]);
    return match ? match[1] : null;
  }

  function playVideo(url, title) {
    if (!url) return safeNoty('Неверная ссылка');
    const movieData = { title, file: url, type: 'movie' };
    if (Lampa.Player?.play) Lampa.Player.play(movieData);
    else Lampa.Activity.push({ url: '', component: 'player', source: movieData, title });
    safeNoty('Запуск видео...');
  }

  function openSerVik() {
    const movieInfo = getMovieInfo();
    const html = $(`
      <div class="z01-modal">
        <div style="padding: 1.5em;">
          <div style="text-align: center; margin-bottom: 1.5em;">
            <h2 style="margin: 0 0 10px 0; color: #ff7e00;">SerVik Player</h2>
            <div style="background: #2a2a2a; padding: 10px; border-radius: 8px; margin-bottom: 15px;">
              <div style="font-weight: bold;">${movieInfo.title}</div>
              ${movieInfo.year ? `<div style="color: #888; font-size: 14px;">${movieInfo.year} год</div>` : ''}
            </div>
          </div>
          <div style="margin-bottom: 1.5em;">
            <h3 style="margin: 0 0 15px 0; color: #fff;">Выберите источник:</h3>
            <div class="balancers-list" style="display: flex; flex-direction: column; gap: 10px;">
              <div class="selector balancer-item" data-balancer="bwa" style="background: #3a3a3a; padding: 15px; border-radius: 10px; cursor: pointer; border: 2px solid transparent;">
                <div style="font-weight: bold; color: #ff7e00;">BWA API</div>
                <div style="font-size: 12px; color: #888; margin-top: 5px;">Прямой поиск через API</div>
              </div>
              <div class="selector balancer-item" data-balancer="rezka" style="background: #3a3a3a; padding: 15px; border-radius: 10px; cursor: pointer; border: 2px solid transparent;">
                <div style="font-weight: bold; color: #4CAF50;">Rezka</div>
                <div style="font-size: 12px; color: #888; margin-top: 5px;">Поиск на rezka.ag</div>
              </div>
              <div class="selector balancer-item" data-balancer="filmix" style="background: #3a3a3a; padding: 15px; border-radius: 10px; cursor: pointer; border: 2px solid transparent;">
                <div style="font-weight: bold; color: #2196F3;">Filmix</div>
                <div style="font-size: 12px; color: #888; margin-top: 5px;">Поиск на filmix.ac</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `);

    html.find('.balancer-item').on('hover:enter', function() {
      const balancerId = $(this).data('balancer');
      Lampa.Modal.close();
      if (balancerId === 'bwa') searchBWA(movieInfo);
      else searchUniversal(balancerId, movieInfo);
    });

    if (isTizen) {
      html.find('.balancer-item').on('keydown', function(e) {
        if (e.code === 'Enter' || e.code === 'OK') {
          const balancerId = $(this).data('balancer');
          Lampa.Modal.close();
          if (balancerId === 'bwa') searchBWA(movieInfo);
          else searchUniversal(balancerId, movieInfo);
        }
      }).on('hover:focus', function() {
        html.find('.balancer-item').css('border-color', 'transparent');
        $(this).css('border-color', '#ff7e00');
      });
    }

    Lampa.Modal.open({ title: 'SerVik Player', html, size: 'medium', onBack: () => Lampa.Modal.close() });
  }

