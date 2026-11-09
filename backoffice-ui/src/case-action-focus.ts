export function focusCaseAction(route: "offer" | "production", selector: string): void {
  const focus = () => {
    const element = document.querySelector<HTMLElement>(selector);
    for (let parent = element?.parentElement; parent; parent = parent.parentElement) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
    }
    element?.focus({ preventScroll: true });
    element?.scrollIntoView?.({ block: "start", inline: "nearest", behavior: "auto" });
  };
  if (route === "production") {
    window.dispatchEvent(new CustomEvent("production:reveal", { detail: { selector } }));
    window.requestAnimationFrame(focus);
  } else {
    focus();
  }
}
