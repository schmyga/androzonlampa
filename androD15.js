(() => {
    if (typeof Lampa === 'undefined') {
        console.warn('Lampa не определена, плагин Androzon не инициализирован');
        return;
    }

    const sources = [
        { name: 'Rezka', url: 'https://rezka.ag/search/?q=' },
        { name: 'Filmix', url: 'https://filmix.ac/search?q=' },
        { name: 'Kodik', url: 'https://kodik.cc/search?query=' },
        { name: 'VideoCDN', url: 'https://videocdn.tv/search?q=' }
    ];

    function createSearchModal(title) {
        const modal = $('<div class="search-modal"></div>');
        const header = $(`<h2 style="margin-bottom:15px;">Поиск: ${title}</h2>`);
        modal.append(header);

        sources.forEach(source => {
            const link = $(`<a href="${source.url + encodeURIComponent(title)}" target="_blank" class="search-link">${source.name}</a>`);
            link.css({
                display: 'block',
                marginBottom: '10px',
                fontSize: '18px',
                color: '#00aaff',
                textDecoration: 'none'
            });
            modal.append(link);
        });

        const closeBtn = $('<button>Закрыть</button>');
        closeBtn.css({
            marginTop: '20px',
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#333',
            color: '#fff',
            border: 'none',
            cursor: 'pointer'
        });
        closeBtn.on('click', () => {
            modal.remove();
        });

        modal.append(closeBtn);
        $('body').append(modal);
    }

    function addSearchButton() {
        const btn = $('<div class="search-btn">🔍 Androzon</div>');
        btn.css({
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: '#222',
            color: '#fff',
            padding: '10px 15px',
            borderRadius: '8px',
            cursor: 'pointer',
            zIndex: 9999,
            fontSize: '16px',
            boxShadow: '0 0 10px rgba(0,0,0,0.5)'
        });

        btn.on('click', () => {
            const title = $('.full-title').text().trim();
            if (title) {
                createSearchModal(title);
            } else {
                alert('Название не найдено');
            }
        });

        $('body').append(btn);
    }

    function waitForTitleAndInject() {
        const interval = setInterval(() => {
            if ($('.full-title').length > 0) {
                clearInterval(interval);
                addSearchButton();
            }
        }, 1000);
    }

    waitForTitleAndInject();
})();
