(() => {
  let activeIndex = null;
  let lastPoints = [];

  const pointDate = (point) => point.date ? new Date(point.date) : new Date(point.dt * 1000);

  window.drawTideChart = function drawTideChartDetailed(points) {
    lastPoints = points || [];
    const canvas = document.getElementById('tideChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    const cssWidth = Math.max(canvas.clientWidth, 320);
    const cssHeight = cssWidth < 600 ? 340 : 360;
    const width = cssWidth * ratio;
    const height = cssHeight * ratio;
    canvas.width = width;
    canvas.height = height;
    canvas.style.height = `${cssHeight}px`;
    ctx.clearRect(0, 0, width, height);

    if (lastPoints.length < 2) {
      ctx.fillStyle = '#9eb4c8';
      ctx.font = `${14 * ratio}px Manrope`;
      ctx.fillText('No tide curve available', 20 * ratio, 45 * ratio);
      return;
    }

    const left = 68 * ratio;
    const right = 22 * ratio;
    const top = 34 * ratio;
    const bottom = 70 * ratio;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const heights = lastPoints.map((p) => Number(p.height));
    const rawMin = Math.min(...heights);
    const rawMax = Math.max(...heights);
    const padding = Math.max((rawMax - rawMin) * 0.12, 0.05);
    const min = rawMin - padding;
    const max = rawMax + padding;
    const range = max - min || 1;
    const unit = typeof unitConfig === 'function' ? unitConfig().wave : 'm';
    const xy = lastPoints.map((p, i) => ({
      x: left + i * plotWidth / (lastPoints.length - 1),
      y: top + plotHeight - (Number(p.height) - min) * plotHeight / range,
      point: p
    }));

    ctx.font = `${11 * ratio}px Manrope`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const value = max - i * range / 5;
      const y = top + i * plotHeight / 5;
      ctx.strokeStyle = 'rgba(158,180,200,.18)';
      ctx.lineWidth = ratio;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(width - right, y);
      ctx.stroke();
      ctx.fillStyle = '#9eb4c8';
      ctx.fillText(`${value.toFixed(2)} ${unit}`, left - 8 * ratio, y);
    }

    const timeLabels = cssWidth < 600 ? 7 : 13;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let tick = 0; tick < timeLabels; tick++) {
      const index = Math.round(tick * (lastPoints.length - 1) / (timeLabels - 1));
      const dt = pointDate(lastPoints[index]);
      const x = left + index * plotWidth / (lastPoints.length - 1);
      ctx.strokeStyle = 'rgba(158,180,200,.16)';
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + plotHeight);
      ctx.stroke();
      ctx.fillStyle = '#d7e5f1';
      ctx.font = `${11 * ratio}px Manrope`;
      ctx.fillText(dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), x, top + plotHeight + 10 * ratio);
      ctx.fillStyle = '#829bb0';
      ctx.font = `${10 * ratio}px Manrope`;
      ctx.fillText(dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }), x, top + plotHeight + 27 * ratio);
    }

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#5ee7e7');
    gradient.addColorStop(1, '#52b7ff');
    ctx.beginPath();
    ctx.moveTo(xy[0].x, top + plotHeight);
    xy.forEach(({ x, y }) => ctx.lineTo(x, y));
    ctx.lineTo(xy[xy.length - 1].x, top + plotHeight);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, top, 0, top + plotHeight);
    fill.addColorStop(0, 'rgba(82,183,255,.36)');
    fill.addColorStop(1, 'rgba(82,183,255,.02)');
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.beginPath();
    xy.forEach(({ x, y }, i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3 * ratio;
    ctx.stroke();

    for (let i = 1; i < xy.length - 1; i++) {
      const previous = heights[i - 1];
      const current = heights[i];
      const next = heights[i + 1];
      if (!((current > previous && current > next) || (current < previous && current < next))) continue;
      const high = current > previous && current > next;
      const { x, y } = xy[i];
      const dt = pointDate(lastPoints[i]);
      ctx.fillStyle = high ? '#5ee7e7' : '#52b7ff';
      ctx.beginPath();
      ctx.arc(x, y, 5 * ratio, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#eaf6ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = high ? 'bottom' : 'top';
      ctx.font = `600 ${10 * ratio}px Manrope`;
      const labelY = y + (high ? -9 : 9) * ratio;
      ctx.fillText(`${high ? 'High' : 'Low'} ${current.toFixed(2)} ${unit}`, x, labelY);
      ctx.font = `${9 * ratio}px Manrope`;
      ctx.fillStyle = '#9eb4c8';
      ctx.fillText(dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), x, labelY + (high ? -13 : 13) * ratio);
    }

    if (activeIndex !== null && xy[activeIndex]) {
      const selected = xy[activeIndex];
      const dt = pointDate(selected.point);
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = ratio;
      ctx.setLineDash([5 * ratio, 4 * ratio]);
      ctx.beginPath();
      ctx.moveTo(selected.x, top);
      ctx.lineTo(selected.x, top + plotHeight);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(selected.x, selected.y, 6 * ratio, 0, Math.PI * 2);
      ctx.fill();

      const line1 = dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      const line2 = `${dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · ${Number(selected.point.height).toFixed(2)} ${unit}`;
      ctx.font = `600 ${12 * ratio}px Manrope`;
      const boxWidth = 150 * ratio;
      const boxHeight = 48 * ratio;
      let boxX = selected.x + 12 * ratio;
      if (boxX + boxWidth > width - right) boxX = selected.x - boxWidth - 12 * ratio;
      let boxY = selected.y - boxHeight - 14 * ratio;
      if (boxY < top) boxY = selected.y + 14 * ratio;
      ctx.fillStyle = 'rgba(7,26,45,.96)';
      ctx.strokeStyle = 'rgba(94,231,231,.55)';
      ctx.lineWidth = ratio;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 8 * ratio);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#9eb4c8';
      ctx.font = `${10 * ratio}px Manrope`;
      ctx.fillText(line1, boxX + 10 * ratio, boxY + 8 * ratio);
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${12 * ratio}px Manrope`;
      ctx.fillText(line2, boxX + 10 * ratio, boxY + 25 * ratio);
    }

    canvas.onpointermove = (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * ratio;
      activeIndex = Math.max(0, Math.min(lastPoints.length - 1, Math.round((x - left) * (lastPoints.length - 1) / plotWidth)));
      window.drawTideChart(lastPoints);
    };
    canvas.onpointerleave = () => {
      activeIndex = null;
      window.drawTideChart(lastPoints);
    };
    canvas.onclick = (event) => canvas.onpointermove(event);
  };

  const refresh = () => {
    if (typeof state !== 'undefined' && state.tide) window.drawTideChart((state.tide.heights || []).slice(0, 96));
  };
  setTimeout(refresh, 1200);
  document.querySelector('[data-tab="tides"]')?.addEventListener('click', () => setTimeout(refresh, 50));
})();