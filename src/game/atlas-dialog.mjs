// The exchange already provides a higher modal layer for FX. Keep the atlas
// sheet inside the screen so that the exchange can suspend it with screen.inert.
const focusables = 'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex]';
let current = null;
let previous = null;
let trigger = null;

function descriptor(element, root) {
  if (!root?.contains(element)) return null;
  return {
    element, id: element.id, action: element.dataset.act, value: element.dataset.value,
    query: element.matches('.atlas-query'), initial: element.hasAttribute('data-atlas-initial'),
    heading: element.matches('h1,h2,h3,h4,h5,h6') ? element.tagName.toLowerCase() : null,
    position: [...root.querySelectorAll(focusables)].indexOf(element),
  };
}

function resolve(saved, root, byPosition = false) {
  if (!saved || !root) return null;
  if (root.contains(saved.element)) return saved.element;
  if (saved.id) {
    const found = root.querySelector('#' + CSS.escape(saved.id));
    if (found) return found;
  }
  if (saved.query) return root.querySelector('.atlas-query');
  if (saved.initial || saved.heading) {
    const label = root.querySelector(saved.initial ? '[data-atlas-initial]' : saved.heading);
    if (label && !label.matches(focusables)) label.tabIndex = -1;
    if (label) return label;
  }
  if (saved.action) {
    const found = [...root.querySelectorAll('[data-act]')].find(node =>
      node.dataset.act === saved.action && node.dataset.value === saved.value && typeof node.focus === 'function' &&
      (node.tabIndex >= 0 || node.hasAttribute('tabindex')));
    if (found) return found;
  }
  return byPosition ? root.querySelectorAll(focusables)[saved.position] : null;
}

const folded = value => String(value || '').normalize('NFKC').toLowerCase().trim();
const showing = node => !!(node && !node.closest('[hidden],[inert]') && node.getClientRects().length);
const rootModal = () => document.getElementById('overlay');
const covered = () => rootModal()?.hidden === false;
function focus(node) {
  if (!node || !showing(node)) return false;
  node.focus({preventScroll: true});
  return document.activeElement === node;
}

function inputResults(panel) {
  const field = panel.querySelector('.atlas-query');
  if (!field) return [];
  const terms = folded(field.value).split(/\s+/).filter(Boolean);
  const matches = [];
  for (const node of panel.querySelectorAll('.atlas-find-result')) {
    const words = folded(node.dataset.search ?? node.textContent);
    node.hidden = !terms.every(term => words.includes(term));
    if (!node.hidden) matches.push(node);
  }
  const empty = panel.querySelector('[data-search-empty]');
  if (empty) empty.hidden = matches.length !== 0;
  const count = panel.querySelector('[data-search-count]');
  const label = matches.length + '개 국가·연합';
  if (count && count.textContent !== label) count.textContent = label;
  return matches;
}

function scrollAreas(panel) {
  return [panel, ...panel.querySelectorAll('[data-atlas-scroll]')];
}

