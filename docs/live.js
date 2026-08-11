(() => {
    const ITEM_SEL = '.faq-l1-item';
    const HEADER_SEL = ':scope > .faq-l1-header';
    const BODY_SEL = ':scope > .faq-l1-body';

    function isOpen(item) {
        const header = item.querySelector(HEADER_SEL);
        const aria = header ? header.getAttribute('aria-expanded') : null;

        // When aria-expanded exists, trust it exclusively (both directions).
        // This ignores stale "is-active-accordion" classes that linger after close.
        if (aria !== null) return aria === 'true';

        // No aria-expanded at all — fall back to class signals.
        if (item.classList.contains('is-active-accordion') || item.classList.contains('is-accordion-active')) return true;
        const body = item.querySelector(BODY_SEL);
        if (body && (body.classList.contains('is-active-accordion') || body.classList.contains('is-accordion-active'))) return true;
        return false;
    }

    function sync() {
        document.querySelectorAll(ITEM_SEL).forEach((item) => {
            const body = item.querySelector(BODY_SEL);
            if (!body) return;

            body.style.setProperty('transition', 'none', 'important');

            if (isOpen(item)) {
                body.style.setProperty('max-height', 'none', 'important');
                body.style.setProperty('overflow', 'visible', 'important');
                body.style.removeProperty('display');
            } else {
                body.style.setProperty('max-height', '0px', 'important');
                body.style.setProperty('overflow', 'hidden', 'important');
            }
        });
    }

    // Watch only aria-expanded + class (NOT style), so our own style
    // writes never re-trigger the observer — no feedback loop.
    const obs = new MutationObserver(sync);

    function start() {
        const root = document.querySelector('.guides-sidebar') || document.body;
        if (!root) {
            // Body not parsed yet — wait for it, then start.
            document.addEventListener('DOMContentLoaded', start, { once: true });
            return;
        }
        obs.observe(root, {
            subtree: true,
            attributes: true,
            attributeFilter: ['aria-expanded', 'class'],
        });
        sync();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
    window.addEventListener('load', sync);
    window.addEventListener('guides:loaded', () => setTimeout(sync, 0));
})();

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.guides-feedback-inner').forEach((root) => {
        const form = root.querySelector('form');
        const success = root.querySelector('.w-form-done');
        const quick = root.querySelector('.guides-quickfb-wrapper');

        if (!form || !success || !quick) return;

        const obs = new MutationObserver(() => {
            const successVisible = getComputedStyle(success).display !== 'none';

            if (successVisible) {
                quick.style.display = 'none';
            }
        });

        obs.observe(success, {
            attributes: true,
            attributeFilter: ['style', 'class'],
        });
    });
});

document.addEventListener('DOMContentLoaded', () => {
    ['.guides-sidebar'].forEach((selector) => {
        document.querySelectorAll(selector).forEach((el) => {
            el.setAttribute('data-lenis-prevent', '');
            el.setAttribute('data-lenis-prevent-wheel', '');
            el.setAttribute('data-lenis-prevent-touch', '');
        });
    });
});

