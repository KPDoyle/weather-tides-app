(() => {
  let activeIndex = null;
  let lastPoints = [];

  const pointDate = (point) => point.date ? new Date(point.date) : new Date(Number(point.dt) * 1000);
  const pointTime = (point) => pointDate(point).getTime();

  function upcomingPoints(points) {
    const valid = (points || [])
      .map(point => ({ ...point, height: Number(point.height) }))
      .filter(point => Number.isFinite(point.height) && Number.isFinite(pointTime(point)))
      .sort((a, b) => pointTime(a) - pointTime(b));

    if (valid.length < 2) return valid;

    const now = Date.now();
    let start = valid.findIndex(point => pointTime(point) >= now);
    if (start < 0) start = Math.max(0, valid.length - 2);
    if (start > 0) {
      const before = valid[start - 1];
      const after = valid[start];
      if (Math.abs(pointTime(before) - now) < Math.abs(pointTime(after) - now)) start -= 1;
    }

    // Show approximately the next 48 hours, while retaining enough points for a smooth curve.
    const endTime = now + 48 * 60 * 60 * 1000;
    const future = valid.slice(start).filter(point => pointTime(point) <= endTime);
    return (future.length >= 2 ? future : valid.slice(start, start + 96)).slice(0, 192);
  }

  function timeTicks(points, cssWidth) {
    if (!points.length) return [];
    const start = pointDate(points[0]);
    const end = pointDate(points[points.length - 1]);
    const durationHours = Math.max(1, (end - start) / 3600000);
    const intervalHours = cssWidth < 600 ? 3 : cssWidth < 1000 ? 2 : 1;
    const ticks = [];
    let next = new Date(start);
    next.setMinutes(0, 0, 0);
    if (next < start) next.setHours(next.getHours() + 1);
    const remainder = next.getHours() % intervalHours;
    if (remainder) next.setHours(next.getHours() + intervalHours - remainder);

    while (next <= end && ticks.length < 60) {
      let closest = 0;
      let distance = Infinity;
      points.forEach((point, index) => {
        const diff = Math.abs(pointTime(point) - next.getTime());
        if (diff < distance) { distance = diff; closest = index; }
      });
      if (!ticks.length || ticks[ticks.length - 1].index !== closest) ticks.push({ index: closest, date: new Date(next) });
      next = new Date(next.getTime() + intervalHours * 3600000);
    }

    if (ticks.length < 2 && durationHours > 0) {
      return [
        { index: 0, date: pointDate(points[0]) },
        { index: points.length - 1, date: pointDate(points[points.length - 1]) }
      ];
    }
    return ticks;
  }

  window.drawTideChart = function drawTideChartDetailed(points) {
    lastPoints = upcomingPoints(points);
    const canvas = document.getElementById('tideChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    const cssWidth = Math.max(canvas.clientWidth, 320);
    const cssHeight = cssWidth < 600 ? 360 : 390;
    const width = cssWidth * ratio;
    const height = cssHeight * ratio;
    canvas.width = width;
    canvas.height = height;
    canvas.style.height = `${cssHeight}px`;
    ctx.clearRect(0, 0, width, height);

    if (lastPoints.length < 2) {
      ctx.fillStyle = '#9eb4c8';
      ctx.font = `${14 * ratio}px Manrope`;
      ctx.fillText('No upcoming tide curve available', 20 * ratio, 45 * ratio);
      return;
    }

    const left = 68 * ratio;
    const right = 22 * ratio;
    const top = 40 * ratio;
    const bottom = 78 * ratio;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const heights = lastPoints.map(p => Number(p.height));
    const rawMin = Math.min(...heights);
    const rawMax = Math.max(...heights);
    const padding = Math.max((rawMax - rawMin) * 0.12, 0.05);
    const min = rawMin - padding;
    const max = rawMax + padding;
    const range = max - min || 1;
    const unit = typeof unitConfig === 'function' ? unitConfig().wave : (typeof state !== 'undefined' && state.units === 'imperial' ? 'ft' : 'm');
    const firstTime = pointTime(lastPoints[0]);
    const lastTime = pointTime(lastPoints[lastPoints.length - 1]);
    const timeRange = Math.max(1, lastTime - firstTime);
    const xy = lastPoints.map(p => ({
      x: left + (pointTime(p) - firstTime) * plotWidth / timeRange,
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
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(width - right, y); ctx.stroke();
      ctx.fillStyle = '#9eb4c8';
      ctx.fillText(`${value.toFixed(2)} ${unit}`, left - 8 * ratio, y);
    }

    const ticks = timeTicks(lastPoints, cssWidth);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    let previousDay = '';
    ticks.forEach(({ index, date }) => {
      const x = xy[index].x;
      const dayKey = date.toLocaleDateString('en-GB');
      const dayChanged = dayKey !== previousDay;
      ctx.strokeStyle = dayChanged ? 'rgba(255,255,255,.28)' : 'rgba(158,180,200,.13)';
      ctx.lineWidth = dayChanged ? 1.5 * ratio : ratio;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + plotHeight); ctx.stroke();
      ctx.fillStyle = '#e7f2fa';
      ctx.font = `${11 * ratio}px Manrope`;
      ctx.fillText(date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), x, top + plotHeight + 10 * ratio);
      if (dayChanged) {
        ctx.fillStyle = '#8fa8bc';
        ctx.font = `600 ${10 * ratio}px Manrope`;
        ctx.fillText(date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), x, top + plotHeight + 29 * ratio);
      }
      previousDay = dayKey;
    });

    // Current-time marker at the beginning of the visible forecast.
    ctx.strokeStyle = 'rgba(94,231,231,.8)';
    ctx.lineWidth = 2 * ratio;
    ctx.beginPath(); ctx.moveTo(xy[0].x, top); ctx.lineTo(xy[0].x, top + plotHeight); ctx.stroke();
    ctx.fillStyle = '#5ee7e7';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.font = `700 ${11 * ratio}px Manrope`;
    ctx.fillText('NOW', xy[0].x + 5 * ratio, top - 7 * ratio);

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#5ee7e7'); gradient.addColorStop(1, '#52b7ff');
    ctx.beginPath(); ctx.moveTo(xy[0].x, top + plotHeight); xy.forEach(({ x, y }) => ctx.lineTo(x, y)); ctx.lineTo(xy[xy.length - 1].x, top + plotHeight); ctx.closePath();
    const fill = ctx.createLinearGradient(0, top, 0, top + plotHeight);
    fill.addColorStop(0, 'rgba(82,183,255,.36)'); fill.addColorStop(1, 'rgba(82,183,255,.02)');
    ctx.fillStyle = fill; ctx.fill();
    ctx.beginPath(); xy.forEach(({ x, y }, i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.strokeStyle = gradient; ctx.lineWidth = 3 * ratio; ctx.stroke();

    for (let i = 1; i < xy.length - 1; i++) {
      const previous = heights[i - 1], current = heights[i], next = heights[i + 1];
      if (!((current > previous && current > next) || (current < previous && current < next))) continue;
      const high = current > previous && current > next;
      const { x, y } = xy[i];
      const dt = pointDate(lastPoints[i]);
      ctx.fillStyle = high ? '#5ee7e7' : '#52b7ff'; ctx.beginPath(); ctx.arc(x, y, 5 * ratio, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#eaf6ff'; ctx.textAlign = 'center'; ctx.textBaseline = high ? 'bottom' : 'top'; ctx.font = `600 ${10 * ratio}px Manrope`;
      const labelY = y + (high ? -9 : 9) * ratio;
      ctx.fillText(`${high ? 'High' : 'Low'} ${current.toFixed(2)} ${unit}`, x, labelY);
      ctx.font = `${9 * ratio}px Manrope`; ctx.fillStyle = '#9eb4c8';
      ctx.fillText(dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), x, labelY + (high ? -13 : 13) * ratio);
    }

    if (activeIndex !== null && xy[activeIndex]) {
      const selected = xy[activeIndex];
      const dt = pointDate(selected.point);
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = ratio; ctx.setLineDash([5 * ratio, 4 * ratio]);
      ctx.beginPath(); ctx.moveTo(selected.x, top); ctx.lineTo(selected.x, top + plotHeight); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(selected.x, selected.y, 6 * ratio, 0, Math.PI * 2); ctx.fill();
      const line1 = dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      const line2 = `${dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · ${Number(selected.point.height).toFixed(2)} ${unit}`;
      const boxWidth = 160 * ratio, boxHeight = 50 * ratio;
      let boxX = selected.x + 12 * ratio; if (boxX + boxWidth > width - right) boxX = selected.x - boxWidth - 12 * ratio;
      let boxY = selected.y - boxHeight - 14 * ratio; if (boxY < top) boxY = selected.y + 14 * ratio;
      ctx.fillStyle = 'rgba(7,26,45,.96)'; ctx.strokeStyle = 'rgba(94,231,231,.55)'; ctx.lineWidth = ratio;
      ctx.beginPath(); ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 8 * ratio); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#9eb4c8'; ctx.font = `${10 * ratio}px Manrope`; ctx.fillText(line1, boxX + 10 * ratio, boxY + 8 * ratio);
      ctx.fillStyle = '#ffffff'; ctx.font = `700 ${12 * ratio}px Manrope`; ctx.fillText(line2, boxX + 10 * ratio, boxY + 26 * ratio);
    }

    canvas.onpointermove = event => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * ratio;
      const targetTime = firstTime + Math.max(0, Math.min(1, (x - left) / plotWidth)) * timeRange;
      let closest = 0, distance = Infinity;
      lastPoints.forEach((point, index) => { const diff = Math.abs(pointTime(point) - targetTime); if (diff < distance) { distance = diff; closest = index; } });
      activeIndex = closest;
      window.drawTideChart(lastPoints);
    };
    canvas.onpointerleave = () => { activeIndex = null; window.drawTideChart(lastPoints); };
    canvas.onclick = event => canvas.onpointermove(event);
  };

  const refresh = () => {
    if (typeof state !== 'undefined' && state.tide) window.drawTideChart(state.tide.heights || []);
  };
  setTimeout(refresh, 1200);
  document.querySelector('[data-tab="tides"]')?.addEventListener('click', () => setTimeout(refresh, 50));
})();