function install() {
  document.addEventListener('click', event => {
    const page = event.target.closest?.('.atlas-page');
    if (!page || event.target.closest('atlas-popover') || covered()) return;
    const element = event.target.closest('[data-act]') || document.activeElement;
    const saved = descriptor(element, page);
    trigger = saved;
    setTimeout(() => { if (trigger === saved) trigger = null; }, 0);
  }, true);

  class AtlasPopover extends HTMLElement {
    connectedCallback() {
      current = this;
      const saved = previous;
      previous = null;
      this.opener = saved?.opener || trigger || descriptor(document.activeElement, this.closest('.atlas-page'));
      this.locked = new Set();
      this.events = new AbortController();
      queueMicrotask(() => {
        if (!this.isConnected || current !== this) return;
        this.panel = this.querySelector('.atlas-dialog');
        if (!this.panel) return;
        const same = saved?.key === this.dataset.key ? saved : null;
        this.last = same?.last;
        this.panel.setAttribute('role', 'dialog');
        this.panel.setAttribute('aria-modal', 'true');
        const field = this.panel.querySelector('.atlas-query');
        if (field && same) field.value = same.query;
        inputResults(this.panel);
        if (same) {
          scrollAreas(this.panel).forEach((el, n) => {
            const pos = same.scrolls[n];
            if (pos) { el.scrollLeft = pos[0]; el.scrollTop = pos[1]; }
          });
          if (field && same.selection && field.setSelectionRange) field.setSelectionRange(...same.selection);
        }
        const options = {signal: this.events.signal};
        // Detached elements report a scroll offset of zero. Take the snapshot
        // while layout still exists, including immediately before routed actions.
        const saveScroll = () => { this.scrolls = scrollAreas(this.panel).map(el => [el.scrollLeft, el.scrollTop]); };
        saveScroll();
        this.addEventListener('scroll', saveScroll, {...options, capture: true, passive: true});
        document.addEventListener('click', saveScroll, {...options, capture: true});
        document.addEventListener('keydown', saveScroll, {...options, capture: true});
        this.addEventListener('input', e => { if (e.target.matches('.atlas-query')) inputResults(this.panel); }, options);
        this.addEventListener('click', e => {
          if (!covered() && (e.target === this || e.target.matches('[data-atlas-backdrop]'))) this.close();
        }, options);
        document.addEventListener('keydown', e => this.onKey(e), {...options, capture: true});
        document.addEventListener('focusin', e => {
          if (covered()) return;
          if (this.panel.contains(e.target)) this.last = descriptor(e.target, this.panel);
          else this.focusInside();
        }, options);
        const root = rootModal();
        if (root) {
          this.observer = new MutationObserver(() => {
            if (covered() || !this.isConnected) return;
            this.lockBackground();
            if (!this.panel.contains(document.activeElement)) this.focusInside();
          });
          this.observer.observe(root, {attributes: true, attributeFilter: ['hidden']});
        }
        if (!covered()) { this.lockBackground(); this.focusInside(); }
      });
    }

    lockBackground() {
      for (let node = this; node?.parentElement; node = node.parentElement) {
        for (const sibling of node.parentElement.children) {
          if (sibling === node || sibling.inert || sibling.matches('#overlay,#toast,script,style,link')) continue;
          sibling.inert = true;
          this.locked.add(sibling);
        }
        if (node.parentElement.id === 'frame' || node.parentElement === document.body) break;
      }
    }

    disconnectedCallback() {
      this.events?.abort();
      this.observer?.disconnect();
      if (current === this) current = null;
      for (const el of this.locked || []) {
        // These roots remain owned by the app while its own modal is open.
        if (covered() && el.matches('#tabbar,#screen')) continue;
        el.inert = false;
      }
      if (!this.panel) return;
      const field = this.panel.querySelector('.atlas-query');
      const saved = {
        key: this.dataset.key, last: this.last, opener: this.opener, query: field?.value || '',
        selection: field?.selectionStart != null ? [field.selectionStart, field.selectionEnd] : null,
        scrolls: this.scrolls || [],
      };
      previous = saved;
      queueMicrotask(() => {
        if (current || previous !== saved) return;
        previous = null;
        const page = document.querySelector('.atlas-page');
        if (!page || covered()) return;
        if (!focus(resolve(saved.opener, page))) focus(page.querySelector('.atlas-launch-search'));
      });
    }

    focusInside() {
      if (!this.panel || covered()) return;
      if (focus(resolve(this.last, this.panel, true))) return;
      const start = this.panel.querySelector('.atlas-query') || this.panel.querySelector('[data-atlas-initial]') ||
        this.panel.querySelector('h1,h2,h3') || this.panel;
      if (!start.matches(focusables)) start.tabIndex = -1;
      if (!focus(start)) focus(this.panel.querySelector('.atlas-dismiss'));
    }

    close() {
      if (this.closing) return;
      this.closing = true;
      this.panel.querySelector('.atlas-dismiss')?.click();
      queueMicrotask(() => { this.closing = false; });
    }

    onKey(e) {
      if (covered() || e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.close();
        return;
      }
      if (e.key === 'Tab') {
        const items = [...this.panel.querySelectorAll(focusables)].filter(el => el.tabIndex >= 0 && showing(el));
        const index = items.indexOf(document.activeElement);
        if (!items.length || (e.shiftKey ? index <= 0 : index === items.length - 1 || !this.panel.contains(document.activeElement))) {
          e.preventDefault();
          focus(e.shiftKey ? items.at(-1) : items[0]);
        }
        return;
      }
      const query = e.target.closest?.('.atlas-query');
      const result = e.target.closest?.('.atlas-find-result');
      if ((!query && !result) || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && !(query && e.key === 'Enter')) return;
      const items = [...this.panel.querySelectorAll('.atlas-find-result')].filter(showing);
      if (!items.length) return;
      e.preventDefault();
      if (e.key === 'Enter') { items[0].click(); return; }
      const index = items.indexOf(result);
      const next = e.key === 'ArrowDown' ? items[Math.min(items.length - 1, index + 1)] :
        index > 0 ? items[index - 1] : this.panel.querySelector('.atlas-query');
      if (focus(next)) next.scrollIntoView({block: 'nearest', inline: 'nearest'});
    }
  }
  customElements.define('atlas-popover', AtlasPopover);
}

if (typeof customElements !== 'undefined' && !customElements.get('atlas-popover')) install();
