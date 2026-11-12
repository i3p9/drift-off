import test from "node:test";
import assert from "node:assert/strict";
import { initializePreferences } from "../src/preferences.js";

class Control extends EventTarget {
  focus(options) {
    document.activeElement = this;
    this.focusOptions = options;
  }
}

class Dialog extends Control {
  open = false;
  shows = 0;
  content = { scrollTop: 100 };

  showModal() {
    this.open = true;
    this.shows++;
  }

  close() {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  }

  querySelector() {
    return this.content;
  }

  getBoundingClientRect() {
    return { left: 100, right: 400, top: 100, bottom: 600 };
  }
}

function setup(t, { mobile = true, path = "/?welcome=1#home", reloaded = false } = {}) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const screen = new EventTarget();
  screen.matches = mobile;
  const page = new EventTarget();
  const url = (path) => new URL(path, "https://example.invalid");
  const entries = reloaded
    ? [
        { url: url("/"), state: null },
        { url: url(path), state: { driftPreferences: true } },
      ]
    : [{ url: url(path), state: null }];
  let index = entries.length - 1;
  page.location = entries[index].url;
  page.matchMedia = () => screen;
  page.history = {
    backCalls: 0,
    get state() {
      return entries[index].state;
    },
    get length() {
      return entries.length;
    },
    pushState(state, _title, path) {
      entries.splice(index + 1, entries.length, { url: url(path), state });
      index++;
      page.location = entries[index].url;
    },
    replaceState(state, _title, path) {
      entries[index] = { url: url(path), state };
      page.location = entries[index].url;
    },
    go(offset) {
      queueMicrotask(() => {
        if (!entries[index + offset]) return;
        index += offset;
        page.location = entries[index].url;
        page.dispatchEvent(new Event("popstate"));
      });
    },
    back() {
      this.backCalls++;
      this.go(-1);
    },
    forward() {
      this.go(1);
    },
  };
  const doc = { title: "Drift · bedtime scenes" };
  Object.defineProperty(globalThis, "window", { configurable: true, value: page });
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else delete globalThis.window;
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
    else delete globalThis.document;
  });
  const button = new Control();
  const closeButton = new Control();
  const heading = new Control();
  const dialog = new Dialog();
  let syncs = 0;
  initializePreferences({ button, closeButton, heading, dialog, onOpen: () => syncs++ });
  return { page, screen, doc, button, closeButton, heading, dialog, syncs: () => syncs };
}

const click = (control) => control.dispatchEvent(new Event("click"));

test("mobile preferences create one history entry and focus the title instead of Done", (t) => {
  const { page, doc, button, dialog, heading, syncs } = setup(t);
  click(button);
  click(button);
  assert.equal(page.location.pathname, "/preferences");
  assert.equal(page.history.length, 2);
  assert.equal(dialog.open, true);
  assert.equal(dialog.content.scrollTop, 0);
  assert.equal(doc.title, "Preferences · Drift");
  assert.equal(doc.activeElement, heading);
  assert.deepEqual(heading.focusOptions, { preventScroll: true });
  assert.equal(syncs(), 1);
});

test("rapid Back taps return once to the original URL and restore focus without scrolling", async (t) => {
  const { page, doc, button, closeButton, dialog } = setup(t);
  click(button);
  click(closeButton);
  click(closeButton);
  await Promise.resolve();
  assert.equal(page.history.backCalls, 1);
  assert.equal(
    page.location.pathname + page.location.search + page.location.hash,
    "/?welcome=1#home",
  );
  assert.equal(dialog.open, false);
  assert.equal(doc.title, "Drift · bedtime scenes");
  assert.equal(doc.activeElement, button);
  assert.deepEqual(button.focusOptions, { preventScroll: true });
});

test("browser Back and Forward close and reopen preferences without extra history entries", async (t) => {
  const { page, button, dialog, syncs } = setup(t);
  click(button);
  page.history.back();
  await Promise.resolve();
  assert.equal(dialog.open, false);
  dialog.content.scrollTop = 200;
  page.history.forward();
  await Promise.resolve();
  assert.equal(dialog.open, true);
  assert.equal(dialog.content.scrollTop, 0);
  assert.equal(page.history.length, 2);
  assert.equal(syncs(), 2);
});

for (const path of ["/preferences", "/preferences/"]) {
  test("a direct link to " + path + " returns home instead of leaving the app", (t) => {
    const { page, closeButton, dialog } = setup(t, { path });
    assert.equal(dialog.open, true);
    click(closeButton);
    assert.equal(dialog.open, false);
    assert.equal(page.location.pathname, "/");
    assert.equal(page.history.backCalls, 0);
    assert.equal(page.history.length, 1);
  });
}

test("a refreshed app-created preferences entry still returns through browser history", async (t) => {
  const { page, closeButton, dialog } = setup(t, { path: "/preferences", reloaded: true });
  click(closeButton);
  await Promise.resolve();
  assert.equal(dialog.open, false);
  assert.equal(page.history.backCalls, 1);
  assert.equal(page.location.pathname, "/");
});

test("desktop preferences remain a modal without changing the URL, including Escape", (t) => {
  const { page, button, dialog } = setup(t, { mobile: false });
  const originalUrl = page.location.href;
  click(button);
  assert.equal(page.location.href, originalUrl);
  assert.equal(page.history.length, 1);
  const cancel = new Event("cancel", { cancelable: true });
  dialog.dispatchEvent(cancel);
  assert.equal(cancel.defaultPrevented, true);
  assert.equal(dialog.open, false);
  assert.equal(page.location.href, originalUrl);
});

test("Escape on mobile closes the route through Back", async (t) => {
  const { page, button, dialog } = setup(t);
  click(button);
  dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
  await Promise.resolve();
  assert.equal(dialog.open, false);
  assert.equal(page.location.pathname, "/");
});

test("resizing an open desktop panel to mobile adds its route only once", async (t) => {
  const { page, screen, button, closeButton, dialog } = setup(t, { mobile: false });
  click(button);
  screen.matches = true;
  screen.dispatchEvent(new Event("change"));
  assert.equal(page.location.pathname, "/preferences");
  screen.matches = false;
  screen.dispatchEvent(new Event("change"));
  assert.equal(page.history.length, 2);
  assert.equal(dialog.shows, 1);
  click(closeButton);
  await Promise.resolve();
  assert.equal(dialog.open, false);
  assert.equal(page.location.pathname, "/");
});

test("a direct desktop link opens its panel and replaces the route when closed", (t) => {
  const { page, closeButton, dialog } = setup(t, { mobile: false, path: "/preferences" });
  assert.equal(dialog.open, true);
  click(closeButton);
  assert.equal(dialog.open, false);
  assert.equal(page.location.pathname, "/");
  assert.equal(page.history.length, 1);
});

test("desktop backdrop clicks close the panel while clicks inside keep it open", (t) => {
  const { button, dialog } = setup(t, { mobile: false });
  click(button);
  const inside = Object.assign(new Event("click"), { clientX: 200, clientY: 200 });
  dialog.dispatchEvent(inside);
  assert.equal(dialog.open, true);
  const outside = Object.assign(new Event("click"), { clientX: 50, clientY: 50 });
  dialog.dispatchEvent(outside);
  assert.equal(dialog.open, false);
});
