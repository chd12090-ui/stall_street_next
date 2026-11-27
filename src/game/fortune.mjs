export function bindFortuneLever(root, onPull) {
  let held = null;
  let suppressClick = false;
  function drag(event) {
    const distance = Math.max(0, event.clientY - held.start);
    held.progress = Math.min(1, distance / held.range);
    held.moved ||= Math.abs(event.clientY - held.start) > 5;
    held.node.style.setProperty('--lever-position', held.progress * 100 + '%');
  }
  function release(event, pulled) {
    if (!held || event.pointerId !== held.id) return;
    if (pulled) drag(event);
    const {node, progress, moved} = held;
    held = null;
    suppressClick = moved || !pulled;
    node.classList.remove('is-dragging');
    const reset = () => node.style.removeProperty('--lever-position');
    if (pulled && progress >= .22) void Promise.resolve(onPull(progress)).finally(reset);
    else reset();
  }
  root.addEventListener('pointerdown', event => {
    const node = event.target.closest('[data-slot-lever]');
    if (!node || node.disabled || event.button !== 0 || held) return;
    const range = node.querySelector('.fortune-lever-groove').getBoundingClientRect().height;
    if (!range) return;
    suppressClick = false;
    held = {node, id:event.pointerId, start:event.clientY, range, progress:0, moved:false};
    node.classList.add('is-dragging');
    node.setPointerCapture(event.pointerId);
  });
  root.addEventListener('pointermove', event => {
    if (held && event.pointerId === held.id) drag(event);
  });
  root.addEventListener('pointerup', event => release(event, true));
  root.addEventListener('pointercancel', event => release(event, false));
  root.addEventListener('lostpointercapture', event => release(event, false));
  root.addEventListener('click', event => {
    if (suppressClick && (event.detail || event.pointerType) && event.target.closest('[data-slot-lever]')) {
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}