// API guide search
document.addEventListener('DOMContentLoaded', () => {
    const input = document.querySelector('#guides-search');
    const results = document.querySelector('.guides-search-results');
    const tree = document.querySelector('.guides-tree');

    if (!input || !results || !tree) return;

    let debounceTimer;
    let currentRequest;

    function showTree() {
        results.innerHTML = '';
        results.style.display = 'none';
        tree.style.display = 'block';
    }

    function showLoading() {
        tree.style.display = 'none';
        results.style.display = 'block';
        results.innerHTML = '<div>Searching...</div>';
    }

    function showError() {
        tree.style.display = 'none';
        results.style.display = 'block';
        results.innerHTML = '<div>Unable to search guides.</div>';
    }

    function renderResults(items) {
        tree.style.display = 'none';
        results.style.display = 'block';
        results.innerHTML = '';

        if (!items.length) {
            results.innerHTML = '<div>No guides found.</div>';
            return;
        }

        const availableFaqLists = getAvailableFaqs();
        const validatedGuides = items.filter(guide => {
            guide.faqliststr?.split(",").some(faqId => {
                availableFaqLists.has(String(faqId))
            });
        });

        items.forEach((item) => {
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
        showLoading();

        const url = new URL("/api/kbarticle", "https://halo.haloservicedesk.com");
        url.searchParams.set("search", query);
        url.searchParams.set("isportal", "true");
        url.searchParams.set("pageinate", "true");
        url.searchParams.set("page_size", "10");
        url.searchParams.set("page_no", "1");
        url.searchParams.set("includefaqliststr", "true");

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

            renderResults(data.articles || []);
        } catch (error) {
            if (error.name === 'AbortError') return;

            console.error('[Guide Search]', error);
            showError();
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
    const results = document.querySelector('.guides-search-results');
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

(() => {
    function initQuickFeedback() {
        const root = document.querySelector('.guides-feedback-inner');
        if (!root) return;

        const quickWrap = root.querySelector('.guides-quickfb-wrapper');
        const icons = root.querySelectorAll('.guides-quickfb-wrapper .fbicon[data-feedback]');
        const form = root.querySelector('form');

        if (!quickWrap || !icons.length || !form) return;

        const hidden = form.querySelector('#quick_feedback') || form.querySelector('input[name="quick_feedback"]') || form.querySelector('input[name="quick-feedback"]');

        if (!hidden) {
            console.warn('[QuickFB] Hidden field not found inside form.');
            return;
        }

        const setHidden = (val) => {
            hidden.value = val || '';
            hidden.dispatchEvent(new Event('input', { bubbles: true }));
            hidden.dispatchEvent(new Event('change', { bubbles: true }));
        };

        function clearSelection() {
            setHidden('');
            quickWrap.classList.remove('has-selection');
            icons.forEach((icon) => {
                icon.classList.remove('is-selected');
                icon.setAttribute('aria-pressed', 'false');
            });
        }

        function setSelection(value) {
            setHidden(value);
            quickWrap.classList.add('has-selection');
            icons.forEach((icon) => {
                const isSel = icon.dataset.feedback === value;
                icon.classList.toggle('is-selected', isSel);
                icon.setAttribute('aria-pressed', isSel ? 'true' : 'false');
            });
        }

        function toggleFromIcon(icon) {
            const value = icon.dataset.feedback;
            const already = icon.classList.contains('is-selected');
            if (already) clearSelection();
            else setSelection(value);
        }

        icons.forEach((icon) => {
            icon.setAttribute('role', 'button');
            icon.setAttribute('tabindex', '0');
            icon.setAttribute('aria-pressed', 'false');

            icon.addEventListener('click', () => toggleFromIcon(icon));
            icon.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleFromIcon(icon);
                }
            });
        });

        form.addEventListener('reset', clearSelection);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initQuickFeedback);
    } else {
        initQuickFeedback();
    }
})();

(() => {
    function initContactToggle(scope = document) {
        const forms = scope.querySelectorAll('.guides-feedback-inner form');
        if (!forms.length) return;

        forms.forEach((form) => {
            if (form.dataset.contactToggleBound === '1') return;
            form.dataset.contactToggleBound = '1';

            const checkbox = form.querySelector('input.guides-feedback-contact[type="checkbox"]') || form.querySelector(".guides-feedback-contact input[type='checkbox']") || form.querySelector('.guides-feedback-contact');

            const cond = form.querySelector('.guides-form-cond');
            if (!checkbox || !cond) {
                console.warn('[ContactToggle] Missing checkbox or .guides-form-cond', { checkbox, cond });
                return;
            }

            const nameInput = cond.querySelector('input[type="text"], input[name*="name"], input[id*="name"]');
            const emailInput = cond.querySelector('input[type="email"], input[name*="email"], input[id*="email"]');

            function sync() {
                const show = !!checkbox.checked;

                cond.style.display = show ? 'block' : 'none';

                if (nameInput) nameInput.required = show;
                if (emailInput) emailInput.required = show;

                if (!show) {
                    if (nameInput) nameInput.value = '';
                    if (emailInput) emailInput.value = '';
                }
            }

            checkbox.addEventListener('change', sync);
            form.addEventListener('reset', () => setTimeout(sync, 0));

            sync();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initContactToggle(document));
    } else {
        initContactToggle(document);
    }

    window.initGuidesFeedbackContactToggle = () => initContactToggle(document);
})();

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.guides-sidebar');
    const listWrap = document.querySelector('.guidescollection');
    if (!sidebar || !listWrap) return;

    sidebar.classList.add('is-loading');

    let settleTimer = null;
    let finished = false;

    const finish = () => {
        if (finished) return;
        finished = true;
        sidebar.classList.remove('is-loading');
        observer.disconnect();
    };

    const bump = () => {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(finish, 800);
    };

    const observer = new MutationObserver(bump);
    observer.observe(listWrap, { subtree: true, childList: true, attributes: true });

    setTimeout(finish, 6000);
    setTimeout(bump, 50);
});

