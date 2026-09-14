import { ID, escapeHTML as e, setting, log } from "../constants.js";
export const button = (action, label, attrs = "") => `<button type="button" data-action="${action}" ${attrs}>${e(label)}</button>`;
export const options = (values, selected) => values.map(v => {
  const [id, label] = Array.isArray(v) ? v : [v, v];
  return `<option value="${e(id)}" ${id === selected ? "selected" : ""}>${e(label)}</option>`;
}).join("");
export const field = (name, label, value = "", type = "text") => `<label>${e(label)}<input name="${name}" type="${type}" value="${e(value)}"></label>`;
export const check = (name, label, value) => `<label class="neta-check"><input name="${name}" type="checkbox" ${value ? "checked" : ""}>${e(label)}</label>`;
export function formDialog(title, content, label = "Save") {
  return new Promise(resolve => {
    let submitted = false;
    new Dialog({
      title,
      content: `<form class="neta-form">${content}</form>`,
      buttons: {
        save: {
          label,
          callback: html => {
            const form = html[0].querySelector("form");
            if (!form.reportValidity()) return;
            submitted = true;
            const data = Object.fromEntries(new FormData(form));
            for (const el of form.querySelectorAll('[type="checkbox"]')) data[el.name] = el.checked;
            resolve(data);
          }
        },
        cancel: {
          label: "Cancel",
          callback: () => resolve(null)
        }
      },
      default: "save",
      close: () => {
        if (!submitted) resolve(null);
      }
    }, {
      width: 520,
      classes: ["neta-dialog"]
    }).render(true);
  });
}
export class NETApplication extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["neta-window"],
      width: 1120,
      height: 760,
      resizable: true,
      scrollY: [".neta-inspector", ".neta-run-sidebar", ".neta-combat-layout"],
      template: `modules/${ID}/templates/application.hbs`
    });
  }
  constructor(options = {}) {
    super(options);
    this.root = null;
  }
  async getData() {
    return {
      body: ""
    };
  }
  activateListeners(html) {
    super.activateListeners(html);
    this.root = html[0];
    this.root.style.setProperty("--neta-scale", setting("uiScale"));
    this.root.classList.toggle("neta-reduced", setting("reducedMotion") || matchMedia("(prefers-reduced-motion: reduce)").matches || !setting("animations"));
    this.root.style.setProperty("--neta-intensity", setting("intensity"));
    html.find("[data-action]").on("click", event => {
      if (event.currentTarget.closest(".neta-journal-body")) return;
      event.preventDefault();
      const target = event.currentTarget;
      if (target.disabled) return;
      target.disabled = true;
      Promise.resolve(this.action(target.dataset.action, target, event)).catch(log.error).finally(() => {
        target.disabled = false;
      });
    });
  }
  async action() {}
}
