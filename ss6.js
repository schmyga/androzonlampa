/*!
 * Androzon — кнопка рядом с "Смотреть" на экране фильма
 * Работает на всех версиях Lampa (yumata / mod / Androzon / TV)
 */

(function () {
  const PLUGIN_ID = 'androzon_button';
  const PLUGIN_TITLE = 'Androzon';
  const DEBUG = true;

  // Балансеры с API
  const BALANCERS = {
    'rezka': {
      name: 'Rezka',
      url: 'https://rezka.ag',
      search: '/search/?do=search&subaction=search&q='
    },
    'filmix': {
      name: 'Filmix',
      url: 'https://filmix.ac',
      search: '/search/'
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
    const button = $('<div class="full-start__button selector" style="background: linear-gradient(135deg, #ff7e00, #ffb700); border-radius: 50px; padding: 0 20px; margin-left: 10px;">')
      .html('<span>Androzon</span>');

    button.on('hover:enter', function () {
      safeNoty('Загрузка через Androzon...');
      openAndrozon();
    });

    return button;
  }

  // Получить информацию о текущем фильме
  function getMovieInfo() {
    const title = $('.full-start-new__title').text().trim();
    const year = $('.full-start__details').text().match(/\d{4}/)?.[0] || '';
    const originalTitle = $('.full-start__original').text().trim() || title;
    
    // Получаем ID фильма из URL
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

  // Универсальный поиск через прокси
  async function searchUniversal(balancerId, movieInfo) {
    try {
      safeNoty(`Поиск через ${BALANCERS[balancerId].name}...`);
      
      // Используем прокси для обхода CORS
      const proxyUrl = 'https://corsproxy.io/?';
      const searchUrl = `${BALANCERS[balancerId].url}${BALANCERS[balancerId].search}${encodeURIComponent(movieInfo.searchQuery)}`;
      
      const response = await fetch(proxyUrl + encodeURIComponent(searchUrl));
      const html = await response.text();
      
      // Парсим HTML и находим ссылки на видео
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const videoLinks = findVideoLinks(doc, balancerId);
      
      if (videoLinks.length > 0) {
        showVideoLinks(videoLinks, BALANCERS[balancerId].name, movieInfo.title);
      } else {
        safeNoty(`Не найдено ссылок через ${BALANCERS[balancerId].name}`);
      }
      
    } catch (error) {
      console.error(`${balancerId} error:`, error);
      safeNoty(`Ошибка ${BALANCERS[balancerId].name}`);
    }
  }

  // Поиск видео ссылок в HTML
  function findVideoLinks(doc, balancerId) {
    const links = [];
    
    switch(balancerId) {
      case 'rezka':
        doc.querySelectorAll('a[href*="/films/"], a[href*="/series/"]').forEach(link => {
          if (link.href && !link.href.includes('/search/')) {
            links.push({
              url: link.href,
              title: link.textContent.trim() || 'Rezka Video',
              balancer: balancerId
            });
          }
        });
        break;
        
      case 'filmix':
        doc.querySelectorAll('a[href*="/film/"], a[href*="/movie/"]').forEach(link => {
          if (link.href && !link.href.includes('/search/')) {
            links.push({
              url: link.href,
              title: link.textContent.trim() || 'Filmix Video',
              balancer: balancerId
            });
          }
        });
        break;
    }
    
    return links.slice(0, 5); // Ограничиваем 5 результатами
  }

  // Показать найденные ссылки для выбора
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

    // Обработчики для ссылок
    html.find('.video-link').on('hover:enter', function() {
      const url = $(this).data('url');
      const balancer = $(this).data('balancer');
      Lampa.Modal.close();
      parseAndPlayVideo(url, balancer, movieTitle);
    });

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

  // Парсинг и воспроизведение видео
  async function parseAndPlayVideo(url, balancerId, title) {
    try {
      safeNoty('Парсинг видео...');
      
      let videoUrl = null;
      
      // Используем встроенные методы Lampa для извлечения
      if (balancerId === 'rezka') {
        try {
          const rezkaData = await Lampa.Extract.rezka(url);
          if (rezkaData && rezkaData.url) {
            videoUrl = rezkaData.url; // m3u8 или mp4
          }
        } catch (e) {
          console.error('Rezka extract error:', e);
          safeNoty('Ошибка парсинга Rezka');
        }
      } else if (balancerId === 'filmix') {
        try {
          const filmixData = await Lampa.Extract.filmix(url);
          if (filmixData && filmixData.url) {
            videoUrl = filmixData.url; // m3u8 или mp4
          }
        } catch (e) {
          console.error('Filmix extract error:', e);
          safeNoty('Ошибка парсинга Filmix');
        }
      }

      // Fallback: парсинг через прокси, если Lampa.Extract не сработал
      if (!videoUrl) {
        const proxyUrl = 'https://corsproxy.io/?';
        const response = await fetch(proxyUrl + encodeURIComponent(url));
        const html = await response.text();
        videoUrl = extractVideoUrl(html, balancerId);
      }
      
      if (videoUrl) {
        playVideo(videoUrl, `${BALANCERS[balancerId].name} - ${title}`);
      } else {
        safeNoty('Не удалось извлечь видео');
      }
      
    } catch (error) {
      console.error('Parse error:', error);
      safeNoty('Ошибка парсинга');
    }
  }

  // Извлечение видео URL из HTML (fallback)
  function extractVideoUrl(html, balancerId) {
    let regexMap = {
      'rezka': /(https?:\/\/[^"'>\s]*\.(m3u8|mp4)[^"']*)/i,
      'filmix': /(https?:\/\/[^"'>\s]*\.(m3u8|mp4)[^"']*)/i
    };

    // Попытка извлечь через DOM
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
          const data = JSON.parse(match[1]);
          return data.link || null;
        }
      }
    }
    
    // Fallback на regex
    const match = html.match(regexMap[balancerId]);
    return match ? match[1] : null;
  }

  // Запуск видео в плеере Lampa
  function playVideo(url, title) {
    if (!url) {
      safeNoty('Неверная ссылка на видео');
      return;
    }

    // Создаем объект для плеера Lampa
    const movieData = {
      title: title,
      file: url,
      type: 'movie' // или 'serial' для сериалов
    };

    // Запускаем в стандартном плеере Lampa
    if (window.Lampa && window.Lampa.Player && window.Lampa.Player.play) {
      Lampa.Player.play(movieData);
    } else {
      // Альтернативный способ через Activity
      Lampa.Activity.push({
        url: '',
        component: 'player',
        source: movieData,
        title: title
      });
    }
    
    safeNoty('Запуск видео...');
  }

  // Основное окно Androzon
  function openAndrozon() {
    const movieInfo = getMovieInfo();
    
    const html = $(`
      <div class="androzon-modal">
        <div style="padding: 1.5em;">
          <div style="text-align: center; margin-bottom: 1.5em;">
            <h2 style="margin: 0 0 10px 0; color: #ff7e00;">Androzon Player</h2>
            <div style="background: #2a2a2a; padding: 10px; border-radius: 8px; margin-bottom: 15px;">
              <div style="font-weight: bold;">${movieInfo.title}</div>
              ${movieInfo.year ? `<div style="color: #888; font-size: 14px;">${movieInfo.year} год</div>` : ''}
            </div>
          </div>
          
          <div style="margin-bottom: 1.5em;">
            <h3 style="margin: 0 0 15px 0; color: #fff;">Выберите источник:</h3>
            <div class="balancers-list" style="display: flex; flex-direction: column; gap: 10px;">
              <div class="selector balancer-item" data-balancer="rezka" 
                   style="background: #3a3a3a; padding: 15px; border-radius: 10px; cursor: pointer; border: 2px solid transparent;">
                <div style="font-weight: bold; color: #4CAF50;">Rezka</div>
                <div style="font-size: 12px; color: #888; margin-top: 5px;">Поиск на rezka.ag</div>
              </div>
              <div class="selector balancer-item" data-balancer="filmix" 
                   style="background: #3a3a3a; padding: 15px; border-radius: 10px; cursor: pointer; border: 2px solid transparent;">
                <div style="font-weight: bold; color: #2196F3;">Filmix</div>
                <div style="font-size: 12px; color: #888; margin-top: 5px;">Поиск на filmix.ac</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `);

    // Обработчики для балансеров
    html.find('.balancer-item').on('hover:enter', function() {
      const balancerId = $(this).data('balancer');
      Lampa.Modal.close();
      searchUniversal(balancerId, movieInfo);
    });

    // Эффекты фокуса
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

  function insertButton() {
    const buttonBlock = $('.full-start-new__buttons');
    if (buttonBlock.length && !buttonBlock.find('.' + PLUGIN_ID).length) {
      const btn = createButton();
      btn.addClass(PLUGIN_ID);
      buttonBlock.append(btn);
      log('✅ Кнопка Androzon добавлена');
    }
  }

  function followApp() {
    if (!window.Lampa?.Listener?.follow) return;
    Lampa.Listener.follow('full', e => {
      if (e.type === 'build') setTimeout(insertButton, 1000);
    });
  }

  function init() {
    followApp();
    log('✅ Плагин Androzon инициализирован');
  }

  init();
})();