(() => {
    const SIDEBAR_SEL = '.guides-sidebar';
    const OVERLAY_SEL = '.sidebar-loading-overlay';
    const FADE_MS = 350;

    function showOverlay(overlay) {
        overlay.style.display = 'flex';
        overlay.style.pointerEvents = 'auto';
        requestAnimationFrame(() => (overlay.style.opacity = '1'));
    }

    function hideOverlay(overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.pointerEvents = 'none';
            overlay.style.display = 'none';
        }, FADE_MS);
    }

    function sync() {
        const sidebar = document.querySelector(SIDEBAR_SEL);
        if (!sidebar) return;

        const overlay = sidebar.querySelector(OVERLAY_SEL);
        if (!overlay) return;

        const loading = sidebar.classList.contains('is-loading');

        if (loading) showOverlay(overlay);
        else if (getComputedStyle(overlay).display !== 'none') hideOverlay(overlay);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const sidebar = document.querySelector(SIDEBAR_SEL);
        if (!sidebar) return;

        const overlay = sidebar.querySelector(OVERLAY_SEL);
        if (overlay) {
            overlay.style.display = 'none';
            overlay.style.opacity = '0';
            overlay.style.pointerEvents = 'none';
        }

        sync();

        const obs = new MutationObserver(sync);
        obs.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    });
})();

