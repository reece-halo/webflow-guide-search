document.addEventListener('DOMContentLoaded', () => {
    const input = document.querySelector('#guides-search');
    const header = document.querySelector('.guides-search-results-header');
    const results = document.querySelector('.guides-search-results');
    const tree = document.querySelector('.guides-tree');
    const parent = document.querySelector('.guides-search-results-outer');

    const statusText = header.querySelector('.status');
    const resultsText = header.querySelector('.results');

    if (!input || !results || !tree) return;

    let debounceTimer;
    let currentRequest;

    function showTree() {
        results.innerHTML = '';
        parent.style.display = 'none';
        tree.style.display = 'block';
    }

    function showStatus(message) {
        tree.style.display = 'none';
        results.style.display = 'none';
        statusText.textContent = message;
        resultsText.textContent = '';
    }

    function renderResults(items) {
        tree.style.display = 'none';
        parent.style.display = 'block';
        results.style.display = 'block';
        results.innerHTML = '';

        const availableFaqListIds = getAvailableFaqIds();

        const validatedGuides = items.filter(guide =>
            guide.faqlists?.some(faq => availableFaqListIds.has(String(faq.id))) || guide.id == 2384
        );

        if (!validatedGuides.length) {
            showStatus('No guides found.');
            return;
        }

        statusText.textContent = '';
        resultsText.textContent = `${validatedGuides.length} results`;

        validatedGuides.forEach((item) => {
            const outerDiv = document.createElement('div');
            outerDiv.className = 'guide-search-results w-dyn-item';
            outerDiv.role = 'listitem';

            const link = document.createElement('a');
            link.href = `/guides/${item.id}`;
            link.className = 'guide-link-div w-inline-block';

            const title = document.createElement('div');
            title.className = 'guide-search-result-title';
            title.textContent = item.name || '';

            link.appendChild(title);
            outerDiv.appendChild(link);
            results.appendChild(outerDiv);
        });
    }

    async function searchGuides(query) {
        currentRequest?.abort();
        currentRequest = new AbortController();
        showStatus('Searching...');

        const url = new URL("/api/kbarticle", "https://halo.haloservicedesk.com");
        url.searchParams.set("search", query);
        url.searchParams.set("isportal", "true");
        url.searchParams.set("pageinate", "true");
        url.searchParams.set("page_size", "50");
        url.searchParams.set("page_no", "1");
        url.searchParams.set("includefaqlists", "true");

        try {
            const response = await fetch(url, {
                signal: currentRequest.signal,
                headers: {
                    Accept: 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`);
            }

            const data = await response.json();
            let guides = data.articles || [];

            // This is to handle also being excluded from search because it is a stop word
            if (query.startsWith("also")) {
                guides.push({
                    id: 2384,
                    name: "ALSO Integration"
                });
            }

            renderResults(guides);
        } catch (error) {
            if (error.name === 'AbortError') return;

            console.error('[Guide Search]', error);
            showStatus('Unable to search guides.');
        }
    }

    function handleSearch() {
        const query = input.value.trim();

        clearTimeout(debounceTimer);

        if (!query) {
            currentRequest?.abort();
            showTree();
            return;
        }

        debounceTimer = setTimeout(() => {
            searchGuides(query);
        }, 300);
    }

    input.addEventListener('input', handleSearch);
    input.addEventListener('search', handleSearch);

    input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;

        event.preventDefault();
        clearTimeout(debounceTimer);

        const query = input.value.trim();

        if (query) {
            searchGuides(query);
        }
    });

    if (input.value.trim()) {
        searchGuides(input.value.trim());
    } else {
        showTree();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const input = document.querySelector('#guides-search');
    const results = document.querySelector('.guides-search-results-outer');
    const tree = document.querySelector('.guides-tree');

    if (!input || !results || !tree) return;

    function syncSearchUi() {
        const hasQuery = input.value.trim().length > 0;

        results.style.display = hasQuery ? 'block' : 'none';
        tree.style.display = hasQuery ? 'none' : 'block';
    }

    input.addEventListener('input', syncSearchUi);
    input.addEventListener('search', syncSearchUi);

    syncSearchUi();
});

// #region Helpers

function getAvailableFaqIds() {
    return new Set(Array
        .from(document.querySelectorAll('.guides-tree a[fs-list-element="item-link"][href^="/faq/"]'))
        .map(link => { return link.pathname.split('/').pop(); }));
}

// #endregion