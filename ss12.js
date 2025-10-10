/*!
 * Androzon — кнопка рядом с "Смотреть" (фикс Tizen из bwa.to/rc + CUB API fallback)
 * Балансеры: Rezka/Filmix с Lampac/CUB proxy
 */

(function () {
  'use strict';

  if (!window.Lampa) return;

  const PLUGIN_ID = 'androzon_button';
  const PLUGIN_TITLE = 'Androzon';
  const DEBUG = true;
  const LOGO_URL = 'https://yourusername.github.io/androzonlampa/logo.png';

  const isTizen = typeof tizen !== 'undefined';
  const isAndroid = navigator.userAgent.indexOf('Android') > -1 && !isTizen;
  const isFireTV = isAndroid && navigator.userAgent.indexOf('FireOS') > -1;

  // Proxy: Lampac или CUB (fallback из доки)
  const LAMPA_PROXY = Lampa.Storage.get('androzon_proxy') || 'http://127.0.0.1:9118';
  const CUB_PROXY = 'https://cub.rip/api/v2'; // Из CUB API
  const FILMIX_TOKEN = Lampa.Storage.get('filmix_token') || '';

  const BALANCERS = {
    rezka: { name: 'Rezka', url: 'https://rezka.ag/search/?do=search&subaction=search&q=', proxy: true },
    filmix: { name: 'Filmix', url: 'https://filmix.ac/search/', proxy: true, token: FILMIX_TOKEN }
  };

  function log(...args) { if (DEBUG) console.log('[Androzon]', ...args); }

  function safeNoty(text) { try { Lampa.Noty.show(text); } catch (e) { console.log('[Androzon]', text); } }

  function createButton() {
    const button = $('<div class="full-start__button selector ' + PLUGIN_ID + '" style="background: linear-gradient(135deg, #ff7e00, #ffb700); border-radius: 50px; padding: 0 20px; margin-left: 10px; display: flex; align-items: center;">')
      .html('<img src="' + LOGO_URL + '" style="width: 20px; height: 20px; margin-right: 5px;"> <span>Androzon</span>');

    button.on('hover:enter', openAndrozon);

    if (isTizen || isFireTV) {
      button.on('keydown', function(e) {
        if (e.code === 'Enter' || e.code === 'OK' || e.code === 'Space') {
          e.preventDefault();
          openAndrozon();
        }
      });
    }

    return button;
  }

  function getMovieInfo() {
    const title = $('.full-start-new__title, .full-start__title, .title').text().trim(); // Fallback из bwa.to
    const year = $('.full-start__details, .full-start__year').text().match(/\d{4}/)?.[0] || '';
    const original = $('.full-start__original').text().trim() || title;
    const params = new URLSearchParams(window.location.search);
    return { title, original, year, kpId: params.get('card') || '', query: `${title} ${year}`.trim() };
  }

  async function searchUniversal(id, info) {
    const bal = BALANCERS[id];
    safeNoty(`Поиск в ${bal.name}...`);
    let url = `${bal.url}${encodeURIComponent(info.query)}`;
    if (bal.proxy) {
      // Lampac primary
      url = `${LAMPA_PROXY}/proxy?url=${encodeURIComponent(url)}`;
      // CUB fallback если Lampac не работает (из API доки)
      if (!url.startsWith('http://') && !url.startsWith('https://')) url = `${CUB_PROXY}/search?query=${encodeURIComponent(info.query)}`;
    } else {
      url = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Fetch failed');
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const links = findLinks(doc, id);

      if (links.length) showLinks(links, bal.name, info.title);
      else safeNoty(`Не найдено в ${bal.name}`);
    } catch (e) {
      console.error(id, e); safeNoty(`Ошибка ${bal.name}`);
    }
  }

  function findLinks(doc, id) {
    const links = [];
    const selectors = id === 'rezka' ? 'a[href*="/films/"], a[href*="/series/"]' : 'a[href*="/film/"], a[href*="/serial/"]';
    doc.querySelectorAll(selectors).forEach(a => {
      if (a.href && !a.href.includes('/search/') && a.textContent.trim()) {
        links.push({ url: a.href, title: a.textContent.trim(), id });
      }
    });
    return links.slice(0, 5);
  }

  function showLinks(links, name, title) {
    const html = $(`
      <div style="padding: 1em;">
        <h3 style="color: #ff7e00;">${name} (${links.length})</h3>
        <div class="links" style="max-height: 300px; overflow-y: auto;">
          ${links.map(l => `<div class="selector link-item" data-url="${l.url}" data-id="${l.id}" style="background: #3a3a3a; padding: 12px; margin: 5px 0; border-radius: 8px; border: 2px solid transparent;">
            <div style="font-weight: bold;">${l.title}</div>
            <div style="font-size: 12px; color: #888;">${l.url}</div>
          </div>`).join('')}
        </div>
      </div>
    `);

    html.find('.link-item').on('hover:enter', function() {
      const url = $(this).data('url'), id = $(this).data('id');
      Lampa.Modal.close();
      parsePlay(url, id, title);
    });

    if (isTizen || isFireTV) {
      html.find('.link-item').on('keydown', function(e) {
        if (e.code === 'Enter' || e.code === 'OK') {
          const url = $(this).data('url'), id = $(this).data('id');
          Lampa.Modal.close();
          parsePlay(url, id, title);
        }
      }).on('hover:focus', function() {
        html.find('.link-item').css('border-color', 'transparent');
        $(this).css('border-color', '#ff7e00');
      });
    }

    Lampa.Modal.open({
      title: `${name} - Выбор`,
      html: html,
      size: 'medium',
      buttons: [{ title: 'Назад', action: () => { Lampa.Modal.close(); setTimeout(openAndrozon, 300); } }]
    });
  }

  async function parsePlay(url, id, title) {
    safeNoty('Парсинг...');
    let vUrl = null;
    const bal = BALANCERS[id];

    if (Lampa.Extract) {
      try {
        const data = await (id === 'rezka' ? Lampa.Extract.rezka(url) : Lampa.Extract.filmix(url, { token: bal.token }));
        if (data && data.url) vUrl = data.url;
      } catch (e) { console.error('Extract', e); }
    }

    if (!vUrl && bal.proxy) {
      vUrl = `${LAMPA_PROXY}/proxy?url=${encodeURIComponent(url)}`;
      // CUB parse fallback (из API)
      if (!vUrl) vUrl = `${CUB_PROXY}/parse?url=${encodeURIComponent(url)}&balancer=${id}`;
    } else if (!vUrl) {
      const pUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      const res = await fetch(pUrl);
      const html = await res.text();
      vUrl = extractUrl(html, id);
    }

    if (vUrl) playVideo(vUrl, `${bal.name} - ${title}`);
    else safeNoty('Видео не найдено');
  }

  function extractUrl(html, id) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (id === 'rezka') {
      const vid = doc.querySelector('video[src], source[src]');
      if (vid) return vid.src;
    } else if (id === 'filmix') {
      const scr = Array.from(doc.querySelectorAll('script')).find(s => s.textContent.includes('player_data'));
      if (scr) {
        const m = scr.textContent.match(/player_data\s*=\s*({.*?})/);
        if (m) try { return JSON.parse(m[1]).link; } catch (e) {}
      }
    }
    const re = /(https?:\/\/[^"'>\s]*\.(m3u8|mp4)[^"']*)/i;
    return html.match(re)?.[1] || null;
  }

  function playVideo(url, title) {
    if (!url) return safeNoty('Неверная ссылка');
    const data = { title, file: url, type: 'movie' };
    if (Lampa.Player?.play) Lampa.Player.play(data);
    else Lampa.Activity.push({ url: '', component: 'player', source: data, title });
    safeNoty('Запуск...');
  }

  function openAndrozon() {
    const info = getMovieInfo();
    const html = $(`
      <div style="text-align: center; padding: 1.5em;">
        <img src="${LOGO_URL}" style="width: 60px; margin-bottom: 10px;">
        <h2 style="color: #ff7e00;">${PLUGIN_TITLE}</h2>
        <div style="background: #2a2a2a; padding: 10px; border-radius: 8px; margin-bottom: 15px;">
          <div style="font-weight: bold;">${info.title}</div>
          ${info.year ? `<div style="color: #888;">${info.year}</div>` : ''}
        </div>
        <h3 style="color: #fff;">Источник:</h3>
        <div class="balancers" style="display: flex; flex-direction: column; gap: 10px;">
          <div class="selector balancer-item" data-id="rezka" style="background: #3a3a3a; padding: 15px; border-radius: 10px; border: 2px solid transparent;">
            <div style="font-weight: bold; color: #4CAF50;">Rezka</div>
            <div style="font-size: 12px; color: #888;">(proxy: ${LAMPA_PROXY})</div>
          </div>
          <div class="selector balancer-item" data-id="filmix" style="background: #3a3a3a; padding: 15px; border-radius: 10px; border: 2px solid transparent;">
            <div style="font-weight: bold; color: #2196F3;">Filmix</div>
            <div style="font-size: 12px; color: #888;">(token: ${FILMIX_TOKEN ? 'OK' : 'добавь'})</div>
          </div>
        </div>
      </div>
    `);

    html.find('.balancer-item').on('hover:enter', function() {
      const id = $(this).data('id');
      Lampa.Modal.close();
      searchUniversal(id, info);
    });

    if (isTizen || isFireTV) {
      html.find('.balancer-item').on('keydown', function(e) {
        if (e.code === 'Enter' || e.code === 'OK') {
          const id = $(this).data('id');
          Lampa.Modal.close();
          searchUniversal(id, info);
        }
      }).on('hover:focus', function() {
        html.find('.balancer-item').css('border-color', 'transparent');
        $(this).css('border-color', '#ff7e00');
      });
    }

    Lampa.Modal.open({ title: PLUGIN_TITLE, html, size: 'medium', onBack: () => Lampa.Modal.close() });
  }

  // Insert с retry (из bwa.to/rc: 3 попытки + Observer)
  function insertButton(retry = 0) {
    let block = $('.full-start-new__buttons, .full-start__buttons, .buttons, .full-start'); // Fallbackы
    if (!block.length) block = $('body'); // Ultimate
    if (block.length && !block.find('.' + PLUGIN_ID).length) {
      block.append(createButton());
      log('Кнопка добавлена (retry: ' + retry + ')');

      // Observer (Tizen из bwa.to)
      if (isTizen) {
        const observer = new MutationObserver(() => {
          if (!block.find('.' + PLUGIN_ID).length) insertButton(retry + 1);
        });
        observer.observe(block[0] || document.body, { childList: true, subtree: true });
      }
      return;
    }
    if (retry < 3) setTimeout(() => insertButton(retry + 1), 500); // Retry каждые 0.5s, макс 3
  }

  // Listener (app ready + full build, как в bwa.to)
  Lampa.Listener.follow('app', (e) => {
    if (e.type === 'ready') log('App ready');
  });
  Lampa.Listener.follow('full', (e) => {
    if (e.type === 'build') {
      const delay = isTizen ? 3000 : 1000; // 3s для Tizen
      setTimeout(() => insertButton(), delay);
      if (isTizen || isFireTV) {
        Lampa.Controller.listener.follow('keydown', (ev) => {
          if ((ev.code === 'Enter' || ev.code === 'OK') && $('.selector.focus').hasClass(PLUGIN_ID)) {
            ev.preventDefault();
            openAndrozon();
          }
        });
      }
    }
  });

  log('Инициализация (Tizen:', isTizen, ')');
})();