document.addEventListener('DOMContentLoaded', () => {
    (() => {
        const LINK_SELECTOR = 'a.guide-link-div.w-inline-block';
        const SWAP_SELECTOR = '.guides-content-col';
        const LOADER_SELECTOR = '.guide-loader';
        const SCROLL_PANE_SELECTOR = '.guides-content';
        const HEADER_TITLE_SELECTOR = '.guides-display-title';
        const HEADER_SELECTOR = '.guides-display-header';
        const FEEDBACK_WRAPPER_SELECTOR = '.guides-feedback-form-wrapper';
        const GUIDE_GROUP_TABS_SELECTOR = '.guides-group-tabs';

        const FEEDBACK_FORM_SELECTOR = `${FEEDBACK_WRAPPER_SELECTOR} form`;
        const FEEDBACK_GUIDE_NAME_SELECTOR = '#feedback-guide-name';
        const FEEDBACK_URL_SELECTOR = '#feedback-guide-url';

        const cache = new Map();

        const isSameOrigin = (href) => {
            try {
                return new URL(href, location.href).origin === location.origin;
            } catch {
                return false;
            }
        };

        const normalizeUrl = (href) => new URL(href, location.href).toString();

        function clearActive() {
            document.querySelectorAll(LINK_SELECTOR).forEach((link) => {
                link.classList.remove('is-active-guide');
            });
        }

        function setActiveEl(el) {
            if (!el) return;
            clearActive();
            el.classList.add('is-active-guide');
        }

        function closeOtherTopLevelAccordions(activeLink) {
            const activeTopLevel = activeLink?.closest('.faq-l1-item');

            document.querySelectorAll('.faq-l1-item').forEach((item) => {
                if (item === activeTopLevel) return;

                const header = item.querySelector(':scope > .faq-l1-header, :scope > .fs_accordion-2_header');
                const content = item.querySelector(':scope > .faq-l1-body, :scope > .fs_accordion-2_content');

                item.classList.remove('is-active-accordion', 'is-accordion-active');

                if (header) {
                    header.setAttribute('aria-expanded', 'false');
                }

                if (content) {
                    content.classList.remove('is-active-accordion', 'is-accordion-active');
                    content.style.display = 'none';
                    content.style.maxHeight = '0px';
                }
            });
        }

        function setActiveFromUrl(url) {
            const path = new URL(url, location.href).pathname;
            const links = document.querySelectorAll(LINK_SELECTOR);
            for (const link of links) {
                const linkPath = new URL(link.href, location.href).pathname;
                if (linkPath === path) {
                    setActiveEl(link);
                    return;
                }
            }
            clearActive();
        }

        async function fetchGuidePage(url) {
            if (cache.has(url)) return cache.get(url);

            const res = await fetch(url, { credentials: 'same-origin' });
            if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);

            const text = await res.text();
            const doc = new DOMParser().parseFromString(text, 'text/html');

            const swapEl = doc.querySelector(SWAP_SELECTOR);
            if (!swapEl) throw new Error(`Could not find ${SWAP_SELECTOR} on ${url}`);

            const fetchedHeaderTitle = doc.querySelector(HEADER_TITLE_SELECTOR)?.textContent?.trim() || doc.querySelector('h1')?.textContent?.trim() || '';

            const title = doc.querySelector('title')?.textContent || document.title;

            const payload = { html: swapEl.innerHTML, title, headerTitle: fetchedHeaderTitle };
            cache.set(url, payload);
            return payload;
        }

        function setPeripheralVisibility(isLoading) {
            const header = document.querySelector(HEADER_SELECTOR);
            const feedback = document.querySelector(FEEDBACK_WRAPPER_SELECTOR);
            const tabs = document.querySelector(GUIDE_GROUP_TABS_SELECTOR);

            if (isLoading) {
                if (header) header.style.display = 'none';
                if (feedback) feedback.style.display = 'none';

                if (tabs) {
                    tabs.style.visibility = 'hidden';
                    tabs.style.opacity = '0';
                    tabs.style.pointerEvents = 'none';
                }
                return;
            }

            if (header) header.style.display = '';
            if (feedback) feedback.style.display = '';

            if (tabs) {
                tabs.style.visibility = '';
                tabs.style.opacity = '';
                tabs.style.pointerEvents = '';
            }
        }

        function showGuideLoader() {
            const swap = document.querySelector(SWAP_SELECTOR);
            const loader = document.querySelector(LOADER_SELECTOR);
            if (swap) swap.style.display = 'none';
            if (loader) loader.style.display = 'flex';
            setPeripheralVisibility(true);
        }

        function hideGuideLoader() {
            const swap = document.querySelector(SWAP_SELECTOR);
            const loader = document.querySelector(LOADER_SELECTOR);
            if (loader) loader.style.display = 'none';
            if (swap) swap.style.display = '';
            setPeripheralVisibility(false);
        }

        function updateHeaderTitle(text) {
            if (!text) return;
            const el = document.querySelector(HEADER_TITLE_SELECTOR);
            if (el) el.textContent = text;
        }

        function setFieldValue(el, value) {
            if (!el) return;
            const tag = el.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select') {
                el.value = value ?? '';
            } else {
                el.textContent = value ?? '';
            }
        }

        function setFeedbackContext({ guideTitle, url }) {
            const nameEl = document.querySelector(FEEDBACK_GUIDE_NAME_SELECTOR);
            const urlEl = document.querySelector(FEEDBACK_URL_SELECTOR);

            setFieldValue(nameEl, guideTitle || '');
            if (urlEl) setFieldValue(urlEl, url || location.href);
        }

        function resetFeedbackForm({ guideTitle, url }) {
            const form = document.querySelector(FEEDBACK_FORM_SELECTOR);
            if (!form) return;

            form.reset();

            form.querySelectorAll('input, textarea, select').forEach((el) => {
                if (el.matches(FEEDBACK_GUIDE_NAME_SELECTOR)) return;
                if (el.matches(FEEDBACK_URL_SELECTOR)) return;

                const type = (el.getAttribute('type') || '').toLowerCase();

                if (type === 'checkbox' || type === 'radio') {
                    el.checked = false;
                } else if (type === 'submit' || type === 'button' || type === 'hidden') {
                    // leave hidden alone
                } else {
                    el.value = '';
                }
            });

            setFeedbackContext({ guideTitle, url });
        }

        function applyFeedbackRefreshAfterSwap({ guideTitle, url }) {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    resetFeedbackForm({ guideTitle, url });
                }, 0);
            });
        }

        async function swapTo(url, { push = true } = {}) {
            const loaderTimer = setTimeout(showGuideLoader, 120);

            try {
                const { html, title, headerTitle } = await fetchGuidePage(url);

                const swap = document.querySelector(SWAP_SELECTOR);
                if (!swap) return;

                swap.innerHTML = html;

                window.hydrateGuide?.();
                window.initGuidesFeedbackContactToggle?.();

                updateHeaderTitle(headerTitle);

                if (title) document.title = title;
                if (push) history.pushState({ url }, '', url);

                const pane = document.querySelector(SCROLL_PANE_SELECTOR);
                if (pane) pane.scrollTop = 0;

                swapTo._pendingFeedback = { guideTitle: headerTitle, url };
            } finally {
                clearTimeout(loaderTimer);
                hideGuideLoader();

                window.dispatchEvent(
                    new CustomEvent('guides:loaded', {
                        detail: { url },
                    }),
                );

                const activeLink = document.querySelector('a.guide-link-div.w-inline-block.is-active-guide');
                if (activeLink) closeOtherTopLevelAccordions(activeLink);

                if (swapTo._pendingFeedback) {
                    applyFeedbackRefreshAfterSwap(swapTo._pendingFeedback);
                    swapTo._pendingFeedback = null;
                }
            }
        }

        document.addEventListener(
            'click',
            (e) => {
                const a = e.target.closest(LINK_SELECTOR);
                if (!a) return;

                const href = a.getAttribute('href');
                if (!href) return;
                if (!isSameOrigin(href)) return;
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

                setActiveEl(a);
                closeOtherTopLevelAccordions(a);
                e.preventDefault();

                const url = normalizeUrl(href);
                swapTo(url, { push: true }).catch((err) => console.error('[Guides AJAX]', err));
            },
            true,
        );

        window.addEventListener('popstate', (e) => {
            const url = e.state?.url ? e.state.url : location.href;
            swapTo(url, { push: false }).catch((err) => console.error('[Guides AJAX]', err));
            setActiveFromUrl(url);

            const activeLink = document.querySelector('a.guide-link-div.w-inline-block.is-active-guide');
            if (activeLink) closeOtherTopLevelAccordions(activeLink);
        });

        history.replaceState({ url: location.href }, '', location.href);
        setActiveFromUrl(location.href);

        window.dispatchEvent(
            new CustomEvent('guides:loaded', {
                detail: { url: location.href },
            }),
        );

        setFeedbackContext({
            guideTitle: document.querySelector(HEADER_TITLE_SELECTOR)?.textContent?.trim() || '',
            url: location.href,
        });
    })();
});

