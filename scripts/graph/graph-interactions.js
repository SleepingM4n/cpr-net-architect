export class GraphInteractions {
  constructor(app, architecture, {
    edit = false,
    onSelect,
    onChange,
    onDrop
  } = {}) {
    Object.assign(this, {
      app,
      architecture,
      edit,
      onSelect,
      onChange,
      onDrop
    });
    this.firstView = !app.graphView;
    this.view = app.graphView ?? {
      x: 30,
      y: 30,
      scale: 0.9
    };
  }
  bind(root) {
    this.viewport = root.querySelector(".neta-viewport");
    this.world = root.querySelector(".neta-world");
    if (!this.viewport) return;
    this.transform();
    this.viewport.addEventListener("wheel", event => {
      event.preventDefault();
      const bounds = this.viewport.getBoundingClientRect(),
        x = event.clientX - bounds.left,
        y = event.clientY - bounds.top,
        old = this.view.scale;
      this.view.scale = Math.max(0.2, Math.min(2.5, old * Math.exp(-event.deltaY * 0.001)));
      this.view.x = x - (x - this.view.x) * this.view.scale / old;
      this.view.y = y - (y - this.view.y) * this.view.scale / old;
      this.transform();
    }, {
      passive: false
    });
    this.viewport.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      const el = event.target.closest("[data-node]"),
        node = el ? this.architecture.nodes.find(n => n.id === el.dataset.node) : null;
      if (node && !this.edit) return;
      const start = {
        x: event.clientX,
        y: event.clientY,
        nx: node?.x ?? this.view.x,
        ny: node?.y ?? this.view.y
      };
      let dragged = false;
      this.viewport.setPointerCapture(event.pointerId);
      const move = ev => {
        const dx = ev.clientX - start.x,
          dy = ev.clientY - start.y;
        if (Math.abs(dx) + Math.abs(dy) > 5) dragged = true;
        if (!dragged) return;
        if (node) {
          node.x = Math.round(start.nx + dx / this.view.scale);
          node.y = Math.round(start.ny + dy / this.view.scale);
          el.style.left = `${node.x}px`;
          el.style.top = `${node.y}px`;
          this.paths();
        } else {
          this.view.x = start.nx + dx;
          this.view.y = start.ny + dy;
          this.transform();
        }
      };
      const up = () => {
        this.viewport.removeEventListener("pointermove", move);
        this.viewport.removeEventListener("pointerup", up);
        if (dragged) {
          this.ignoreClick = true;
          setTimeout(() => this.ignoreClick = false, 0);
          if (node) this.onChange?.();
        } else if (node) this.onSelect?.(node.id);
      };
      this.viewport.addEventListener("pointermove", move);
      this.viewport.addEventListener("pointerup", up, {
        once: true
      });
    });
    this.viewport.querySelectorAll("[data-node]").forEach(el => {
      el.addEventListener("click", ev => {
        if (this.ignoreClick) return;
        if (!this.edit || ev.detail === 0) this.onSelect?.(el.dataset.node);
      });
      el.addEventListener("contextmenu", ev => {
        ev.preventDefault();
        this.onSelect?.(el.dataset.node, true);
      });
      if (this.edit && this.onDrop) {
        el.addEventListener("dragover", ev => ev.preventDefault());
        el.addEventListener("drop", ev => {
          ev.preventDefault();
          this.onDrop(ev, el.dataset.node);
        });
      }
    });
    if (this.firstView) this.fit();
  }
  transform() {
    this.world.style.transform = `translate(${this.view.x}px,${this.view.y}px) scale(${this.view.scale})`;
    this.app.graphView = this.view;
  }
  fit() {
    const nodes = this.architecture.nodes;
    if (!nodes.length) return;
    const minX = Math.min(...nodes.map(n => n.x)),
      minY = Math.min(...nodes.map(n => n.y)),
      maxX = Math.max(...nodes.map(n => n.x)) + 220,
      maxY = Math.max(...nodes.map(n => n.y)) + 130;
    this.view.scale = Math.min(1.3, (this.viewport.clientWidth - 70) / (maxX - minX), (this.viewport.clientHeight - 70) / (maxY - minY));
    this.view.x = 35 - minX * this.view.scale;
    this.view.y = 35 - minY * this.view.scale;
    this.transform();
  }
  paths() {
    const map = new Map(this.architecture.nodes.map(n => [n.id, n]));
    for (const e of this.architecture.edges) {
      const a = map.get(e.from),
        b = map.get(e.to),
        el = this.world.querySelector(`[data-edge="${CSS.escape(e.id)}"]`);
      if (el) {
        const x = a.x + 100,
          y = a.y + 55,
          xx = b.x + 100,
          yy = b.y + 55;
        el.setAttribute("d", `M ${x} ${y} C ${(x + xx) / 2} ${y}, ${(x + xx) / 2} ${yy}, ${xx} ${yy}`);
      }
    }
  }
}
