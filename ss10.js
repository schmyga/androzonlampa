/*!
 * Androzon — кнопка рядом с "Смотреть" на экране фильма
 * Фиксы: Tizen (Samsung TV), Fire TV (пульт), Lampac proxy для балансеров
 * Работает на всех версиях Lampa (yumata / mod / Androzon / TV)
 */

(function () {
  'use strict';

  const PLUGIN_ID = 'androzon_button';
  const PLUGIN_TITLE = 'Androzon';
  const DEBUG = true;
  const LOGO_URL = 'https://yourusername.github.io/androzonlampa/logo.png'; // Твой логотип

  // Платформа detection
  const isTizen = typeof tizen !== 'undefined';
  const isAndroid = navigator.userAgent.indexOf('Android') > -1 && !isTizen;
  const isFireTV = isAndroid && navigator.userAgent.indexOf('FireOS') > -1; // Fire TV Stick

  // Lampac config (по умолчанию локальный)
  const LAMPA_PROXY = Lampa.Storage.get('androzon_lampac_proxy') || 'http://127.0.0.1:9118';
  const FILMIX_TOKEN = Lampa.Storage.get('filmix_token') || ''; // Для Filmix PRO

  // Балансеры (Lampac-style: proxy для поиска/стрима)
  const BALANCERS = {
    'rezka': {
      name: 'Rezka',
      url: 'https://rezka.ag',
      search: '/search/?do=search&subaction=search&q=',
      proxy: true // Через Lampac /proxy
    },
    'filmix': {
      name: 'Filmix',
      url: 'https://filmix.ac',
      search: '/search/',
      proxy: true,
      token: FILMIX_TOKEN // Если есть
    }
  };

  function log(...args) {
    if (DEBUG) console.log('[Androzon]', ...args);
  }

  function safeNoty(text) {
    try {
      if (window.Lampa?.Noty?.show) Lampa.Noty.show(text);
      else console.log('[Androzon]', text);
    } catch (e) { console.log('[Androzon]', text); }
  }

  function createButton() {
    const button = $('<div class="full-start__button selector ' + PLUGIN_ID + '" style="background: linear-gradient(135deg, #ff7e00, #ffb700); border-radius: 50px; padding: 0 20px; margin-left: 10px; display: flex; align-items: center; justify-content: center;">')
      .html('<img src="' + LOGO_URL + '" style="width: 20px; height: 20px; margin-right: 5px;"> <span>Androzon</span>');

    // Hover:enter для touch/mouse
    button.on('hover:enter', function () {
      safeNoty('Загрузка через Androzon...');
      openAndrozon();
    });

    // Для пульта (Fire TV/Tizen)
    if (isFireTV || isTizen) {
      button.on('keydown', function(e) {
        if (e.code === 'Enter' || e.code === 'OK' || e.code === 'Space') {
          e.preventDefault();
          safeNoty('Загрузка через Androzon...');
          openAndrozon();
        }
      });
    }

    return button;
  }

  // Получить информацию о текущем фильме
  function getMovieInfo() {
    const title = $('.full-start-new__title, .full-start__title').text().trim(); // Fallback для Tizen
    const year = $('.full-start__details, .full-start__year').text().match(/\d{4}/)?.[0] || '';
    const originalTitle = $('.full-start__original').text().trim() || title;
    
    const urlParams = new URLSearchParams(window.location.search);
    const kpId = urlParams.get('card') || '';
    
    return {
      title: title,
      originalTitle: originalTitle,
      year: year,
      kpId: kpId,
      searchQuery: `${title} ${year}`.trim()
    };
  }

  // Универсальный поиск через Lampac proxy
  async function searchUniversal(balancerId, movieInfo) {
    try {
      safeNoty(`Поиск через ${BALANCERS[balancerId].name}...`);
      
      const balancer = BALANCERS[balancerId];
      let searchUrl = `${balancer.url}${balancer.search}${encodeURIComponent(movieInfo.searchQuery)}`;
      
      // Через Lampac proxy для CORS/обхода
      if (balancer.proxy) {
        searchUrl = `${LAMPA_PROXY}/proxy?url=${encodeURIComponent(searchUrl)}`;
      } else {
        searchUrl = `https://corsproxy.io/?${encodeURIComponent(searchUrl)}`;
      }
      
      const response = await fetch(searchUrl);
      const html = await response.text();
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const videoLinks = findVideoLinks(doc, balancerId);
      
      if (videoLinks.length > 0) {
        showVideoLinks(videoLinks, balancer.name, movieInfo.title);
      } else {
        safeNoty(`Не найдено ссылок через ${balancer.name}`);
      }
      
    } catch (error) {
      console.error(`${balancerId} error:`, error);
      safeNoty(`Ошибка ${BALANCERS[balancerId].name}`);
    }
  }

  // Поиск видео ссылок в HTML (улучшено для Lampac)
  function findVideoLinks(doc, balancerId) {
    const links = [];
    
    switch(balancerId) {
      case 'rezka':
        // Rezka: ссылки на /films/ или /series/
        doc.querySelectorAll('a[href*="/films/"], a[href*="/series/"]').forEach(link => {
          if (link.href && !link.href.includes('/search/') && link.textContent.trim()) {
            links.push({
              url: link.href,
              title: link.textContent.trim(),
              balancer: balancerId
            });
          }
        });
        break;
        
      case 'filmix':
        // Filmix: ссылки на /film/ или /serial/
        doc.querySelectorAll('a[href*="/film/"], a[href*="/serial/"]').forEach(link => {
          if (link.href && !link.href.includes('/search/') && link.textContent.trim()) {
            links.push({
              url: link.href,
              title: link.textContent.trim(),
              balancer: balancerId
            });
          }
        });
        break;
    }
    
    return links.slice(0, 5);
  }

  // Показать найденные ссылки (адаптация для Tizen/Fire TV)
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

    // Hover:enter + keydown для пульта
    html.find('.video-link').on('hover:enter', function() {
      const url = $(this).data('url');
      const balancer = $(this).data('balancer');
      Lampa.Modal.close();
      parseAndPlayVideo(url, balancer, movieTitle);
    });

    if (isFireTV || isTizen) {
      html.find('.video-link').on('keydown', function(e) {
        if (e.code === 'Enter' || e.code === 'OK') {
          const url = $(this).data('url');
          const balancer = $(this).data('balancer');
          Lampa.Modal.close();
          parseAndPlayVideo(url, balancer, movieTitle);
        }
      });
    }

    Lampa.Modal.open({
      title: `Выбор ссылки - ${balancerName}`,
      html: html,
      size: 'medium',
      buttons: [{
        title: 'Назад',
        action: function() {
          Lampa.Modal.close();
          setTimeout(openAndrozon, 300);
        }
      }]
    });
  }

  // Парсинг и воспроизведение (Lampac proxy + Lampa.Extract)
  async function parseAndPlayVideo(url, balancerId, title) {
    try {
      safeNoty('Парсинг видео...');
      
      let videoUrl = null;
      const balancer = BALANCERS[balancerId];
      
      // Через Lampa.Extract (если доступно)
      if (window.Lampa?.Extract) {
        if (balancerId === 'rezka') {
          const rezkaData = await Lampa.Extract.rezka(url, { proxy: balancer.proxy ? `${LAMPA_PROXY}/proxy?url=` : undefined });
          if (rezkaData && rezkaData.url) videoUrl = rezkaData.url;
        } else if (balancerId === 'filmix') {
          const filmixData = await Lampa.Extract.filmix(url, { token: balancer.token, proxy: balancer.proxy ? `${LAMPA_PROXY}/proxy?url=` : undefined });
          if (filmixData && filmixData.url) videoUrl = filmixData.url;
        }
      }

      // Fallback: Lampac proxy для стрима
      if (!videoUrl && balancer.proxy) {
        videoUrl = `${LAMPA_PROXY}/proxy?url=${encodeURIComponent(url)}`;
      } else if (!videoUrl) {
        const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(url);
        const response = await fetch(proxyUrl);
        const html = await response.text();
        videoUrl = extractVideoUrl(html, balancerId);
      }
      
      if (videoUrl) {
        playVideo(videoUrl, `${balancer.name} - ${title}`);
      } else {
        safeNoty('Не удалось извлечь видео');
      }
      
    } catch (error) {
      console.error('Parse error:', error);
      safeNoty('Ошибка парсинга');
    }
  }

  // Fallback извлечение (DOM/regex)
  function extractVideoUrl(html, balancerId) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    if (balancerId === 'rezka') {
      const video = doc.querySelector('video[src], source[src]');
      if (video) return video.src;
    } else if (balancerId === 'filmix') {
      const script = Array.from(doc.querySelectorAll('script')).find(s => s.textContent.includes('player_data'));
      if (script) {
        const match = script.textContent.match(/player_data\s*=\s*({.*?})/);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            return data.link || null;
          } catch (e) {}
        }
      }
    }
    
    const regexMap = {
      'rezka': /(https?:\/\/[^"'>\s]*\.(m3u8|mp4)[^"']*)/i,
      'filmix': /(https?:\/\/[^"'>\s]*\.(m3u8|mp4)[^"']*)/i
    };
    const match = html.match(regexMap[balancerId]);
    return match ? match[1] : null;
  }

  // Запуск видео (Lampa Player + streamproxy)
  function playVideo(url, title) {
    if (!url) {
      safeNoty('Неверная ссылка на видео');
      return;
    }

    const movieData = {
      title: title,
      file: url.startsWith(LAMPA_PROXY) ? url : url, // Уже через proxy
      type: 'movie'
    };

    if (window.Lampa?.Player?.play) {
      Lampa.Player.play(movieData);
    } else {
      Lampa.Activity.push({
        url: '',
        component: 'player',
        source: movieData,
        title: title
      });
    }
    
    safeNoty('Запуск видео...');
  }

  // Основное окно (логотип + балансеры)
  function openAndrozon() {
    const movieInfo = getMovieInfo();
    
    const html = $(`
      <div class="androzon-modal" style="text-align: center;">
        <img src="${LOGO_URL}" style="width: 60px; height: 60px; margin-bottom: 10px;">
        <h2 style="margin: 0 0 10px 0; color: #ff7e00;">Androzon Player</h2>
        <div style="background: #2a2a2a; padding: 10px; border-radius: 8px; margin-bottom: 15px;">
          <div style="font-weight: bold;">${movieInfo.title}</div>
          ${movieInfo.year ? `<div style="color: #888; font-size: 14px;">${movieInfo.year} год</div>` : ''}
        </div>
        
        <h3 style="margin: 0 0 15px 0; color: #fff;">Выберите источник:</h3>
        <div class="balancers-list" style="display: flex; flex-direction: column; gap: 10px;">
          <div class="selector balancer-item" data-balancer="rezka" 
               style="background: #3a3a3a; padding: 15px; border-radius: 10px; cursor: pointer; border: 2px solid transparent;">
            <div style="font-weight: bold; color: #4CAF50;">Rezka</div>
            <div style="font-size: 12px; color: #888; margin-top: 5px;">rezka.ag (proxy)</div>
          </div>
          <div class="selector balancer-item" data-balancer="filmix" 
               style="background: #3a3a3a; padding: 15px; border-radius: 10px; cursor: pointer; border: 2px solid transparent;">
            <div style="font-weight: bold; color: #2196F3;">Filmix</div>
            <div style="font-size: 12px; color: #888; margin-top: 5px;">filmix.ac (token: ${FILMIX_TOKEN ? 'OK' : 'add token'})</div>
          </div>
        </div>
      </div>
    `);

    // Обработчики (touch + пульт)
    html.find('.balancer-item').on('hover:enter', function() {
      const balancerId = $(this).data('balancer');
      Lampa.Modal.close();
      searchUniversal(balancerId, movieInfo);
    });

    if (isFireTV || isTizen) {
      html.find('.balancer-item').on('keydown', function(e) {
        if (e.code === 'Enter' || e.code === 'OK') {
          const balancerId = $(this).data('balancer');
          Lampa.Modal.close();
          searchUniversal(balancerId, movieInfo);
        }
      });
    }

    // Фокус для пульта
    html.find('.balancer-item').on('hover:focus', function() {
      html.find('.balancer-item').css({'border-color': 'transparent'});
      $(this).css({'border-color': '#ff7e00'});
    });

    Lampa.Modal.open({
      title: 'Androzon Player',
      html: html,
      size: 'medium',
      onBack: function() {
        Lampa.Modal.close();
      }
    });
  }

  // Вставка кнопки (улучшено для Tizen/Fire TV)
  function insertButton() {
    let buttonBlock = $('.full-start-new__buttons, .full-start__buttons'); // Fallback классы
    if (!buttonBlock.length) {
      buttonBlock = $('.full-start'); // Ultimate fallback
    }
    
    if (buttonBlock.length && !buttonBlock.find('.' + PLUGIN_ID).length) {
      const btn = createButton();
      buttonBlock.append(btn);
      log('✅ Кнопка Androzon добавлена');
      
      // Для Tizen: MutationObserver для повторной вставки
      if (isTizen) {
        const observer = new MutationObserver(function(mutations) {
          mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && !buttonBlock.find('.' + PLUGIN_ID).length) {
              insertButton();
            }
          });
        });
        observer.observe(buttonBlock[0], { childList: true, subtree: true });
      }
    }
  }

  // Глобальный listener для пульта (Fire TV/Tizen)
  function setupRemoteListener() {
    if (isFireTV || isTizen) {
      Lampa.Controller.listener.follow('keydown', function(e) {
        if (e.code === 'Enter' || e.code === 'OK') {
          const focused = $('.selector.focus');
          if (focused.hasClass(PLUGIN_ID)) {
            e.preventDefault();
            openAndrozon();
          }
        }
      });
    }
  }

  function followApp() {
    if (!window.Lampa?.Listener?.follow) return;
    Lampa.Listener.follow('full', function(e) {
      if (e.type === 'build') {
        // Увеличенный timeout для Tizen
        setTimeout(function() {
          insertButton();
          setupRemoteListener();
        }, isTizen ? 2000 : 1000);
      }
    });
  }

  function init() {
    followApp();
    log('✅ Плагин Androzon инициализирован (Tizen: ' + isTizen + ', FireTV: ' + isFireTV + ')');
  }

  init();
})();