(() => {
    const GUIDE_GROUP_FLAG_CLASS = 'guide-group-flag';
    const CLICKABLE_HEADER_SELECTOR = '.faq-l1-header, .fs_accordion-2_header';
    const GUIDE_GROUP_GUIDES_SELECTOR = '.guide-group-guides';
    const GUIDE_GROUP_GUIDE_LINK_SELECTOR = '.guide-group-guide-link';
    const TABS_WRAPPER_SELECTOR = '.guides-group-tabs';
    const TABS_INNER_SELECTOR = '.guides-group-tabs-inner';

    function hasDirectGuideGroupFlag(el) {
        if (!el) return false;

        return Array.from(el.children).some((child) => child.classList && child.classList.contains(GUIDE_GROUP_FLAG_CLASS));
    }

    function findNearestGuideGroupOwner(startEl) {
        let el = startEl;

        while (el && el !== document.body) {
            if (hasDirectGuideGroupFlag(el)) {
                return el;
            }
            el = el.parentElement;
        }

        return null;
    }

    function getGuideLinksFromGroupOwner(groupOwner) {
        if (!groupOwner) return [];

        return Array.from(groupOwner.querySelectorAll(`${GUIDE_GROUP_GUIDES_SELECTOR} ${GUIDE_GROUP_GUIDE_LINK_SELECTOR}`)).filter((link) => link.getAttribute('href'));
    }

    function getTabsElements() {
        const wrapper = document.querySelector(TABS_WRAPPER_SELECTOR);
        const inner = document.querySelector(TABS_INNER_SELECTOR);
        return { wrapper, inner };
    }

    function showTabs() {
        const { wrapper } = getTabsElements();
        if (wrapper) wrapper.style.display = 'block';
    }

    function hideTabs() {
        const { wrapper, inner } = getTabsElements();
        if (inner) inner.innerHTML = '';
        if (wrapper) wrapper.style.display = 'none';
    }

    function renderGuideGroupTabs(links, activeUrl) {
        const { wrapper, inner } = getTabsElements();
        if (!wrapper || !inner) return;

        inner.innerHTML = '';

        if (!links.length) {
            hideTabs();
            return;
        }

        const activePath = new URL(activeUrl || location.href, location.href).pathname;

        links.forEach((link) => {
            const href = link.getAttribute('href');
            const text = (link.textContent || '').trim();

            const tab = document.createElement('a');
            tab.href = href;
            tab.textContent = text;
            tab.className = 'guide-group-tab';

            const tabPath = new URL(href, location.href).pathname;
            if (tabPath === activePath) {
                tab.classList.add('is-active');
            }

            inner.appendChild(tab);
        });

        showTabs();
    }

    function loadGuideViaExistingAjax(url) {
        const normalizedUrl = new URL(url, location.href).toString();
        history.pushState({ url: normalizedUrl }, '', normalizedUrl);
        window.dispatchEvent(new PopStateEvent('popstate', { state: { url: normalizedUrl } }));
    }

    function findGuideGroupOwnerByGuideUrl(url) {
        const targetPath = new URL(url, location.href).pathname;

        const allFlags = document.querySelectorAll(`.${GUIDE_GROUP_FLAG_CLASS}`);

        for (const flag of allFlags) {
            const owner = flag.parentElement;
            if (!owner) continue;

            const links = getGuideLinksFromGroupOwner(owner);
            const match = links.find((link) => {
                const href = link.getAttribute('href');
                if (!href) return false;
                return new URL(href, location.href).pathname === targetPath;
            });

            if (match) {
                return owner;
            }
        }

        return null;
    }

    window.syncTabsToCurrentGuide = function (url) {
        const owner = findGuideGroupOwnerByGuideUrl(url);

        if (!owner) {
            hideTabs();
            return;
        }

        const links = getGuideLinksFromGroupOwner(owner);
        renderGuideGroupTabs(links, url);
    };

    document.addEventListener(
        'click',
        (e) => {
            const header = e.target.closest(CLICKABLE_HEADER_SELECTOR);
            if (!header) return;

            const guideGroupOwner = findNearestGuideGroupOwner(header);
            if (!guideGroupOwner) return;

            const links = getGuideLinksFromGroupOwner(guideGroupOwner);
            if (!links.length) return;

            const firstHref = links[0].getAttribute('href');
            if (!firstHref) return;

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation?.();

            hideTabs();

            if (e && e.type === 'click') {
                loadGuideViaExistingAjax(firstHref);
            }
        },
        true,
    );

    document.addEventListener(
        'click',
        (e) => {
            const tab = e.target.closest('.guide-group-tab');
            if (!tab) return;

            const href = tab.getAttribute('href');
            if (!href) return;

            e.preventDefault();

            const { inner } = getTabsElements();
            if (inner) {
                inner.querySelectorAll('.guide-group-tab').forEach((t) => t.classList.remove('is-active'));
            }
            tab.classList.add('is-active');

            if (e && e.type === 'click') {
                loadGuideViaExistingAjax(href);
            }
        },
        true,
    );

    window.addEventListener('guides:loaded', (e) => {
        const url = e.detail?.url || location.href;
        window.syncTabsToCurrentGuide(url);
    });

    setTimeout(() => {
        window.syncTabsToCurrentGuide(location.href);
    }, 0);
})();

(() => {
    const GUIDE_LINK_SELECTOR = 'a.guide-link-div.w-inline-block';
    const SIDEBAR_SELECTOR = '.guides-sidebar';

    function getCurrentPath() {
        return new URL(location.href, location.href).pathname;
    }

    function findSidebarGuideLinkByUrl() {
        const path = getCurrentPath();

        return Array.from(document.querySelectorAll(GUIDE_LINK_SELECTOR)).find((link) => {
            try {
                return new URL(link.href, location.href).pathname === path;
            } catch {
                return false;
            }
        });
    }

    function getAccordionHeaderForItem(item) {
        if (!item) return null;

        if (item.matches('.faq-l1-item')) {
            return item.querySelector(':scope > .faq-l1-header');
        }

        if (item.matches('.fs_accordion-2_item')) {
            return item.querySelector(':scope > .fs_accordion-2_header');
        }

        return null;
    }

    function getAncestorAccordionItems(startItem) {
        const items = [];
        let node = startItem;

        while (node && node !== document.body) {
            if (node.matches?.('.faq-l1-item, .fs_accordion-2_item')) {
                items.push(node);
            }
            node = node.parentElement;
        }

        return items.reverse();
    }

    function isGuideGroupItem(item) {
        if (!item) return false;

        return Array.from(item.children).some((child) => child.classList && child.classList.contains('guide-group-flag'));
    }

    function openAccordionPathTo(linkEl) {
        const startItem = linkEl.closest('.faq-l1-item, .fs_accordion-2_item');
        if (!startItem) return;

        const items = getAncestorAccordionItems(startItem);

        items.forEach((item, index) => {
            const header = getAccordionHeaderForItem(item);
            if (!header) return;

            setTimeout(() => {
                // IMPORTANT: never programmatically click Guide Group items during restore
                if (isGuideGroupItem(item)) return;

                if (header.getAttribute('aria-expanded') !== 'true') {
                    header.click();
                }
            }, index * 90);
        });
    }

    function applyGuideHighlight(linkEl) {
        document.querySelectorAll(GUIDE_LINK_SELECTOR).forEach((link) => {
            link.classList.remove('is-active-guide');
        });

        if (linkEl) {
            linkEl.classList.add('is-active-guide');
        }
    }

    function waitForSidebarStability(callback) {
        const sidebar = document.querySelector(SIDEBAR_SELECTOR);
        if (!sidebar) {
            callback();
            return;
        }

        let settleTimer = null;
        let finished = false;

        const done = () => {
            if (finished) return;
            finished = true;
            observer.disconnect();
            callback();
        };

        const queueDone = () => {
            clearTimeout(settleTimer);

            if (sidebar.classList.contains('is-loading')) {
                settleTimer = setTimeout(queueDone, 150);
                return;
            }

            settleTimer = setTimeout(done, 450);
        };

        const observer = new MutationObserver(queueDone);
        observer.observe(sidebar, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['class', 'aria-expanded', 'style'],
        });

        queueDone();
        setTimeout(done, 4000);
    }

    function restoreSidebarAndTabs() {
        const activeLink = findSidebarGuideLinkByUrl();

        if (activeLink) {
            applyGuideHighlight(activeLink);
            openAccordionPathTo(activeLink);

            setTimeout(() => {
                applyGuideHighlight(activeLink);
                if (typeof window.syncTabsToCurrentGuide === 'function') {
                    window.syncTabsToCurrentGuide(location.href);
                }
            }, 700);

            return;
        }

        if (typeof window.syncTabsToCurrentGuide === 'function') {
            window.syncTabsToCurrentGuide(location.href);
        }
    }

    window.addEventListener('load', () => {
        waitForSidebarStability(() => {
            restoreSidebarAndTabs();
        });
    });
})();

(() => {
    const GUIDE_GROUP_FLAG_CLASS = 'guide-group-flag';
    const GUIDE_LINK_SELECTOR = 'a.guide-link-div.w-inline-block';

    function hasDirectGuideGroupFlag(el) {
        if (!el) return false;

        return Array.from(el.children).some((child) => child.classList && child.classList.contains(GUIDE_GROUP_FLAG_CLASS));
    }

    function markGuideGroupItems() {
        document.querySelectorAll('.faq-l1-item, .fs_accordion-2_item').forEach((item) => {
            item.classList.toggle('is-guide-group', hasDirectGuideGroupFlag(item));
        });
    }

    function getGuideLinksFromGroupOwner(groupOwner) {
        if (!groupOwner) return [];

        return Array.from(groupOwner.querySelectorAll('.guide-group-guides .guide-group-guide-link')).filter((link) => link.getAttribute('href'));
    }

    function findGuideGroupOwnerByGuideUrl(url) {
        const targetPath = new URL(url, location.href).pathname;

        const allFlags = document.querySelectorAll(`.${GUIDE_GROUP_FLAG_CLASS}`);

        for (const flag of allFlags) {
            const owner = flag.parentElement;
            if (!owner) continue;

            const links = getGuideLinksFromGroupOwner(owner);
            const match = links.find((link) => {
                const href = link.getAttribute('href');
                if (!href) return false;
                return new URL(href, location.href).pathname === targetPath;
            });

            if (match) return owner;
        }

        return null;
    }

    function clearGuideGroupHighlights() {
        document.querySelectorAll('.is-active-guide-group').forEach((el) => el.classList.remove('is-active-guide-group'));
    }

    function applyGuideGroupHighlightByUrl(url = location.href) {
        clearGuideGroupHighlights();

        const owner = findGuideGroupOwnerByGuideUrl(url);
        if (!owner) return;

        owner.classList.add('is-active-guide-group');
    }

    // Make sure guide-group items are tagged whenever the sidebar/tree is rebuilt
    function initGuideGroupUi() {
        markGuideGroupItems();
        applyGuideGroupHighlightByUrl(location.href);
    }

    // Initial run
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGuideGroupUi);
    } else {
        initGuideGroupUi();
    }

    // Re-run after AJAX guide loads
    window.addEventListener('guides:loaded', (e) => {
        const url = e.detail?.url || location.href;

        // slight delay lets sidebar/tree state settle first
        setTimeout(() => {
            markGuideGroupItems();
            applyGuideGroupHighlightByUrl(url);
        }, 0);
    });

    // Re-run after hard reload / restore logic finishes opening the path
    window.addEventListener('load', () => {
        setTimeout(() => {
            markGuideGroupItems();
            applyGuideGroupHighlightByUrl(location.href);
        }, 900);
    });

    // Also keep it correct when clicking normal guide links
    document.addEventListener(
        'click',
        (e) => {
            const guideLink = e.target.closest(GUIDE_LINK_SELECTOR);
            if (!guideLink) return;

            const href = guideLink.getAttribute('href');
            if (!href) return;

            setTimeout(() => {
                applyGuideGroupHighlightByUrl(href);
            }, 0);
        },
        true,
    );
})();

window.hydrateGuide = function hydrateGuide() {
    const rawEl = document.getElementById('guide-raw');
    const outEl = document.getElementById('guide-output');

    if (!rawEl || !outEl) return;

    let raw = rawEl.children.length
        ? Array.from(rawEl.children)
            .map((el) => el.textContent)
            .join('\n\n')
        : rawEl.textContent;

    let html = raw;

    const scope = '#guide-output';

    html = html.replace(
        /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
        (match, css) => {
            const scoped = css.replace(
                /(^|})(\s*[^@}{][^{]*\{)/g,
                (fullMatch, brace, selectorBlock) => {
                    return (
                        brace +
                        selectorBlock.replace(
                            /(^\s*)([^{}]+)\{/,
                            (selectorMatch, whitespace, selectors) =>
                                whitespace +
                                selectors
                                    .split(',')
                                    .map((selector) => `${scope} ${selector.trim()}`)
                                    .join(', ') +
                                ' {'
                        )
                    );
                }
            );

            return `<style>${scoped}</style>`;
        }
    );

    outEl.innerHTML = html;
};

if (document.readyState === 'loading') {
    document.addEventListener(
        'DOMContentLoaded',
        () => window.hydrateGuide?.(),
        { once: true }
    );
} else {
    window.hydrateGuide?.();
}

document.addEventListener('DOMContentLoaded', () => {
    const BTN_SELECTOR = '.guides-action-btn-wrapper';
    const SIDEBAR_SELECTOR = '.guides-sidebar';
    const ACTIVE_CLASS = 'is-active';

    const TOOLTIP_TEXT = {
        view: 'Reading mode',
        print: 'Print',
        link: 'Copy link',
    };

    function getAction(btn) {
        return btn?.getAttribute('data-guide-action');
    }

    function getTooltip(btn) {
        return btn?.querySelector('.guides-action-tooltip');
    }

    function setTooltip(btn, text) {
        const tooltip = getTooltip(btn);
        if (tooltip) tooltip.textContent = text;
    }

    function showTooltip(btn) {
        const tooltip = getTooltip(btn);
        if (!tooltip) return;
        tooltip.style.opacity = '1';
        tooltip.style.visibility = 'visible';
    }

    function hideTooltip(btn) {
        const tooltip = getTooltip(btn);
        if (!tooltip) return;
        tooltip.style.opacity = '';
        tooltip.style.visibility = '';
    }

    function setReadingMode(isActive) {
        const sidebar = document.querySelector(SIDEBAR_SELECTOR);
        const viewBtn = document.querySelector('[data-guide-action="view"]');

        if (sidebar) {
            sidebar.style.display = isActive ? 'none' : '';
        }

        if (viewBtn) {
            viewBtn.classList.toggle(ACTIVE_CLASS, isActive);
            viewBtn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        }

        document.documentElement.classList.toggle('is-reading-mode', isActive);
    }

    async function copyCurrentLink(btn) {
        const url = window.location.href;

        try {
            await navigator.clipboard.writeText(url);

            const confirm = btn.querySelector('.guides-action-btn-tooltip-confirm');

            if (confirm) {
                confirm.style.opacity = '1';
                confirm.style.visibility = 'visible';

                setTimeout(() => {
                    confirm.style.opacity = '';
                    confirm.style.visibility = '';
                }, 1200);
            }

            setTooltip(btn, 'Copied');
            showTooltip(btn);
            btn.classList.add(ACTIVE_CLASS);

            setTimeout(() => {
                btn.classList.remove(ACTIVE_CLASS);
                setTooltip(btn, TOOLTIP_TEXT.link);
            }, 1200);
        } catch (err) {
            console.error('[Guides] Copy link failed', err);

            setTooltip(btn, 'Copy failed');
            showTooltip(btn);

            setTimeout(() => {
                setTooltip(btn, TOOLTIP_TEXT.link);
            }, 1200);
        }
    }

    function flashActive(btn) {
        btn.classList.add(ACTIVE_CLASS);
        setTimeout(() => btn.classList.remove(ACTIVE_CLASS), 400);
    }

    async function printGuide() {
        const content = document.querySelector('.guides-content');

        if (!content) {
            window.print();
            return;
        }

        const images = Array.from(content.querySelectorAll('img'));

        await Promise.all(
            images.map((img) => {
                if (img.complete && img.naturalWidth > 0) return Promise.resolve();

                return new Promise((resolve) => {
                    img.addEventListener('load', resolve, { once: true });
                    img.addEventListener('error', resolve, { once: true });
                    setTimeout(resolve, 3000);
                });
            }),
        );

        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        window.print();
    }

    function runAction(btn) {
        const action = getAction(btn);
        if (!action) return;

        if (action === 'view') {
            const isActive = btn.classList.contains(ACTIVE_CLASS);
            setReadingMode(!isActive);
            return;
        }

        if (action === 'print') {
            flashActive(btn);

            printGuide().catch((err) => {
                console.error('[Guides] Print failed', err);
                window.print();
            });

            return;
        }

        if (action === 'link') {
            copyCurrentLink(btn);
        }
    }

    document.querySelectorAll(BTN_SELECTOR).forEach((btn) => {
        const action = getAction(btn);
        if (!action) return;

        btn.setAttribute('role', 'button');
        btn.setAttribute('tabindex', '0');

        if (action === 'view') {
            btn.setAttribute('aria-pressed', btn.classList.contains(ACTIVE_CLASS) ? 'true' : 'false');
        }

        setTooltip(btn, TOOLTIP_TEXT[action] || '');

        btn.addEventListener('mouseenter', () => showTooltip(btn));
        btn.addEventListener('mouseleave', () => hideTooltip(btn));
        btn.addEventListener('focus', () => showTooltip(btn));
        btn.addEventListener('blur', () => hideTooltip(btn));

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            runAction(btn);
        });

        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                runAction(btn);
            }
        });
    });
});

// #region Helpers

function getAvailableFaqs() {
    return new Set(Array
        .from(document.querySelectorAll('.guides-tree a[fs-list-element="item-link"][href^="/faq/"]'))
        .map(link => { return link.pathname.split('/').pop(); }));
}

// #endregion